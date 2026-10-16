-- STAGING ONLY. Restores weaker pre-009 policies/functions AND captured ACLs,
-- including possibly unsafe default grants. Export first, stop all clients.
-- Requires empty user tables; never erase user data to satisfy this guard.
-- Same execution: set herstop.staging_only='on';
-- set herstop.rollback_009_clients_ready='on';
begin;
set local lock_timeout='5s';
lock table public.reviews,public.profiles,public.saved_stops,public.banned_users,
  public.review_reports,public.hidden_reviews in access exclusive mode;
do $$
declare saved jsonb; item jsonb; command text;
begin
  if to_regclass('herstop_rollback.state') is not null then
    select payload into saved from herstop_rollback.state where version='009' and creator=current_user;
  end if;
  if to_regprocedure('public.is_caller_banned()') is null and saved is null then return; end if;
  if saved is null then raise exception '009 rollback metadata/creator mismatch'; end if;
  if current_setting('herstop.staging_only',true) is distinct from 'on'
    or current_setting('herstop.rollback_009_clients_ready',true) is distinct from 'on' then
    raise exception '009 rollback requires staging-only and stopped-client attestations';
  end if;
  if exists(select 1 from public.reviews) or exists(select 1 from public.profiles)
    or exists(select 1 from public.saved_stops) or exists(select 1 from public.banned_users)
    or exists(select 1 from public.hidden_reviews) or exists(select 1 from public.review_reports) then
    raise exception '009 rollback refuses populated user/moderation tables';
  end if;
  for item in select * from jsonb_array_elements(saved->'policies') loop
    execute format('drop policy if exists %I on public.reviews',item->>'name');
    command:=format('create policy %I on public.reviews for %s to %s',item->>'name',item->>'command',item->>'roles');
    if item->>'using' is not null then command:=command||' using ('||(item->>'using')||')'; end if;
    if item->>'check' is not null then command:=command||' with check ('||(item->>'check')||')'; end if;
    execute command;
  end loop;
  for item in select * from jsonb_array_elements(saved->'functions') loop execute item->>'definition'; end loop;
  drop function if exists public.is_caller_banned();
  revoke all on all tables in schema public from public,anon,authenticated;
  revoke execute on all functions in schema public from public,anon,authenticated;
  revoke all on schema public from public,anon,authenticated;
  alter default privileges revoke all on tables from public,anon,authenticated;
  alter default privileges in schema public revoke all on tables from public,anon,authenticated;
  alter default privileges revoke all on functions from public,anon,authenticated;
  alter default privileges in schema public revoke all on functions from public,anon,authenticated;
  for command in select jsonb_array_elements_text(saved->'grants') loop execute command; end loop;
  delete from herstop_rollback.state where version='009';
end $$;
commit;
