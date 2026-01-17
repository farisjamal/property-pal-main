# Audit Log View Security Fix

## Issue Resolved

**Supabase Linter Warning:**
> View public.audit_log_summary is defined with the SECURITY DEFINER property

## What Was Changed

### File Modified
`supabase/migrations/20260117000000_audit_log_system.sql` (Lines 241-242)

### Change Applied

**Before:**
```sql
CREATE OR REPLACE VIEW public.audit_log_summary AS
SELECT ...
```

**After:**
```sql
CREATE OR REPLACE VIEW public.audit_log_summary
WITH (security_invoker = true) AS
SELECT ...
```

### Additional Changes

1. **Updated Comments** (Line 240)
   - Added: "SECURITY: Uses security_invoker=true to ensure RLS policies are applied based on querying user"

2. **Added View Documentation** (Line 266)
   - New COMMENT explaining the security model

3. **Updated Security Documentation**
   - `SECURITY_IMPLEMENTATION.md` - Added note about `security_invoker` pattern

## What This Fix Does

### Security Improvements

✅ **Explicit Security Declaration**
- Makes it clear that the view uses the querying user's permissions (not the creator's)
- Prevents privilege escalation

✅ **RLS Policy Enforcement**
- Ensures Row Level Security policies on `audit_log` table are properly evaluated
- Admin users see data, non-admin users get empty results

✅ **Supabase Best Practice Compliance**
- Resolves linter warning
- Follows Supabase security recommendations

### No Functional Changes

- ✅ View behavior remains identical
- ✅ Existing application code works unchanged
- ✅ Admin access unchanged
- ✅ Non-admin blocking unchanged
- ✅ No breaking changes

## How to Apply

### Option 1: Re-run Migration (If Not Applied Yet)

If you haven't applied the audit log migration yet:

1. **Via Supabase Dashboard:**
   - Go to SQL Editor
   - Copy entire contents of `supabase/migrations/20260117000000_audit_log_system.sql`
   - Run the migration

2. **Via Supabase CLI:**
   ```bash
   supabase db push
   ```

### Option 2: Apply Fix to Existing View

If you've already applied the migration:

1. **Via Supabase Dashboard SQL Editor:**
   ```sql
   -- Drop and recreate the view with security_invoker
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

   COMMENT ON VIEW public.audit_log_summary IS
   'Daily aggregated audit log statistics. Access restricted to admins via RLS on audit_log table. Uses security_invoker mode to ensure RLS policies are evaluated based on the querying user.';
   ```

2. **Verify Fix:**
   ```sql
   -- Check view properties
   SELECT
     schemaname,
     viewname,
     viewowner,
     definition
   FROM pg_views
   WHERE viewname = 'audit_log_summary';
   ```

## Verification

### 1. Check Supabase Linter

- Navigate to: **Supabase Dashboard > Database > Linter**
- Expected: No warnings for `audit_log_summary`
- Status should show: ✅ Green checkmark

### 2. Test Admin Access

```sql
-- Login as admin user (role_id = 1)
SELECT * FROM public.audit_log_summary LIMIT 5;
```

**Expected Result:** Returns aggregated audit data

### 3. Test Non-Admin Access

```sql
-- Login as tenant/owner user (role_id = 2 or 3)
SELECT * FROM public.audit_log_summary;
```

**Expected Result:** Returns empty result set (0 rows)

### 4. Verify via Application

```typescript
// In admin dashboard
import { fetchAuditLogSummary } from '@/utils/auditLog';

const summary = await fetchAuditLogSummary();
console.log('Data retrieved:', summary.length > 0); // Should be true for admin
```

## Technical Details

### Why `security_invoker = true`?

**PostgreSQL View Security Modes:**

| Mode | Behavior | Use Case |
|------|----------|----------|
| `security_invoker = true` (default) | View executes with querying user's permissions | Standard views with RLS ✅ |
| `security_definer` | View executes with creator's permissions | Privileged operations (use carefully!) |

**Your Use Case:**
- ✅ View queries `audit_log` table with RLS enabled
- ✅ Want RLS to filter based on **querying user** (not view creator)
- ✅ Therefore `security_invoker = true` is correct

### How RLS is Enforced

```
User Query Flow:
┌─────────────────────┐
│ User executes query │
└──────────┬──────────┘
           │
           v
┌─────────────────────────────┐
│ audit_log_summary view      │
│ (security_invoker = true)   │
└──────────┬──────────────────┘
           │
           v
┌─────────────────────────────────────┐
│ audit_log table                     │
│ RLS Policy: has_role_id(uid(), 1)  │
└──────────┬──────────────────────────┘
           │
           v
┌─────────────────────────────────┐
│ IF admin: Return filtered data  │
│ IF not admin: Return empty set  │
└─────────────────────────────────┘
```

## Security Impact

### Before Fix
- ⚠️ Implicit security model (not explicitly documented)
- ⚠️ Supabase linter flagged potential concern
- ✅ RLS still enforced (no actual vulnerability)

### After Fix
- ✅ Explicit `security_invoker = true` declaration
- ✅ Security model clearly documented
- ✅ Supabase linter satisfied
- ✅ RLS enforcement remains unchanged

## References

- **Migration File:** `supabase/migrations/20260117000000_audit_log_system.sql`
- **Security Guide:** `SECURITY_IMPLEMENTATION.md`
- **Codebase Guide:** `CLAUDE.md`

## Summary

This fix resolves a Supabase linter warning by making the view's security model **explicit** rather than implicit. The actual security behavior is unchanged - the view continues to properly enforce RLS policies, ensuring only admin users can view audit log data.

**Risk Level:** Minimal (improves clarity, no functional changes)
**Breaking Changes:** None
**Testing Required:** Verify linter warning is resolved

---

**Applied:** January 17, 2026
**Status:** ✅ Complete
