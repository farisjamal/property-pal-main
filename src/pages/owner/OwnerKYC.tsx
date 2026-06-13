import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UploadCloud, FileImage, ShieldCheck, RotateCw } from 'lucide-react';
import {
  KycStatus,
  KycDocKind,
  createKycSubmission,
  getLatestKycSubmissionForOwner,
  getOwnerKycStatus,
  uploadKycDocument,
  validateKycFile,
  resubmitAllowed,
  getSignedDocumentUrl,
} from '@/security/kyc';
import { logKycSubmission } from '@/security/auditLog';
import KycStatusBadge from '@/components/kyc/KycStatusBadge';
import PdpaNotice from '@/components/kyc/PdpaNotice';
import { supabase } from '@/integrations/supabase/client';

interface Thumbs {
  ic_front?: string;
  ic_back?: string;
  selfie?: string;
}

const OwnerKYC = () => {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();

  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [status, setStatus] = useState<KycStatus>('not_submitted');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [reviewedAt, setReviewedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [thumbs, setThumbs] = useState<Thumbs>({});

  const [fullName, setFullName] = useState('');
  const [icNo, setIcNo] = useState('');
  const [pdpaConsent, setPdpaConsent] = useState(false);

  const icFrontRef = useRef<HTMLInputElement>(null);
  const icBackRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<Record<KycDocKind, File | null>>({
    ic_front: null,
    ic_back: null,
    selfie: null,
  });

  useEffect(() => {
    if (!user) return;
    void loadOwnerAndKyc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadOwnerAndKyc = async () => {
    try {
      const { data: ownerData } = await supabase
        .from('property_owner')
        .select('owner_id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (!ownerData) {
        setIsLoading(false);
        return;
      }
      setOwnerId(ownerData.owner_id);

      const st = await getOwnerKycStatus(ownerData.owner_id);
      setStatus(st);

      const latest = await getLatestKycSubmissionForOwner(ownerData.owner_id);
      if (latest) {
        setRejectionReason(latest.rejection_reason);
        setReviewedAt(latest.reviewed_at);

        if (latest.status === 'approved' || latest.status === 'pending') {
          try {
            const [f, b, s] = await Promise.all([
              getSignedDocumentUrl(latest.ic_front_path, 60),
              getSignedDocumentUrl(latest.ic_back_path, 60),
              getSignedDocumentUrl(latest.selfie_path, 60),
            ]);
            setThumbs({ ic_front: f, ic_back: b, selfie: s });
          } catch {
            // Signed URL failures should not block page render
          }
        }
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (kind: KycDocKind, f: File | null) => {
    if (!f) {
      setFiles((prev) => ({ ...prev, [kind]: null }));
      return;
    }
    const err = validateKycFile(f);
    if (err) {
      toast({ title: 'Invalid file', description: err, variant: 'destructive' });
      return;
    }
    setFiles((prev) => ({ ...prev, [kind]: f }));
  };

  const canSubmit =
    resubmitAllowed(status) &&
    fullName.trim().length >= 3 &&
    icNo.trim().length >= 6 &&
    !!files.ic_front &&
    !!files.ic_back &&
    !!files.selfie &&
    pdpaConsent;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !ownerId) return;
    if (!canSubmit) {
      toast({ title: 'Missing fields', description: 'Please complete all fields and consent.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    const uploaded: string[] = [];
    try {
      const icFrontPath = await uploadKycDocument(user.id, 'ic_front', files.ic_front!);
      uploaded.push(icFrontPath);
      const icBackPath = await uploadKycDocument(user.id, 'ic_back', files.ic_back!);
      uploaded.push(icBackPath);
      const selfiePath = await uploadKycDocument(user.id, 'selfie', files.selfie!);
      uploaded.push(selfiePath);

      const res = await createKycSubmission({
        ownerId,
        userId: user.id,
        fullName: fullName.trim(),
        icNo: icNo.trim(),
        icFrontPath,
        icBackPath,
        selfiePath,
        pdpaConsent,
      });

      await logKycSubmission(res.id);

      toast({
        title: 'Submitted',
        description: 'Your KYC documents have been submitted for review.',
      });

      // Reset form + reload status
      setFullName('');
      setIcNo('');
      setPdpaConsent(false);
      setFiles({ ic_front: null, ic_back: null, selfie: null });
      if (icFrontRef.current) icFrontRef.current.value = '';
      if (icBackRef.current) icBackRef.current.value = '';
      if (selfieRef.current) selfieRef.current.value = '';
      await loadOwnerAndKyc();
    } catch (err: any) {
      // Best-effort cleanup of orphaned uploads
      if (uploaded.length) {
        try {
          await supabase.storage.from('kyc-documents').remove(uploaded);
        } catch {
          // ignore cleanup errors
        }
      }
      toast({ title: 'Submission failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-8 w-64 bg-muted rounded-lg" />
        <div className="h-40 bg-muted rounded-2xl" />
        <div className="h-40 bg-muted rounded-2xl" />
      </div>
    );
  }

  if (!ownerId) {
    return (
      <div className="max-w-3xl mx-auto card-elevated p-10 text-center">
        <p className="text-muted-foreground">Owner profile not found.</p>
      </div>
    );
  }

  const isFormLocked = !resubmitAllowed(status);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="animate-fade-up">
        <p className="section-label mb-1.5">Compliance</p>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="font-display font-light text-[clamp(1.8rem,4vw,2.8rem)] leading-tight tracking-[-0.02em]">
            Identity Verification
          </h1>
          <KycStatusBadge status={status} />
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          Verify your identity to publish property listings. Documents are encrypted and
          reviewed only by authorised administrators.
        </p>
      </div>

      {/* Status card */}
      {status === 'pending' && (
        <div className="card-elevated p-6 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            Under review
          </div>
          <p className="text-sm text-muted-foreground">
            Your submission is being reviewed. You'll be notified by email once a decision is made.
            You cannot edit your submission while it is under review.
          </p>
        </div>
      )}

      {status === 'approved' && (
        <div className="card-elevated p-6 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Verified
          </div>
          <p className="text-sm text-muted-foreground">
            You are verified{reviewedAt ? ` as of ${new Date(reviewedAt).toLocaleDateString()}` : ''}.
            You may now list properties.
          </p>
        </div>
      )}

      {status === 'rejected' && (
        <div className="card-elevated p-6 space-y-2 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-sm font-medium text-red-600">
            <RotateCw className="w-4 h-4" />
            Resubmission required
          </div>
          <p className="text-sm text-muted-foreground">
            <strong>Reason:</strong> {rejectionReason || 'No reason provided.'}
          </p>
          <p className="text-xs text-muted-foreground">
            Please correct the issue and submit new documents below.
          </p>
        </div>
      )}

      {/* Thumbnails (pending/approved) */}
      {(status === 'pending' || status === 'approved') && thumbs.ic_front && (
        <div className="grid grid-cols-3 gap-3">
          {(['ic_front', 'ic_back', 'selfie'] as const).map((k) => (
            <div key={k} className="card-elevated overflow-hidden">
              <div className="aspect-[3/2] bg-muted">
                {thumbs[k] ? (
                  <img src={thumbs[k]} alt={k} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <FileImage className="w-6 h-6" />
                  </div>
                )}
              </div>
              <div className="p-2 text-[11px] text-center text-muted-foreground uppercase tracking-wide">
                {k.replace('_', ' ')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submission form */}
      {!isFormLocked && (
        <form onSubmit={handleSubmit} className="card-elevated p-6 space-y-5">
          <h2 className="font-display font-light text-xl">
            {status === 'rejected' ? 'Resubmit Documents' : 'Submit Documents'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Full Name (as per IC) *
              </Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="e.g. Ahmad bin Abdullah"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="icNo" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                IC Number *
              </Label>
              <Input
                id="icNo"
                value={icNo}
                onChange={(e) => setIcNo(e.target.value)}
                required
                placeholder="xxxxxx-xx-xxxx"
                className="h-10 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FileField
              label="IC — Front"
              kind="ic_front"
              file={files.ic_front}
              inputRef={icFrontRef}
              onChange={handleFileChange}
            />
            <FileField
              label="IC — Back"
              kind="ic_back"
              file={files.ic_back}
              inputRef={icBackRef}
              onChange={handleFileChange}
            />
            <FileField
              label="Selfie holding IC"
              kind="selfie"
              file={files.selfie}
              inputRef={selfieRef}
              onChange={handleFileChange}
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            JPEG / PNG / WebP, max 5 MB each. Ensure IC text is fully legible.
          </p>

          <PdpaNotice checked={pdpaConsent} onCheckedChange={setPdpaConsent} />

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="rounded-xl px-6"
            >
              <UploadCloud className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Submitting…' : status === 'rejected' ? 'Resubmit' : 'Submit for Review'}
            </Button>
          </div>
        </form>
      )}

      {userProfile && (
        <p className="text-[11px] text-muted-foreground text-center">
          Signed in as {userProfile.email}
        </p>
      )}
    </div>
  );
};

interface FileFieldProps {
  label: string;
  kind: KycDocKind;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement>;
  onChange: (kind: KycDocKind, file: File | null) => void;
}

const FileField = ({ label, kind, file, inputRef, onChange }: FileFieldProps) => (
  <div className="space-y-2">
    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {label} *
    </Label>
    <div className="border border-dashed border-border rounded-xl p-3 text-center bg-secondary/20">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => onChange(kind, e.target.files?.[0] || null)}
        className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:text-primary file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-primary/15"
      />
      {file && (
        <p className="text-[10px] text-muted-foreground mt-2 truncate">
          {file.name} · {(file.size / 1024).toFixed(0)} KB
        </p>
      )}
    </div>
  </div>
);

export default OwnerKYC;
