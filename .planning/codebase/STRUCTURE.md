# Codebase Structure

**Analysis Date:** 2026-02-18

## Directory Layout

```
property-pal-main/
├── src/
│   ├── assets/                   # Static assets (images, fonts)
│   ├── components/
│   │   ├── auth/                 # Route authorization guard
│   │   ├── chat/                 # Global AI chatbot overlay
│   │   ├── landing/              # Public landing page sections
│   │   ├── layout/               # Role-specific shell layouts
│   │   ├── properties/           # Shared property display components
│   │   └── ui/                   # shadcn/ui primitive components (generated)
│   ├── hooks/                    # Custom React hooks
│   ├── integrations/
│   │   └── supabase/             # Supabase client singleton and auto-generated types
│   ├── lib/                      # Tiny utility helpers
│   ├── pages/
│   │   ├── admin/                # Admin role pages
│   │   ├── owner/                # Property owner role pages
│   │   └── tenant/               # Tenant role pages
│   ├── utils/                    # Security and audit log utilities
│   ├── App.tsx                   # Router config and provider tree root
│   ├── main.tsx                  # DOM mount entry point
│   ├── index.css                 # Global Tailwind base styles
│   └── vite-env.d.ts             # Vite env type declarations
├── supabase/
│   ├── migrations/               # Ordered SQL migration files for Supabase
│   └── scripts/                  # Standalone SQL scripts for manual execution
├── docs/                         # Developer documentation
├── public/                       # Static public assets served by Vite
├── .planning/                    # GSD planning documents (not committed to production)
│   └── codebase/                 # Codebase analysis documents
├── components.json               # shadcn/ui CLI configuration
├── tailwind.config.ts            # Tailwind CSS theme and plugin config
├── tsconfig.json                 # TypeScript compiler settings
├── vite.config.ts                # Vite build and dev server config
└── package.json                  # Dependencies and npm scripts
```

## Directory Purposes

**`src/components/auth/`:**
- Purpose: Route-level authorization enforcement
- Contains: `ProtectedRoute.tsx` - accepts `allowedRoles: number[]`, blocks unauthenticated/wrong-role access
- Key files: `src/components/auth/ProtectedRoute.tsx`

**`src/components/chat/`:**
- Purpose: AI property assistant chatbot rendered globally above all routes
- Contains: `PropertyChatbot.tsx` - floating widget, always visible when authenticated
- Key files: `src/components/chat/PropertyChatbot.tsx`

**`src/components/landing/`:**
- Purpose: Composable sections for the public `Index` page
- Contains: `Hero.tsx`, `Features.tsx`, `FeaturedProperties.tsx`, `CTA.tsx`, `Navbar.tsx`, `Footer.tsx`
- Key files: `src/components/landing/Hero.tsx`

**`src/components/layout/`:**
- Purpose: Persistent sidebar + header shell for each user role; renders `<Outlet />` for child pages
- Contains: `AdminLayout.tsx`, `OwnerLayout.tsx`, `TenantLayout.tsx`
- Key files: `src/components/layout/AdminLayout.tsx`

**`src/components/properties/`:**
- Purpose: Shared property display and upload components used across Owner and Tenant pages
- Contains: `PropertyDetailModal.tsx`, `PropertyPhotoUpload.tsx`
- Key files: `src/components/properties/PropertyDetailModal.tsx`

**`src/components/ui/`:**
- Purpose: shadcn/ui component library - do not edit manually; re-generate with shadcn CLI
- Contains: ~40 primitive components (Button, Card, Dialog, Input, Select, Table, etc.)
- Key files: `src/components/ui/button.tsx`, `src/components/ui/card.tsx`, `src/components/ui/dialog.tsx`

**`src/hooks/`:**
- Purpose: Custom React hooks for shared stateful logic
- Contains: `useAuth.ts` (session + role profile), `use-toast.ts` (toast notifications), `use-mobile.tsx` (responsive breakpoint)
- Key files: `src/hooks/useAuth.ts`

**`src/integrations/supabase/`:**
- Purpose: Single source of truth for Supabase connectivity
- Contains: `client.ts` (singleton with localStorage persistence), `types.ts` (auto-generated DB types - do not edit manually)
- Key files: `src/integrations/supabase/client.ts`

**`src/lib/`:**
- Purpose: Shared utility functions not tied to any domain
- Contains: `utils.ts` - exports `cn()` helper (clsx + tailwind-merge)
- Key files: `src/lib/utils.ts`

**`src/pages/admin/`:**
- Purpose: All Admin role pages rendered inside `AdminLayout`
- Contains: `AdminDashboard.tsx`, `AdminUsers.tsx`, `AdminPropertyOwners.tsx`, `AdminReports.tsx`
- Key files: `src/pages/admin/AdminDashboard.tsx`

**`src/pages/owner/`:**
- Purpose: All Property Owner role pages rendered inside `OwnerLayout`
- Contains: `OwnerDashboard.tsx`, `OwnerProperties.tsx`, `OwnerAppointments.tsx`, `OwnerProfile.tsx`
- Key files: `src/pages/owner/OwnerProperties.tsx`

**`src/pages/tenant/`:**
- Purpose: All Tenant role pages rendered inside `TenantLayout`
- Contains: `TenantDashboard.tsx`, `TenantProperties.tsx`, `TenantAppointments.tsx`, `TenantProfile.tsx`
- Key files: `src/pages/tenant/TenantProfile.tsx`

**`src/utils/`:**
- Purpose: Security and audit utilities consumed across all pages
- Contains: `security.ts` (AES-256 encrypt/decrypt, bcrypt hashPin), `auditLog.ts` (event logging to `audit_log` table)
- Key files: `src/utils/security.ts`, `src/utils/auditLog.ts`

**`supabase/migrations/`:**
- Purpose: Ordered PostgreSQL schema migrations applied via Supabase CLI or dashboard
- Contains: 20 migration files covering schema creation, RLS policies, security hardening, audit log system, registration trigger fixes
- Key files: `supabase/migrations/20251227195951_8b63911f-d265-42f6-ac67-8fdb2f061b37.sql` (RLS policies), `supabase/migrations/20260117000000_audit_log_system.sql` (audit system)

**`supabase/scripts/`:**
- Purpose: Manual diagnostic and fix scripts - not auto-applied migrations
- Contains: `COMPLETE_REGISTRATION_FIX.sql`, `DIAGNOSTIC_QUERY.sql`

## Key File Locations

**Entry Points:**
- `src/main.tsx`: DOM mount - renders `<App />` into `#root`
- `src/App.tsx`: Full router tree, provider wrappers, global components

**Configuration:**
- `vite.config.ts`: Vite dev server (port 8080) and build config
- `tailwind.config.ts`: Theme colors (`property-warm`, `property-earth`), plugins
- `tsconfig.json`: Relaxed TypeScript (noImplicitAny: false, strictNullChecks: false)
- `components.json`: shadcn/ui CLI settings

**Core Logic:**
- `src/hooks/useAuth.ts`: Auth state management hook
- `src/components/auth/ProtectedRoute.tsx`: Route authorization guard
- `src/integrations/supabase/client.ts`: Supabase singleton client
- `src/utils/security.ts`: Encryption and hashing utilities
- `src/utils/auditLog.ts`: Audit event logging

**Database Schema:**
- `supabase/migrations/`: All schema and policy migrations

## Naming Conventions

**Files:**
- Page components: PascalCase with role prefix - `AdminDashboard.tsx`, `OwnerProperties.tsx`, `TenantProfile.tsx`
- Layout components: PascalCase with role prefix - `AdminLayout.tsx`, `OwnerLayout.tsx`, `TenantLayout.tsx`
- Hook files: camelCase with `use` prefix - `useAuth.ts`, `use-toast.ts`, `use-mobile.tsx`
- Utility files: camelCase - `security.ts`, `auditLog.ts`
- UI primitives: kebab-case - `alert-dialog.tsx`, `dropdown-menu.tsx`

**Directories:**
- Role pages: lowercase role name - `admin/`, `owner/`, `tenant/`
- Component groups: lowercase descriptive name - `auth/`, `chat/`, `landing/`, `layout/`, `properties/`, `ui/`

## Where to Add New Code

**New Admin Page:**
- Implementation: `src/pages/admin/Admin{Feature}.tsx`
- Register route: `src/App.tsx` inside the `/admin` `ProtectedRoute` block
- Import layout: Page is automatically wrapped by `AdminLayout` via `<Outlet />`

**New Owner Page:**
- Implementation: `src/pages/owner/Owner{Feature}.tsx`
- Register route: `src/App.tsx` inside the `/owner` `ProtectedRoute` block

**New Tenant Page:**
- Implementation: `src/pages/tenant/Tenant{Feature}.tsx`
- Register route: `src/App.tsx` inside the `/tenant` `ProtectedRoute` block

**New Shared Component:**
- Domain-specific: `src/components/{domain}/{ComponentName}.tsx`
- Generic UI primitive: use shadcn CLI to add to `src/components/ui/`

**New Custom Hook:**
- Location: `src/hooks/use{HookName}.ts`

**New Utility Function:**
- Security-related: add to `src/utils/security.ts`
- Audit-related: add to `src/utils/auditLog.ts`
- General: add to `src/lib/utils.ts`

**New Database Migration:**
- Location: `supabase/migrations/{timestamp}_{description}.sql`
- Format: Use ISO-like timestamp prefix for ordering

## Special Directories

**`src/components/ui/`:**
- Purpose: shadcn/ui primitives
- Generated: Yes (via shadcn CLI)
- Committed: Yes - edit with caution; re-run CLI to update

**`src/integrations/supabase/types.ts`:**
- Purpose: Auto-generated TypeScript types from Supabase schema
- Generated: Yes (via Supabase CLI `gen types`)
- Committed: Yes - regenerate after schema migrations

**`.planning/`:**
- Purpose: GSD planning and codebase analysis documents
- Generated: Yes (by GSD map-codebase command)
- Committed: Optional - not needed for production builds

**`supabase/migrations/`:**
- Purpose: Applied database migrations
- Generated: No (manually authored)
- Committed: Yes - required for reproducible deployments

---

*Structure analysis: 2026-02-18*
