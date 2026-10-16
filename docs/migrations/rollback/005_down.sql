-- PostgreSQL cannot detect deployed app/ingestion code dependencies.
-- Refuses until the operator has stopped those clients and confirmed no code
-- path needs these columns, then IN THE SAME SESSION sets:
-- set herstop.rollback_005_columns_unused = 'on';
-- Loses updated_at history and default provider metadata. Export first.
begin;
set local lock_timeout = '5s';
lock table public.stops in access exclusive mode;
do $$
begin
  if current_setting('herstop.rollback_005_columns_unused', true) is distinct from 'on' then
    raise exception '005 rollback requires columns-unused attestation';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='stops' and column_name='source') then
    if exists (select 1 from public.stops where source <> 'manual' or source_id <> id or stop_type is not null or safety_context is not null) then
      raise exception '005 rollback refuses non-default provider data loss; undo 006 and restore/export first';
    end if;
  end if;
end $$;
drop trigger if exists stops_set_updated_at on public.stops;
drop function if exists public.set_stops_updated_at();
drop index if exists public.stops_source_source_id_key;
alter table public.stops
  drop column if exists source,
  drop column if exists source_id,
  drop column if exists stop_type,
  drop column if exists updated_at,
  drop column if exists safety_context;
commit;
