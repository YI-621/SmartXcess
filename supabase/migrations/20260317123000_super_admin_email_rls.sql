-- Allow a single designated super admin email to bypass admin-only RLS checks
-- without introducing new tables.

CREATE OR REPLACE FUNCTION public.is_designated_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt()->>'email', '')) = 'wyeyi621@gmail.com'
$$;

-- Profiles: allow designated super admin to view all profiles.
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_designated_super_admin()
  );

-- User roles: allow designated super admin to view and manage all roles.
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_designated_super_admin()
  );

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_designated_super_admin()
  );

-- Settings: allow designated super admin to manage system settings.
DROP POLICY IF EXISTS "Admins can manage settings" ON public.system_settings;
CREATE POLICY "Admins can manage settings" ON public.system_settings
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_designated_super_admin()
  );

-- Moderator assignments: allow designated super admin to manage all assignments.
DROP POLICY IF EXISTS "Admins can manage moderator_modules" ON public.moderator_modules;
CREATE POLICY "Admins can manage moderator_modules" ON public.moderator_modules
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_designated_super_admin()
  );

-- Assessments: allow designated super admin to view/manage all assessments.
DROP POLICY IF EXISTS "Admins can view all assessments" ON public.assessments;
CREATE POLICY "Admins can view all assessments" ON public.assessments
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_designated_super_admin()
  );

DROP POLICY IF EXISTS "Admins can manage all assessments" ON public.assessments;
CREATE POLICY "Admins can manage all assessments" ON public.assessments
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_designated_super_admin()
  );
