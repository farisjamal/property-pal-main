# NIST Strong Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add NIST 800-63-4-aligned strong-password enforcement with a live strength indicator to the signup and reset-password screens.

**Architecture:** Two new pure modules (`pwnedPassword.ts` breach check via HaveIBeenPwned k-anonymity, `passwordStrength.ts` zxcvbn wrapper) feed an async combined validator in the existing `passwordValidation.ts`. A new `PasswordStrengthMeter` component renders the live checklist + strength bar + breach/zxcvbn feedback and is mounted in `Auth.tsx` (signup) and `ResetPassword.tsx`.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest + jsdom + React Testing Library, zxcvbn, Web Crypto (`crypto.subtle`), HaveIBeenPwned Pwned Passwords API.

## Global Constraints

- Policy model: **Hybrid** — keep the 5 visible composition requirements AND add zxcvbn score + breach + context checks. Do not remove composition rules.
- `MIN_PASSWORD_LENGTH = 8`, `MIN_ZXCVBN_SCORE = 3` (block submit below "Good").
- Breach API **fails open**: any network/parse error returns breach count `0`; never block a user because the API is down.
- k-anonymity: only the first **5 hex chars** of the SHA-1 hash may leave the browser.
- zxcvbn must be **lazy-loaded** via dynamic `import('zxcvbn')` — keep it out of the initial bundle.
- Tests are colocated as `*.test.ts(x)` next to source, using Vitest globals (`describe/it/expect/vi`), jsdom env, per `vite.config.ts`.
- No CSP change: `vercel.json` `connect-src` already allows `https:`.
- Follow project rules: typed errors at boundaries, no magic numbers, accessible UI (`aria-live`, labelled toggle), `handle*` naming.

---

### Task 1: Add zxcvbn dependency

**Files:**
- Modify: `package.json` (dependencies + devDependencies)

**Interfaces:**
- Consumes: nothing.
- Produces: `zxcvbn` runtime module + `@types/zxcvbn` types available to later tasks.

- [ ] **Step 1: Install zxcvbn and its types**

Run:
```bash
npm install zxcvbn@^4.4.2 && npm install -D @types/zxcvbn@^4.4.5
```
Expected: both packages added, `package-lock.json` updated, no peer-dep errors.

- [ ] **Step 2: Verify it imports**

Run:
```bash
node -e "console.log(typeof require('zxcvbn'))"
```
Expected: prints `function`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add zxcvbn for password strength estimation"
```

---

### Task 2: Breach-check module (`pwnedPassword.ts`)

**Files:**
- Create: `src/security/pwnedPassword.ts`
- Test: `src/security/pwnedPassword.test.ts`

**Interfaces:**
- Consumes: global `fetch`, `crypto.subtle` (Web Crypto).
- Produces: `checkPwnedPassword(password: string): Promise<number>` — returns the number of breaches the password appears in (`0` = safe / unknown / API error).

- [ ] **Step 1: Write the failing test**

Create `src/security/pwnedPassword.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { checkPwnedPassword } from "./pwnedPassword";

// SHA-1 of the string password -> prefix 5BAA6 + the suffix below.
const KNOWN_SUFFIX = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";

function mockFetchText(body: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(body),
  } as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("checkPwnedPassword", () => {
  it("returns the breach count when the suffix is found", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchText(`0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n${KNOWN_SUFFIX}:99999`)
    );
    expect(await checkPwnedPassword("password")).toBe(99999);
  });

  it("returns 0 when the suffix is not in the response", async () => {
    vi.stubGlobal("fetch", mockFetchText("0018A45C4D1DEF81644B54AB7F969B88D65:1"));
    expect(await checkPwnedPassword("password")).toBe(0);
  });

  it("sends only the 5-char hash prefix (k-anonymity)", async () => {
    const fetchMock = mockFetchText("");
    vi.stubGlobal("fetch", fetchMock);
    await checkPwnedPassword("password");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.pwnedpasswords.com/range/5BAA6",
      expect.any(Object)
    );
  });

  it("fails open (returns 0) on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect(await checkPwnedPassword("password")).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/security/pwnedPassword.test.ts`
Expected: FAIL — cannot resolve `./pwnedPassword`.

- [ ] **Step 3: Write the implementation**

Create `src/security/pwnedPassword.ts`:
```ts
const PWNED_RANGE_URL = "https://api.pwnedpasswords.com/range/";
const HASH_PREFIX_LENGTH = 5;

async function sha1Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/**
 * Checks a password against the HaveIBeenPwned Pwned Passwords API using
 * k-anonymity: only the first 5 chars of the SHA-1 hash are sent. Returns the
 * number of breaches the password appears in (0 = safe). Fails open on error.
 */
export async function checkPwnedPassword(password: string): Promise<number> {
  if (!password) return 0;
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, HASH_PREFIX_LENGTH);
    const suffix = hash.slice(HASH_PREFIX_LENGTH);

    const response = await fetch(`${PWNED_RANGE_URL}${prefix}`, {
      headers: { "Add-Padding": "true" },
    });
    if (!response.ok) return 0;

    const body = await response.text();
    for (const line of body.split("\n")) {
      const [lineSuffix, countText] = line.trim().split(":");
      if (lineSuffix === suffix) {
        const count = Number.parseInt(countText, 10);
        return Number.isFinite(count) ? count : 0;
      }
    }
    return 0;
  } catch (error) {
    // Fail open: a third-party outage must never block account flows.
    console.warn("Pwned-password check failed; treating as not breached.", error);
    return 0;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/security/pwnedPassword.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/security/pwnedPassword.ts src/security/pwnedPassword.test.ts
git commit -m "feat(security): add HaveIBeenPwned breach check (k-anonymity)"
```

---

### Task 3: Strength-estimation module (`passwordStrength.ts`)

**Files:**
- Create: `src/security/passwordStrength.ts`
- Test: `src/security/passwordStrength.test.ts`

**Interfaces:**
- Consumes: `zxcvbn` (dynamic import) from Task 1.
- Produces:
  - type `StrengthResult = { score: 0|1|2|3|4; label: string; warning: string; suggestions: string[] }`
  - `evaluatePassword(password: string, userInputs?: string[]): Promise<StrengthResult>`
  - `STRENGTH_LABELS: readonly string[]` (index = score)

- [ ] **Step 1: Write the failing test**

Create `src/security/passwordStrength.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { evaluatePassword } from "./passwordStrength";

describe("evaluatePassword", () => {
  it("scores a common password as very weak", async () => {
    const result = await evaluatePassword("password");
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.label).toBe("Very weak");
  });

  it("scores a long random password as strong", async () => {
    const result = await evaluatePassword("Gx7$mK9pLz!qWeRt");
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  it("penalizes passwords derived from user context", async () => {
    const withoutContext = await evaluatePassword("johnsmith2020");
    const withContext = await evaluatePassword("johnsmith2020", ["john.smith@example.com"]);
    expect(withContext.score).toBeLessThanOrEqual(withoutContext.score);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/security/passwordStrength.test.ts`
Expected: FAIL — cannot resolve `./passwordStrength`.

- [ ] **Step 3: Write the implementation**

Create `src/security/passwordStrength.ts`:
```ts
export type StrengthScore = 0 | 1 | 2 | 3 | 4;

export interface StrengthResult {
  score: StrengthScore;
  label: string;
  warning: string;
  suggestions: string[];
}

export const STRENGTH_LABELS = [
  "Very weak",
  "Weak",
  "Fair",
  "Good",
  "Strong",
] as const;

/**
 * Estimates password strength with zxcvbn (lazy-loaded to keep it out of the
 * initial bundle). `userInputs` (e.g. email, name) let zxcvbn penalize
 * context-specific terms, per NIST 800-63-4.
 */
export async function evaluatePassword(
  password: string,
  userInputs: string[] = []
): Promise<StrengthResult> {
  const { default: zxcvbn } = await import("zxcvbn");
  const sanitizedInputs = userInputs.filter(Boolean);
  const { score, feedback } = zxcvbn(password, sanitizedInputs);
  return {
    score: score as StrengthScore,
    label: STRENGTH_LABELS[score],
    warning: feedback.warning ?? "",
    suggestions: feedback.suggestions ?? [],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/security/passwordStrength.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/security/passwordStrength.ts src/security/passwordStrength.test.ts
git commit -m "feat(security): add zxcvbn-based password strength estimator"
```

---

### Task 4: Combined async validator in `passwordValidation.ts`

**Files:**
- Modify: `src/security/passwordValidation.ts`
- Test: `src/security/passwordValidation.test.ts`

**Interfaces:**
- Consumes: `checkPwnedPassword` (Task 2), `evaluatePassword` (Task 3), existing `validatePassword`.
- Produces:
  - constants `MIN_PASSWORD_LENGTH = 8`, `MIN_ZXCVBN_SCORE = 3`
  - `validatePasswordFull(password: string, context?: { email?: string; name?: string }): Promise<{ valid: boolean; errors: string[] }>`

- [ ] **Step 1: Write the failing test**

Create `src/security/passwordValidation.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { validatePasswordFull } from "./passwordValidation";

function mockFetchText(body: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(body),
  } as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("validatePasswordFull", () => {
  it("rejects a breached, weak password", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchText("1E4C9B93F3F0682250B6CF8331B7EE68FD8:99999")
    );
    const result = await validatePasswordFull("password");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("This password has appeared in a known data breach");
  });

  it("accepts a strong, non-breached password", async () => {
    vi.stubGlobal("fetch", mockFetchText("0018A45C4D1DEF81644B54AB7F969B88D65:1"));
    const result = await validatePasswordFull("Gx7$mK9pLz!qWeRt");
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/security/passwordValidation.test.ts`
Expected: FAIL — `validatePasswordFull` is not exported.

- [ ] **Step 3: Add constants and the combined validator**

In `src/security/passwordValidation.ts`, add imports at the top (after the existing `import { z } from 'zod';` line):
```ts
import { checkPwnedPassword } from './pwnedPassword';
import { evaluatePassword } from './passwordStrength';
```

Add the constants directly above `PASSWORD_REQUIREMENTS`:
```ts
export const MIN_PASSWORD_LENGTH = 8;
export const MIN_ZXCVBN_SCORE = 3;
```

Change the first requirement line from:
```ts
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
```
to:
```ts
  { label: `At least ${MIN_PASSWORD_LENGTH} characters`, test: (p: string) => p.length >= MIN_PASSWORD_LENGTH },
```

Append at the end of the file:
```ts
/**
 * Full async validation for submit-time gating: composition rules + zxcvbn
 * strength + breach check + context-term penalty. The sync `validatePassword`
 * stays for instant per-keystroke checklist feedback.
 */
export async function validatePasswordFull(
  password: string,
  context: { email?: string; name?: string } = {}
): Promise<{ valid: boolean; errors: string[] }> {
  const { errors } = validatePassword(password);

  const userInputs = [context.email, context.name].filter(
    (value): value is string => Boolean(value)
  );
  const strength = await evaluatePassword(password, userInputs);
  if (strength.score < MIN_ZXCVBN_SCORE) {
    errors.push('Password is too weak or predictable');
  }

  const breachCount = await checkPwnedPassword(password);
  if (breachCount > 0) {
    errors.push('This password has appeared in a known data breach');
  }

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/security/passwordValidation.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/security/passwordValidation.ts src/security/passwordValidation.test.ts
git commit -m "feat(security): add validatePasswordFull combining strength + breach checks"
```

---

### Task 5: `PasswordStrengthMeter` component

**Files:**
- Create: `src/components/auth/PasswordStrengthMeter.tsx`
- Test: `src/components/auth/PasswordStrengthMeter.test.tsx`

**Interfaces:**
- Consumes: `PASSWORD_REQUIREMENTS` (passwordValidation), `evaluatePassword`/`STRENGTH_LABELS` (Task 3), `checkPwnedPassword` (Task 2).
- Produces: default-exported `PasswordStrengthMeter` React component with props `{ password: string; userInputs?: string[] }`. Renders the requirement checklist synchronously; strength bar + breach warning update after a debounce.

- [ ] **Step 1: Write the failing test**

Create `src/components/auth/PasswordStrengthMeter.test.tsx`:
```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PasswordStrengthMeter from "./PasswordStrengthMeter";

const SAMPLE = "abcdefgh"; // 8 lowercase chars: length met, uppercase unmet

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PasswordStrengthMeter", () => {
  it("marks the length requirement met for an 8+ char password", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve("") }));
    render(<PasswordStrengthMeter password={SAMPLE} />);
    const lengthItem = screen.getByText("At least 8 characters");
    expect(lengthItem.getAttribute("data-met")).toBe("true");
  });

  it("marks the uppercase requirement unmet for an all-lowercase password", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve("") }));
    render(<PasswordStrengthMeter password={SAMPLE} />);
    const upperItem = screen.getByText("One uppercase letter");
    expect(upperItem.getAttribute("data-met")).toBe("false");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/auth/PasswordStrengthMeter.test.tsx`
Expected: FAIL — cannot resolve `./PasswordStrengthMeter`.

- [ ] **Step 3: Write the component**

Create `src/components/auth/PasswordStrengthMeter.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Check, X, ShieldAlert } from 'lucide-react';
import { PASSWORD_REQUIREMENTS } from '@/security/passwordValidation';
import { evaluatePassword, STRENGTH_LABELS, type StrengthScore } from '@/security/passwordStrength';
import { checkPwnedPassword } from '@/security/pwnedPassword';

const DEBOUNCE_MS = 400;

const BAR_COLORS = [
  'bg-destructive',
  'bg-destructive',
  'bg-yellow-500',
  'bg-green-500',
  'bg-green-600',
] as const;

interface PasswordStrengthMeterProps {
  password: string;
  userInputs?: string[];
}

const PasswordStrengthMeter = ({ password, userInputs = [] }: PasswordStrengthMeterProps) => {
  const [score, setScore] = useState<StrengthScore | null>(null);
  const [warning, setWarning] = useState('');
  const [breachCount, setBreachCount] = useState(0);

  const inputsKey = userInputs.join('|');

  useEffect(() => {
    if (!password) {
      setScore(null);
      setWarning('');
      setBreachCount(0);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const [strength, breaches] = await Promise.all([
        evaluatePassword(password, inputsKey ? inputsKey.split('|') : []),
        checkPwnedPassword(password),
      ]);
      if (cancelled) return;
      setScore(strength.score);
      setWarning(strength.warning);
      setBreachCount(breaches);
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [password, inputsKey]);

  if (!password) return null;

  return (
    <div className="space-y-2 mt-2">
      {/* Strength bar */}
      {score !== null && (
        <div className="space-y-1" aria-live="polite">
          <div className="flex gap-1" role="presentation">
            {[0, 1, 2, 3].map((segment) => (
              <div
                key={segment}
                className={`h-1.5 flex-1 rounded-full ${segment < score ? BAR_COLORS[score] : 'bg-muted'}`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Strength: <span className="font-medium text-foreground">{STRENGTH_LABELS[score]}</span>
          </p>
        </div>
      )}

      {/* Breach warning */}
      {breachCount > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-destructive font-medium" aria-live="polite">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
          Found in {breachCount.toLocaleString()} known data breaches — choose another.
        </p>
      )}

      {/* zxcvbn warning */}
      {warning && breachCount === 0 && (
        <p className="text-xs text-muted-foreground" aria-live="polite">{warning}</p>
      )}

      {/* Requirement checklist */}
      <ul className="space-y-1">
        {PASSWORD_REQUIREMENTS.map((req) => {
          const met = req.test(password);
          return (
            <li
              key={req.label}
              data-met={met}
              className={`flex items-center gap-1.5 text-xs ${met ? 'text-green-600' : 'text-muted-foreground'}`}
            >
              {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              {req.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PasswordStrengthMeter;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/auth/PasswordStrengthMeter.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/PasswordStrengthMeter.tsx src/components/auth/PasswordStrengthMeter.test.tsx
git commit -m "feat(auth): add live PasswordStrengthMeter component"
```

---

### Task 6: Wire strong-password UX into signup (`Auth.tsx`)

**Files:**
- Modify: `src/pages/Auth.tsx`

**Interfaces:**
- Consumes: `passwordSchema`, `validatePasswordFull` (Task 4), `PasswordStrengthMeter` (Task 5).
- Produces: signup form gated by strong-password rules with live meter and show/hide toggle.

- [ ] **Step 1: Add imports**

In `src/pages/Auth.tsx`, after the existing `import MFAVerify from '@/components/auth/MFAVerify';` line, add:
```ts
import PasswordStrengthMeter from '@/components/auth/PasswordStrengthMeter';
import { passwordSchema, validatePasswordFull } from '@/security/passwordValidation';
import { Eye, EyeOff } from 'lucide-react';
```

- [ ] **Step 2: Tighten the register schema**

In `registerSchema`, change the password field from `z.string().min(6, 'Password must be at least 6 characters')` to:
```ts
  password: passwordSchema,
```

- [ ] **Step 3: Add show-password state**

After the line `const [activeTab, setActiveTab] = useState('login');` add:
```ts
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
```

- [ ] **Step 4: Gate submit on the full async validation**

In `handleRegister`, immediately after `const validated = registerSchema.parse(registerData);`, add:
```ts
      const strongCheck = await validatePasswordFull(validated.password, {
        email: validated.email,
        name: validated.name,
      });
      if (!strongCheck.valid) {
        toast({
          title: 'Weak Password',
          description: strongCheck.errors[0],
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }
```

- [ ] **Step 5: Replace the register password input block (placeholder, toggle, meter)**

Replace the register password `<div className="space-y-1.5">` block (the one containing `id="register-password"`, currently around lines 618–632) with:
```tsx
                <div className="space-y-1.5">
                  <Label htmlFor="register-password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-password"
                      type={showRegisterPassword ? 'text' : 'password'}
                      placeholder="Create a strong password"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      className="pl-10 pr-10 h-11"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword((prev) => !prev)}
                      aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                    >
                      {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <PasswordStrengthMeter
                    password={registerData.password}
                    userInputs={[registerData.email, registerData.name]}
                  />
                </div>
```

- [ ] **Step 6: Verify build and types**

Run: `npm run build`
Expected: build succeeds with no new TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Auth.tsx
git commit -m "feat(auth): enforce strong password with live meter on signup"
```

---

### Task 7: Wire strong-password UX into reset (`ResetPassword.tsx`)

**Files:**
- Modify: `src/pages/ResetPassword.tsx`

**Interfaces:**
- Consumes: `validatePasswordFull` (Task 4), `PasswordStrengthMeter` (Task 5).
- Produces: reset form gated by breach + strength + composition with live meter and show/hide toggle.

- [ ] **Step 1: Update imports**

In `src/pages/ResetPassword.tsx`, change:
```ts
import { Building2, Lock, Check, X, Loader2 } from 'lucide-react';
import { passwordSchema, PASSWORD_REQUIREMENTS } from '@/security/passwordValidation';
```
to:
```ts
import { Building2, Lock, Check, Loader2, Eye, EyeOff } from 'lucide-react';
import { validatePasswordFull } from '@/security/passwordValidation';
import PasswordStrengthMeter from '@/components/auth/PasswordStrengthMeter';
```
(`X` and the `passwordSchema`/`PASSWORD_REQUIREMENTS` imports are removed — the meter now owns the checklist. `Check` stays for the success panel.)

- [ ] **Step 2: Add show-password state**

After `const [isSubmitting, setIsSubmitting] = useState(false);` add:
```ts
  const [showPassword, setShowPassword] = useState(false);
```

- [ ] **Step 3: Replace the sync schema gate with the full async validator**

In `handleResetPassword`, replace the `try { passwordSchema.parse(newPassword); } catch { ... }` block (currently lines ~59–66) with:
```ts
    const strongCheck = await validatePasswordFull(newPassword);
    if (!strongCheck.valid) {
      toast({ title: 'Weak Password', description: strongCheck.errors[0], variant: 'destructive' });
      return;
    }
```

- [ ] **Step 4: Replace the new-password input + hand-rolled checklist with toggle + meter**

Replace the new-password `<div className="space-y-2">` block (the one containing `id="new-password"` and the `{newPassword && (<ul>...)` checklist, currently lines ~121–148) with:
```tsx
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PasswordStrengthMeter password={newPassword} />
              </div>
```

- [ ] **Step 5: Verify build and types**

Run: `npm run build`
Expected: build succeeds with no new TypeScript errors (and no "unused import" failures for the removed imports).

- [ ] **Step 6: Commit**

```bash
git add src/pages/ResetPassword.tsx
git commit -m "feat(auth): use strength meter and breach check on reset password"
```

---

### Task 8: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all suites pass, including the new `pwnedPassword`, `passwordStrength`, `passwordValidation`, and `PasswordStrengthMeter` tests.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: succeeds; zxcvbn appears in a **separate lazy chunk** (dynamic import), not the main entry.

- [ ] **Step 3: Manual smoke test (dev server)**

Run: `npm run dev`, then:
- On signup, type a common word like the literal `password` → meter shows "Very weak", breach warning appears, submit is blocked.
- Type `Gx7$mK9pLz!qWeRt` → meter shows "Strong", all checklist items green, no breach warning, submit proceeds.
- Repeat on the reset-password screen via a recovery link.
- Toggle show/hide reveals and hides the password.

Expected: behavior matches above.

## Self-Review notes

- **Spec coverage:** breach check (Task 2), zxcvbn meter (Task 3), combined validator incl. context terms (Task 4), live component with show/hide + aria-live (Task 5), signup wiring (Task 6), reset wiring (Task 7), verification (Task 8). All spec sections mapped.
- **Type consistency:** `checkPwnedPassword`, `evaluatePassword`, `StrengthResult`/`StrengthScore`, `STRENGTH_LABELS`, `validatePasswordFull`, `MIN_ZXCVBN_SCORE`, `MIN_PASSWORD_LENGTH`, and `PasswordStrengthMeter` props are referenced with identical names/signatures across tasks.
- **No CSP change** required (verified: `connect-src 'self' https: wss:`).
