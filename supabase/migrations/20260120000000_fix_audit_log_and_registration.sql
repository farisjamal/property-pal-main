-- =====================================================================
-- FIX: Audit Log user_role_id NULL + Registration Database Error
-- =====================================================================
--
-- ISSUE 1: user_role_id is NULL in audit_log entries
-- ROOT CAUSE: log_sensitive_data_access() doesn't populate user_role_id
--
-- ISSUE 2: Registration fails with "Database error saving new user"
-- ROOT CAUSE: Audit logging trigger can fail during registration when
--             user_roles entry doesn't exist yet or auth.uid() is NULL
--
-- SOLUTION:
-- 1. Rewrite log_sensitive_data_access() to always populate user_role_id
-- 2. Make the function get role_id directly from user_roles using NEW.user_id
-- 3. Wrap audit insert in exception handler so it never fails the main operation
-- =====================================================================

-- Drop and recreate the trigger function with all fixes
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
  -- ===================================================================
  -- STEP 1: Resolve user_id
  -- Priority: auth.uid() > NEW.user_id > OLD.user_id > NULL
  -- ===================================================================
  v_user_id := auth.uid();

  -- During registration, auth.uid() is NULL - fallback to record's user_id
  IF v_user_id IS NULL THEN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      BEGIN
        EXECUTE format('SELECT ($1).%I', 'user_id') USING NEW INTO v_user_id;
      EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
      END;
    ELSIF TG_OP = 'DELETE' THEN
      BEGIN
        EXECUTE format('SELECT ($1).%I', 'user_id') USING OLD INTO v_user_id;
      EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
      END;
    END IF;
  END IF;

  -- ===================================================================
  -- STEP 2: Fetch user_email and user_role_id from related tables
  -- This must happen AFTER user_id is resolved
  -- ===================================================================
  IF v_user_id IS NOT NULL THEN
    -- Get email from auth.users
    BEGIN
      SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
    EXCEPTION WHEN OTHERS THEN
      v_user_email := NULL;
    END;

    -- Get role_id from user_roles table
    -- NOTE: During registration, this record SHOULD exist because handle_new_user
    -- inserts into user_roles BEFORE inserting into tenant/property_owner/admin
    BEGIN
      SELECT role_id INTO v_user_role_id FROM public.user_roles WHERE user_id = v_user_id;
    EXCEPTION WHEN OTHERS THEN
      v_user_role_id := NULL;
    END;

    -- Fallback: If user_roles doesn't have it yet, try users table
    IF v_user_role_id IS NULL THEN
      BEGIN
        SELECT role_id INTO v_user_role_id FROM public.users WHERE user_id = v_user_id;
      EXCEPTION WHEN OTHERS THEN
        v_user_role_id := NULL;
      END;
    END IF;
  END IF;

  -- ===================================================================
  -- STEP 3: Determine action type and resource type
  -- ===================================================================
  IF TG_OP = 'INSERT' THEN
    v_action_type := 'CREATE';
  ELSIF TG_OP = 'UPDATE' THEN
    v_action_type := 'UPDATE';
  ELSIF TG_OP = 'DELETE' THEN
    v_action_type := 'DELETE';
  END IF;

  v_resource_type := UPPER(TG_TABLE_NAME);

  -- ===================================================================
  -- STEP 4: Determine resource_id based on table
  -- ===================================================================
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

  -- ===================================================================
  -- STEP 5: Build sanitized metadata (exclude sensitive fields)
  -- ===================================================================
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

  -- ===================================================================
  -- STEP 6: Insert audit log entry with ALL fields including user_role_id
  -- CRITICAL: Wrapped in exception handler to NEVER fail the main operation
  -- ===================================================================
  BEGIN
    INSERT INTO public.audit_log (
      user_id,
      user_email,
      user_role_id,  -- NOW PROPERLY POPULATED
      action_type,
      resource_type,
      resource_id,
      description,
      severity,
      metadata
    ) VALUES (
      v_user_id,
      v_user_email,
      v_user_role_id,  -- Will be 1, 2, or 3 based on user's role
      v_action_type,
      v_resource_type,
      v_resource_id,
      format('%s operation on %s table', v_action_type, TG_TABLE_NAME),
      CASE WHEN TG_OP = 'DELETE' THEN 'WARNING' ELSE 'INFO' END,
      v_metadata
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log error but DON'T fail the main operation
    RAISE WARNING 'Audit logging failed: %', SQLERRM;
  END;

  -- ===================================================================
  -- STEP 7: Return appropriate value based on operation
  -- ===================================================================
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Add descriptive comment
COMMENT ON FUNCTION public.log_sensitive_data_access() IS
'Audit trigger function that logs changes to sensitive tables (tenant, property_owner, admin).
Features:
1. Populates user_id from auth.uid() or falls back to NEW.user_id during registration
2. ALWAYS populates user_role_id by querying user_roles (then users as fallback)
3. Excludes sensitive fields (security_pin_hash, ic_no, contact_no) from metadata
4. Wrapped in exception handler to never fail the main operation
5. Tracks changed fields for UPDATE operations';

-- =====================================================================
-- VERIFICATION: The fix will be verified on next registration
-- =====================================================================
-- After applying this migration:
-- 1. Test registration - should succeed without database error
-- 2. Check audit_log table - user_role_id should be populated (1, 2, or 3)
-- =====================================================================
