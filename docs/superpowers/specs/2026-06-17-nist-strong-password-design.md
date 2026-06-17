# Design: NIST-aligned Strong Passwords with Live Strength Indicator

**Date:** 2026-06-17
**Branch:** `feature/nist-strong-password`
**Reference:** NIST SP 800-63-4 §A — Strength of Memorized Secrets
(https://pages.nist.gov/800-63-4/sp800-63b/passwords/#appA)

## Problem

The signup form ([src/pages/Auth.tsx](../../../src/pages/Auth.tsx)) enforces only
`password.min(6)` and shows the placeholder "At least 6 characters" with **no live
feedback** on whether the chosen password is strong. The reset-password form
([src/pages/ResetPassword.tsx](../../../src/pages/ResetPassword.tsx)) already enforces
the shared composition rules and shows a static requirement checklist, but has no
strength meter and no breach detection.

We want both screens to guide users toward strong passwords with live feedback,
aligned with NIST SP 800-63-4 guidance.

## NIST 800-63-4 §A — what it actually requires

- Minimum length 8 characters; **recommend** 15+; allow up to at least 64.
- Allow all printable ASCII **and** Unicode, including spaces.
- **Do NOT** impose mandatory composition rules (mixtures of character types).
- **Do NOT** require periodic rotation or password hints.
- **Compare against a blocklist** of compromised (breached) passwords, dictionary
  words, repetitive/sequential characters, and context-specific words (e.g. the
  user's email or name).
- **Offer** a password-strength meter as guidance.
- Allow "show password" and paste.

## Chosen model: **Hybrid**

NIST advises *against* mandatory composition rules, but a visible composition
checklist communicates "strong" clearly to users and reviewers. We therefore keep
the existing composition checklist **and** layer the NIST-distinctive features on top:

- Keep the 5 visible composition requirements (length 8, upper, lower, number, symbol).
- Add a **zxcvbn** strength score requirement (score ≥ 3 of 4).
- Add a **breached-password** check (HaveIBeenPwned, k-anonymity).
- Add **context-term** blocking (email/name) via zxcvbn `userInputs`.
- Add a **live strength meter**, **show/hide password** toggle.

## Decisions (confirmed with user)

| Decision | Choice |
|---|---|
| Policy model | Hybrid (composition checklist + NIST extras) |
| Breach check | Yes — HaveIBeenPwned k-anonymity API |
| Strength meter | zxcvbn library (lazy-loaded) |
| Scope | Signup (Auth.tsx) + Reset (ResetPassword.tsx) only |

## Architecture

### New module: `src/security/pwnedPassword.ts`

```
checkPwnedPassword(password: string): Promise<number>
```

- SHA-1 hash the password with Web Crypto (`crypto.subtle.digest`).
- Split into 5-char prefix + suffix (k-anonymity). Send **only the prefix** to
  `https://api.pwnedpasswords.com/range/{prefix}` (Add-Padding header on).
- Match the suffix against the returned list locally; return the breach count
  (0 = not found in any known breach). The full password never leaves the browser.
- **Fails open**: on network/parse error, return 0 and log a warning. An API
  outage must never block a signup. Typed error is caught at this boundary.

CSP: `connect-src` in `vercel.json` is already `'self' https: wss:`, so
`api.pwnedpasswords.com` is permitted — **no CSP change needed**.

### New module: `src/security/passwordStrength.ts`

```
evaluatePassword(password: string, userInputs: string[]):
  Promise<{ score: 0|1|2|3|4; label: string; warning: string; suggestions: string[] }>
```

- Lazy-loads zxcvbn via dynamic `import('zxcvbn')` so the ~400KB library stays out
  of the initial bundle and only loads when a user focuses a password field.
- `userInputs` carries the user's email + name so zxcvbn penalizes context-specific
  terms (NIST requirement).
- `label` maps score → "Very weak" | "Weak" | "Fair" | "Good" | "Strong".

### Updated module: `src/security/passwordValidation.ts`

- Keep `PASSWORD_REQUIREMENTS`, `validatePassword`, `passwordSchema` (sync, instant —
  used for the live checklist and existing call sites).
- Add constants: `MIN_PASSWORD_LENGTH = 8`, `MIN_ZXCVBN_SCORE = 3`.
- Add an async combined validator:

```
validatePasswordFull(password, { email, name }):
  Promise<{ valid: boolean; errors: string[] }>
```

  Combines: composition pass **AND** zxcvbn score ≥ `MIN_ZXCVBN_SCORE` **AND**
  breach count === 0. Used on submit in both screens.

### New component: `src/components/auth/PasswordStrengthMeter.tsx`

Props: `{ password: string; userInputs: string[] }`

Renders:
1. Composition requirement checklist (instant, reuses `PASSWORD_REQUIREMENTS`).
2. Colored strength bar + label from zxcvbn (debounced ~400ms).
3. Breach warning ("This password appeared in N known breaches — choose another"),
   debounced async.
4. zxcvbn `warning` / top `suggestions` as helper text.

Accessibility: dynamic feedback region uses `aria-live="polite"`. Includes a
**show/hide password** toggle (button with `aria-label`, toggles input `type`).

### Wiring

**`src/pages/Auth.tsx` (signup):**
- Change `registerSchema.password` from `z.string().min(6, …)` to the shared
  `passwordSchema`.
- Mount `<PasswordStrengthMeter password={registerData.password}
  userInputs={[registerData.email, registerData.name]} />` under the password input.
- Update placeholder from "At least 6 characters" to "Create a strong password".
- In `handleRegister`, call `validatePasswordFull` and block submit (toast) if invalid
  — before calling `supabase.auth.signUp`.
- Add show/hide toggle to the password input.

**`src/pages/ResetPassword.tsx`:**
- Replace the existing hand-rolled checklist (lines ~135–147) with
  `<PasswordStrengthMeter password={newPassword} userInputs={[]} />`.
- In `handleResetPassword`, gate on `validatePasswordFull` (breach + strength + match)
  before `supabase.auth.updateUser`.
- Add show/hide toggle.

## Error handling

- Breach API failure → **fail-open** (return 0, soft console warning). Rationale:
  authentication is still enforced server-side by Supabase; a third-party API outage
  must not lock users out of registration. Strength + composition gating still apply
  offline.
- All async checks are debounced to avoid hammering the API on every keystroke.

## Testing (Vitest)

- `pwnedPassword`: mocked `fetch` returning a k-anonymity range body — assert a
  **hit** returns the right count and a **miss** returns 0; assert network error
  returns 0 (fail-open). Assert only the 5-char prefix is sent.
- `passwordValidation`: `validatePasswordFull` rejects a breached/low-score password
  and accepts a strong, non-breached one; context terms (email/name) lower the score.

(Test-runner presence to be confirmed during planning; add `vitest` config if absent.)

## Out of scope

- Profile change-password screens (OwnerProfile, TenantProfile, AdminUsers,
  AdminPropertyOwners) — deferred per user decision.
- Server-side / Supabase password-policy enforcement (Supabase has its own minimum;
  this work is client-side UX guidance).
- Removing composition rules entirely (would be stricter NIST; user chose Hybrid).
