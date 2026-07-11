-- Close privilege escalation via profile self-update.
--
-- The "Users update own profile" policy (schema.sql) row-filters on
-- auth.uid() = id but puts no restriction on WHICH columns change. RLS
-- cannot compare old vs new values, so a signed-in user could PATCH their
-- own profiles row through the REST API and either:
--   1. set role = 'admin' directly, or
--   2. set email to one of the allowlisted addresses in admin_setup.sql,
--      which the promote_admins_on_signup BEFORE UPDATE trigger would then
--      promote to admin.
--
-- Column-level privileges close both paths: authenticated users keep UPDATE
-- only on harmless columns. role and email stay writable by the service
-- role and the SQL editor, and BEFORE-trigger assignments to NEW (the
-- promote trigger) are not privilege-checked against the requesting user,
-- so legitimate auto-promotion keeps working.
--
-- Safe to re-run (REVOKE/GRANT are idempotent).
--
-- NOTE: rebuilding a database from schema.sql re-grants full table UPDATE to
-- authenticated (Supabase default privileges fire on CREATE TABLE), so this
-- file must be re-run as the LAST step of any rebuild — see docs/SETUP.md.

REVOKE UPDATE ON profiles FROM authenticated, anon;
GRANT UPDATE (full_name, avatar_url, phone, updated_at) ON profiles TO authenticated;

-- Self-check: fail loudly if the table-level UPDATE grant survived (e.g. the
-- REVOKE no-oped because the grant was made by a different grantor role).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND grantee IN ('authenticated', 'anon', 'PUBLIC')
      AND privilege_type = 'UPDATE'
  ) THEN
    RAISE EXCEPTION
      'profiles still has table-level UPDATE for authenticated/anon — role escalation NOT closed. Re-run this REVOKE as the role that owns the grant (usually postgres).';
  END IF;
END $$;
