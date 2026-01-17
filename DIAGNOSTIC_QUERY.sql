-- Diagnostic Query: Check current state of audit log system
-- Run this in Supabase SQL Editor to see what needs to be fixed

-- 1. Check if log_sensitive_data_access function exists and its current definition
SELECT
  routine_name,
  LEFT(routine_definition, 500) as definition_preview,
  CASE
    WHEN routine_definition LIKE '%NEW.user_id%' THEN '✅ FIXED - Has fallback logic'
    ELSE '❌ NEEDS FIX - Missing fallback logic'
  END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'log_sensitive_data_access';

-- 2. Check audit_log_summary view configuration
SELECT
  'audit_log_summary' as view_name,
  CASE
    WHEN viewname IS NOT NULL THEN '✅ View exists'
    ELSE '❌ View missing'
  END as status
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'audit_log_summary';

-- 3. Check if audit_log table exists and has data
SELECT
  'audit_log' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT user_id) as unique_users,
  MAX(timestamp) as latest_log
FROM public.audit_log;

-- 4. Check recent audit log entries
SELECT
  timestamp,
  user_id,
  action_type,
  resource_type,
  status,
  description
FROM public.audit_log
ORDER BY timestamp DESC
LIMIT 5;

-- 5. Test if audit log triggers are active
SELECT
  trigger_name,
  event_object_table,
  action_statement,
  CASE
    WHEN trigger_name LIKE 'audit_%' THEN '✅ Audit trigger active'
    ELSE 'Other trigger'
  END as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN ('audit_tenant_changes', 'audit_property_owner_changes', 'audit_admin_changes');
