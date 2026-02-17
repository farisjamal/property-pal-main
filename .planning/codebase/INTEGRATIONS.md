# External Integrations

**Analysis Date:** 2026-02-18

## APIs & External Services

**Backend-as-a-Service:**
- Supabase - Primary backend platform handling auth, database, storage, and real-time
  - SDK/Client: `@supabase/supabase-js` ^2.89.0
  - Client singleton: `src/integrations/supabase/client.ts`
  - Auth: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` env vars
  - Project ID: `wlflgdiqnrhjhgnhosvu` (from `supabase/config.toml`)

## Data Storage

**Databases:**
- Supabase PostgreSQL (managed)
  - Connection: via `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`
  - Client: Supabase JS SDK (no separate ORM; typed via auto-generated `src/integrations/supabase/types.ts`)
  - Row Level Security: Enabled on all tables
  - Migrations: `supabase/migrations/` (19 migration files, applied via Supabase CLI or dashboard)

**Core Tables:**
- `users` - User accounts linked to `auth.users`
- `roles` - Role definitions (Admin=1, Property Owner=2, Tenant=3)
- `user_roles` - User-to-role mapping
- `admin`, `property_owner`, `tenant` - Role-specific profile data (encrypted `contact_no`, `ic_no`)
- `property` - Property listings
- `appointment` - Property viewing appointments
- `notifications` - User notifications
- `audit_log` - Comprehensive audit trail (admin-only RLS; not in auto-generated types, accessed via type assertion in `src/utils/auditLog.ts`)

**File Storage:**
- Not detected - No Supabase Storage SDK calls found; property images not confirmed to use external storage

**Caching:**
- @tanstack/react-query - In-memory client-side caching for server state

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built into `@supabase/supabase-js`)
  - Implementation: Email/password authentication via `src/pages/Auth.tsx`
  - Session persistence: localStorage (`storage: localStorage` in `src/integrations/supabase/client.ts`)
  - Auto token refresh: enabled (`autoRefreshToken: true`)
  - Session management: `src/hooks/useAuth.ts` reads role from `user_roles` table after sign-in
  - Route guard: `src/components/auth/ProtectedRoute.tsx` enforces role-based access

**Role-Based Access:**
- Three-tier RBAC enforced at both application level (ProtectedRoute) and database level (RLS policies)
- Role IDs: Admin (1), Property Owner (2), Tenant (3)

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, Datadog, or similar SDK found

**Audit Logging:**
- Custom implementation via `src/utils/auditLog.ts`
- Writes to `audit_log` Supabase table
- Captures: logins, logouts, failed logins, sensitive data access (decryption events), profile updates, user CRUD, property CRUD, appointment status changes, permission denials
- Severity levels: INFO, WARNING, ERROR, CRITICAL
- `navigator.userAgent` captured automatically on each log entry
- Accessible only to Admin role (enforced by RLS)

**Logs:**
- `console.error` used for failed audit writes and decryption errors in `src/utils/security.ts` and `src/utils/auditLog.ts`
- No structured logging service

## CI/CD & Deployment

**Hosting:**
- Not explicitly configured - No `netlify.toml`, `vercel.json`, or similar deployment config detected
- Static SPA output from `npm run build` is deployable to any static host

**CI Pipeline:**
- Not detected - No GitHub Actions, CircleCI, or similar config found

## Encryption & Cryptography

**Client-Side Encryption:**
- crypto-js 4.2.0 - AES-256 encryption (CBC mode via CryptoJS.AES)
  - Implementation: `src/utils/security.ts`
  - Key source: `VITE_ENCRYPTION_KEY` env var
  - Usage: Encrypt `contact_no` and `ic_no` before saving; decrypt on display
  - Fatal error thrown at startup if key is missing

**Password/PIN Hashing:**
- bcryptjs 3.0.3 - bcrypt hashing for security PINs
  - Salt rounds: 10
  - One-way hash - cannot be reversed

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

**Real-time (Supabase):**
- Supabase real-time subscriptions available via SDK but specific subscriptions not confirmed in explored source files

## Environment Configuration

**Required env vars:**
- `VITE_SUPABASE_URL` - Supabase project endpoint URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon (public) key
- `VITE_ENCRYPTION_KEY` - AES encryption secret (min 32 bytes recommended; app fails to start without it)

**Secrets location:**
- `.env` file at project root (not committed to git; listed in `.gitignore`)
- All `VITE_*` vars are bundled into the client build - do not store server-side secrets here

**Database migrations:**
- Location: `supabase/migrations/`
- Applied via Supabase CLI or Supabase dashboard
- Scripts for manual fixes: `supabase/scripts/COMPLETE_REGISTRATION_FIX.sql`, `supabase/scripts/DIAGNOSTIC_QUERY.sql`

---

*Integration audit: 2026-02-18*
