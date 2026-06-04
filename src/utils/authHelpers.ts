/**
 * Authenticator Assurance Level state returned by
 * `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`.
 */
interface AalState {
  currentLevel: 'aal1' | 'aal2' | null;
  nextLevel: 'aal1' | 'aal2' | null;
}

/**
 * True when the account has a verified second factor (nextLevel is aal2) but the
 * current session has not completed it yet. Password auth alone only reaches aal1,
 * so this gates access until the TOTP challenge is passed.
 */
export const requiresMfaChallenge = (aal: AalState | null | undefined): boolean =>
  aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2';
