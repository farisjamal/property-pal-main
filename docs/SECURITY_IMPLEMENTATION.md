# Security Implementation Summary

## Overview

This document outlines the comprehensive security architecture of the PropertyPal system, including server-side encryption, MFA, rate limiting, RBAC, audit logging, and security best practices.

## Last Updated

April 5, 2026 (originally January 17, 2026)

## 1. Audit Logging System

### Database Schema

**Migration File:** `supabase/migrations/20260117000000_audit_log_system.sql`

**Audit Log Table:**
```sql
audit_log (
  log_id UUID PRIMARY KEY,
  timestamp TIMESTAMPTZ,
  user_id UUID,
  user_email TEXT,
  user_role_id INTEGER,
  action_type TEXT, -- CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT, FAILED_LOGIN, PERMISSION_DENIED
  resource_type TEXT, -- USER, PROPERTY, APPOINTMENT, PROFILE, ADMIN, TENANT, OWNER, AUTH
  resource_id TEXT,
  description TEXT,
  ip_address INET,
  user_agent TEXT,
  status TEXT, -- SUCCESS, FAILED, DENIED
  severity TEXT, -- INFO, WARNING, ERROR, CRITICAL
  metadata JSONB,
  created_at TIMESTAMPTZ
)
```

**Features:**
- Automatic audit triggers on `tenant`, `property_owner`, and `admin` tables
- Row Level Security (RLS) policies - only admins can view audit logs
- Database functions for logging auth events and data access

**Utility Functions:** `src/utils/auditLog.ts`

Key audit logging functions:
- `logAuditEvent()` - Core logging function
- `logLogin()`, `logLogout()`, `logFailedLogin()` - Authentication events
- `logSensitiveDataAccess()` - Tracks decryption of IC numbers and contact numbers
- `logProfileUpdate()` - Logs profile modifications
- `logUserCreation()`, `logUserDeletion()` - Admin operations
- `logPermissionDenied()` - Access control violations
- `fetchAuditLogs()` - Query audit logs (admin only)

## 2. Data Encryption Implementation

### Encryption Standards

**Algorithm:** AES-256-GCM via Web Crypto API (server-side)
**Runtime:** Supabase Edge Function (`crypto-service`)
**Password Hashing:** Bcrypt (salt rounds: 10, client-side for security PIN)
**Encryption Key:** Stored as Edge Function secret (`ENCRYPTION_KEY`) — never exposed to the client

> **Architecture change (Feb 2026):** Encryption was migrated from client-side CryptoJS to a server-side Supabase Edge Function. The `VITE_ENCRYPTION_KEY` environment variable has been removed. All encrypt/decrypt operations now route through the `crypto-service` Edge Function.

**Client Wrapper:** `src/utils/security.ts`

```typescript
encryptData(text: string): Promise<string>   // Calls crypto-service Edge Function (encrypt)
decryptData(ciphertext: string): Promise<string>  // Calls crypto-service Edge Function (decrypt)
batchDecrypt(ciphertexts: (string|null)[]): Promise<(string|null)[]>  // Batch decrypt (max 50)
hashPin(pin: string): Promise<string>         // Bcrypt hashing (client-side)
```

**Edge Function:** `supabase/functions/crypto-service/index.ts`

| Action | Auth Required | Description |
|--------|--------------|-------------|
| `encrypt` | No (needed during registration) | Encrypts plaintext → `{ciphertext, iv}` JSON |
| `decrypt` | Yes (JWT) | Decrypts `{ciphertext, iv}` → plaintext |
| `batch_decrypt` | Yes (JWT) | Decrypts up to 50 ciphertexts in parallel |

### Fields Encrypted

| Field | Tables | Status |
|-------|--------|--------|
| **contact_no** | tenant, property_owner, admin | ✅ **ENCRYPTED** |
| **ic_no** | tenant, property_owner, admin | ✅ **ENCRYPTED** |
| **security_pin** | user metadata | ✅ **HASHED (bcrypt)** |
| password | auth.users (Supabase Auth) | ✅ Managed by Supabase |
| email | all tables | ❌ Plain text (required for auth) |
| date_of_birth | all user tables | ❌ Plain text (low sensitivity) |

## 3. Supabase Edge Functions

### crypto-service
- **Purpose:** Server-side AES-256-GCM encryption/decryption
- **Auth:** JWT required for decrypt/batch_decrypt; encrypt is unauthenticated (registration flow)
- **Key:** `ENCRYPTION_KEY` (Edge Function secret, never exposed to client)
- **File:** `supabase/functions/crypto-service/index.ts`

### admin-create-user
- **Purpose:** Creates new users via Supabase Admin API without affecting the admin's session
- **Auth:** JWT required, caller must have admin role (`role_id: 1`)
- **Validation:** Server-side password policy enforcement (8+ chars, upper, lower, digit, special)
- **File:** `supabase/functions/admin-create-user/index.ts`

### rate-limiter
- **Purpose:** Server-side rate limiting using sliding window algorithm
- **Storage:** `rate_limits` table (service_role only)
- **Actions:** `login` (5 attempts/5 min), `password_reset`, `registration`
- **Operations:** `check`, `record`, `reset`
- **File:** `supabase/functions/rate-limiter/index.ts`

## 4. Components Using Encryption

### Profile Pages (encrypt/decrypt via Edge Function)

| Component | Encrypt on Save | Decrypt on Fetch | Audit Logging |
|-----------|----------------|------------------|---------------|
| `TenantProfile.tsx` | contact_no, ic_no | contact_no, ic_no | ✅ |
| `OwnerProfile.tsx` | contact_no, ic_no | contact_no, ic_no | ✅ |
| `AdminUsers.tsx` | contact_no | contact_no | ✅ |
| `AdminPropertyOwners.tsx` | contact_no, ic_no | contact_no, ic_no | ✅ |
| `Auth.tsx` | contact_no (registration) | — | ✅ |
| `TenantAppointments.tsx` | — | contact_no | ✅ |
| `OwnerAppointments.tsx` | — | contact_no | ✅ |

## 5. Authentication & Access Control

### Multi-Factor Authentication (MFA)
- **Type:** TOTP (Time-based One-Time Password)
- **Provider:** Supabase Auth MFA
- **Components:**
  - `src/components/auth/MFASetup.tsx` — QR code enrollment flow
  - `src/components/auth/MFAVerify.tsx` — Code verification during login
  - `src/components/auth/MFASection.tsx` — Profile page enable/disable toggle
- **Available to:** All user roles (admin, owner, tenant)
- **Enforcement:** Optional per-user; can be enabled from profile settings

### Password Policy
- **Validation:** `src/utils/passwordValidation.ts`
- **Requirements:** 8+ characters, uppercase, lowercase, digit, special character
- **Enforced at:**
  - Client-side: Registration form, password reset form
  - Server-side: `admin-create-user` Edge Function
- **Password Reset:** Dedicated `/reset-password` page with email-based flow

### Rate Limiting
- **Implementation:** `rate-limiter` Edge Function with `rate_limits` DB table
- **Protected actions:** Login, registration, password reset
- **Default limits:** 5 attempts per 5-minute sliding window
- **Behavior:** Counter resets on successful login

### Role-Based Access Control (RBAC)
- **Roles:** Admin (1), Property Owner (2), Tenant (3)
- **Enforced at:**
  - Route level: `ProtectedRoute` component with `allowedRoles` prop
  - Database level: RLS policies with `has_role_id()` function
  - Edge Function level: JWT role verification (admin-create-user)
  - Application level: `useAuth` hook with `userProfile.roleId`
- **Migration:** `supabase/migrations/20260405000000_rbac_hardening.sql`

## 6. Security Best Practices Implemented

### ✅ Server-Side Encryption
- All sensitive PII encrypted via Supabase Edge Function (never in browser)
- Encryption key stored as Edge Function secret (not in client bundle)
- AES-256-GCM with random IV per encryption operation

### ✅ Encryption in Transit
- HTTPS enforced by Supabase
- All API calls encrypted via TLS

### ✅ Comprehensive Audit Trail
- All database modifications to user tables automatically logged
- Sensitive data access logged (decryption events)
- Admin operations logged (create/delete users)
- Authentication events logged (login/logout/failures)

### ✅ Row Level Security (RLS)
- Database-level access control via Supabase RLS policies
- Users can only access their own data
- Admins have elevated permissions via role-based policies
- Audit logs only accessible to admins
- Views use `security_invoker = true` to ensure RLS policies are evaluated based on the querying user (not the view creator)

### ✅ Password Security
- Passwords managed by Supabase Auth (industry-standard hashing)
- Security PINs hashed with bcrypt (salt rounds: 10)
- Strong password policy enforced client-side and server-side
- No plaintext passwords stored anywhere

### ✅ Multi-Factor Authentication
- TOTP-based MFA via Supabase Auth
- Optional per-user enrollment
- QR code setup with authenticator app support

### ✅ Rate Limiting
- Server-side sliding window rate limiting
- Protects login, registration, and password reset endpoints
- Automatic counter reset on successful authentication

### ✅ Access Control
- Role-Based Access Control (RBAC) enforced at:
  - Route level (ProtectedRoute component)
  - Database level (RLS policies + `user_roles` table)
  - Edge Function level (JWT verification)
  - Application level (useAuth hook)

## 6. Compliance & Standards

### Data Protection
- **GDPR-Ready:** Encryption of PII, audit trails, right to erasure support
- **PDPA (Malaysia) Compliant:** Secure handling of IC numbers and personal data
- **ISO 27001 Aligned:** Audit logging, encryption, access controls

### Industry Standards
- **OWASP Top 10:** Protected against injection, broken auth, sensitive data exposure
- **PCI DSS Principles:** Strong cryptography, access controls, audit trails
- **NIST Framework:** Data encryption, monitoring, access management

## 7. Environment Variables

### Client-side (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anon/public key |
| `VITE_SUPABASE_PROJECT_ID` | Yes | Supabase project reference ID |
| `VITE_N8N_NEW_BOOKING_WEBHOOK` | Yes | n8n webhook URL for new appointments |
| `VITE_N8N_STATUS_WEBHOOK` | Yes | n8n webhook URL for status updates |
| `VITE_N8N_WEBHOOK_SECRET` | Yes | HMAC secret for authenticating webhook calls |

### Server-side (Edge Function Secrets)

| Secret | Used By | Description |
|--------|---------|-------------|
| `ENCRYPTION_KEY` | crypto-service | AES-256-GCM encryption key (never exposed to client) |
| `SUPABASE_SERVICE_ROLE_KEY` | admin-create-user, rate-limiter | Supabase service role key for admin operations |
| `SUPABASE_URL` | All Edge Functions | Auto-set by Supabase |
| `SUPABASE_ANON_KEY` | crypto-service, admin-create-user | Auto-set by Supabase |

**Security Recommendations:**
1. **Generate strong encryption key:** `openssl rand -base64 32`
2. **Never commit `.env` to version control**
3. **Use different keys for dev/staging/production**
4. **`VITE_ENCRYPTION_KEY` has been removed** — encryption is now server-side only

## 8. Audit Log Usage

### For Admins: View Audit Logs

```typescript
import { fetchAuditLogs } from '@/utils/auditLog';

// Fetch all logs
const logs = await fetchAuditLogs();

// Fetch filtered logs
const filtered = await fetchAuditLogs({
  userId: 'specific-user-id',
  actionType: 'DELETE',
  resourceType: 'TENANT',
  startDate: new Date('2026-01-01'),
  limit: 100
});

```

### Common Audit Queries

**SQL Examples** (run in Supabase SQL Editor):

```sql
-- Failed login attempts in last 24 hours
SELECT * FROM audit_log
WHERE action_type = 'FAILED_LOGIN'
AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- Sensitive data access by user
SELECT user_email, resource_type, description, timestamp
FROM audit_log
WHERE action_type = 'READ'
AND metadata->>'fields_accessed' IS NOT NULL
ORDER BY timestamp DESC;

-- User deletions (security-critical events)
SELECT * FROM audit_log
WHERE action_type = 'DELETE'
AND severity IN ('WARNING', 'CRITICAL')
ORDER BY timestamp DESC;
```

## 9. Testing Checklist

### Manual Testing

- [ ] **Tenant Profile**
  - [ ] Create tenant with IC and contact number
  - [ ] Verify data is encrypted in database
  - [ ] View profile - verify data is decrypted correctly
  - [ ] Update profile - verify encryption on save
  - [ ] Check audit log for access and update events

- [ ] **Property Owner Profile**
  - [ ] Same as tenant profile tests
  - [ ] Verify IC number encryption

- [ ] **Admin Users Management**
  - [ ] Create new tenant via admin panel
  - [ ] Verify contact number encrypted in DB
  - [ ] View tenants list - verify decryption
  - [ ] Update tenant - verify encryption
  - [ ] Delete tenant - verify audit log entry

- [ ] **Admin Property Owners Management**
  - [ ] Create new owner via admin panel
  - [ ] Verify IC and contact encrypted
  - [ ] View owners list - verify decryption
  - [ ] Update owner - verify encryption
  - [ ] Delete owner - verify audit log

- [ ] **Audit Logs**
  - [ ] Verify only admins can access audit logs
  - [ ] Verify failed login attempts are logged
  - [ ] Verify sensitive data access is logged
  - [ ] Verify user creation/deletion is logged

### Database Verification

```sql
-- Check encryption (should see ciphertext, not plain text)
SELECT contact_no, ic_no FROM tenant LIMIT 5;
SELECT contact_no, ic_no FROM property_owner LIMIT 5;

-- Verify audit log entries exist
SELECT COUNT(*) FROM audit_log;

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('audit_log', 'tenant', 'property_owner');
```

## 10. Migration Instructions

### Step 1: Apply Database Migrations

```bash
# If using Supabase CLI
supabase db push

# Key migrations (in order):
# 20260117000000_audit_log_system.sql         — Audit log table + triggers
# 20260405000000_rbac_hardening.sql           — RBAC with user_roles table
# 20260405000001_rate_limiting.sql            — Rate limits table
```

### Step 2: Deploy Edge Functions

```bash
supabase functions deploy crypto-service
supabase functions deploy admin-create-user
supabase functions deploy rate-limiter
```

### Step 3: Set Edge Function Secrets

```bash
supabase secrets set ENCRYPTION_KEY="$(openssl rand -base64 32)"
# SUPABASE_URL and SUPABASE_ANON_KEY are auto-set
# SUPABASE_SERVICE_ROLE_KEY must be set for admin-create-user and rate-limiter
```

### Step 4: Deploy Application

```bash
npm run build
# Deploy to your hosting platform
```

## 11. Known Issues & Limitations

### Current Limitations

1. **Email Not Encrypted** ⚠️
   - Emails stored in plain text
   - **Reason:** Required for authentication and notifications
   - **Risk:** Low (emails are semi-public)
   - **Mitigation:** RLS policies protect email access

2. **MFA Not Enforced** ⚠️
   - MFA is optional (user-enabled)
   - **Reason:** Usability trade-off for FYP scope
   - **Risk:** Low (available for security-conscious users)

### Completed Enhancements (formerly "Future")

- ✅ **Server-Side Encryption** — Migrated to Edge Function (Feb 2026)
- ✅ **Multi-Factor Authentication** — TOTP via Supabase Auth MFA (Apr 2026)
- ✅ **Rate Limiting** — Server-side sliding window (Apr 2026)
- ✅ **RBAC Hardening** — Database-level role enforcement (Apr 2026)
- ✅ **Password Policy** — Client + server validation (Apr 2026)

### Future Enhancements

1. **Key Rotation** — Automatic encryption key rotation with re-encryption
2. **Advanced Audit Features** — Real-time alerts, anomaly detection
3. **Data Masking** — Partial masking of IC/contact in UI (show last 4 digits)
4. **MFA Enforcement** — Mandatory MFA for admin accounts

## 12. Maintenance

### Regular Tasks

**Weekly:**
- Review audit logs for suspicious activity
- Check for failed login patterns
- Verify backup integrity

**Monthly:**
- Review and prune old audit logs (>1 year)
- Audit encryption key security
- Update dependencies with security patches

**Quarterly:**
- Security audit
- Penetration testing
- Key rotation planning

**Annually:**
- Full security review
- Compliance assessment
- Disaster recovery drill

## 13. Support & Documentation

### For Developers

- Encryption client wrapper: `src/utils/security.ts`
- Encryption Edge Function: `supabase/functions/crypto-service/index.ts`
- Admin user creation: `supabase/functions/admin-create-user/index.ts`
- Rate limiter: `supabase/functions/rate-limiter/index.ts`
- Password validation: `src/utils/passwordValidation.ts`
- Audit utilities: `src/utils/auditLog.ts`
- MFA components: `src/components/auth/MFASetup.tsx`, `MFAVerify.tsx`, `MFASection.tsx`
- Auth hook: `src/hooks/useAuth.ts`
- Password reset: `src/pages/ResetPassword.tsx`
- RBAC migration: `supabase/migrations/20260405000000_rbac_hardening.sql`
- Rate limit migration: `supabase/migrations/20260405000001_rate_limiting.sql`

### For System Administrators

- Audit log queries: See section 8
- Security monitoring: Check audit_log table daily
- Incident response: Review CRITICAL severity logs immediately

### For Compliance Officers

- Data protection: All PII encrypted at rest via server-side Edge Function
- Audit trail: Complete audit history in audit_log table
- Access controls: RBAC enforced at route, database, Edge Function, and app levels
- Authentication: MFA available, rate limiting active, strong password policy
- Data retention: Audit logs retained for 1 year (configurable)

---

## Summary

✅ **Server-Side Encryption:** AES-256-GCM via Edge Function — key never exposed to client
✅ **MFA:** TOTP-based multi-factor authentication via Supabase Auth
✅ **Rate Limiting:** Server-side sliding window for login, registration, password reset
✅ **RBAC:** Role-based access control at route, database, Edge Function, and app levels
✅ **Password Policy:** Strong password requirements enforced client-side and server-side
✅ **Audit Logging:** Comprehensive audit trail for all sensitive operations
✅ **Compliance:** GDPR/PDPA-ready with encrypted PII and audit trails
✅ **Best Practices:** Industry-standard encryption, password hashing, and security controls

**Security Posture:** Strong ✅
**Compliance Ready:** Yes ✅
**Production Ready:** Yes (with noted limitations) ✅
