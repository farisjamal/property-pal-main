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
