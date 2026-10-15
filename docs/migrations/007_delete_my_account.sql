-- ============================================================
-- HerStop — migration 007: delete_my_account()
-- PROPOSED — NOT YET APPLIED. Requires founder review + manual run
-- in the Supabase SQL Editor. No agent should execute this against
-- the live project (see .claude/rules/supabase-rules.md).
--
-- Why: Apple App Review (guideline 5.1.1(v)) requires apps that let
-- people create an account to also let them delete it from inside
-- the app.
--
-- Depends on: 002 (profiles, saved_stops, reviews). 003 is optional
-- for this function to work, but its tables are covered below.
--
-- What it does: deletes the auth.users row of the CALLER, and nobody
-- else. The caller is `auth.uid()`, taken from the verified JWT —
-- the function takes NO arguments, so there is no id to forge.
-- Raises if there is no signed-in user.
--
-- What gets removed (verified against 002 and 003, every foreign key
-- to auth.users is `on delete cascade`):
--
--   table             column        on user delete
--   ----------------  ------------  -------------------------------
--   profiles          id            cascade -> row deleted
--   saved_stops       user_id       cascade -> rows deleted
--   reviews           user_id       cascade -> rows DELETED (see below)
--   hidden_reviews    user_id       cascade -> rows deleted
--   review_reports    reporter_id   cascade -> rows deleted
--   banned_users      user_id       cascade -> row deleted
--
-- DECISION — reviews are DELETED, not anonymized.
--   The alternative (keep the text, null out user_id) would leave
--   words a traveler wrote, about where they were and when, in the
--   database after they asked to be erased. Reviews carry no
--   user_id to other clients anyway (003), so removing them costs
--   other travelers a little data but protects the person leaving.
--   Anonymizing would need `user_id` to become nullable — a schema
--   change to a user-owned table — so it is deliberately not done.
--
-- Side effects of deleting reviews (cascade from reviews):
--   * review_reports that OTHER travelers filed against the deleted
--     reviews are removed with them (nothing left to moderate).
--   * hidden_reviews rows that other travelers made for those
--     reviews are removed too.
--   * RLS does not apply to cascades, so the 003 rule "an author
--     cannot delete a moderated (hidden) review" does not block
--     this. Accepted: moderation evidence is not worth keeping a
--     departing user's text. A banned user can therefore erase
--     their banned_users row by deleting the account — but they
--     could always just sign up again with a new email, so the
--     ban was never durable against that. Not a new hole.
--
-- Security notes:
--   * SECURITY DEFINER is required: clients have no privilege on
--     the auth schema. `set search_path = ''` and fully qualified
--     names stop search-path hijacking of a definer function.
--   * EXECUTE is revoked from PUBLIC and anon and granted only to
--     authenticated. (Postgres grants EXECUTE to PUBLIC by default,
--     so the revoke is not optional.)
--   * The delete is `where id = auth.uid()` — it cannot touch any
--     other user's row.
--   * The user's JWT stays valid until it expires (default 1h);
--     the app signs out locally right after the call.
--
-- Idempotent: `create or replace`, and revoke/grant are repeatable.
--
-- Rollback:
--   drop function if exists public.delete_my_account();
-- ============================================================

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'delete_my_account: not signed in'
      using errcode = '28000'; -- invalid_authorization_specification
  end if;

  -- Cascades remove profiles, saved_stops, reviews, hidden_reviews,
  -- review_reports and banned_users rows for this user (see table above).
  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public;
revoke execute on function public.delete_my_account() from anon;
grant  execute on function public.delete_my_account() to authenticated;
