# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PropertyPal is a property management platform built with React, TypeScript, Vite, and Supabase. It supports three user roles (Admin, Property Owner, Tenant) with role-based access control (RBAC) and server-side data encryption for sensitive information via Supabase Edge Functions.

## Development Commands

### Running the Application
```bash
npm run dev          # Start development server on port 8080
npm run build        # Production build
npm run build:dev    # Development build
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Database Management
Database migrations are located in `supabase/migrations/` and manage the PostgreSQL schema with Row Level Security (RLS) policies. Migrations are applied through Supabase CLI or dashboard.

## Architecture

### Role-Based Access Control (RBAC)

The application implements a three-tier role system:

1. **Admin (roleId: 1)** - Full system access via `/admin` routes
2. **Property Owner (roleId: 2)** - Property management via `/owner` routes
3. **Tenant (roleId: 3)** - Property browsing and appointments via `/tenant` routes

**Key Components:**
- `src/components/auth/ProtectedRoute.tsx` - Route-level authorization guard
- `src/hooks/useAuth.ts` - Centralized authentication and user profile management
- Database tables: `users`, `user_roles`, `roles`, `admin`, `property_owner`, `tenant`

**Authentication Flow:**
1. User signs in via Supabase Auth ([src/pages/Auth.tsx](src/pages/Auth.tsx))
2. `useAuth` hook fetches role from `user_roles` table
3. Profile data loaded from role-specific table (admin/property_owner/tenant)
4. `ProtectedRoute` validates role against allowed roles for each route
5. Unauthorized access redirects to `/auth`

**Login Rate Limiting:**
- Max 5 failed login attempts before a 60-second lockout
- Lockout state managed in `src/pages/Auth.tsx` (client-side)
- Countdown timer shown on the login button during lockout

### Security Architecture

**Encryption ([src/utils/security.ts](src/utils/security.ts)):**
- All encryption/decryption is **server-side only** via the `crypto-service` Edge Function
- AES-256-GCM with a random IV per value; key never exposed to the client
- `ENCRYPTION_KEY` is stored as a **Supabase Edge Function secret** (not in `.env`)
- `encryptData()` and `decryptData()` are **async** — they invoke the Edge Function
- `encryptData()` works without authentication (needed during registration)
- `decryptData()` and `batchDecrypt()` require a valid user JWT
- Security PINs hashed using bcrypt (salt rounds: 10) via `hashPin()` — client-side only
- **CRITICAL:** IC numbers and contact numbers MUST be encrypted before saving to database
- **CRITICAL:** Always decrypt before displaying sensitive data to users

**Edge Functions ([supabase/functions/](supabase/functions/)):**

| Function | Auth Required | Purpose |
|---|---|---|
| `crypto-service` | JWT for decrypt/batch_decrypt only | AES-256-GCM encrypt/decrypt |
| `admin-create-user` | JWT + roleId:1 check | Create users without hijacking admin session |

- CORS is **allowlisted** — only `http://localhost:8080` and `http://localhost:5173` are permitted
- Do NOT use wildcard `*` CORS on any Edge Function
- `admin-create-user` uses the `service_role` key (Admin API) so it never touches the caller's session
- Admin pages call `supabase.functions.invoke('admin-create-user', ...)` — **never** `supabase.auth.signUp()` directly

**IDOR Protection (Insecure Direct Object Reference):**
- All owner property mutations include `.eq('owner_id', ownerId)` — see [src/pages/owner/OwnerProperties.tsx](src/pages/owner/OwnerProperties.tsx)
- All owner appointment status updates include `.eq('owner_id', ownerId)` — see [src/pages/owner/OwnerAppointments.tsx](src/pages/owner/OwnerAppointments.tsx)
- All tenant appointment cancellations include `.eq('tenant_id', tenantId)` — see [src/pages/tenant/TenantAppointments.tsx](src/pages/tenant/TenantAppointments.tsx)
- **ALWAYS** scope mutations to the authenticated user's ID — never update/delete by record ID alone

**Admin Page Authorization:**
- Every admin page (`AdminDashboard`, `AdminUsers`, `AdminPropertyOwners`, `AdminReports`) performs an in-component role check via `useAuth()` in addition to `ProtectedRoute`
- If `userProfile?.roleId !== 1`, the page renders an "Access Denied" state immediately
- `useEffect` data fetches depend on `userProfile` to prevent loading before auth is confirmed

**Chatbot Data Safety ([src/components/chat/PropertyChatbot.tsx](src/components/chat/PropertyChatbot.tsx)):**
- Property query uses an **explicit column list** — never `select("*")`
- Permitted columns: `property_id, property_type, location, rental_price, num_bedroom, num_bathroom, property_size, description, availability_status, images`
- `owner_id` and any other sensitive join columns are deliberately excluded

**CSS Injection Prevention ([src/components/ui/chart.tsx](src/components/ui/chart.tsx)):**
- CSS values passed to `dangerouslySetInnerHTML` are sanitized via `sanitizeCssValue()` and `sanitizeCssIdentifier()`
- These strip any characters outside safe CSS value ranges before injection

**Audit Logging ([src/utils/auditLog.ts](src/utils/auditLog.ts)):**
- Comprehensive audit trail for all security-sensitive operations
- Automatic logging of database changes via triggers
- Application-level logging for sensitive data access, authentication events, and admin actions
- Database: `audit_log` table with RLS (admin-only access)
- Key functions:
  - `logSensitiveDataAccess()` - Track when encrypted data is decrypted
  - `logProfileUpdate()` - Track profile modifications
  - `logUserCreation()`, `logUserDeletion()` - Track admin operations
  - `logLogin()`, `logLogout()`, `logFailedLogin()` - Track authentication
  - `fetchAuditLogs()` - Query audit logs (admin only)

**Database Security:**
- Row Level Security (RLS) enabled on all tables
- Security definer functions prevent recursive RLS issues
- Policies enforce role-based data access at database level
- Automatic audit triggers on `tenant`, `property_owner`, and `admin` tables
- See [supabase/migrations/20251227195951_8b63911f-d265-42f6-ac67-8fdb2f061b37.sql](supabase/migrations/20251227195951_8b63911f-d265-42f6-ac67-8fdb2f061b37.sql) for RLS policies
- See [supabase/migrations/20260117000000_audit_log_system.sql](supabase/migrations/20260117000000_audit_log_system.sql) for audit system

### Project Structure

```
property-pal/
├── docs/                   # Documentation files
│   ├── REGISTRATION_FIX_SUMMARY.md
│   ├── REGISTRATION_FIX_VERIFICATION.md
│   ├── SECURITY_IMPLEMENTATION.md
│   └── supabase_mcp_setup.md
├── src/
│   ├── components/
│   │   ├── auth/           # Authentication guards
│   │   ├── chat/           # PropertyChatbot component
│   │   ├── landing/        # Public landing page components
│   │   ├── layout/         # Role-specific layouts (AdminLayout, OwnerLayout, TenantLayout)
│   │   ├── properties/     # Property-related components
│   │   └── ui/             # shadcn/ui components
│   ├── hooks/              # Custom React hooks (useAuth, use-toast, use-mobile)
│   ├── integrations/
│   │   └── supabase/       # Supabase client and auto-generated types
│   ├── lib/                # Utility libraries (utils.ts for cn() helper)
│   ├── pages/              # Route components
│   │   ├── admin/          # Admin dashboard and management pages
│   │   ├── owner/          # Property owner dashboard and pages
│   │   └── tenant/         # Tenant dashboard and pages
│   ├── utils/              # Security utilities (encryption, audit logging)
│   └── App.tsx             # Router configuration with role-based routes
├── supabase/
│   ├── functions/
│   │   ├── crypto-service/ # AES-256-GCM encrypt/decrypt Edge Function
│   │   └── admin-create-user/ # Admin API user creation Edge Function
│   ├── migrations/         # Database migrations (applied via Supabase)
│   └── scripts/            # Utility SQL scripts (manual execution)
│       ├── COMPLETE_REGISTRATION_FIX.sql
│       └── DIAGNOSTIC_QUERY.sql
├── CLAUDE.md               # AI assistant instructions (this file)
└── README.md               # Project readme
```

### Routing Structure

Routes are defined in [src/App.tsx](src/App.tsx):

- `/` - Public landing page
- `/auth` - Authentication page
- `/admin/*` - Admin routes (requires roleId: 1)
  - `/admin` - Dashboard
  - `/admin/users` - User management
  - `/admin/owners` - Property owner management
  - `/admin/reports` - System reports
- `/owner/*` - Owner routes (requires roleId: 2)
  - `/owner` - Dashboard
  - `/owner/properties` - Property management
  - `/owner/appointments` - Appointment management
  - `/owner/profile` - Profile settings
- `/tenant/*` - Tenant routes (requires roleId: 3)
  - `/tenant` - Dashboard
  - `/tenant/properties` - Browse properties
  - `/tenant/appointments` - View appointments
  - `/tenant/profile` - Profile settings

Each role-based route group uses a dedicated layout component and is protected by `ProtectedRoute`.

### State Management

- **React Query (@tanstack/react-query)** - Server state management and caching
- **Supabase Client** - Real-time subscriptions and database queries
- **useAuth Hook** - Global authentication state with session persistence
- **React Hook Form + Zod** - Form state and validation

### UI Framework

Built with **shadcn/ui** component library:
- Configuration: [components.json](components.json)
- Components: [src/components/ui/](src/components/ui/)
- Styling: Tailwind CSS with custom theme extensions ([tailwind.config.ts](tailwind.config.ts))
- Path aliases: `@/` maps to `src/`

Custom theme colors: `property-warm`, `property-earth` for brand consistency

### Database Schema (Supabase)

**Core Tables:**
- `users` - User accounts (linked to auth.users)
- `roles` - Role definitions (Admin, Property Owner, Tenant)
- `user_roles` - User-to-role mapping (supports RBAC)
- `admin`, `property_owner`, `tenant` - Role-specific profile data (contact_no and ic_no are ENCRYPTED)
- `property` - Property listings
- `appointment` - Viewing appointments
- `notifications` - User notifications
- `audit_log` - Comprehensive audit trail (admin-only access)

**Type Safety:**
Auto-generated TypeScript types in [src/integrations/supabase/types.ts](src/integrations/supabase/types.ts) provide end-to-end type safety for database operations.

## Important Notes

### Environment Variables

Required variables in `.env`:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon key

**No longer in `.env`:**
- `VITE_ENCRYPTION_KEY` has been removed — encryption is now fully server-side via the `crypto-service` Edge Function. The key is stored as a **Supabase Edge Function secret** named `ENCRYPTION_KEY`. Set it via Supabase Dashboard → Settings → Edge Functions → Secrets.

### TypeScript Configuration

TypeScript is configured with relaxed strictness for development flexibility:
- `noImplicitAny: false`
- `strictNullChecks: false`
- `noUnusedLocals: false`
- `noUnusedParameters: false`

ESLint is configured to ignore unused variables (`@typescript-eslint/no-unused-vars: off`).

### Supabase Client Usage

Import the singleton client:
```typescript
import { supabase } from '@/integrations/supabase/client';
```

Session persistence is enabled via localStorage with automatic token refresh.

### Component Patterns

When creating new role-specific pages:
1. Place in appropriate folder: `src/pages/admin/`, `src/pages/owner/`, or `src/pages/tenant/`
2. Add route to [src/App.tsx](src/App.tsx) within the corresponding `ProtectedRoute` wrapper
3. Use `useAuth()` hook to access user profile and role information
4. **ALWAYS** scope mutations to the authenticated user's own records (IDOR prevention)
5. **ALWAYS** decrypt sensitive data using `await decryptData()` from [src/utils/security.ts](src/utils/security.ts) before display — note it is async
6. **ALWAYS** log sensitive data access using `logSensitiveDataAccess()` from [src/utils/auditLog.ts](src/utils/auditLog.ts)

### Security Best Practices

**Data Encryption (MANDATORY):**
- **ALWAYS** encrypt IC numbers and contact numbers before saving to database using `await encryptData()`
- **ALWAYS** decrypt before displaying to users using `await decryptData()`
- **NEVER** store plain text IC numbers or contact numbers in database
- Use `hashPin()` for security PINs — never store plain text
- Both `encryptData` and `decryptData` are **async** — always use `await`
- Encryption is handled by the `crypto-service` Edge Function — the key never reaches the browser

**Admin User Creation (MANDATORY):**
- **NEVER** call `supabase.auth.signUp()` in admin pages — this hijacks the admin's own session
- **ALWAYS** use `supabase.functions.invoke('admin-create-user', { body: { email, password, role, ... } })` instead
- The Edge Function uses the `service_role` key server-side and returns `{ userId }` on success

**IDOR Prevention (MANDATORY):**
- **ALWAYS** add `.eq('owner_id', ownerId)` to owner property/appointment mutations
- **ALWAYS** add `.eq('tenant_id', tenantId)` to tenant appointment mutations
- **NEVER** update or delete a record by its primary key alone — always scope to the session user

**CORS on Edge Functions:**
- **NEVER** use `'Access-Control-Allow-Origin': '*'` on any Edge Function
- Use the `getCorsHeaders(req)` pattern that checks against `ALLOWED_ORIGINS`
- Add your production domain to `ALLOWED_ORIGINS` before deploying

**Audit Logging (MANDATORY):**
- **ALWAYS** log when sensitive data is decrypted: `logSensitiveDataAccess(resourceType, resourceId, ['contact_no', 'ic_no'])`
- **ALWAYS** log profile updates: `logProfileUpdate(resourceType, resourceId, updatedFields)`
- Log user creation/deletion in admin panels: `logUserCreation()`, `logUserDeletion()`
- Failed operations should also be logged for security monitoring

**Access Control:**
- Validate user roles on both frontend (ProtectedRoute) and backend (RLS policies)
- Admin pages also verify `userProfile?.roleId === 1` in-component before rendering data
- Sensitive operations should query through RLS-protected tables, not bypass security
- Audit logs are admin-only — enforced by RLS policies

**Environment Security:**
- Never commit `.env` file
- `ENCRYPTION_KEY` is a Supabase secret — rotate via dashboard every 90 days
- Rotating `ENCRYPTION_KEY` invalidates all existing encrypted data — re-encrypt before rotating

**Example: Fetching and Decrypting Sensitive Data**

```typescript
import { decryptData } from '@/utils/security';
import { logSensitiveDataAccess } from '@/utils/auditLog';

const fetchProfile = async () => {
  const { data } = await supabase
    .from('tenant')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (data) {
    // decryptData is async — always await
    const decryptedContactNo = data.contact_no ? await decryptData(data.contact_no) : '';
    const decryptedIcNo = data.ic_no ? await decryptData(data.ic_no) : '';

    const accessedFields = [];
    if (decryptedContactNo) accessedFields.push('contact_no');
    if (decryptedIcNo) accessedFields.push('ic_no');

    if (accessedFields.length > 0) {
      logSensitiveDataAccess('TENANT', data.tenant_id.toString(), accessedFields);
    }

    setProfile({
      ...data,
      contact_no: decryptedContactNo,
      ic_no: decryptedIcNo,
    });
  }
};
```

**Example: Encrypting and Saving Sensitive Data**

```typescript
import { encryptData } from '@/utils/security';
import { logProfileUpdate } from '@/utils/auditLog';

const saveProfile = async () => {
  // encryptData is async — always await
  const encryptedContactNo = profile.contact_no ? await encryptData(profile.contact_no) : null;
  const encryptedIcNo = profile.ic_no ? await encryptData(profile.ic_no) : null;

  await supabase
    .from('tenant')
    .update({
      name: profile.name,
      contact_no: encryptedContactNo,
      ic_no: encryptedIcNo,
    })
    .eq('user_id', userId);

  const updatedFields = ['name'];
  if (encryptedContactNo) updatedFields.push('contact_no');
  if (encryptedIcNo) updatedFields.push('ic_no');

  logProfileUpdate('TENANT', tenantId.toString(), updatedFields);
};
```

**Example: Admin Creating a User (correct pattern)**

```typescript
const { data, error } = await supabase.functions.invoke('admin-create-user', {
  body: {
    email,
    password,
    role: 'tenant', // or 'property_owner'
    name,
    contact_no,  // plain text — Edge Function encrypts server-side
    ic_no,
  }
});

if (error) {
  // handle error
}
// data.userId contains the new user's ID
```

**For detailed security implementation guide, see:** [docs/SECURITY_IMPLEMENTATION.md](docs/SECURITY_IMPLEMENTATION.md)
