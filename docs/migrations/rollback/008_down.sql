-- STAGING ONLY. Security downgrade; loses edit history. Export first.
-- Requires 009_down first and zero reviews; never discard user data to proceed.
-- Same execution: set herstop.staging_only='on';
-- set herstop.rollback_008_clients_ready='on';
begin;
set local lock_timeout='5s';
lock table public.reviews in access exclusive mode;
do $$
declare definition text; saved jsonb;
begin
  if to_regprocedure('public.is_caller_banned()') is not null then
    raise exception '008 rollback requires 009_down first';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='reviews' and column_name='edited_at') then
    return;
  end if;
  if current_setting('herstop.staging_only',true) is distinct from 'on'
    or current_setting('herstop.rollback_008_clients_ready',true) is distinct from 'on' then
    raise exception '008 rollback requires staging-only and stopped-client attestations';
  end if;
  if exists (select 1 from public.reviews) then raise exception '008 rollback refuses review/edit data loss'; end if;
  if to_regclass('herstop_rollback.state') is null then raise exception '008 rollback metadata missing'; end if;
  select payload into saved from herstop_rollback.state where version='008' and creator=current_user;
  if saved is null then raise exception '008 rollback metadata/creator mismatch'; end if;
  if exists (select 1 from herstop_rollback.state where version<>'008') then
    raise exception '008 rollback requires later rollback metadata removed first';
  end if;
  for definition in select jsonb_array_elements_text(saved) loop execute definition; end loop;
  alter table public.reviews drop column edited_at;
  delete from herstop_rollback.state where version='008';
  drop table herstop_rollback.state;
  drop schema herstop_rollback; -- No CASCADE: unexpected dependencies abort.
end $$;
commit;
