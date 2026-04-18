-- RBAC Hardening: Self-update RLS policies + role immutability trigger
-- Phase 4 of production auth security upgrade

-- =============================================================
-- 1. Explicit UPDATE policies for profile self-service edits
-- =============================================================

-- Property owners can update ONLY their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'property_owner'
      AND policyname = 'Owners can update own profile'
  ) THEN
    CREATE POLICY "Owners can update own profile"
    ON public.property_owner FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Tenants can update ONLY their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tenant'
      AND policyname = 'Tenants can update own profile'
  ) THEN
    CREATE POLICY "Tenants can update own profile"
    ON public.tenant FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;


-- =============================================================
-- 2. Role immutability trigger
--    Only service_role (Edge Functions) can change role_id.
--    Prevents privilege escalation via direct DB manipulation.
-- =============================================================

CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role_id IS DISTINCT FROM NEW.role_id THEN
    IF current_setting('role') != 'service_role' THEN
      RAISE EXCEPTION 'Role changes are not permitted';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists to make migration idempotent
DROP TRIGGER IF EXISTS prevent_role_change_trigger ON public.user_roles;

CREATE TRIGGER prevent_role_change_trigger
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_role_change();
