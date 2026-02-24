import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Calendar, Clock, MapPin, User, Phone, Mail, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { decryptData } from '@/utils/security';
import { logSensitiveDataAccess, logAppointmentStatusChange } from '@/utils/auditLog';

interface Appointment {
  appointment_id: number;
  appointment_date: string;
  appointment_time: string;
  status: string;
  created_at: string;
  tenant: {
    tenant_id: number;
    name: string;
    email: string | null;
    contact_no: string | null;
  } | null;
  property: {
    property_type: string;
    location: string;
    rental_price: number;
  } | null;
}

const statusConfig = {
  pending: { label: 'Pending', className: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800' },
  approved: { label: 'Approved', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800' },
  rejected: { label: 'Rejected', className: 'bg-red-500/10 text-red-600 border-red-200 dark:border-red-800' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground border-border' },
};

const OwnerAppointments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [actionDialog, setActionDialog] = useState<{ open: boolean; type: 'approve' | 'reject' | null }>({ open: false, type: null });
  const [isProcessing, setIsProcessing] = useState(false);
  const [ownerId, setOwnerId] = useState<number | null>(null);

  useEffect(() => {
    if (user) fetchAppointments();
  }, [user]);

  const fetchAppointments = async () => {
    try {
      const { data: ownerData, error: ownerError } = await supabase
        .from('property_owner')
        .select('owner_id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (ownerError) throw ownerError;
      if (!ownerData) return;
      setOwnerId(ownerData.owner_id);

      const { data, error } = await supabase
        .from('appointment')
        .select(`
          appointment_id,
          appointment_date,
          appointment_time,
          status,
          created_at,
          tenant:tenant_id(tenant_id, name, email, contact_no),
          property:property_id(property_type, location, rental_price)
        `)
        .eq('owner_id', ownerData.owner_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const decryptedAppointments = await Promise.all(
        (data as unknown as Appointment[])?.map(async (appointment) => {
          if (appointment.tenant?.contact_no) {
            const decryptedContactNo = await decryptData(appointment.tenant.contact_no);
            logSensitiveDataAccess('TENANT', appointment.tenant.tenant_id.toString(), ['contact_no']);
            return {
              ...appointment,
              tenant: { ...appointment.tenant, contact_no: decryptedContactNo },
            };
          }
          return appointment;
        }) || []
      );

      setAppointments(decryptedAppointments);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedAppointment || !actionDialog.type) return;
    setIsProcessing(true);
    try {
      const oldStatus = selectedAppointment.status;
      const newStatus = actionDialog.type === 'approve' ? 'approved' : 'rejected';

      const { error } = await supabase
        .from('appointment')
        .update({ status: newStatus })
        .eq('appointment_id', selectedAppointment.appointment_id)
        .eq('owner_id', ownerId);

      if (error) throw error;

      await logAppointmentStatusChange(
        selectedAppointment.appointment_id.toString(),
        oldStatus,
        newStatus
      );

      toast({
        title: 'Success',
        description: `Appointment ${newStatus} successfully. The tenant will be notified.`,
      });

      setActionDialog({ open: false, type: null });
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
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
              {appointment.property?.property_type || 'Property'}
            </h3>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{appointment.property?.location || '—'}</span>
            </div>
          </div>
          <Badge className={`text-xs shrink-0 border ${sc.className}`}>{sc.label}</Badge>
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

        {/* Tenant Info */}
        <div className="pt-3 border-t border-border/50">
          <p className="section-label mb-2.5">Requested by</p>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">
                {appointment.tenant?.name || 'Unknown Tenant'}
              </p>
              {appointment.tenant?.email && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <Mail className="w-3 h-3 shrink-0" />
                  <span className="truncate">{appointment.tenant.email}</span>
                </div>
              )}
              {appointment.tenant?.contact_no && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="w-3 h-3 shrink-0" />
                  <span>{appointment.tenant.contact_no}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions (pending only) */}
        {appointment.status === 'pending' && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-1.5 text-xs font-medium"
              onClick={() => {
                setSelectedAppointment(appointment);
                setActionDialog({ open: true, type: 'approve' });
              }}
            >
              <Check className="w-3.5 h-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1 rounded-xl gap-1.5 text-xs font-medium"
              onClick={() => {
                setSelectedAppointment(appointment);
                setActionDialog({ open: true, type: 'reject' });
              }}
            >
              <X className="w-3.5 h-3.5" />
              Reject
            </Button>
          </div>
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
        <p className="section-label mb-1.5">Management</p>
        <h1 className="font-display font-light text-[clamp(1.8rem,4vw,2.8rem)] leading-tight tracking-[-0.02em]">
          Appointment Requests
        </h1>
        <p className="text-muted-foreground mt-1">
          Review and manage viewing requests from tenants.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="w-full animate-fade-up" style={{ animationDelay: '0.1s' }}>
        <TabsList className="h-auto p-1 rounded-xl bg-muted/60 gap-1">
          {[
            { value: 'all', label: 'All', count: appointments.length },
            { value: 'pending', label: 'Pending', count: pendingCount },
            { value: 'approved', label: 'Approved', count: approvedCount },
            { value: 'rejected', label: 'Rejected', count: rejectedCount },
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-9 bg-muted rounded-xl" />
                  <div className="h-9 bg-muted rounded-xl" />
                </div>
                <div className="h-14 bg-muted rounded-xl" />
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
                      No {tab === 'all' ? '' : tab} appointments.
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

      {/* Confirm Action Dialog */}
      <Dialog
        open={actionDialog.open}
        onOpenChange={open => setActionDialog({ open, type: actionDialog.type })}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display font-light text-2xl">
              {actionDialog.type === 'approve' ? 'Approve Viewing' : 'Decline Viewing'}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {actionDialog.type === 'approve'
                ? 'Confirm this viewing appointment. The tenant will be notified.'
                : 'Decline this viewing request. The tenant will be notified.'}
            </DialogDescription>
          </DialogHeader>

          {selectedAppointment && (
            <div className="py-4 space-y-3">
              <div className="card-elevated p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Property</span>
                  <span className="font-medium">
                    {selectedAppointment.property?.property_type || 'Property'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">
                    {format(new Date(selectedAppointment.appointment_date), 'MMMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Time</span>
                  <span className="font-medium">{selectedAppointment.appointment_time}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tenant</span>
                  <span className="font-medium">{selectedAppointment.tenant?.name || 'Unknown'}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setActionDialog({ open: false, type: null })}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={isProcessing}
              className={`rounded-xl px-6 ${
                actionDialog.type === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : ''
              }`}
              variant={actionDialog.type === 'reject' ? 'destructive' : 'default'}
            >
              {isProcessing
                ? 'Processing...'
                : actionDialog.type === 'approve'
                ? 'Confirm Approval'
                : 'Decline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OwnerAppointments;
