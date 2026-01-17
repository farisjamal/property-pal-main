import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Calendar, Clock, MapPin, User, Phone, Mail, Check, X } from 'lucide-react';
import { format } from 'date-fns';

interface Appointment {
  appointment_id: number;
  appointment_date: string;
  appointment_time: string;
  status: string;
  created_at: string;
  tenant: {
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

const OwnerAppointments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [actionDialog, setActionDialog] = useState<{ open: boolean; type: 'approve' | 'reject' | null }>({ open: false, type: null });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (user) fetchAppointments();
  }, [user]);

  const fetchAppointments = async () => {
    try {
      // First get the owner_id
      const { data: ownerData, error: ownerError } = await supabase
        .from('property_owner')
        .select('owner_id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (ownerError) throw ownerError;
      if (!ownerData) return;

      const { data, error } = await supabase
        .from('appointment')
        .select(`
          appointment_id,
          appointment_date,
          appointment_time,
          status,
          created_at,
          tenant:tenant_id(name, email, contact_no),
          property:property_id(property_type, location, rental_price)
        `)
        .eq('owner_id', ownerData.owner_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAppointments((data as unknown as Appointment[]) || []);
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
      const newStatus = actionDialog.type === 'approve' ? 'approved' : 'rejected';
      
      const { error } = await supabase
        .from('appointment')
        .update({ status: newStatus })
        .eq('appointment_id', selectedAppointment.appointment_id);

      if (error) throw error;

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Pending</Badge>;
      case 'approved': return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Approved</Badge>;
      case 'rejected': return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Rejected</Badge>;
      case 'cancelled': return <Badge className="bg-muted text-muted-foreground">Cancelled</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const filterByStatus = (status: string | null) => {
    if (!status) return appointments;
    return appointments.filter(a => a.status === status);
  };

  const AppointmentCard = ({ appointment }: { appointment: Appointment }) => (
    <Card className="hover-lift">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{appointment.property?.property_type || 'Property'}</CardTitle>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <MapPin className="w-3 h-3" />
              <span className="line-clamp-1">{appointment.property?.location || 'Location not available'}</span>
            </div>
          </div>
          {getStatusBadge(appointment.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-primary" />
            <span>{format(new Date(appointment.appointment_date), 'MMM d, yyyy')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-primary" />
            <span>{appointment.appointment_time}</span>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground mb-2">Requested by:</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{appointment.tenant?.name || 'Unknown Tenant'}</span>
            </div>
            {appointment.tenant?.email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-3 h-3" />
                <span>{appointment.tenant.email}</span>
              </div>
            )}
            {appointment.tenant?.contact_no && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-3 h-3" />
                <span>{appointment.tenant.contact_no}</span>
              </div>
            )}
          </div>
        </div>

        {appointment.status === 'pending' && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => { setSelectedAppointment(appointment); setActionDialog({ open: true, type: 'approve' }); }}
            >
              <Check className="w-4 h-4 mr-1" />Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              onClick={() => { setSelectedAppointment(appointment); setActionDialog({ open: true, type: 'reject' }); }}
            >
              <X className="w-4 h-4 mr-1" />Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const pendingCount = filterByStatus('pending').length;
  const approvedCount = filterByStatus('approved').length;
  const rejectedCount = filterByStatus('rejected').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Appointment Requests</h2>
        <p className="text-muted-foreground">Review and manage viewing requests from tenants</p>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="all">All ({appointments.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approvedCount})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({rejectedCount})</TabsTrigger>
        </TabsList>

        {['all', 'pending', 'approved', 'rejected'].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-6">
            {filterByStatus(tab === 'all' ? null : tab).length === 0 ? (
              <Card><CardContent className="flex flex-col items-center justify-center py-12"><p className="text-muted-foreground">No {tab === 'all' ? '' : tab} appointments</p></CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filterByStatus(tab === 'all' ? null : tab).map((appointment) => (
                  <AppointmentCard key={appointment.appointment_id} appointment={appointment} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ open, type: actionDialog.type })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionDialog.type === 'approve' ? 'Approve Appointment' : 'Reject Appointment'}</DialogTitle>
            <DialogDescription>
              {actionDialog.type === 'approve'
                ? 'Are you sure you want to approve this viewing appointment? The tenant will be notified via email.'
                : 'Are you sure you want to reject this viewing appointment? The tenant will be notified via email.'}
            </DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="py-4 space-y-2 text-sm">
              <p><strong>Property:</strong> {selectedAppointment.property?.property_type || 'Property'} at {selectedAppointment.property?.location || 'N/A'}</p>
              <p><strong>Date:</strong> {format(new Date(selectedAppointment.appointment_date), 'MMMM d, yyyy')}</p>
              <p><strong>Time:</strong> {selectedAppointment.appointment_time}</p>
              <p><strong>Tenant:</strong> {selectedAppointment.tenant?.name || 'Unknown'}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, type: null })}>Cancel</Button>
            <Button
              onClick={handleAction}
              disabled={isProcessing}
              className={actionDialog.type === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
              variant={actionDialog.type === 'reject' ? 'destructive' : 'default'}
            >
              {isProcessing ? 'Processing...' : actionDialog.type === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OwnerAppointments;
