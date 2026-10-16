-- Removes the endpoint only; cannot resurrect previously deleted accounts/data.
-- Deploy a client without account-deletion dependence before applying.
begin;
set local lock_timeout = '5s';
drop function if exists public.delete_my_account();
commit;
