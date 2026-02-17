# Architecture

**Analysis Date:** 2026-02-18

## Pattern Overview

**Overall:** Role-Based Single Page Application (SPA) with Backend-as-a-Service (BaaS)

**Key Characteristics:**
- Three-tier RBAC with role-specific route groups, layouts, and page components
- All backend logic delegated to Supabase (auth, database, RLS, storage, triggers)
- No separate API server - frontend queries Supabase directly via its JS client
- Encryption and audit logging performed client-side before/after database operations
- Route-level authorization enforced by `ProtectedRoute` component wrapping layout trees

## Layers

**Presentation Layer:**
- Purpose: Render UI and handle user interaction
- Location: `src/pages/`, `src/components/`
- Contains: Page components (one per route), role-specific layout shells, reusable UI widgets
- Depends on: Authentication hooks, Supabase client, utility functions
- Used by: React Router (via `src/App.tsx`)

**Authentication/Authorization Layer:**
- Purpose: Manage session state and enforce role-based access
- Location: `src/hooks/useAuth.ts`, `src/components/auth/ProtectedRoute.tsx`
- Contains: Session listener, profile loader, role-resolved user object, route guard
- Depends on: Supabase auth client, `user_roles` table
- Used by: All role-specific layouts and pages

**Security Utilities Layer:**
- Purpose: Encrypt/decrypt sensitive PII fields and hash security PINs before persistence
- Location: `src/utils/security.ts`
- Contains: `encryptData()`, `decryptData()` (AES-256 via CryptoJS), `hashPin()` (bcrypt)
- Depends on: `VITE_ENCRYPTION_KEY` env var
- Used by: `src/pages/Auth.tsx`, `src/pages/tenant/TenantProfile.tsx`, `src/pages/owner/OwnerProfile.tsx`, `src/pages/admin/AdminUsers.tsx`

**Audit Logging Layer:**
- Purpose: Record a tamper-evident trail of all security-sensitive operations
- Location: `src/utils/auditLog.ts`
- Contains: `logAuditEvent()` (base), and domain-specific helpers (`logLogin`, `logLogout`, `logFailedLogin`, `logSensitiveDataAccess`, `logProfileUpdate`, `logUserCreation`, `logUserDeletion`, `logPropertyCreation`, `logPropertyUpdate`, `logPropertyDeletion`, `logSecurityEvent`, `fetchAuditLogs`)
- Depends on: Supabase client, `audit_log` table (accessed via type assertion)
- Used by: `src/pages/Auth.tsx`, all profile pages, `src/hooks/useAuth.ts`

**Integration Layer:**
- Purpose: Typed Supabase singleton client shared across the app
- Location: `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`
- Contains: Single `supabase` export with session persistence and auto token refresh enabled
- Depends on: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` env vars
- Used by: Every component or hook that reads/writes data

**Database Layer (Supabase/PostgreSQL):**
- Purpose: Persistent storage, Row Level Security enforcement, and automatic audit triggers
- Location: `supabase/migrations/`
- Contains: Schema migrations, RLS policies, security-definer functions, DB-level audit triggers on `tenant`, `property_owner`, `admin` tables
- Depends on: Supabase cloud project
- Used by: All data operations from the frontend

## Data Flow

**Login Flow:**

1. User submits credentials on `src/pages/Auth.tsx`
2. Zod validates input client-side
3. `supabase.auth.signInWithPassword()` called
4. On success, `user_roles` table queried to resolve `role_id`
5. `logLogin()` writes entry to `audit_log` table
6. `redirectBasedOnRole()` navigates to `/admin`, `/owner`, or `/tenant`
7. `ProtectedRoute` re-checks session and role, renders layout + `<Outlet />`
8. `useAuth` hook's `onAuthStateChange` listener fires, fetches full `UserProfile` from role-specific table

**Registration Flow:**

1. User submits form on `src/pages/Auth.tsx` (register tab)
2. Zod validates input; `encryptData()` encrypts contact number; `hashPin()` hashes security PIN
3. `supabase.auth.signUp()` called with encrypted/hashed values in `options.data`
4. Supabase `handle_new_user` DB trigger automatically creates records in `users`, `user_roles`, and role-specific profile table (`tenant` or `property_owner`)
5. Auto-login attempted; redirects to role dashboard if successful

**Sensitive Data Read Flow:**

1. Page component fetches row from `tenant`, `property_owner`, or `admin` table
2. `decryptData()` called on `contact_no` and `ic_no` fields
3. `logSensitiveDataAccess()` writes READ audit entry
4. Decrypted values set in local component state for display

**Sensitive Data Write Flow:**

1. User edits profile form; component state holds plain-text values
2. On submit, `encryptData()` applied to `contact_no` and `ic_no`
3. Encrypted ciphertext inserted/updated in Supabase table
4. `logProfileUpdate()` writes UPDATE audit entry

**State Management:**

- Server state: Fetched directly via Supabase client inside `useEffect` hooks; no React Query wrappers used in practice (QueryClientProvider is set up in `src/App.tsx` but pages use manual state)
- Auth state: Managed in `useAuth` hook via `useState` + `supabase.auth.onAuthStateChange` subscription
- Form state: Local `useState` in each page component; no global form library used except Zod for validation on the auth page

## Key Abstractions

**ProtectedRoute:**
- Purpose: Declarative route guard that blocks unauthenticated or wrong-role access
- Examples: `src/components/auth/ProtectedRoute.tsx`
- Pattern: Wraps role-grouped `<Route>` trees in `src/App.tsx`; checks `user_roles` table directly; redirects to `/auth` on failure with `state={{ from: location }}`

**Role-Specific Layout:**
- Purpose: Provide persistent sidebar navigation and header for each role domain
- Examples: `src/components/layout/AdminLayout.tsx`, `src/components/layout/OwnerLayout.tsx`, `src/components/layout/TenantLayout.tsx`
- Pattern: Renders `<Outlet />` for child page content; consumes `useAuth()` for user display name and `signOut()`

**useAuth Hook:**
- Purpose: Central auth state - session, user, resolved role+profile, sign out
- Examples: `src/hooks/useAuth.ts`
- Pattern: Custom hook with `useState` + `useEffect`; listens to `onAuthStateChange`; resolves role then queries role-specific profile table; exposes `redirectBasedOnRole()`

**Security Utilities:**
- Purpose: Provide a consistent encryption/hashing API for all sensitive fields
- Examples: `src/utils/security.ts`
- Pattern: Pure functions exported from single module; `encryptData`/`decryptData` use AES-256; `hashPin` uses bcrypt with salt rounds 10; key loaded from env at module initialization (throws if missing)

**Audit Log Utilities:**
- Purpose: Structured event logging for compliance and security monitoring
- Examples: `src/utils/auditLog.ts`
- Pattern: All helpers delegate to `logAuditEvent()` which auto-attaches current session user, queries `user_roles` for `user_role_id`, and inserts into `audit_log` table; typed enums for `ActionType`, `ResourceType`, `Status`, `Severity`

## Entry Points

**Application Bootstrap:**
- Location: `src/main.tsx`
- Triggers: Browser loads `index.html`, Vite serves `main.tsx`
- Responsibilities: Mounts `<App />` into `#root` DOM element

**Router Configuration:**
- Location: `src/App.tsx`
- Triggers: `main.tsx` renders `<App />`
- Responsibilities: Sets up `QueryClientProvider`, `TooltipProvider`, global toasters, `BrowserRouter`, all `<Route>` definitions with `ProtectedRoute` wrappers, and global `<PropertyChatbot />` overlay

**Authentication Page:**
- Location: `src/pages/Auth.tsx`
- Triggers: Navigation to `/auth` or redirect from `ProtectedRoute`
- Responsibilities: Login and registration forms, Zod validation, Supabase auth calls, encryption before registration, audit logging, role-based redirect after success

## Error Handling

**Strategy:** Optimistic UI with try/catch blocks; toast notifications for user feedback; console.error for developer diagnostics

**Patterns:**
- All async data operations wrapped in `try/catch/finally`; `finally` always clears loading state
- Supabase errors surfaced via `toast({ variant: 'destructive' })` using `useToast()` hook
- Zod validation errors caught and first message extracted: `error.errors[0].message`
- `decryptData()` falls back to returning the original ciphertext on failure (logged to console)
- `logAuditEvent()` silently catches errors to avoid blocking normal application flow

## Cross-Cutting Concerns

**Logging:** All security-sensitive events logged via `src/utils/auditLog.ts`; writes to `audit_log` Supabase table; admin-only RLS enforced server-side

**Validation:** Zod schemas defined inline in `src/pages/Auth.tsx` for login and registration; field-level HTML `required` attributes used elsewhere

**Authentication:** Supabase session stored in `localStorage` with auto token refresh; `ProtectedRoute` re-checks on `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED` events; double-enforced via Supabase RLS policies at database level

**Encryption:** AES-256 via CryptoJS applied to `contact_no` and `ic_no` before any write to `admin`, `property_owner`, or `tenant` tables; must decrypt after any read before display

---

*Architecture analysis: 2026-02-18*
