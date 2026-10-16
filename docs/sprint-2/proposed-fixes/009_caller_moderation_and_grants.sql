-- FINAL CANDIDATE, UNAPPLIED. After 008, fresh disposable staging only.
-- WHICH ROLE CREATES OBJECTS: the role that runs the SQL (CURRENT_USER) owns every
-- table/function made by schema.sql and 002-008. In the Supabase SQL Editor that
-- is normally postgres, but it is NOT assumed: inspect ownership and
-- pg_default_acl first (staging-runbook "Fresh-project pre-checks"), then attest.
-- Same execution: set herstop.object_creator_role = '<inspected role>';
-- All public application functions/tables must be owned by this role.
-- LIMIT: REVOKE and ALTER DEFAULT PRIVILEGES issued by postgres only touch
-- grants that postgres (or the owner it acts for) made, and only postgres's own
-- default ACLs. A grant made by another role, or a pg_default_acl row belonging
-- to another role (e.g. supabase_admin), is silently left in place: REVOKE
-- reports success and does nothing. So this file ends by asserting the
-- EFFECTIVE privileges and aborts if any client can still truncate or execute
-- something outside the allowlist. Objects created later by another role are not
-- covered; re-run the post-apply inventory after any such change.
begin;
set local lock_timeout = '5s';
do $$
begin
  if current_setting('herstop.object_creator_role',true) is distinct from current_user::text then
    raise exception '009 requires inspected object-creator role matching current_user';
  end if;
  if exists (select 1 from pg_proc where pronamespace='public'::regnamespace and proowner<>current_user::regrole)
     or exists (select 1 from pg_class where relnamespace='public'::regnamespace and relkind='r' and relowner<>current_user::regrole) then
    raise exception '009 requires a single inspected public object creator; review other owners separately';
  end if;
  if not exists (select 1 from herstop_rollback.state where version='008' and creator=current_user) then
    raise exception '009 requires 008 rollback metadata owned by this creator';
  end if;
end $$;
-- Catalog metadata only. Down restores prior effective grants for these three
-- client grantees, including global and public-schema defaults. No catalog writes.
insert into herstop_rollback.state(version,creator,payload)
select '009',current_user,jsonb_build_object(
  'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid))) from pg_proc p where p.pronamespace='public'::regnamespace),
  'policies',(select jsonb_agg(jsonb_build_object('name',polname,'command',case polcmd when 'a' then 'insert' when 'w' then 'update' when 'd' then 'delete' end,
    'using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid),
    'roles',(select string_agg(case when r=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(r)) end,',' order by r) from unnest(polroles) r)))
    from pg_policy where polrelid='public.reviews'::regclass and polcmd in ('a','w','d')),
  'grants',(select coalesce(jsonb_agg(command),'[]'::jsonb) from (
    select format('grant %s on table public.%I to %s%s',a.privilege_type,c.relname,
      case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end,
      case when a.is_grantable then ' with grant option' else '' end) command
    from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    where c.relnamespace='public'::regnamespace and c.relkind='r'
      and a.grantee in (0,'anon'::regrole,'authenticated'::regrole)
    union all
    select format('grant %s on function %s to %s%s',a.privilege_type,p.oid::regprocedure,
      case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end,
      case when a.is_grantable then ' with grant option' else '' end)
    from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where p.pronamespace='public'::regnamespace and a.grantee in (0,'anon'::regrole,'authenticated'::regrole)
    union all
    select format('grant %s on schema public to %s%s',a.privilege_type,
      case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end,
      case when a.is_grantable then ' with grant option' else '' end)
    from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
    where n.nspname='public' and a.grantee in (0,'anon'::regrole,'authenticated'::regrole)
    union all
    select format('alter default privileges for role %I %s grant %s on %s to %s%s',current_user,
      case when scope=0 then '' else 'in schema public' end,a.privilege_type,
      case when kind='f' then 'functions' else 'tables' end,
      case when a.grantee=0 then 'PUBLIC' else quote_ident(pg_get_userbyid(a.grantee)) end,
      case when a.is_grantable then ' with grant option' else '' end)
    from (values (0::oid),('public'::regnamespace::oid)) scopes(scope)
    cross join (values ('f'::"char"),('r'::"char")) kinds(kind)
    left join pg_default_acl d on d.defaclrole=current_user::regrole and d.defaclnamespace=scope and d.defaclobjtype=kind
    cross join lateral aclexplode(coalesce(d.defaclacl,case when scope=0 then acldefault(kind,current_user::regrole) else '{}'::aclitem[] end)) a
    where a.grantee in (0,'anon'::regrole,'authenticated'::regrole)
  ) grants)
);
create function public.is_caller_banned() returns boolean language sql
security definer stable set search_path = '' as $$
  select exists (select 1 from public.banned_users where user_id=auth.uid());
$$;
drop policy "Authenticated users can write their own review" on public.reviews;
create policy "Authenticated users can write their own review" on public.reviews for insert to authenticated
with check (auth.uid()=user_id and not public.is_caller_banned());
drop policy "Authors can edit their own review" on public.reviews;
create policy "Authors can edit their own review" on public.reviews for update to authenticated
using (auth.uid()=user_id) with check (auth.uid()=user_id and not public.is_caller_banned());
drop policy "Authors can delete their own review" on public.reviews;
create policy "Authors can delete their own review" on public.reviews for delete to authenticated
using (auth.uid()=user_id and is_hidden=false);
create or replace function public.report_review(p_review_id uuid,p_reason text,p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_review public.reviews%rowtype;
begin
  if v_uid is null then raise exception 'report_review requires an authenticated user'; end if;
  if public.is_caller_banned() then
    raise exception 'moderation unavailable for this account' using errcode='42501';
  end if;
  select * into v_review from public.reviews where id=p_review_id;
  if not found then raise exception 'review not found or not visible to the caller'; end if;
  if v_review.user_id<>v_uid and (v_review.is_hidden
    or greatest(v_review.created_at,v_review.edited_at)>=date_trunc('day',now()-public.review_publish_delay())
    or public.is_banned(v_review.user_id)) then
    raise exception 'review not found or not visible to the caller';
  end if;
  insert into public.review_reports(review_id,reporter_id,reason,note,review_note_snapshot)
  values(p_review_id,v_uid,p_reason,p_note,v_review.note)
  on conflict(review_id,reporter_id) do nothing;
end $$;
create or replace function public.hide_review(p_review_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_review public.reviews%rowtype;
begin
  if v_uid is null then raise exception 'hide_review requires an authenticated user'; end if;
  if public.is_caller_banned() then
    raise exception 'moderation unavailable for this account' using errcode='42501';
  end if;
  select * into v_review from public.reviews where id=p_review_id;
  if not found then raise exception 'review not found or not visible to the caller'; end if;
  if v_review.user_id=v_uid then return; end if;
  if v_review.is_hidden
    or greatest(v_review.created_at,v_review.edited_at)>=date_trunc('day',now()-public.review_publish_delay())
    or public.is_banned(v_review.user_id) then
    raise exception 'review not found or not visible to the caller';
  end if;
  insert into public.hidden_reviews(user_id,review_id) values(v_uid,p_review_id)
  on conflict(user_id,review_id) do nothing;
end $$;
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke all on public.review_reports,public.hidden_reviews,public.banned_users from public,anon,authenticated;
revoke create on schema public from public,anon,authenticated;
-- CURRENT_USER is the inspected object creator. Global/schema defaults add up.
alter default privileges revoke truncate,references,trigger on tables from public,anon,authenticated;
alter default privileges in schema public revoke truncate,references,trigger on tables from public,anon,authenticated;
alter default privileges revoke execute on functions from public,anon,authenticated;
alter default privileges in schema public revoke execute on functions from public,anon,authenticated;
-- Existing functions need explicit revokes plus a per-function allowlist.
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.get_stop_reviews(text),public.get_stop_review_stats(text[]) to anon,authenticated;
grant execute on function public.is_caller_banned(),public.report_review(uuid,text,text),
  public.hide_review(uuid),public.delete_my_account() to authenticated;
-- Trigger functions, review_publish_delay and is_banned remain owner-only.
-- Existing triggers still execute; clients cannot attach new triggers.
-- Effective-privilege check (includes PUBLIC and grants made by other roles).
do $$
declare r record;
begin
  for r in select c.relname, g.rolname from pg_class c
    cross join (values ('anon'),('authenticated')) g(rolname)
    where c.relnamespace='public'::regnamespace and c.relkind in ('r','p')
      and has_table_privilege(g.rolname,c.oid,'truncate,references,trigger') loop
    raise exception '009 privilege check: % still has truncate/references/trigger on %',r.rolname,r.relname;
  end loop;
  for r in select p.oid::regprocedure sig, g.rolname from pg_proc p
    cross join (values ('anon'),('authenticated')) g(rolname)
    where p.pronamespace='public'::regnamespace
      and has_function_privilege(g.rolname,p.oid,'execute') <> (
        p.oid in ('public.get_stop_reviews(text)'::regprocedure,'public.get_stop_review_stats(text[])'::regprocedure)
        or (g.rolname='authenticated' and p.oid in ('public.is_caller_banned()'::regprocedure,
          'public.report_review(uuid,text,text)'::regprocedure,'public.hide_review(uuid)'::regprocedure,
          'public.delete_my_account()'::regprocedure))) loop
    raise exception '009 privilege check: unexpected execute state for % on %',r.rolname,r.sig;
  end loop;
end $$;
commit;
