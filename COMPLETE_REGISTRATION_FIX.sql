-- =====================================================================
-- COMPLETE REGISTRATION FIX
-- Run this entire script in Supabase SQL Editor
-- =====================================================================

-- This script fixes ALL registration issues:
-- 1. Audit logging trigger failing due to NULL auth.uid()
-- 2. Security PIN hash not being saved
-- 3. IC number column missing
-- 4. View security settings

-- =====================================================================
-- STEP 1: Check and add missing columns
-- =====================================================================

-- Add security_pin_hash column to tenant table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'tenant'
    AND column_name = 'security_pin_hash'
  ) THEN
    ALTER TABLE public.tenant ADD COLUMN security_pin_hash TEXT;
    RAISE NOTICE 'Added security_pin_hash column to tenant table';
  ELSE
    RAISE NOTICE 'security_pin_hash column already exists in tenant table';
  END IF;
END $$;

-- Add security_pin_hash column to property_owner table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'property_owner'
    AND column_name = 'security_pin_hash'
  ) THEN
    ALTER TABLE public.property_owner ADD COLUMN security_pin_hash TEXT;
    RAISE NOTICE 'Added security_pin_hash column to property_owner table';
  ELSE
    RAISE NOTICE 'security_pin_hash column already exists in property_owner table';
  END IF;
END $$;

-- Add security_pin_hash column to admin table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'admin'
    AND column_name = 'security_pin_hash'
  ) THEN
    ALTER TABLE public.admin ADD COLUMN security_pin_hash TEXT;
    RAISE NOTICE 'Added security_pin_hash column to admin table';
  ELSE
    RAISE NOTICE 'security_pin_hash column already exists in admin table';
  END IF;
END $$;

-- Add ic_no column to tenant table if it doesn't exist (for encrypted IC numbers)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'tenant'
    AND column_name = 'ic_no'
  ) THEN
    ALTER TABLE public.tenant ADD COLUMN ic_no TEXT;
    RAISE NOTICE 'Added ic_no column to tenant table';
  ELSE
    RAISE NOTICE 'ic_no column already exists in tenant table';
  END IF;
END $$;

-- Add ic_no column to property_owner table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'property_owner'
    AND column_name = 'ic_no'
  ) THEN
    ALTER TABLE public.property_owner ADD COLUMN ic_no TEXT;
    RAISE NOTICE 'Added ic_no column to property_owner table';
  ELSE
    RAISE NOTICE 'ic_no column already exists in property_owner table';
  END IF;
END $$;

-- Add ic_no column to admin table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'admin'
    AND column_name = 'ic_no'
  ) THEN
    ALTER TABLE public.admin ADD COLUMN ic_no TEXT;
    RAISE NOTICE 'Added ic_no column to admin table';
  ELSE
    RAISE NOTICE 'ic_no column already exists in admin table';
  END IF;
END $$;

-- =====================================================================
-- STEP 2: Update handle_new_user function to save security_pin_hash
-- =====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  role_id_val INTEGER;
  user_name TEXT;
  contact_no_val TEXT;
  security_pin_val TEXT;
BEGIN
  -- Get role and name from metadata, default to tenant (3) if not provided
  role_id_val := COALESCE((NEW.raw_user_meta_data->>'role_id')::INTEGER, 3);
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  contact_no_val := NEW.raw_user_meta_data->>'contact_no';
  security_pin_val := NEW.raw_user_meta_data->>'security_pin_hash';

  -- Insert into users table (without password - managed by Supabase Auth)
  INSERT INTO public.users (user_id, email, role_id)
  VALUES (NEW.id, NEW.email, role_id_val)
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert into user_roles table
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (NEW.id, role_id_val)
  ON CONFLICT (user_id) DO NOTHING;

  -- Create profile based on role
  IF role_id_val = 1 THEN
    INSERT INTO public.admin (user_id, name, email, contact_no, security_pin_hash)
    VALUES (NEW.id, user_name, NEW.email, contact_no_val, security_pin_val)
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF role_id_val = 2 THEN
    INSERT INTO public.property_owner (user_id, name, email, contact_no, security_pin_hash)
    VALUES (NEW.id, user_name, NEW.email, contact_no_val, security_pin_val)
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.tenant (user_id, name, email, contact_no, security_pin_hash)
    VALUES (NEW.id, user_name, NEW.email, contact_no_val, security_pin_val)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function to create user records and profiles. Now includes security_pin_hash storage.';

-- =====================================================================
-- STEP 3: Fix audit_log_summary View Security
-- =====================================================================

DROP VIEW IF EXISTS public.audit_log_summary;

CREATE VIEW public.audit_log_summary
WITH (security_invoker = true) AS
SELECT
  DATE_TRUNC('day', timestamp) AS log_date,
  action_type,
  resource_type,
  status,
  severity,
  COUNT(*) AS event_count,
  COUNT(DISTINCT user_id) AS unique_users
FROM public.audit_log
GROUP BY DATE_TRUNC('day', timestamp), action_type, resource_type, status, severity
ORDER BY log_date DESC;

COMMENT ON VIEW public.audit_log_summary IS 'Daily aggregated audit log statistics. Uses security_invoker=true to enforce RLS of the querying user.';
GRANT SELECT ON public.audit_log_summary TO authenticated;

-- =====================================================================
-- STEP 4: Fix log_sensitive_data_access Function to handle NULL auth.uid()
-- =====================================================================

CREATE OR REPLACE FUNCTION public.log_sensitive_data_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_action_type TEXT;
  v_resource_type TEXT;
  v_resource_id TEXT;
BEGIN
  -- Robust user_id resolution: Try auth.uid(), fallback to NEW.user_id if available
  -- During registration flow, auth.uid() returns NULL, so we use NEW.user_id
  v_user_id := auth.uid();

  IF v_user_id IS NULL AND TG_OP IN ('INSERT', 'UPDATE') THEN
    -- Try to extract user_id from the NEW record
    BEGIN
      -- All our sensitive tables (tenant, property_owner, admin) have a user_id column
      EXECUTE format('SELECT ($1).%I', 'user_id')
        USING NEW
        INTO v_user_id;
    EXCEPTION WHEN OTHERS THEN
      -- If user_id column doesn't exist or other error, keep it NULL
      v_user_id := NULL;
    END;
  END IF;

  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action_type := 'CREATE';
  ELSIF TG_OP = 'UPDATE' THEN
    v_action_type := 'UPDATE';
  ELSIF TG_OP = 'DELETE' THEN
    v_action_type := 'DELETE';
  END IF;

  -- Determine resource type
  v_resource_type := TG_TABLE_NAME;

  -- Determine resource_id safely with error handling
  BEGIN
    CASE
      WHEN TG_TABLE_NAME = 'tenant' THEN
        v_resource_id := NEW.tenant_id::TEXT;
      WHEN TG_TABLE_NAME = 'property_owner' THEN
        v_resource_id := NEW.owner_id::TEXT;
      WHEN TG_TABLE_NAME = 'admin' THEN
        v_resource_id := NEW.admin_id::TEXT;
      ELSE
        v_resource_id := NULL;
    END CASE;
  EXCEPTION WHEN OTHERS THEN
    -- If resource_id extraction fails, use a safe fallback
    v_resource_id := 'UNKNOWN';
  END;

  -- Insert audit log entry
  INSERT INTO public.audit_log (
    user_id,
    action_type,
    resource_type,
    resource_id,
    description,
    severity,
    metadata
  ) VALUES (
    v_user_id, -- Will be captured from NEW.user_id during registration
    v_action_type,
    UPPER(v_resource_type),
    v_resource_id,
    format('%s operation on %s table', v_action_type, TG_TABLE_NAME),
    CASE
      WHEN TG_OP = 'DELETE' THEN 'WARNING'
      ELSE 'INFO'
    END,
    CASE
      WHEN TG_OP = 'UPDATE' THEN jsonb_build_object(
        'old_values', to_jsonb(OLD),
        'new_values', to_jsonb(NEW)
      )
      WHEN TG_OP = 'INSERT' THEN jsonb_build_object('new_values', to_jsonb(NEW))
      WHEN TG_OP = 'DELETE' THEN jsonb_build_object('deleted_values', to_jsonb(OLD))
      ELSE NULL
    END
  );

  -- Return appropriate value based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.log_sensitive_data_access() IS 'Automatically logs changes to sensitive tables. Handles NULL auth.uid() during registration by falling back to NEW.user_id from the record itself.';

-- =====================================================================
-- VERIFICATION QUERIES
-- =====================================================================

-- Check if all columns exist
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('tenant', 'property_owner', 'admin')
  AND column_name IN ('security_pin_hash', 'ic_no', 'contact_no')
ORDER BY table_name, column_name;

-- Check if functions were updated
SELECT
  routine_name,
  CASE
    WHEN routine_definition LIKE '%security_pin_hash%' THEN '✅ Has security_pin_hash'
    ELSE '❌ Missing security_pin_hash'
  END as pin_status,
  CASE
    WHEN routine_definition LIKE '%NEW.user_id%' THEN '✅ Has fallback logic'
    ELSE '❌ Missing fallback'
  END as fallback_status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('handle_new_user', 'log_sensitive_data_access');

-- Success message
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'REGISTRATION FIX APPLIED SUCCESSFULLY!';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Test user registration at /auth';
  RAISE NOTICE '2. Check audit logs after registration';
  RAISE NOTICE '3. Verify security_pin_hash is saved in profile tables';
  RAISE NOTICE '=================================================================';
END $$;
