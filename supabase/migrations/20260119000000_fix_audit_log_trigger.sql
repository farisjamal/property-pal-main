-- Fix Audit Log Trigger Migration
-- Resolves issues:
-- 1. NULL user_email and user_role_id in audit logs
-- 2. Sensitive data (security_pin_hash) being logged in metadata
-- 3. Improves trigger to fetch related user data

-- Drop existing trigger function and recreate with fixes
CREATE OR REPLACE FUNCTION public.log_sensitive_data_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_user_role_id INTEGER;
  v_action_type TEXT;
  v_resource_type TEXT;
  v_resource_id TEXT;
  v_metadata JSONB;
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();

  -- Fetch user email and role_id from related tables
  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
    SELECT role_id INTO v_user_role_id FROM public.user_roles WHERE user_id = v_user_id;
  END IF;

  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action_type := 'CREATE';
  ELSIF TG_OP = 'UPDATE' THEN
    v_action_type := 'UPDATE';
  ELSIF TG_OP = 'DELETE' THEN
    v_action_type := 'DELETE';
  END IF;

  -- Determine resource type (uppercase table name)
  v_resource_type := UPPER(TG_TABLE_NAME);

  -- Determine resource_id based on table
  IF TG_OP = 'DELETE' THEN
    v_resource_id := CASE
      WHEN TG_TABLE_NAME = 'tenant' THEN OLD.tenant_id::TEXT
      WHEN TG_TABLE_NAME = 'property_owner' THEN OLD.owner_id::TEXT
      WHEN TG_TABLE_NAME = 'admin' THEN OLD.admin_id::TEXT
      ELSE NULL
    END;
  ELSE
    v_resource_id := CASE
      WHEN TG_TABLE_NAME = 'tenant' THEN NEW.tenant_id::TEXT
      WHEN TG_TABLE_NAME = 'property_owner' THEN NEW.owner_id::TEXT
      WHEN TG_TABLE_NAME = 'admin' THEN NEW.admin_id::TEXT
      ELSE NULL
    END;
  END IF;

  -- Build sanitized metadata (exclude sensitive fields)
  -- Sensitive fields to exclude: security_pin_hash, ic_no, contact_no (encrypted but still sensitive)
  IF TG_OP = 'UPDATE' THEN
    v_old_values := to_jsonb(OLD) - 'security_pin_hash' - 'ic_no' - 'contact_no';
    v_new_values := to_jsonb(NEW) - 'security_pin_hash' - 'ic_no' - 'contact_no';
    v_metadata := jsonb_build_object(
      'old_values', v_old_values,
      'new_values', v_new_values,
      'changed_fields', (
        SELECT jsonb_agg(key)
        FROM jsonb_each(to_jsonb(NEW) - 'security_pin_hash' - 'ic_no' - 'contact_no') AS n(key, value)
        WHERE NOT EXISTS (
          SELECT 1 FROM jsonb_each(to_jsonb(OLD) - 'security_pin_hash' - 'ic_no' - 'contact_no') AS o(key, value)
          WHERE o.key = n.key AND o.value = n.value
        )
      )
    );
  ELSIF TG_OP = 'INSERT' THEN
    v_new_values := to_jsonb(NEW) - 'security_pin_hash' - 'ic_no' - 'contact_no';
    v_metadata := jsonb_build_object('new_values', v_new_values);
  ELSIF TG_OP = 'DELETE' THEN
    v_old_values := to_jsonb(OLD) - 'security_pin_hash' - 'ic_no' - 'contact_no';
    v_metadata := jsonb_build_object('deleted_values', v_old_values);
  END IF;

  -- Insert audit log entry with all related data
  INSERT INTO public.audit_log (
    user_id,
    user_email,
    user_role_id,
    action_type,
    resource_type,
    resource_id,
    description,
    severity,
    metadata
  ) VALUES (
    v_user_id,
    v_user_email,
    v_user_role_id,
    v_action_type,
    v_resource_type,
    v_resource_id,
    format('%s operation on %s table', v_action_type, TG_TABLE_NAME),
    CASE
      WHEN TG_OP = 'DELETE' THEN 'WARNING'
      ELSE 'INFO'
    END,
    v_metadata
  );

  -- Return appropriate value based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION public.log_sensitive_data_access() IS 'Audit trigger function that logs changes to sensitive tables while:
1. Populating user_email and user_role_id from related tables
2. Excluding sensitive fields (security_pin_hash, ic_no, contact_no) from metadata
3. Tracking changed fields for UPDATE operations';

-- Note: Existing triggers will automatically use the updated function
-- No need to recreate triggers since they reference the function by name
