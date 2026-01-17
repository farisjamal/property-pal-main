-- Fix Registration Failure & Security Hardening
-- This migration resolves two critical issues:
-- 1. Registration failure due to audit logging trigger failing when auth.uid() is NULL
-- 2. Ensures audit_log_summary view properly enforces RLS with security_invoker mode

-- =====================================================================
-- 1. Fix audit_log_summary View Security
-- =====================================================================
-- Drop and recreate with explicit security_invoker = true
-- This ensures RLS policies are evaluated based on the querying user, not the view owner
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

-- Grant access to authenticated users
-- Security is enforced through the underlying audit_log table's RLS policy
GRANT SELECT ON public.audit_log_summary TO authenticated;

-- =====================================================================
-- 2. Harden log_sensitive_data_access Function
-- =====================================================================
-- Update the function to handle NULL auth.uid() during registration
-- Falls back to NEW.user_id when auth session is not available
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
    v_user_id, -- Will be NULL during registration, which is acceptable
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

-- Comment on the function to document the fix
COMMENT ON FUNCTION public.log_sensitive_data_access() IS 'Automatically logs changes to sensitive tables. Handles NULL auth.uid() during registration by falling back to NEW.user_id from the record itself.';
