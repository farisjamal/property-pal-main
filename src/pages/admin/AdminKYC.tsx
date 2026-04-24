import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ShieldCheck, ShieldX, Eye, Clock } from 'lucide-react';
import {
  KycStatus,
  KycSubmissionRow,
  approveSubmission,
  getSignedDocumentUrl,
  listAllSubmissions,
  rejectSubmission,
} from '@/utils/kyc';
import { batchDecrypt } from '@/utils/security';
import {
  logKycDecision,
  logKycDocumentAccess,
  logSensitiveDataAccess,
} from '@/utils/auditLog';
import KycStatusBadge from '@/components/kyc/KycStatusBadge';

interface DecryptedSubmission extends KycSubmissionRow {
  fullName: string;
  icNo: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
}

const TABS: { value: KycStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const AdminKYC = () => {
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<KycStatus | 'all'>('pending');
  const [rows, setRows] = useState<DecryptedSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<DecryptedSubmission | null>(null);
  const [docUrls, setDocUrls] = useState<{ [k: string]: string }>({});
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isActing, setIsActing] = useState(false);

  useEffect(() => {
    if (userProfile?.roleId === 1) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile, tab]);

  const load = async () => {
    setIsLoading(true);
    try {
      const raw = await listAllSubmissions(tab === 'all' ? undefined : (tab as KycStatus));

      // Build owner lookup
      const ownerIds = Array.from(new Set(raw.map((r) => r.owner_id)));
      const ownerMap = new Map<number, { name: string | null; email: string | null }>();
      if (ownerIds.length) {
        const { data: owners } = await supabase
          .from('property_owner')
          .select('owner_id, name, email')
          .in('owner_id', ownerIds);
        (owners || []).forEach((o: any) =>
          ownerMap.set(o.owner_id, { name: o.name, email: o.email }),
        );
      }

      // Batch decrypt full_name and ic_no across all rows
      const encPayloads = raw.flatMap((r) => [r.full_name_enc, r.ic_no_enc]);
      const decrypted = await batchDecrypt(encPayloads);

      const decoded: DecryptedSubmission[] = raw.map((r, i) => ({
        ...r,
        fullName: decrypted[i * 2] || '',
        icNo: decrypted[i * 2 + 1] || '',
        ownerName: ownerMap.get(r.owner_id)?.name || null,
        ownerEmail: ownerMap.get(r.owner_id)?.email || null,
      }));

      if (raw.length) {
        await logSensitiveDataAccess(
          'KYC',
          'bulk',
          ['full_name', 'ic_no'],
        );
      }

      setRows(decoded);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const openDetail = async (row: DecryptedSubmission) => {
    setSelected(row);
    setDocUrls({});
    try {
      const [f, b, s] = await Promise.all([
        getSignedDocumentUrl(row.ic_front_path, 120),
        getSignedDocumentUrl(row.ic_back_path, 120),
        getSignedDocumentUrl(row.selfie_path, 120),
      ]);
      setDocUrls({ ic_front: f, ic_back: b, selfie: s });
      await Promise.all([
        logKycDocumentAccess(row.id, 'ic_front'),
        logKycDocumentAccess(row.id, 'ic_back'),
        logKycDocumentAccess(row.id, 'selfie'),
      ]);
    } catch (err: any) {
      toast({ title: 'Cannot load documents', description: err.message, variant: 'destructive' });
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    setIsActing(true);
    try {
      await approveSubmission(selected.id);
      await logKycDecision(selected.id, 'approved');
      toast({ title: 'Approved', description: 'Owner has been verified.' });
      setSelected(null);
      await load();
    } catch (err: any) {
      toast({ title: 'Approval failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsActing(false);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    setIsActing(true);
    try {
      await rejectSubmission(selected.id, rejectReason);
      await logKycDecision(selected.id, 'rejected', rejectReason.trim());
      toast({ title: 'Rejected', description: 'Owner has been notified via dashboard.' });
      setRejectOpen(false);
      setRejectReason('');
      setSelected(null);
      await load();
    } catch (err: any) {
      toast({ title: 'Rejection failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsActing(false);
    }
  };

  if (userProfile?.roleId !== 1) {
    return (
      <div className="max-w-xl mx-auto card-elevated p-10 text-center">
        <ShieldX className="w-10 h-10 text-destructive mx-auto mb-3" />
        <h2 className="font-medium">Forbidden</h2>
        <p className="text-sm text-muted-foreground mt-1">Admins only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="animate-fade-up">
        <p className="section-label mb-1.5">Compliance</p>
        <h1 className="font-display font-light text-[clamp(1.8rem,4vw,2.8rem)] leading-tight tracking-[-0.02em]">
          KYC Review
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Verify owner identities. Every document view and decision is audit-logged.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as KycStatus | 'all')}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-6">
            {isLoading ? (
              <div className="card-elevated p-10 text-center text-muted-foreground">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="card-elevated p-10 text-center text-muted-foreground">
                No submissions.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rows.map((r) => (
                  <Card key={r.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{r.fullName || '(name encrypted)'}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.ownerName ? `${r.ownerName} · ` : ''}{r.ownerEmail || 'no email'}
                          </p>
                        </div>
                        <KycStatusBadge status={r.status} />
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        Submitted {new Date(r.submitted_at).toLocaleString()}
                      </div>
                      {r.rejection_reason && (
                        <p className="text-xs text-red-600">
                          Reason: {r.rejection_reason}
                        </p>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl w-full gap-2"
                        onClick={() => openDetail(r)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Review
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display font-light text-2xl flex items-center gap-3">
                  Review Submission
                  <KycStatusBadge status={selected.status} />
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Full Name" value={selected.fullName} />
                  <Field label="IC Number" value={selected.icNo} />
                  <Field label="Owner" value={selected.ownerName || '—'} />
                  <Field label="Email" value={selected.ownerEmail || '—'} />
                  <Field label="Submitted" value={new Date(selected.submitted_at).toLocaleString()} />
                  <Field
                    label="PDPA Consent"
                    value={new Date(selected.pdpa_consent_at).toLocaleString()}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {(['ic_front', 'ic_back', 'selfie'] as const).map((k) => (
                    <div key={k} className="card-elevated overflow-hidden">
                      <div className="aspect-[3/2] bg-muted">
                        {docUrls[k] ? (
                          <a href={docUrls[k]} target="_blank" rel="noopener noreferrer">
                            <img src={docUrls[k]} alt={k} className="w-full h-full object-cover" />
                          </a>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                            loading…
                          </div>
                        )}
                      </div>
                      <div className="p-2 text-[11px] text-center text-muted-foreground uppercase tracking-wide">
                        {k.replace('_', ' ')}
                      </div>
                    </div>
                  ))}
                </div>

                {selected.rejection_reason && (
                  <div className="text-sm text-red-600">
                    Prior rejection reason: {selected.rejection_reason}
                  </div>
                )}
              </div>

              {selected.status === 'pending' && (
                <DialogFooter className="pt-4">
                  <Button
                    variant="outline"
                    className="rounded-xl text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => setRejectOpen(true)}
                    disabled={isActing}
                  >
                    <ShieldX className="w-4 h-4 mr-1.5" />
                    Reject
                  </Button>
                  <Button
                    className="rounded-xl"
                    onClick={handleApprove}
                    disabled={isActing}
                  >
                    <ShieldCheck className="w-4 h-4 mr-1.5" />
                    {isActing ? 'Approving…' : 'Approve'}
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Reject submission</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            <p className="text-xs text-muted-foreground">
              Provide a clear reason. The owner will see this on their dashboard.
            </p>
            <Textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. IC image is blurry and IC number is not readable."
              className="rounded-xl resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={handleReject}
              disabled={isActing || rejectReason.trim().length < 10}
            >
              {isActing ? 'Rejecting…' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    <div className="text-sm font-medium break-all">{value}</div>
  </div>
);

export default AdminKYC;
