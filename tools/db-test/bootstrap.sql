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
revoke create on schema public from public, anon, authenticated;
set timezone = 'UTC';
create schema test;
grant usage on schema test to anon, authenticated;
create function test.ok(p boolean, message text) returns void language plpgsql as $$
begin
  if p is distinct from true then raise exception 'ASSERT: %', message; end if;
end $$;
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
