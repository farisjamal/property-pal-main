# Testing Patterns

**Analysis Date:** 2026-02-18

## Test Framework

**Runner:**
- None detected. No `jest.config.*`, `vitest.config.*`, or any other test runner configuration file is present in this project.

**Assertion Library:**
- None installed.

**Run Commands:**
```bash
# No test commands exist in package.json scripts
npm run lint     # Only quality check available; runs ESLint
```

## Test File Organization

**Location:**
- No test files detected (no `*.test.*` or `*.spec.*` files exist anywhere in the codebase).

**Naming:**
- Not applicable.

**Structure:**
- Not applicable.

## Test Structure

**Suite Organization:**
- No tests exist. No test framework is installed as a dependency.

**Patterns:**
- None observed.

## Mocking

**Framework:** None.

**What to Mock (recommendations for when tests are added):**
- Supabase client (`@/integrations/supabase/client`) - all data fetching goes through this singleton
- `import.meta.env.VITE_ENCRYPTION_KEY` - required for `src/utils/security.ts` to load without throwing
- `navigator.userAgent` - referenced in `src/utils/auditLog.ts`
- React Router hooks (`useNavigate`, `useLocation`) - used in `useAuth` and `ProtectedRoute`

**What NOT to Mock:**
- `src/utils/security.ts` encryption/decryption logic - these are pure functions that should be tested directly
- Zod schemas - test real validation behavior

## Fixtures and Factories

**Test Data:**
- None exist.

**Location:**
- No `__fixtures__`, `__mocks__`, or `test/` directories found.

## Coverage

**Requirements:** None enforced. No coverage tooling configured.

**View Coverage:**
```bash
# Not available - no test runner configured
```

## Test Types

**Unit Tests:**
- None present. Good candidates for unit tests would be:
  - `src/utils/security.ts` - `encryptData`, `decryptData`, `hashPin` are pure/async pure functions
  - `src/utils/auditLog.ts` - `logAuditEvent` and wrapper functions
  - Zod schemas in `src/pages/Auth.tsx` (`loginSchema`, `registerSchema`)
  - `src/lib/utils.ts` - `cn()` utility function

**Integration Tests:**
- None present. Good candidates would be:
  - `src/hooks/useAuth.ts` - auth state management with mocked Supabase
  - `src/components/auth/ProtectedRoute.tsx` - role-based routing with mocked session

**E2E Tests:**
- None present. No Playwright, Cypress, or similar tooling installed.

## Current Quality Gates

The only automated quality check is ESLint:
```bash
npm run lint     # Runs ESLint on all .ts/.tsx files
```

ESLint rules in `eslint.config.js`:
- `eslint-plugin-react-hooks` recommended rules (hooks rules enforced)
- `react-refresh/only-export-components` warned
- `@typescript-eslint/no-unused-vars` disabled

## Recommendations for Adding Tests

If tests are added to this project, the recommended approach given the stack (Vite + React + TypeScript) is:

**Install Vitest:**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Vitest config (`vitest.config.ts`):**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

**Test file placement:**
- Co-locate with source: `src/utils/security.test.ts` next to `src/utils/security.ts`
- Or separate directory: `src/__tests__/`

**Example unit test for security utilities:**
```typescript
// src/utils/security.test.ts
import { encryptData, decryptData } from './security';

describe('security utilities', () => {
  it('should encrypt and decrypt data round-trip', () => {
    const original = '0123456789';
    const encrypted = encryptData(original);
    expect(encrypted).not.toBe(original);
    expect(decryptData(encrypted)).toBe(original);
  });

  it('should return empty string for empty input', () => {
    expect(encryptData('')).toBe('');
    expect(decryptData('')).toBe('');
  });
});
```

**Example test for Zod schema validation:**
```typescript
// src/pages/Auth.test.ts
import { z } from 'zod';
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

describe('loginSchema', () => {
  it('rejects invalid email', () => {
    expect(() => loginSchema.parse({ email: 'bad', password: 'abc123' }))
      .toThrow();
  });
});
```

---

*Testing analysis: 2026-02-18*
