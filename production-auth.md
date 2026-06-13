# Implementation Plan: Production-Grade Authentication & Authorization

## Task Type
- [x] Frontend (Auth UI, MFA enrollment, password reset page)
- [x] Backend (Supabase config, Edge Functions, MFA verification)
- [x] Fullstack (end-to-end auth flow)

---

## Problem Analysis

### Current State
| Issue | Root Cause | Severity |
|-------|-----------|----------|
| Fake emails can register | Supabase email confirmation disabled; auto-login after signup bypasses verification | CRITICAL |
| Password reset link doesn't work | `resetPasswordForEmail` redirects to `/auth` but no code handles `type=recovery` event or provides a new-password form | CRITICAL |
| 2FA/MFA non-functional | `input-otp` UI component installed but zero MFA enrollment/verification logic exists | HIGH |
| Rate limiting bypassed easily | Client-side only (state resets on page refresh) | MEDIUM |
| Weak password policy | Only 6 chars minimum, no complexity | MEDIUM |

### Supabase Auth Capabilities Used
- `supabase.auth.signUp()` - registration
- `supabase.auth.signInWithPassword()` - login
- `supabase.auth.resetPasswordForEmail()` - sends reset email (broken redirect)
- `supabase.auth.mfa.*` - **NOT USED AT ALL** (Supabase has built-in TOTP MFA)

---

## Technical Solution

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Auth Flow (Fixed)                     │
│                                                         │
│  Register → Email Confirmation → Login → MFA Challenge  │
│                                           ↓             │
│                                    MFA Verified → App   │
│                                                         │
│  Forgot Password → Email Link → /auth/reset-password    │
│                                  → Update Password      │
│                                  → Redirect to /auth    │
└─────────────────────────────────────────────────────────┘
```

**Key decisions:**
- Use **Supabase's built-in TOTP MFA** (`supabase.auth.mfa.*`) — no custom crypto needed
- Use **Supabase email confirmation** (enable in dashboard) — server-enforced, not client-side
- Create a **dedicated `/auth/reset-password` route** to handle recovery tokens
- Add **password strength validation** with zod (uppercase, lowercase, number, special char)
- Move rate limiting to **server-side** via a new Edge Function (or use Supabase's built-in)

---

## Implementation Steps

### Step 1: Enable Supabase Email Confirmation (Config)
**Expected deliverable:** Email verification enforced server-side

- In Supabase Dashboard → Authentication → Settings:
  - Enable "Confirm email" toggle
  - Set Site URL to production URL
  - Add redirect URLs: `http://localhost:8080/auth/reset-password`, `http://localhost:8080/auth`
  - Configure SMTP (or use Supabase's built-in email for dev)
- Remove the auto-login-after-register code in `Auth.tsx` (lines 229-235)
- Show a "Check your email to confirm your account" message instead

### Step 2: Strengthen Password Validation
**Expected deliverable:** Strong password requirements on registration

- Update `registerSchema` in `Auth.tsx`:
  - Min 8 chars, at least 1 uppercase, 1 lowercase, 1 number, 1 special character
- Add a `PasswordStrengthIndicator` component showing requirements in real-time
- Apply same validation on the reset-password page (Step 4)

### Step 3: Create Password Reset Flow
**Expected deliverable:** Functional forgot-password and reset-password pages

3a. **Add "Forgot Password" to login page** (`Auth.tsx`):
  - Add a "Forgot password?" link below the login form
  - On click, show an email input and call `supabase.auth.resetPasswordForEmail(email, { redirectTo: '{origin}/auth/reset-password' })`
  - Show success message: "Check your email for the reset link"

3b. **Create `ResetPassword.tsx` page** (`src/pages/auth/ResetPassword.tsx`):
  - This page handles the Supabase recovery redirect
  - On mount, listen for `supabase.auth.onAuthStateChange` with event `PASSWORD_RECOVERY`
  - Show a form with: new password, confirm password (with strength validation from Step 2)
  - Call `supabase.auth.updateUser({ password: newPassword })`
  - On success, redirect to `/auth` with success toast

3c. **Add route** in `App.tsx`:
  - `<Route path="/auth/reset-password" element={<ResetPassword />} />`

3d. **Update `OwnerProfile.tsx` and `TenantProfile.tsx`**:
  - Change `redirectTo` in `resetPasswordForEmail` to `${window.location.origin}/auth/reset-password`

### Step 4: Implement TOTP MFA (Two-Factor Authentication)
**Expected deliverable:** Functional 2FA enrollment and verification

4a. **Create MFA Enrollment component** (`src/components/auth/MFAEnrollment.tsx`):
  - Call `supabase.auth.mfa.enroll({ factorType: 'totp' })` to get QR code URI
  - Display QR code using a QR library (e.g., `qrcode.react`)
  - Show the TOTP secret as text backup
  - User enters the 6-digit code from their authenticator app
  - Verify with `supabase.auth.mfa.challengeAndVerify({ factorId, code })`
  - On success, MFA is enrolled

4b. **Create MFA Challenge component** (`src/components/auth/MFAChallenge.tsx`):
  - Uses the existing `InputOTP` component from `src/components/ui/input-otp.tsx`
  - On login, check `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`
  - If `currentLevel === 'aal1'` and `nextLevel === 'aal2'`, show MFA challenge
  - Call `supabase.auth.mfa.challenge({ factorId })` then `supabase.auth.mfa.verify({ factorId, challengeId, code })`
  - On success, proceed to dashboard

4c. **Update login flow** in `Auth.tsx`:
  - After successful password login, check MFA assurance level
  - If MFA enrolled (`nextLevel === 'aal2'`), navigate to MFA challenge instead of dashboard
  - Create an intermediate state/route for MFA verification

4d. **Add MFA enrollment to profile pages**:
  - Add "Enable Two-Factor Authentication" section to `OwnerProfile.tsx` and `TenantProfile.tsx`
  - Show enrollment status (enabled/disabled)
  - Allow enrolling new TOTP factor
  - Allow unenrolling (`supabase.auth.mfa.unenroll({ factorId })`)

4e. **Update `ProtectedRoute.tsx`**:
  - Check `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`
  - If user has MFA enrolled but only at `aal1`, redirect to MFA challenge
  - This prevents accessing protected routes without completing MFA

### Step 5: Server-Side Rate Limiting (Optional Enhancement)
**Expected deliverable:** Rate limiting that can't be bypassed by refreshing

- Create a new Edge Function `rate-limiter` or use Supabase's built-in auth rate limits
- Supabase already rate-limits auth endpoints (default: 30 requests/hour for email signup, configurable in dashboard)
- For additional protection: track failed login IPs in a `login_attempts` table
- Keep existing client-side rate limiting as UX enhancement (instant feedback)

### Step 6: Update Registration Flow for Email Verification
**Expected deliverable:** Registration requires email confirmation before access

- After `supabase.auth.signUp()`, do NOT auto-login
- Show clear message: "We've sent a confirmation email to {email}. Please click the link to activate your account."
- Handle the email confirmation redirect (Supabase redirects to Site URL after confirmation)
- On the `/auth` page, detect `type=signup` in URL hash and show "Email confirmed! You can now log in."

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `src/pages/Auth.tsx` | Modify | Add forgot password, remove auto-login, strengthen password validation, add MFA challenge after login |
| `src/pages/auth/ResetPassword.tsx` | **Create** | New page to handle password reset token and new password form |
| `src/components/auth/MFAEnrollment.tsx` | **Create** | TOTP MFA enrollment with QR code |
| `src/components/auth/MFAChallenge.tsx` | **Create** | TOTP MFA verification using InputOTP |
| `src/components/auth/PasswordStrengthIndicator.tsx` | **Create** | Real-time password strength feedback |
| `src/components/auth/ProtectedRoute.tsx` | Modify | Add MFA assurance level check |
| `src/pages/owner/OwnerProfile.tsx` | Modify | Add MFA enrollment section, fix reset redirect |
| `src/pages/tenant/TenantProfile.tsx` | Modify | Add MFA enrollment section, fix reset redirect |
| `src/App.tsx` | Modify | Add `/auth/reset-password` and `/auth/mfa` routes |
| `src/hooks/useAuth.ts` | Modify | Add MFA status to UserProfile, add MFA helper methods |

## New Dependencies

| Package | Purpose |
|---------|---------|
| `qrcode.react` | Render QR code for TOTP MFA enrollment |

`input-otp` is already installed for the OTP input UI.

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Supabase email delivery unreliable in dev | Use Supabase's Inbucket (local email testing) or configure custom SMTP |
| Users locked out if they lose authenticator | Provide backup codes during MFA enrollment (Supabase doesn't natively support this — store encrypted backup codes in DB) |
| Existing users can't login after enabling email confirmation | Existing confirmed users are unaffected; only new signups require confirmation |
| MFA enrollment UX complexity | Make MFA optional (not forced), provide clear step-by-step instructions in UI |
| Password reset token expiry | Supabase tokens expire in 1 hour by default; show clear message if expired |

---

## Supabase Dashboard Configuration Required

These changes must be made manually in the Supabase Dashboard (cannot be done via code):

1. **Authentication → Settings → Email Auth**:
   - Enable "Confirm email" = ON
   - Set "Minimum password length" = 8

2. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:8080` (dev) / production URL
   - Redirect URLs: Add `http://localhost:8080/auth/reset-password`

3. **Authentication → Settings → Rate Limits** (optional):
   - Adjust email signup rate limit if needed

4. **Authentication → Multi-Factor Authentication**:
   - Ensure MFA is enabled in Supabase project settings

---

## Pseudo-Code

### Login with MFA Flow
```typescript
// Auth.tsx - handleLogin (modified)
const handleLogin = async () => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { /* handle error, rate limit */ return; }

  // Check MFA requirement
  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalData.currentLevel === 'aal1' && aalData.nextLevel === 'aal2') {
    // User has MFA enrolled, needs verification
    navigate('/auth/mfa-verify');
    return;
  }

  // No MFA, proceed normally
  redirectBasedOnRole(roleData.role_id);
};
```

### MFA Enrollment
```typescript
// MFAEnrollment.tsx
const enrollMFA = async () => {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error) return;
  setQrCode(data.totp.qr_code); // data:image URI
  setSecret(data.totp.secret);   // text backup
  setFactorId(data.id);
};

const verifyEnrollment = async (code: string) => {
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  const verify = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  });
  if (!verify.error) { /* MFA enrolled successfully */ }
};
```

### MFA Challenge (Login Verification)
```typescript
// MFAChallenge.tsx
const verifyMFA = async (code: string) => {
  const factors = await supabase.auth.mfa.listFactors();
  const totpFactor = factors.data.totp[0];

  const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
  const verify = await supabase.auth.mfa.verify({
    factorId: totpFactor.id,
    challengeId: challenge.data.id,
    code,
  });

  if (!verify.error) {
    // Now at aal2, redirect to dashboard
    redirectBasedOnRole(userProfile.roleId);
  }
};
```

### Password Reset Page
```typescript
// ResetPassword.tsx
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      setShowResetForm(true);
    }
  });
  return () => subscription.unsubscribe();
}, []);

const handleResetPassword = async () => {
  // Validate password strength
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (!error) {
    toast({ title: 'Password updated!' });
    navigate('/auth');
  }
};
```

---

## SESSION_ID (for /ccg:execute use)
- CODEX_SESSION: N/A (codeagent-wrapper not available)
- GEMINI_SESSION: N/A (codeagent-wrapper not available)
