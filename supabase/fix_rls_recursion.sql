-- Fix infinite recursion in profiles RLS policy
-- The "Admins read all profiles" policy queried profiles from within a
-- profiles policy, causing Postgres to error out and break profile reads
-- for ALL users (including the user's own profile lookup in the navbar).

-- 1. Drop the recursive policy
DROP POLICY IF EXISTS "Admins read all profiles" ON profiles;

-- 2. Create a security-definer function to check admin role without RLS
-- (SECURITY DEFINER runs as the function owner, bypassing RLS on profiles)
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 3. Re-create the admin policy using the non-recursive function
CREATE POLICY "Admins read all profiles" ON profiles
  FOR SELECT USING (is_current_user_admin());

-- 4. Also simplify other admin policies on OTHER tables to use the function
-- (these weren't recursive but are cleaner this way, and won't break)
-- We leave existing non-recursive policies in place for now to avoid
-- disruption. The critical fix is the profiles-on-profiles recursion.
