# Registration Fix & Security Hardening - Verification Guide

## Overview

This document provides verification steps for the database migration that resolves:
1. **Registration Failure**: "Database error saving a new user" caused by audit logging trigger failing
2. **Security Enhancement**: Ensures `audit_log_summary` view properly enforces RLS

## Migration Details

**File**: [supabase/migrations/20260117100000_fix_registration_and_view.sql](supabase/migrations/20260117100000_fix_registration_and_view.sql)

### Changes Made

#### 1. Enhanced `log_sensitive_data_access()` Function
- **Problem**: During user registration, `auth.uid()` returns NULL because no session exists yet
- **Solution**: Function now falls back to `NEW.user_id` when `auth.uid()` is NULL
- **Impact**: Registration triggers can now successfully create audit logs

#### 2. Confirmed `audit_log_summary` View Security
- **Enhancement**: View explicitly uses `security_invoker = true` mode
- **Impact**: RLS policies are evaluated based on the querying user (not view owner)

## Applying the Migration

### Method 1: Supabase Dashboard (Recommended)
1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy contents of `supabase/migrations/20260117100000_fix_registration_and_view.sql`
5. Paste and click **Run**
6. Verify "Success. No rows returned" message

### Method 2: Supabase CLI
```bash
# Push all pending migrations
supabase db push

# Or apply specific migration
supabase migration up --db-url "your-connection-string"
```

## Verification Steps

### 1. Verify Migration Applied Successfully

Run this SQL query in Supabase SQL Editor:

```sql
-- Check if log_sensitive_data_access function was updated
SELECT
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'log_sensitive_data_access'
  AND routine_definition LIKE '%auth.uid()%'
  AND routine_definition LIKE '%NEW.user_id%';
```

**Expected**: Should return 1 row showing the updated function.

### 2. Verify View Security Settings

```sql
-- Check audit_log_summary view configuration
SELECT
  schemaname,
  viewname,
  viewowner,
  definition
FROM pg_views
WHERE viewname = 'audit_log_summary';
```

**Expected**: Should show the view exists with proper definition.

### 3. Test User Registration Flow

#### Test Case 1: New Tenant Registration

1. **Navigate to Registration Page**: Go to `/auth` in your browser
2. **Fill Registration Form**:
   - Name: `Test Tenant Registration`
   - Email: `test-tenant-fix@example.com`
   - Contact Number: `0123456789`
   - IC Number: `123456789012`
   - Password: `TestPassword123!`
   - Role: `Tenant`
3. **Submit Form**
4. **Expected Result**:
   - Registration succeeds without errors
   - User is redirected to tenant dashboard or shows success message
   - No "Database error saving a new user" error

#### Test Case 2: Verify Database Records

Run this SQL after successful registration:

```sql
-- Check user was created
SELECT
  u.user_id,
  u.email,
  u.role_id,
  t.tenant_id,
  t.name,
  t.email AS tenant_email,
  t.created_at
FROM public.users u
JOIN public.tenant t ON u.user_id = t.user_id
WHERE u.email = 'test-tenant-fix@example.com';
```

**Expected**: Should return 1 row with the new tenant's data.

#### Test Case 3: Verify Audit Log Created

```sql
-- Check audit log entry was created for the new tenant
SELECT
  log_id,
  timestamp,
  user_id,
  action_type,
  resource_type,
  resource_id,
  description,
  status,
  severity,
  metadata->>'new_values' as new_values
FROM public.audit_log
WHERE resource_type = 'TENANT'
  AND action_type = 'CREATE'
  AND metadata->'new_values'->>'email' = 'test-tenant-fix@example.com'
ORDER BY timestamp DESC
LIMIT 1;
```

**Expected**: Should return 1 audit log entry with:
- `action_type`: `CREATE`
- `resource_type`: `TENANT`
- `user_id`: Either NULL or the new user's ID (both are acceptable)
- `status`: `SUCCESS`
- `severity`: `INFO`

### 4. Test Property Owner Registration

Repeat Test Cases 1-3 with:
- Email: `test-owner-fix@example.com`
- Role: `Property Owner`
- Check `property_owner` table instead of `tenant`

### 5. Verify Existing Audit Log Access (Admin Only)

1. **Login as Admin** user
2. **Navigate to Admin Dashboard**: `/admin`
3. **Check Audit Logs** (if UI exists) or run SQL:

```sql
-- This query should work for admin users only
SELECT COUNT(*) as total_logs
FROM public.audit_log_summary;
```

**Expected**: Should return aggregated statistics without errors.

4. **Login as Non-Admin** (Tenant or Owner)
5. **Try to Access Audit Logs**:

```sql
-- This should return no rows due to RLS
SELECT COUNT(*) as total_logs
FROM public.audit_log_summary;
```

**Expected**: Should return 0 rows (RLS prevents non-admin access).

### 6. Test Update Operations Trigger Audit Logs

```sql
-- Update a tenant record to trigger audit log
UPDATE public.tenant
SET name = 'Updated Test Name'
WHERE email = 'test-tenant-fix@example.com';

-- Verify audit log entry was created
SELECT
  action_type,
  resource_type,
  description,
  metadata->'old_values'->>'name' as old_name,
  metadata->'new_values'->>'name' as new_name
FROM public.audit_log
WHERE resource_type = 'TENANT'
  AND action_type = 'UPDATE'
  AND metadata->'new_values'->>'email' = 'test-tenant-fix@example.com'
ORDER BY timestamp DESC
LIMIT 1;
```

**Expected**: Should show audit log with UPDATE action and old/new values.

## Rollback Plan (If Needed)

If the migration causes issues, you can rollback:

```sql
-- Restore original log_sensitive_data_access function
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
  -- Get current user ID (original version)
  v_user_id := auth.uid();

  IF TG_OP = 'INSERT' THEN
    v_action_type := 'CREATE';
  ELSIF TG_OP = 'UPDATE' THEN
    v_action_type := 'UPDATE';
  ELSIF TG_OP = 'DELETE' THEN
    v_action_type := 'DELETE';
  END IF;

  v_resource_type := TG_TABLE_NAME;

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
```

## Security Considerations

### What This Migration Fixes
- ✅ Allows audit logs to capture user creation events during registration
- ✅ Maintains comprehensive audit trail for security compliance
- ✅ Ensures RLS policies are properly enforced on audit log views

### What This Migration Does NOT Change
- ✅ No changes to existing audit log data
- ✅ No changes to RLS policies
- ✅ No changes to user roles or permissions
- ✅ No changes to encryption/decryption logic

### Audit Log Behavior After Fix
- During **registration**: `user_id` in audit log will be the newly created user's ID
- During **normal operations**: `user_id` will be from the active session (`auth.uid()`)
- Both scenarios are now handled gracefully without errors

## Troubleshooting

### Issue: Migration Fails to Apply

**Symptom**: Error when running migration SQL

**Solution**:
1. Check database connection
2. Verify you have sufficient privileges
3. Check for syntax errors in SQL editor

### Issue: Registration Still Fails

**Symptom**: Still seeing "Database error saving a new user"

**Diagnostic Steps**:
```sql
-- Check if function was updated
SELECT routine_definition
FROM information_schema.routines
WHERE routine_name = 'log_sensitive_data_access';
```

**Solution**:
1. Verify migration was applied successfully
2. Check Supabase logs for specific error messages
3. Ensure encryption key is set in environment variables

### Issue: Audit Logs Not Visible to Admin

**Symptom**: Admin users cannot see audit logs

**Diagnostic Steps**:
```sql
-- Verify RLS policy exists
SELECT * FROM pg_policies
WHERE tablename = 'audit_log'
  AND policyname = 'Admins can view all audit logs';

-- Check user's role
SELECT role_id FROM public.user_roles
WHERE user_id = auth.uid();
```

**Solution**:
1. Verify admin user has `role_id = 1`
2. Check RLS policies are enabled on `audit_log` table
3. Verify `has_role_id()` function exists

## Success Criteria

✅ **Registration works**: New users can register without database errors
✅ **Audit logs created**: Registration events are logged to `audit_log` table
✅ **Security maintained**: Only admins can view audit logs
✅ **No data loss**: Existing audit logs remain intact
✅ **View security**: `audit_log_summary` view enforces proper RLS

## Next Steps

After successful verification:
1. Test registration for all three roles (Admin, Owner, Tenant)
2. Monitor audit logs for any anomalies
3. Consider setting up automated alerts for failed audit logging attempts
4. Review audit log retention policies

## Support

If you encounter issues:
1. Check Supabase dashboard logs
2. Review [SECURITY_IMPLEMENTATION.md](SECURITY_IMPLEMENTATION.md) for security architecture
3. Review [AUDIT_VIEW_SECURITY_FIX.md](AUDIT_VIEW_SECURITY_FIX.md) for related security enhancements
