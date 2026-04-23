import { z } from 'zod';

export const PASSWORD_REQUIREMENTS = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
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
