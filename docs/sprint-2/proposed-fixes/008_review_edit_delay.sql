-- FINAL CANDIDATE, UNAPPLIED. Fresh disposable staging only; not production.
-- B1: edits hide the existing public review until the next daily publication
-- batch. A pending-edit copy would preserve the old public text but needs a
-- larger product/schema design. Re-review this simpler visibility tradeoff.
-- KNOWN RISK (accepted for staging only, see staging-runbook DECISION BOX): an
-- edit removes the old published version for other viewers IMMEDIATELY, and the
-- edited version reappears only after the next daily batch: 24-48h later,
-- depending on the time of day of the edit (session TimeZone sets the day).
-- That disappearance is itself a timing signal. "Visible 24 hours after posting"
-- copy is wrong for edits. Only a real change counts as an edit: a no-op
-- upsert (same values) keeps edited_at.
begin;
set local lock_timeout = '5s';
-- Owner-only rollback metadata; no user content is copied here.
create schema if not exists herstop_rollback;
revoke all on schema herstop_rollback from public, anon, authenticated;
create table if not exists herstop_rollback.state (
  version text primary key, creator name not null, payload jsonb not null
);
revoke all on herstop_rollback.state from public, anon, authenticated;
insert into herstop_rollback.state(version,creator,payload)
select '008',current_user,jsonb_agg(pg_get_functiondef(p.oid) order by p.proname)
from pg_proc p where p.oid in (
 'public.reviews_enforce_invariants()'::regprocedure,
 'public.get_stop_reviews(text)'::regprocedure,
 'public.get_stop_review_stats(text[])'::regprocedure,
 'public.report_review(uuid,text,text)'::regprocedure,
 'public.hide_review(uuid)'::regprocedure
);
alter table public.reviews add column edited_at timestamptz;
update public.reviews set edited_at=created_at;
alter table public.reviews alter column edited_at set default now();
alter table public.reviews alter column edited_at set not null;
create or replace function public.reviews_enforce_invariants()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user in ('authenticated','anon') then
    if tg_op='INSERT' then
      new.is_hidden:=false;
      new.created_at:=now();
      new.edited_at:=now();
    else
      new.is_hidden:=old.is_hidden;
      new.created_at:=old.created_at;
      new.stop_id:=old.stop_id;
      new.user_id:=old.user_id;
      new.edited_at:=old.edited_at;
      if (to_jsonb(new)-'edited_at') is distinct from (to_jsonb(old)-'edited_at') then
        new.edited_at:=now();
      end if;
    end if;
  end if;
  return new;
end $$;
-- Guarded definition substitutions keep the original return types, grants,
-- owner, search_path and other visibility predicates. Abort on source drift.
do $$
declare signature text; definition text; old_text text; new_text text;
begin
  foreach signature in array array['public.get_stop_reviews(text)','public.get_stop_review_stats(text[])','public.report_review(uuid,text,text)','public.hide_review(uuid)'] loop
    definition:=pg_get_functiondef(signature::regprocedure);
    if signature like '%get_stop_%' then
      old_text:='r.created_at < date_trunc';
      new_text:='greatest(r.created_at, r.edited_at) < date_trunc';
    elsif signature like '%report_review%' then
      old_text:='select is_hidden, user_id, note, created_at';
      new_text:='select is_hidden, user_id, note, greatest(created_at, edited_at)';
    else
      old_text:='select is_hidden, user_id, created_at into';
      new_text:='select is_hidden, user_id, greatest(created_at, edited_at) into';
    end if;
    if strpos(definition,old_text)=0 then raise exception '008 source drift: %',signature; end if;
    execute replace(definition,old_text,new_text);
  end loop;
end $$;
commit;
