import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';
import type { KycStatus } from '@/utils/kyc';
import { cn } from '@/lib/utils';

interface Props {
  status: KycStatus;
  className?: string;
}

const config: Record<KycStatus, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  not_submitted: {
    label: 'Not Submitted',
    cls: 'bg-muted text-muted-foreground border-border',
    Icon: AlertCircle,
  },
  pending: {
    label: 'Pending Review',
    cls: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800',
    Icon: Clock,
  },
  approved: {
    label: 'Verified',
    cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800',
    Icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    cls: 'bg-red-500/10 text-red-600 border-red-200 dark:border-red-800',
    Icon: XCircle,
  },
};

export const KycStatusBadge = ({ status, className }: Props) => {
  const { label, cls, Icon } = config[status];
  return (
    <Badge className={cn('text-xs border gap-1.5 font-medium', cls, className)}>
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  );
};

export default KycStatusBadge;
