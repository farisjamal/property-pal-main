import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Calendar, Clock, MapPin, User, Phone, X, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { decryptData } from '@/security/encryption';
import { logSensitiveDataAccess } from '@/security/auditLog';

interface Appointment {
  appointment_id: number;
  appointment_date: string;
  appointment_time: string;
  status: string;
  created_at: string;
  property: {
    property_type: string;
    location: string;
    rental_price: number;
  };
  property_owner: {
    name: string;
    contact_no: string | null;
  };
}

const statusConfig = {
  pending: { label: 'Awaiting Approval', className: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800' },
  approved: { label: 'Confirmed', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800' },
  rejected: { label: 'Declined', className: 'bg-red-500/10 text-red-600 border-red-200 dark:border-red-800' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground border-border' },
};

const TenantAppointments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; appointment: Appointment | null }>({
    open: false,
    appointment: null,
  });
  const [isCancelling, setIsCancelling] = useState(false);
  const [tenantId, setTenantId] = useState<number | null>(null);

  useEffect(() => {
    if (user) fetchAppointments();
  }, [user]);

  const fetchAppointments = async () => {
    try {
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenant')
        .select('tenant_id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (tenantError) throw tenantError;
      if (!tenantData) return;
      setTenantId(tenantData.tenant_id);

      const { data, error } = await supabase
        .from('appointment')
        .select(`
          appointment_id,
          appointment_date,
          appointment_time,
          status,
          created_at,
          property:property_id(property_type, location, rental_price),
          property_owner:owner_id(name, contact_no)
        `)
        .eq('tenant_id', tenantData.tenant_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Decrypt owner contact numbers for approved appointments
      const decryptedAppointments = await Promise.all(
        ((data as unknown as Appointment[]) || []).map(async (appointment) => {
          if (appointment.status === 'approved' && appointment.property_owner?.contact_no) {
            const decryptedContactNo = await decryptData(appointment.property_owner.contact_no);
            logSensitiveDataAccess('OWNER', 'appointment-view', ['contact_no']);
            return {
              ...appointment,
              property_owner: { ...appointment.property_owner, contact_no: decryptedContactNo },
            };
          }
          return appointment;
        })
      );

      setAppointments(decryptedAppointments);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelDialog.appointment) return;
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from('appointment')
        .update({ status: 'cancelled' })
        .eq('appointment_id', cancelDialog.appointment.appointment_id)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      toast({ title: 'Success', description: 'Appointment cancelled successfully' });
      setCancelDialog({ open: false, appointment: null });
      fetchAppointments();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsCancelling(false);
    }
  };

  const filterByStatus = (status: string | null) =>
    status ? appointments.filter(a => a.status === status) : appointments;

  const AppointmentCard = ({ appointment }: { appointment: Appointment }) => {
    const sc = statusConfig[appointment.status as keyof typeof statusConfig] || statusConfig.pending;
    return (
      <div className="card-elevated p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm leading-tight truncate">
              {appointment.property.property_type}
            </h3>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{appointment.property.location}</span>
            </div>
          </div>
          <Badge className={`text-xs shrink-0 border ${sc.className}`}>{sc.label}</Badge>
        </div>

        {/* Price */}
        <div className="flex items-end gap-1.5">
          <span className="font-display font-light text-[1.6rem] leading-none text-foreground">
            RM {appointment.property.rental_price.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground mb-0.5">/mo</span>
        </div>

        {/* Date / Time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/50">
            <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs font-medium">
              {format(new Date(appointment.appointment_date), 'MMM d, yyyy')}
            </span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/50">
            <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs font-medium">{appointment.appointment_time}</span>
          </div>
        </div>

        {/* Owner Info */}
        <div className="pt-3 border-t border-border/50">
          <p className="section-label mb-2.5">Property Owner</p>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">
                {appointment.property_owner?.name || 'Owner'}
              </p>
              {appointment.status === 'approved' && appointment.property_owner?.contact_no && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <Phone className="w-3 h-3 shrink-0" />
                  <span>{appointment.property_owner.contact_no}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status-specific banners */}
        {appointment.status === 'approved' && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/8 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
              Your viewing is confirmed. Contact the owner for any questions.
            </p>
          </div>
        )}

        {appointment.status === 'rejected' && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/60">
            <XCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              The owner couldn't accommodate this viewing. Browse other available properties.
            </p>
          </div>
        )}

        {/* Cancel (pending only) */}
        {appointment.status === 'pending' && (
          <Button
            variant="outline"
            size="sm"
            className="w-full rounded-xl text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive gap-1.5 text-xs font-medium"
            onClick={() => setCancelDialog({ open: true, appointment })}
          >
            <X className="w-3.5 h-3.5" />
            Cancel Appointment
          </Button>
        )}
      </div>
    );
  };

  const pendingCount = filterByStatus('pending').length;
  const approvedCount = filterByStatus('approved').length;
  const rejectedCount = filterByStatus('rejected').length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="animate-fade-up">
        <p className="section-label mb-1.5">Schedule</p>
        <h1 className="font-display font-light text-[clamp(1.8rem,4vw,2.8rem)] leading-tight tracking-[-0.02em]">
          My Appointments
        </h1>
        <p className="text-muted-foreground mt-1">
          Track your property viewing appointments.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full animate-fade-up" style={{ animationDelay: '0.1s' }}>
        <TabsList className="h-auto p-1 rounded-xl bg-muted/60 gap-1">
          {[
            { value: 'all', label: 'All', count: appointments.length },
            { value: 'pending', label: 'Pending', count: pendingCount },
            { value: 'approved', label: 'Approved', count: approvedCount },
            { value: 'rejected', label: 'Declined', count: rejectedCount },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-lg text-xs font-medium px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1.5 bg-primary/15 text-primary text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {isLoading ? (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="card-elevated p-5 space-y-3 animate-pulse">
                <div className="h-4 bg-muted rounded-lg w-2/3" />
                <div className="h-3 bg-muted rounded-lg w-1/2" />
                <div className="h-6 bg-muted rounded-lg w-1/3 mt-1" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-9 bg-muted rounded-xl" />
                  <div className="h-9 bg-muted rounded-xl" />
                </div>
                <div className="h-12 bg-muted rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {['all', 'pending', 'approved', 'rejected'].map(tab => (
              <TabsContent key={tab} value={tab} className="mt-6">
                {filterByStatus(tab === 'all' ? null : tab).length === 0 ? (
                  <div className="card-elevated p-12 text-center">
                    <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">
                      No {tab === 'all' ? '' : tab} appointments yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filterByStatus(tab === 'all' ? null : tab).map(appointment => (
                      <AppointmentCard key={appointment.appointment_id} appointment={appointment} />
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </>
        )}
      </Tabs>

      {/* Cancel Dialog */}
      <Dialog
        open={cancelDialog.open}
        onOpenChange={open => setCancelDialog({ open, appointment: cancelDialog.appointment })}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display font-light text-2xl">Cancel Appointment</DialogTitle>
            <DialogDescription className="text-sm">
              Are you sure you want to cancel this viewing appointment?
            </DialogDescription>
          </DialogHeader>

          {cancelDialog.appointment && (
            <div className="py-4">
              <div className="card-elevated p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Property</span>
                  <span className="font-medium">{cancelDialog.appointment.property.property_type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">
                    {format(new Date(cancelDialog.appointment.appointment_date), 'MMMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Time</span>
                  <span className="font-medium">{cancelDialog.appointment.appointment_time}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCancelDialog({ open: false, appointment: null })}
              className="rounded-xl"
            >
              Keep Appointment
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isCancelling}
              className="rounded-xl"
            >
              {isCancelling ? 'Cancelling...' : 'Cancel Appointment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TenantAppointments;
