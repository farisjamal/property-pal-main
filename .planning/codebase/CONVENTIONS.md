# Coding Conventions

**Analysis Date:** 2026-02-18

## Naming Patterns

**Files:**
- React components: PascalCase matching the exported component name (e.g., `AdminUsers.tsx`, `TenantProfile.tsx`, `ProtectedRoute.tsx`)
- Custom hooks: camelCase prefixed with `use` (e.g., `useAuth.ts`, `use-toast.ts`, `use-mobile.tsx`)
- Utility modules: camelCase (e.g., `security.ts`, `auditLog.ts`, `utils.ts`)
- shadcn/ui components: kebab-case (e.g., `alert-dialog.tsx`, `dropdown-menu.tsx`)
- Pages grouped by role in subdirectories: `src/pages/admin/`, `src/pages/owner/`, `src/pages/tenant/`

**Functions:**
- Event handlers: `handle` prefix + subject + action (e.g., `handleLogin`, `handleDelete`, `handleSaveProfile`, `handleSubmit`, `handleChangePassword`)
- Async data fetchers: `fetch` prefix + subject (e.g., `fetchTenants`, `fetchProfile`, `fetchUserProfile`, `fetchOwnerIdAndProperties`)
- Dialog helpers: `open` prefix + action (e.g., `openEditDialog`, `openAddDialog`)
- Utility/pure functions: camelCase verb (e.g., `encryptData`, `decryptData`, `hashPin`, `redirectBasedOnRole`)
- Audit log functions: `log` prefix + event (e.g., `logLogin`, `logLogout`, `logProfileUpdate`, `logUserCreation`)

**Variables:**
- Boolean state: `is` prefix (e.g., `isLoading`, `isSaving`, `isDialogOpen`, `isAuthorized`, `isChangingPassword`)
- State arrays: plural nouns matching the data model (e.g., `tenants`, `properties`, `favorites`)
- Form state object: `formData` (uniform across pages)
- Editing state: `editing` prefix + entity (e.g., `editingTenant`, `editingProperty`)

**Types/Interfaces:**
- Interface names: PascalCase matching their domain (e.g., `Tenant`, `Property`, `UserProfile`, `AuditLogEntry`)
- Form data interfaces: `[Entity]FormData` suffix (e.g., `PropertyFormData`)
- Enum-like union types: SCREAMING_SNAKE_CASE string literals (e.g., `'CREATE' | 'READ' | 'UPDATE'`)

**Database columns:**
- snake_case following PostgreSQL convention (e.g., `tenant_id`, `contact_no`, `ic_no`, `user_role_id`)
- Form fields use the same snake_case names to match DB column names directly

## Code Style

**Formatting:**
- No Prettier config detected; formatting is handled by the editor or not enforced
- Single quotes for imports (`import { useState } from 'react'`)
- Double quotes for JSX string attributes (`className="space-y-6"`)
- Semicolons present
- 2-space indentation in most files; some files (e.g., `security.ts`) use 4-space indentation

**Linting:**
- ESLint via `eslint.config.js` with `typescript-eslint` and `eslint-plugin-react-hooks`
- `@typescript-eslint/no-unused-vars` is explicitly **disabled** (off)
- `react-refresh/only-export-components` is set to "warn"
- React Hooks rules enforced via `eslint-plugin-react-hooks`

## Import Organization

**Order (observed pattern):**
1. React core (`import { useState, useEffect } from 'react'`)
2. Third-party libraries (`react-router-dom`, `@supabase/supabase-js`, `zod`, `lucide-react`)
3. Internal integrations (`@/integrations/supabase/client`)
4. Internal hooks (`@/hooks/useAuth`, `@/hooks/use-toast`)
5. UI components (`@/components/ui/...`)
6. Custom components (`@/components/properties/...`)
7. Utilities (`@/utils/security`, `@/utils/auditLog`)

**Path Aliases:**
- `@/` maps to `src/` (configured in `tsconfig.json` and Vite config)
- Always use `@/` for internal imports; no relative paths across directories

## Error Handling

**Patterns:**
- All async operations wrapped in `try/catch/finally`
- `finally` block always resets loading state (`setIsLoading(false)`, `setIsSaving(false)`)
- Errors surfaced to user via `useToast()` hook with `variant: 'destructive'`
- Error message extracted from `error.message` or `error.errors[0].message` for Zod errors
- Supabase errors: check `if (error) throw error` immediately after destructuring the response
- User-facing messages sanitized: detect common error message patterns and rewrite to human-readable text

**Example pattern:**
```typescript
try {
  const { data, error } = await supabase.from('tenant').select('*');
  if (error) throw error;
  setTenants(data);
} catch (error: any) {
  toast({ title: 'Error', description: error.message, variant: 'destructive' });
} finally {
  setIsLoading(false);
}
```

**Zod validation pattern:**
```typescript
try {
  const validated = loginSchema.parse(loginData);
  // use validated.*
} catch (error: any) {
  if (error instanceof z.ZodError) {
    message = error.errors[0].message;
  }
  toast({ title: 'Error', description: message, variant: 'destructive' });
}
```

## Logging

**Framework:** `console.error` for development; structured audit logging via `src/utils/auditLog.ts`

**Patterns:**
- `console.error()` used for internal debug errors (not shown to users)
- All security-sensitive operations must call an audit log function from `src/utils/auditLog.ts`
- Sensitive data decryption must call `logSensitiveDataAccess(resourceType, resourceId, fields[])`
- Profile updates must call `logProfileUpdate(resourceType, resourceId, fields[])`
- Auth events: `logLogin()`, `logLogout()`, `logFailedLogin()`
- CRUD on user records: `logUserCreation()`, `logUserDeletion()`

## Comments

**When to Comment:**
- Above function signatures in utility files (JSDoc-style block comments describing purpose)
- Inline comments marking security-critical steps (e.g., `// Encrypt contact number before saving`)
- Inline comments for non-obvious Supabase patterns (e.g., `// Use type assertion for audit_log table`)
- Comments explain WHY, not WHAT (e.g., `// Defer profile fetching to avoid deadlock`)

**JSDoc/TSDoc:**
- Used in `src/utils/security.ts` and `src/utils/auditLog.ts` for exported utility functions
- Not used in page/component files

## Function Design

**Size:** Page components are large (200-400 lines) containing fetch logic, state, and JSX inline. No dedicated service layer; all Supabase calls are written directly in page components.

**Parameters:** Utility functions take typed primitive parameters. Components receive typed props via inline interfaces.

**Return Values:**
- Async functions return `Promise<void>` or `Promise<T[]>`
- Components return JSX directly
- Hooks return plain objects (not arrays): `return { user, session, userProfile, isLoading, signOut, redirectBasedOnRole }`

## Module Design

**Exports:**
- Page components: `export default ComponentName` at the bottom of the file
- Utilities: named exports only (`export const encryptData`, `export const logLogin`)
- Custom hooks: named exports (`export const useAuth`)
- UI components (shadcn): named exports

**Barrel Files:** Not used. Each import references the specific file path directly.

## TypeScript Configuration

**Relaxed settings (in `tsconfig.json`):**
- `noImplicitAny: false` - `any` types allowed and used frequently (e.g., `error: any`, `profileData: any`)
- `strictNullChecks: false` - null checks not enforced
- `noUnusedLocals: false` - unused variables do not error
- `noUnusedParameters: false` - unused parameters do not error

**Type assertions:**
- `as any` used for tables not in auto-generated Supabase types (e.g., `supabase.from('audit_log' as any)`)
- Role data cast: `(roleData.roles as any)?.role`

## Security Conventions (Mandatory)

**Encryption workflow (enforced by CLAUDE.md):**
```typescript
// Before save: always encrypt
const encryptedContactNo = profile.contact_no ? encryptData(profile.contact_no) : null;

// After fetch: always decrypt
const decryptedContactNo = data.contact_no ? decryptData(data.contact_no) : '';
```

**Audit logging workflow (enforced by CLAUDE.md):**
```typescript
// After decrypting: always log access
logSensitiveDataAccess('TENANT', data.tenant_id.toString(), ['contact_no', 'ic_no']);

// After updating: always log update
logProfileUpdate('TENANT', tenantId.toString(), updatedFields);
```

**Fields requiring encryption:** `contact_no`, `ic_no` in `admin`, `property_owner`, and `tenant` tables.

---

*Convention analysis: 2026-02-18*
