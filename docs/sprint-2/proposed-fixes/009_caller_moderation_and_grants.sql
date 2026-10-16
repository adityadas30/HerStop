-- PROPOSAL ONLY. Apply after proposed 008 in a disposable LOCAL rehearsal.
-- Keep arbitrary-author helper private for owner-run moderation read functions.
begin;
set local lock_timeout = '5s';
create function public.is_caller_banned() returns boolean language sql
security definer stable set search_path = '' as $$
  select exists (select 1 from public.banned_users where user_id=auth.uid());
$$;
revoke execute on function public.is_caller_banned() from public, anon;
grant execute on function public.is_caller_banned() to authenticated;
drop policy "Authenticated users can write their own review" on public.reviews;
create policy "Authenticated users can write their own review" on public.reviews for insert
with check (auth.uid()=user_id and not public.is_caller_banned());
drop policy "Authors can edit their own review" on public.reviews;
create policy "Authors can edit their own review" on public.reviews for update
using (auth.uid()=user_id) with check (auth.uid()=user_id and not public.is_caller_banned());
revoke execute on function public.is_banned(uuid) from public, anon, authenticated;
do $$
declare signature text; definition text; anchor text;
begin
  foreach signature in array array['public.report_review(uuid,text,text)','public.hide_review(uuid)'] loop
    definition:=pg_get_functiondef(signature::regprocedure);
    anchor:='  if v_uid is null then';
    if strpos(definition,anchor)=0 then raise exception '009 source drift: %',signature; end if;
    execute replace(definition,anchor,E'  if public.is_caller_banned() then\n    raise exception ''moderation unavailable for this account'' using errcode = ''42501'';\n  end if;\n' || anchor);
  end loop;
end $$;
-- RLS never protects TRUNCATE. Revoke across all app tables, not just moderation.
revoke truncate, references, trigger on all tables in schema public from public, anon, authenticated;
revoke all on public.review_reports, public.hidden_reviews, public.banned_users from public, anon, authenticated;
revoke create on schema public from public, anon, authenticated;
-- Future grants must be fixed FOR EACH actual object-creating role after
-- inspecting pg_default_acl; do not guess the Supabase platform owner role.
commit;
