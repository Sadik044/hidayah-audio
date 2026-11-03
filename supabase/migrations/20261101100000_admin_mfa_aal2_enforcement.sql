-- ==============================================================================
-- Migration: 20261101100000_admin_mfa_aal2_enforcement.sql
-- Description: Enforce Supabase Authenticator Assurance Level 2 (aal2) for all
--              privileged administrative operations on categories, series,
--              episodes, profiles, and private storage objects.
--              Includes least-privilege ACL hardening for public.is_admin().
-- ==============================================================================

-- 1. ACL Hardening for public.is_admin()
-- Explicitly revoke EXECUTE from PUBLIC, anon, and service_role.
-- Only authenticated user sessions evaluate this helper function.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2. Helper Function: is_admin_aal2()
-- Returns TRUE only if the requesting user has role = 'admin' AND their session
-- JWT claims confirm current Authenticator Assurance Level is 'aal2'.
CREATE OR REPLACE FUNCTION public.is_admin_aal2()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_admin() AND ((SELECT auth.jwt()->>'aal') = 'aal2');
$$;

-- Grant execution permission strictly to authenticated users
REVOKE ALL ON FUNCTION public.is_admin_aal2() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_aal2() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_aal2() FROM service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_aal2() TO authenticated;

-- 3. Update Categories Table RLS Policies
DROP POLICY IF EXISTS "Admins insert categories" ON public.categories;
CREATE POLICY "Admins insert categories"
  ON public.categories
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins update categories" ON public.categories;
CREATE POLICY "Admins update categories"
  ON public.categories
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_aal2())
  WITH CHECK (public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins delete categories" ON public.categories;
CREATE POLICY "Admins delete categories"
  ON public.categories
  FOR DELETE
  TO authenticated
  USING (public.is_admin_aal2());

-- 3. Update Series Table RLS Policies
DROP POLICY IF EXISTS "Admins read all series" ON public.series;
CREATE POLICY "Admins read all series"
  ON public.series
  FOR SELECT
  TO authenticated
  USING (public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins insert series" ON public.series;
CREATE POLICY "Admins insert series"
  ON public.series
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins update series" ON public.series;
CREATE POLICY "Admins update series"
  ON public.series
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_aal2())
  WITH CHECK (public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins delete series" ON public.series;
CREATE POLICY "Admins delete series"
  ON public.series
  FOR DELETE
  TO authenticated
  USING (public.is_admin_aal2());

-- 4. Update Episodes Table RLS Policies
DROP POLICY IF EXISTS "Admins read all episodes" ON public.episodes;
CREATE POLICY "Admins read all episodes"
  ON public.episodes
  FOR SELECT
  TO authenticated
  USING (public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins insert episodes" ON public.episodes;
CREATE POLICY "Admins insert episodes"
  ON public.episodes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins update episodes" ON public.episodes;
CREATE POLICY "Admins update episodes"
  ON public.episodes
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_aal2())
  WITH CHECK (public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins delete episodes" ON public.episodes;
CREATE POLICY "Admins delete episodes"
  ON public.episodes
  FOR DELETE
  TO authenticated
  USING (public.is_admin_aal2());

-- 5. Update Profiles Table RLS Policies
-- Authenticated users must always be able to read their own profile row,
-- which is required for role identification during initial AAL1 sign-in before MFA elevation.
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_aal2())
  WITH CHECK (public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin_aal2());

-- 6. Update Storage Objects Policies (Audio & Covers)
DROP POLICY IF EXISTS "Admins can read all audio" ON storage.objects;
CREATE POLICY "Admins can read all audio"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'audio' AND public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins can upload audio" ON storage.objects;
CREATE POLICY "Admins can upload audio"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'audio' AND public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins can update audio" ON storage.objects;
CREATE POLICY "Admins can update audio"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'audio' AND public.is_admin_aal2())
  WITH CHECK (bucket_id = 'audio' AND public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins can delete audio" ON storage.objects;
CREATE POLICY "Admins can delete audio"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'audio' AND public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins can upload covers" ON storage.objects;
CREATE POLICY "Admins can upload covers"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'covers' AND public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins can update covers" ON storage.objects;
CREATE POLICY "Admins can update covers"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'covers' AND public.is_admin_aal2())
  WITH CHECK (bucket_id = 'covers' AND public.is_admin_aal2());

DROP POLICY IF EXISTS "Admins can delete covers" ON storage.objects;
CREATE POLICY "Admins can delete covers"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'covers' AND public.is_admin_aal2());
