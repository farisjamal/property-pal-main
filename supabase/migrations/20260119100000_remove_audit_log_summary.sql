-- Remove audit_log_summary view
-- This view is not essential and adds unnecessary complexity

-- Drop the view
DROP VIEW IF EXISTS public.audit_log_summary;
