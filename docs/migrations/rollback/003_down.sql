-- SECURITY DOWNGRADE: restores 002 public review reads, including author UUIDs.
-- Only for an empty, quiesced staging review system. No CASCADE drops.
-- EXPORT FIRST: reviews, banned_users (including reasons), hidden_reviews,
-- review_reports including note snapshots. Never discard bans to pass this guard.
-- In the SAME SQL Editor session, after verifying clients are stopped:
-- set herstop.rollback_003_clients_ready = 'on';
begin;
set local lock_timeout = '5s';
lock table public.reviews in access exclusive mode;
do $$
declare t text; occupied boolean;
begin
  if to_regprocedure('public.is_caller_banned()') is not null or exists (
    select 1 from information_schema.columns where table_schema='public'
      and table_name='reviews' and column_name='edited_at'
  ) then raise exception '003 rollback refuses installed 008/009; roll them back first'; end if;
  if current_setting('herstop.rollback_003_clients_ready', true) is distinct from 'on' then
    raise exception '003 rollback requires stopped-client attestation';
  end if;
  if exists (select 1 from public.reviews) then
    raise exception '003 rollback refuses review data/privacy loss';
  end if;
  foreach t in array array['banned_users','hidden_reviews','review_reports'] loop
    if to_regclass('public.' || t) is not null then
      execute format('lock table public.%I in access exclusive mode', t);
      execute format('select exists (select 1 from public.%I)', t) into occupied;
      if occupied then raise exception '003 rollback refuses moderation data loss: %', t; end if;
    end if;
  end loop;
end $$;
drop trigger if exists reviews_enforce_invariants_trigger on public.reviews;
drop policy if exists "Authenticated users can write their own review" on public.reviews;
create policy "Authenticated users can write their own review" on public.reviews for insert with check (auth.uid() = user_id);
drop policy if exists "Authors can edit their own review" on public.reviews;
create policy "Authors can edit their own review" on public.reviews for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Authors can delete their own review" on public.reviews;
create policy "Authors can delete their own review" on public.reviews for delete using (auth.uid() = user_id);
drop policy if exists "Anyone can read visible reviews" on public.reviews;
create policy "Anyone can read visible reviews" on public.reviews for select using (is_hidden = false);
drop function if exists public.get_stop_reviews(text);
drop function if exists public.get_stop_review_stats(text[]);
drop function if exists public.report_review(uuid,text,text);
drop function if exists public.hide_review(uuid);
drop function if exists public.reviews_enforce_invariants();
drop function if exists public.is_banned(uuid);
drop function if exists public.review_publish_delay();
drop table if exists public.hidden_reviews;
drop table if exists public.review_reports;
drop table if exists public.banned_users;
alter table public.reviews drop constraint if exists reviews_user_id_stop_id_key;
commit;
