-- Audit Log System Migration
-- Creates comprehensive audit logging for security-sensitive operations

-- Create audit_log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_role_id INTEGER,
  action_type TEXT NOT NULL, -- 'CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'FAILED_LOGIN', 'PERMISSION_DENIED'
  resource_type TEXT NOT NULL, -- 'USER', 'PROPERTY', 'APPOINTMENT', 'PROFILE', 'ADMIN', 'TENANT', 'OWNER'
  resource_id TEXT, -- ID of the affected resource
  description TEXT NOT NULL, -- Human-readable description
  ip_address INET, -- Client IP address
  user_agent TEXT, -- Browser/client user agent
  status TEXT NOT NULL DEFAULT 'SUCCESS', -- 'SUCCESS', 'FAILED', 'DENIED'
  severity TEXT NOT NULL DEFAULT 'INFO', -- 'INFO', 'WARNING', 'ERROR', 'CRITICAL'
  metadata JSONB, -- Additional context (old/new values, error details, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on audit_log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Create indexes for efficient querying
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_timestamp ON public.audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_action_type ON public.audit_log(action_type);
CREATE INDEX idx_audit_log_resource_type ON public.audit_log(resource_type);
CREATE INDEX idx_audit_log_severity ON public.audit_log(severity);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- RLS Policy: Only admins can read audit logs
CREATE POLICY "Admins can view all audit logs"
ON public.audit_log FOR SELECT
TO authenticated
USING (public.has_role_id(auth.uid(), 1));

-- RLS Policy: Service role can insert audit logs
CREATE POLICY "Service role can insert audit logs"
ON public.audit_log FOR INSERT
TO service_role
WITH CHECK (true);

-- RLS Policy: Authenticated users can insert their own audit logs
CREATE POLICY "Users can insert their own audit logs"
ON public.audit_log FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Function to automatically log sensitive data access
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
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();

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
    v_user_id,
    v_action_type,
    UPPER(v_resource_type),
    CASE
      WHEN TG_TABLE_NAME = 'tenant' THEN NEW.tenant_id::TEXT
      WHEN TG_TABLE_NAME = 'property_owner' THEN NEW.owner_id::TEXT
      WHEN TG_TABLE_NAME = 'admin' THEN NEW.admin_id::TEXT
      ELSE NULL
    END,
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

  RETURN NEW;
END;
$$;

-- Create triggers for audit logging on sensitive tables
DROP TRIGGER IF EXISTS audit_tenant_changes ON public.tenant;
CREATE TRIGGER audit_tenant_changes
AFTER INSERT OR UPDATE OR DELETE ON public.tenant
FOR EACH ROW
EXECUTE FUNCTION public.log_sensitive_data_access();

DROP TRIGGER IF EXISTS audit_property_owner_changes ON public.property_owner;
CREATE TRIGGER audit_property_owner_changes
AFTER INSERT OR UPDATE OR DELETE ON public.property_owner
FOR EACH ROW
EXECUTE FUNCTION public.log_sensitive_data_access();

DROP TRIGGER IF EXISTS audit_admin_changes ON public.admin;
CREATE TRIGGER audit_admin_changes
AFTER INSERT OR UPDATE OR DELETE ON public.admin
FOR EACH ROW
EXECUTE FUNCTION public.log_sensitive_data_access();

-- Function to log authentication events
CREATE OR REPLACE FUNCTION public.log_auth_event(
  p_user_id UUID,
  p_action_type TEXT,
  p_status TEXT DEFAULT 'SUCCESS',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_user_email TEXT;
  v_role_id INTEGER;
BEGIN
  -- Get user email and role
  SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
  SELECT role_id INTO v_role_id FROM public.user_roles WHERE user_id = p_user_id;

  -- Insert audit log
  INSERT INTO public.audit_log (
    user_id,
    user_email,
    user_role_id,
    action_type,
    resource_type,
    description,
    ip_address,
    user_agent,
    status,
    severity
  ) VALUES (
    p_user_id,
    v_user_email,
    v_role_id,
    p_action_type,
    'AUTH',
    COALESCE(p_description, format('%s event', p_action_type)),
    p_ip_address,
    p_user_agent,
    p_status,
    CASE
      WHEN p_status = 'FAILED' THEN 'WARNING'
      WHEN p_action_type = 'FAILED_LOGIN' THEN 'WARNING'
      WHEN p_action_type = 'PERMISSION_DENIED' THEN 'ERROR'
      ELSE 'INFO'
    END
  ) RETURNING log_id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Function to log data access (for sensitive field reads)
CREATE OR REPLACE FUNCTION public.log_data_access(
  p_user_id UUID,
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_action_description TEXT,
  p_fields_accessed TEXT[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_metadata JSONB;
BEGIN
  -- Build metadata
  v_metadata := jsonb_build_object('fields_accessed', p_fields_accessed);

  -- Insert audit log
  INSERT INTO public.audit_log (
    user_id,
    action_type,
    resource_type,
    resource_id,
    description,
    severity,
    metadata
  ) VALUES (
    p_user_id,
    'READ',
    p_resource_type,
    p_resource_id,
    p_action_description,
    'INFO',
    v_metadata
  ) RETURNING log_id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Create view for audit log summary (admins only)
-- Note: Views don't support RLS policies, but they inherit security from underlying tables
-- Since audit_log has RLS that allows only admins to SELECT, this view is also admin-only
-- SECURITY: Uses security_invoker=true to ensure RLS policies are applied based on querying user
CREATE OR REPLACE VIEW public.audit_log_summary
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

-- Grant access to authenticated users
-- Security is enforced through the underlying audit_log table's RLS policy
GRANT SELECT ON public.audit_log_summary TO authenticated;

-- Comment on table and view
COMMENT ON TABLE public.audit_log IS 'Comprehensive audit trail for security-sensitive operations';
COMMENT ON COLUMN public.audit_log.action_type IS 'Type of action: CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, FAILED_LOGIN, PERMISSION_DENIED';
COMMENT ON COLUMN public.audit_log.resource_type IS 'Type of resource affected: USER, PROPERTY, APPOINTMENT, PROFILE, ADMIN, TENANT, OWNER, AUTH';
COMMENT ON COLUMN public.audit_log.severity IS 'Severity level: INFO, WARNING, ERROR, CRITICAL';
COMMENT ON COLUMN public.audit_log.metadata IS 'Additional context including old/new values for updates';

COMMENT ON VIEW public.audit_log_summary IS 'Daily aggregated audit log statistics. Access restricted to admins via RLS on audit_log table. Uses security_invoker mode to ensure RLS policies are evaluated based on the querying user.';
