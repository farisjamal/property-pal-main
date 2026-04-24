import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { KycStatus } from '@/utils/kyc';

interface Props {
  status: KycStatus;
  children: ReactNode;
}

/**
 * Wraps children only when owner KYC is approved.
 * Otherwise shows a CTA to complete verification.
 * Server-side trigger `enforce_owner_kyc_on_property` is the authoritative check;
 * this gate is purely for UX.
 */
export const KycGate = ({ status, children }: Props) => {
  if (status === 'approved') return <>{children}</>;

  const copy: Record<Exclude<KycStatus, 'approved'>, { title: string; desc: string }> = {
    not_submitted: {
      title: 'Verify your identity to list properties',
      desc: 'Complete a one-time KYC verification before publishing any listing.',
    },
    pending: {
      title: 'Verification in review',
      desc: 'Your submission is being reviewed by our admin team. You can list properties once approved.',
    },
    rejected: {
      title: 'Verification rejected',
      desc: 'Please review the reason on your KYC page and resubmit.',
    },
  };
  const { title, desc } = copy[status];

  return (
    <Alert className="border-amber-200 dark:border-amber-800 bg-amber-500/5">
      <ShieldAlert className="w-4 h-4 text-amber-600" />
      <AlertTitle className="font-medium">{title}</AlertTitle>
      <AlertDescription className="text-sm text-muted-foreground">
        {desc}
        <div className="mt-3">
          <Button asChild size="sm" variant="outline" className="rounded-xl">
            <Link to="/owner/kyc">
              Go to KYC <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default KycGate;
