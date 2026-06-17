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
