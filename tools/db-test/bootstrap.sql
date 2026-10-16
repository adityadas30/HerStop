create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
$$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid(), auth.role() to anon, authenticated;
-- Explicit simulation, NOT evidence of Supabase platform default privileges.
-- Deliberately includes TRUNCATE to reproduce the dangerous grant scenario.
alter default privileges in schema public grant select, insert, update, delete, truncate on tables to anon, authenticated;
-- Broad default EXECUTE on new functions, so 009's function-grant fixes (and any
-- migration that only revokes from PUBLIC) are exercised against explicit grants.
alter default privileges in schema public grant execute on functions to anon, authenticated;
revoke create on schema public from public, anon, authenticated;
set timezone = 'UTC';
create schema test;
grant usage on schema test to anon, authenticated;
create function test.ok(p boolean, message text) returns void language plpgsql as $$
begin
  if p is distinct from true then raise exception 'ASSERT: %', message; end if;
end $$;
-- True when the caller can see no rows of the table: either RLS filters them all
-- (baseline 003) or the table privilege itself is revoked (009, SQLSTATE 42501).
create function test.no_rows_visible(tbl text) returns boolean language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from %s',tbl) into n;
  return n = 0;
exception when insufficient_privilege then
  return true;
end $$;
grant execute on function test.no_rows_visible(text) to anon, authenticated;
-- Owner-run row counts for every public table (definer: callers may lack SELECT).
create function test.public_row_counts() returns jsonb language plpgsql security definer as $$
declare t text; n bigint; result jsonb := '{}';
begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('select count(*) from public.%I',t) into n;
    result := result || jsonb_build_object(t,n);
  end loop;
  return result;
end $$;
grant execute on function test.public_row_counts() to anon, authenticated;
create function test.denied(statement text, expected_code text default '42501') returns void language plpgsql as $$
declare actual text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual = returned_sqlstate;
    if actual = expected_code then return; end if;
    raise exception 'Expected SQLSTATE %, got %', expected_code, actual;
  end;
  raise exception 'ASSERT: statement unexpectedly succeeded';
end $$;
