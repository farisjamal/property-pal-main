import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ShieldCheck } from 'lucide-react';

interface Props {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}

export const PdpaNotice = ({ checked, onCheckedChange }: Props) => {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ShieldCheck className="w-4 h-4 text-primary" />
        PDPA Notice & Consent
      </div>
      <div className="text-xs text-muted-foreground leading-relaxed space-y-2">
        <p>
          <strong>Purpose:</strong> Your IC images and selfie are collected solely to verify
          your identity as a property owner on PropertyPal.
        </p>
        <p>
          <strong>Storage:</strong> Documents are stored in a private, access-controlled bucket.
          Sensitive fields (IC number, full name) are encrypted at rest via AES-256-GCM.
        </p>
        <p>
          <strong>Access:</strong> Only authorised administrators can review your documents,
          and all access is audit-logged.
        </p>
        <p>
          <strong>Retention:</strong> Documents are retained for up to 90 days after
          verification for compliance. You may request deletion at any time by contacting
          support.
        </p>
        <p>
          <strong>Your rights:</strong> Under Malaysia's PDPA 2010, you may withdraw consent,
          request access, correction, or deletion of your personal data.
        </p>
      </div>
      <div className="flex items-start gap-2 pt-1">
        <Checkbox
          id="pdpa-consent"
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
        />
        <Label htmlFor="pdpa-consent" className="text-xs leading-relaxed cursor-pointer">
          I have read and agree to the collection and processing of my personal data for
          identity verification under the terms above.
        </Label>
      </div>
    </div>
  );
};

export default PdpaNotice;
