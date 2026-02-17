# Codebase Concerns

**Analysis Date:** 2026-02-18

---

## Tech Debt

**Client-side AES Encryption Key Exposure:**
- Issue: `VITE_ENCRYPTION_KEY` is a Vite env var prefixed with `VITE_`, which means it is bundled into the client-side JavaScript and is visible to any user who inspects the browser bundle.
- Files: `src/utils/security.ts` (line 6), `src/pages/Auth.tsx`, `src/pages/owner/OwnerProfile.tsx`, `src/pages/tenant/TenantProfile.tsx`, `src/pages/admin/AdminPropertyOwners.tsx`, `src/pages/admin/AdminUsers.tsx`
- Impact: Any user can extract the AES encryption key from the browser bundle, decrypt all `contact_no` and `ic_no` values if they obtain a database dump, and re-encrypt arbitrary data. The security promise of AES field encryption is undermined because the key is public.
- Fix approach: Move encryption/decryption to a server-side Supabase Edge Function. Client submits plaintext, Edge Function encrypts and stores. On read, Edge Function decrypts and returns plaintext over HTTPS. The encryption key lives only in the server environment.

**`audit_log` Table Not in Auto-Generated Types:**
- Issue: The `audit_log` table is accessed via double `as any` casts throughout `src/utils/auditLog.ts` because it is absent from the auto-generated Supabase types in `src/integrations/supabase/types.ts`.
- Files: `src/utils/auditLog.ts` (lines 68, 355)
- Impact: No compile-time type safety on audit log writes or reads. Schema drift goes undetected. The comment "Note: audit_log table is accessed via type assertion" acknowledges this is a known workaround.
- Fix approach: Run `supabase gen types typescript` to regenerate `src/integrations/supabase/types.ts` after the audit log migration has been applied, then remove all `as any` casts.

**Admin User Creation Bypasses Database Trigger:**
- Issue: When an admin creates a tenant (`src/pages/admin/AdminUsers.tsx`) or property owner (`src/pages/admin/AdminPropertyOwners.tsx`), the code manually inserts into `users`, `user_roles`, and the role profile table. The self-registration flow in `src/pages/Auth.tsx` relies on a database trigger `handle_new_user` to do this automatically. The two code paths are not in sync.
- Files: `src/pages/admin/AdminUsers.tsx` (lines 130–158), `src/pages/admin/AdminPropertyOwners.tsx` (lines 157–186)
- Impact: If the trigger logic is updated, admin-created users may end up with an inconsistent state (e.g., missing `user_roles` entry or profile record).
- Fix approach: Unify creation through the trigger by calling the same `supabase.auth.signUp` with user metadata that the trigger reads, or extract a shared user-creation utility function used by both flows.

**Duplicated Profile Page Code:**
- Issue: `src/pages/owner/OwnerProfile.tsx` and `src/pages/tenant/TenantProfile.tsx` contain near-identical implementations of `fetchProfile`, `handleSaveProfile`, `handleChangePassword`, and `handleForgotPassword`. The only meaningful differences are the table names (`property_owner` vs `tenant`) and profile ID field names.
- Files: `src/pages/owner/OwnerProfile.tsx`, `src/pages/tenant/TenantProfile.tsx`
- Impact: Bug fixes and improvements must be applied twice. Any future addition (e.g., adding IC number validation) risks being applied to only one file.
- Fix approach: Extract a shared `useProfileManager` hook parameterised by table name and ID field, or create a generic `ProfileForm` component.

**`redirectBasedOnRole` Duplicated in Two Places:**
- Issue: The `redirectBasedOnRole` function is implemented identically in both `src/pages/Auth.tsx` (lines 63–77) and `src/hooks/useAuth.ts` (lines 125–139).
- Files: `src/pages/Auth.tsx`, `src/hooks/useAuth.ts`
- Impact: Two sources of truth for role-to-route mapping. Adding a new role requires changing both files.
- Fix approach: Remove the local copy in `Auth.tsx` and use `redirectBasedOnRole` from the `useAuth` hook.

**`QueryClient` Configured Without Cache/Retry Settings:**
- Issue: `src/App.tsx` creates `new QueryClient()` with default settings. React Query's default behaviour includes 3 retries on failure and a 5-minute stale time, which may cause excessive Supabase API calls and confusing UX on error conditions.
- Files: `src/App.tsx` (line 26)
- Impact: Failed network calls (e.g., when Supabase is unreachable) retry three times before surfacing an error to the user. The `QueryClient` instance is never used for actual data fetching in the app (all fetches are done with raw `supabase` calls), making it deadweight.
- Fix approach: Either configure `QueryClient` with appropriate `defaultOptions` and migrate data fetching to `useQuery`/`useMutation`, or remove the unused `QueryClientProvider` wrapper.

---

## Known Bugs

**Owner Contact Number Displayed Raw (Not Decrypted) in Tenant Appointments:**
- Symptoms: In `src/pages/tenant/TenantAppointments.tsx`, the `property_owner.contact_no` field is fetched from the `appointment` join and displayed directly without decryption. If the owner's `contact_no` is stored as AES ciphertext, the tenant sees encrypted gibberish when an appointment is approved.
- Files: `src/pages/tenant/TenantAppointments.tsx` (lines 172–175)
- Trigger: A tenant with an approved appointment views their appointment details when the owner has a `contact_no` on file.
- Workaround: None. The `OwnerAppointments.tsx` page correctly decrypts `tenant.contact_no`; the same pattern is missing here for the reverse direction.

**Decryption Failure Returns Original Ciphertext:**
- Symptoms: If decryption fails (e.g., data was encrypted with a different key), `decryptData` in `src/utils/security.ts` returns the original ciphertext string instead of an empty string or error indicator.
- Files: `src/utils/security.ts` (lines 30–33)
- Trigger: The `VITE_ENCRYPTION_KEY` is rotated or a record was encrypted with a different key.
- Workaround: None. Users see raw AES ciphertext strings displayed as `contact_no` or `ic_no` values in the UI without any indication that decryption failed.

**Admin Dashboard Loads All Appointments Into Memory:**
- Symptoms: `src/pages/admin/AdminDashboard.tsx` fetches all appointment rows (without `.head: true`) to count pending ones in JavaScript, while using the efficient `count: 'exact', head: true` pattern for other tables.
- Files: `src/pages/admin/AdminDashboard.tsx` (line 35)
- Trigger: As the `appointment` table grows, this query transfers all rows across the network on every admin dashboard load.
- Workaround: None in the current code.

**Chatbot Shows Properties with Link to `/auth` Regardless of Login State:**
- Symptoms: In `src/components/chat/PropertyChatbot.tsx` (line 178), found properties always link to `/auth`. If a tenant is already logged in, clicking a property card navigates them to the login page instead of the property listing.
- Files: `src/components/chat/PropertyChatbot.tsx` (line 178)
- Trigger: Any logged-in user uses the chatbot.
- Workaround: None.

---

## Security Considerations

**Client-Side AES Key in Browser Bundle:**
- Risk: The encryption key is exposed to every user via the compiled JavaScript bundle (any `VITE_*` variable is public). Attackers can extract `VITE_ENCRYPTION_KEY` to decrypt all IC numbers and contact numbers if they obtain database access.
- Files: `src/utils/security.ts` (line 6)
- Current mitigation: Key is read from `.env` at build time; `.env` file is not committed to the repository.
- Recommendations: Move all encryption/decryption to a server-side Supabase Edge Function where the key is a server-only secret.

**Admin Can Sign Up New Users While Logged In as Admin (Session Swap Risk):**
- Issue: `src/pages/admin/AdminUsers.tsx` and `src/pages/admin/AdminPropertyOwners.tsx` call `supabase.auth.signUp()` directly from the admin's browser session. While Supabase Auth does not sign in the new user during `signUp` (when email confirmation is enabled), this pattern is fragile.
- Files: `src/pages/admin/AdminUsers.tsx` (line 118), `src/pages/admin/AdminPropertyOwners.tsx` (line 146)
- Current mitigation: Supabase does not automatically sign in after signUp when confirmation is disabled at the project level.
- Recommendations: Use a Supabase Edge Function or the Supabase Admin API (server-side only) to create users from admin workflows, which avoids any risk of session interference.

**No Rate Limiting on Login or Registration:**
- Risk: The login form in `src/pages/Auth.tsx` has no client-side rate limiting beyond what Supabase Auth provides by default. Brute-force attempts are not throttled at the application level.
- Files: `src/pages/Auth.tsx` (lines 79–136)
- Current mitigation: Supabase Auth has built-in rate limiting on the API side. Failed logins are audit logged.
- Recommendations: Add a UI-level cooldown after repeated failures (e.g., disable button for 30 seconds) to improve UX and reduce noise in audit logs.

**No Input Validation for IC Number Format:**
- Risk: IC number fields (`ic_no`) in profile forms accept any string without format validation. Malformed IC numbers are encrypted and stored, and there is no way to distinguish valid IC numbers from noise.
- Files: `src/pages/owner/OwnerProfile.tsx` (line 219), `src/pages/tenant/TenantProfile.tsx` (line 276)
- Current mitigation: Placeholder text suggests `XXXXXX-XX-XXXX` format but does not enforce it.
- Recommendations: Add Zod validation enforcing the Malaysian IC number format (`/^\d{6}-\d{2}-\d{4}$/`) in both profile forms.

**Unhandled `decryptData` Return on Failure Exposes Ciphertext:**
- Risk: When `decryptData` fails, it returns the original ciphertext. In the admin views (`AdminPropertyOwners.tsx`, `AdminUsers.tsx`) the returned value is displayed in the table, meaning an admin can see raw AES ciphertext without realising decryption has failed.
- Files: `src/utils/security.ts` (line 32), `src/pages/admin/AdminPropertyOwners.tsx` (lines 76–89), `src/pages/admin/AdminUsers.tsx` (lines 57–66)
- Current mitigation: `console.error` is called when decryption fails, and the raw ciphertext is shown.
- Recommendations: Return an empty string or a sentinel value like `[encrypted]` from `decryptData` on failure and display a user-visible warning rather than raw ciphertext.

---

## Performance Bottlenecks

**Admin Dashboard: Full Appointment Table Scan:**
- Problem: `src/pages/admin/AdminDashboard.tsx` fetches all appointment rows and counts `pending` in JavaScript memory rather than using a server-side filter with `count: 'exact', head: true`.
- Files: `src/pages/admin/AdminDashboard.tsx` (lines 35–39)
- Cause: Inconsistent use of Supabase count API; `tenant`, `property_owner`, and `property` use `head: true` but `appointment` does not.
- Improvement path: Replace with `supabase.from('appointment').select('appointment_id', { count: 'exact', head: true }).eq('status', 'pending')`.

**Admin Reports: Four Sequential Full-Table Scans:**
- Problem: `src/pages/admin/AdminReports.tsx` runs four parallel full-table `SELECT *` queries (tenant, property_owner, property, appointment) on every "Generate Report" click with no caching. All aggregation happens in client-side JavaScript.
- Files: `src/pages/admin/AdminReports.tsx` (lines 29–65)
- Cause: Report generation performs no server-side aggregation; all data is transferred to the browser.
- Improvement path: Create a Supabase PostgreSQL function or view that returns pre-aggregated statistics, or use React Query with a long stale time to cache the report.

**Audit Log: Extra DB Round-Trip Per Logged Event:**
- Problem: `logAuditEvent` in `src/utils/auditLog.ts` always makes a `supabase.auth.getUser()` call and then a `user_roles` lookup before inserting the log entry. Every audit-loggable action (profile loads, appointment changes, etc.) incurs two extra database round-trips.
- Files: `src/utils/auditLog.ts` (lines 49–65)
- Cause: `user_id` and `user_role_id` are fetched on every event rather than being passed from the calling context or cached.
- Improvement path: Pass `userId` and `userRoleId` as parameters to `logAuditEvent` from the calling site (both are available in component state via `useAuth`).

**Chatbot Searches Entire Property Table Without Index Guarantee:**
- Problem: `src/components/chat/PropertyChatbot.tsx` uses `ilike` queries on `property_type` and `location` columns without knowing whether these columns are indexed.
- Files: `src/components/chat/PropertyChatbot.tsx` (lines 93–103)
- Cause: Full table ILIKE scans are slow on large datasets without a trigram or text search index.
- Improvement path: Add GIN indexes on `location` and `property_type` columns in a migration, or switch to Supabase full-text search.

---

## Fragile Areas

**`useAuth` Hook: Race Condition Between `onAuthStateChange` and `getSession`:**
- Files: `src/hooks/useAuth.ts` (lines 22–53)
- Why fragile: Both `onAuthStateChange` and `getSession` can fire `fetchUserProfile` for the same session on initial load, potentially causing two simultaneous profile fetches and two state updates. The `setTimeout(() => fetchUserProfile(...), 0)` comment acknowledges a "defer to avoid deadlock" but does not prevent the race.
- Safe modification: Guard `fetchUserProfile` with a ref flag (`isFetchingRef`) or move the initial session check inside the `onAuthStateChange` callback only.
- Test coverage: No test coverage for auth state transitions.

**`ProtectedRoute`: Auth State Not Shared With `useAuth`:**
- Files: `src/components/auth/ProtectedRoute.tsx`, `src/hooks/useAuth.ts`
- Why fragile: `ProtectedRoute` and `useAuth` maintain independent auth state and independently subscribe to `supabase.auth.onAuthStateChange`. Any component tree that uses both runs two subscriptions and two role lookups per navigation event. If Supabase changes session handling, both need to be updated consistently.
- Safe modification: Have `ProtectedRoute` consume the same state exposed by `useAuth` (via a context provider) rather than re-fetching independently.
- Test coverage: No test coverage.

**`PropertyPhotoUpload`: Image Deletion Silently Fails:**
- Files: `src/components/properties/PropertyPhotoUpload.tsx` (lines 79–93)
- Why fragile: When `handleRemoveImage` is called, it attempts to delete the file from Supabase Storage but catches and silently logs any error. The image URL is removed from the local state regardless of whether deletion succeeded, leaving orphaned files in the `property-photos` bucket.
- Safe modification: Surface storage deletion errors to the user via a toast notification.
- Test coverage: None.

**`decryptData` in `security.ts`: Silent Fallback Returns Ciphertext:**
- Files: `src/utils/security.ts` (lines 25–34)
- Why fragile: The `catch` block returns the original ciphertext on failure, which can be displayed in the UI without any indication of failure. Any key rotation, data corruption, or migration error causes confusing output for administrators and could expose that encrypted data exists.
- Safe modification: Return `''` or throw a typed error; callers in list views should check for non-empty strings before displaying.
- Test coverage: None.

---

## Scaling Limits

**`notifications` Table: No Frontend Consumer:**
- Current capacity: The `notifications` table is defined in `src/integrations/supabase/types.ts` (line 155) but no page or component reads from or writes to it. The OwnerAppointments page comments state "the tenant will be notified via email" but no notification rows are created and no Supabase email trigger is visible in the migrations.
- Limit: Users never receive in-app notifications; the feature is structurally stubbed.
- Scaling path: Implement either a Supabase Database trigger that writes notification rows on appointment status changes, or a Supabase Edge Function that sends transactional emails.

**Appointment Time Slots Are Hardcoded:**
- Current capacity: The booking form in `src/pages/tenant/TenantProperties.tsx` (lines 436–446) offers seven fixed time slots (9:00, 10:00, 11:00, 14:00, 15:00, 16:00, 17:00) with no availability checking. Multiple tenants can book the same property at the same time slot.
- Limit: Double-booking is possible from day one.
- Scaling path: Add a unique constraint on `(property_id, appointment_date, appointment_time, status != 'cancelled')` in the database, or implement a calendar availability system.

---

## Dependencies at Risk

**`bcryptjs` in Browser Context:**
- Risk: bcryptjs is a CPU-intensive hashing library designed for server-side use. Running it in the browser during registration (`src/pages/Auth.tsx` line 153: `await hashPin(validated.securityPin)`) blocks the main thread for several hundred milliseconds on low-end devices.
- Impact: Registration UX degrades on mobile; no functional breakage.
- Migration plan: Move PIN hashing to a Supabase Edge Function, or use a lighter client-side KDF such as PBKDF2 via the Web Crypto API if client-side hashing must remain.

---

## Missing Critical Features

**No Email Notifications for Appointment Status Changes:**
- Problem: When an owner approves or rejects an appointment in `src/pages/owner/OwnerAppointments.tsx`, the success toast says "The tenant will be notified via email" but no notification mechanism exists in the codebase. The `notifications` table exists in the schema but is never populated.
- Blocks: Tenants have no way to know their appointment status changed unless they actively check the appointments page.

**No Admin Audit Log Viewer:**
- Problem: The `audit_log` table and all `logAuditEvent` infrastructure are fully implemented in `src/utils/auditLog.ts` and the database, but no admin UI page exists to view audit log records. The `fetchAuditLogs` function is exported but never called from any component.
- Blocks: Administrators cannot use the audit trail for compliance review or security investigation through the application; they must query the database directly.

**No Pagination on Any List View:**
- Problem: All admin tables (`AdminUsers.tsx`, `AdminPropertyOwners.tsx`), property listings (`TenantProperties.tsx`, `OwnerProperties.tsx`), and appointment lists load all records in a single query with no pagination or virtual scrolling.
- Blocks: Usability and performance degrade as data grows; currently all 100% of rows are loaded on every page visit.

---

## Test Coverage Gaps

**No Tests Exist:**
- What's not tested: There are no test files (`*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`) anywhere in the project. No test runner configuration file (`jest.config.*`, `vitest.config.*`) is present.
- Files: Entire `src/` directory
- Risk: Any refactoring, encryption key rotation, role check logic change, or database schema change can silently break the application with no automated detection.
- Priority: High — especially critical for the encryption/decryption pipeline (`src/utils/security.ts`), the `ProtectedRoute` authorization logic (`src/components/auth/ProtectedRoute.tsx`), and the audit logging utility (`src/utils/auditLog.ts`).

---

*Concerns audit: 2026-02-18*
