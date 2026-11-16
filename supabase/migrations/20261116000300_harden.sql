-- Hardening after the Supabase security check.
-- Only the api_* functions are meant to be called from the website. Helper
-- functions are used inside them (they run as the owner), so nobody else needs
-- to call them directly.

alter function hash_code(text) set search_path = public;
alter function forbid_change() set search_path = public;

revoke all on function require_role(text, text[]) from public;
revoke all on function acting_guest(bigint) from public;
revoke all on function audit_row() from public;
revoke all on function forbid_change() from public;
revoke all on function hash_code(text) from public;
revoke all on function api_role(text) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function require_role(text, text[]) from anon, authenticated;
    revoke all on function acting_guest(bigint) from anon, authenticated;
    revoke all on function audit_row() from anon, authenticated;
    revoke all on function forbid_change() from anon, authenticated;
    revoke all on function hash_code(text) from anon, authenticated;
    revoke all on function api_role(text) from anon, authenticated;
    -- Belt and braces: row-level security already hides every row.
    revoke all on all tables in schema public from anon, authenticated;
    revoke all on all sequences in schema public from anon, authenticated;
  end if;
end $$;
