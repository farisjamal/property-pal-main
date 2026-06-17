import { z } from 'zod';
import { checkPwnedPassword } from './pwnedPassword';
import { evaluatePassword } from './passwordStrength';

export const MIN_PASSWORD_LENGTH = 8;
export const MIN_ZXCVBN_SCORE = 3;

export const PASSWORD_REQUIREMENTS = [
  { label: `At least ${MIN_PASSWORD_LENGTH} characters`, test: (p: string) => p.length >= MIN_PASSWORD_LENGTH },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'One special character (!@#$%^&*...)', test: (p: string) => /[!@#$%^&*()_+\-=[\]{}|;:'",.<>?/~`\\]/.test(p) },
] as const;

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const req of PASSWORD_REQUIREMENTS) {
    if (!req.test(password)) {
      errors.push(req.label);
    }
  }
  return { valid: errors.length === 0, errors };
}

export const passwordSchema = z.string().refine(
  (val) => validatePassword(val).valid,
  (val) => {
    const { errors } = validatePassword(val);
    return { message: `Password requires: ${errors.join(', ')}` };
  }
);

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
