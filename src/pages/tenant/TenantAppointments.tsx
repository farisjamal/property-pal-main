import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Calendar, Clock, MapPin, User, Phone, X } from 'lucide-react';
import { format } from 'date-fns';
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
const TenantAppointments = () => {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelDialog, setCancelDialog] = useState<{
    open: boolean;
    appointment: Appointment | null;
  }>({
    open: false,
    appointment: null
  });
  const [isCancelling, setIsCancelling] = useState(false);
  const [tenantId, setTenantId] = useState<number | null>(null);
  useEffect(() => {
    if (user) fetchAppointments();
  }, [user]);
  const fetchAppointments = async () => {
    try {
      // Get tenant_id
      const {
        data: tenantData,
        error: tenantError
      } = await supabase.from('tenant').select('tenant_id').eq('user_id', user!.id).maybeSingle();
      if (tenantError) throw tenantError;
      if (!tenantData) return;
      setTenantId(tenantData.tenant_id);
      const {
        data,
        error
      } = await supabase.from('appointment').select(`
          appointment_id,
          appointment_date,
          appointment_time,
          status,
          created_at,
          property:property_id(property_type, location, rental_price),
          property_owner:owner_id(name, contact_no)
        `).eq('tenant_id', tenantData.tenant_id).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setAppointments(data as unknown as Appointment[] || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  const handleCancel = async () => {
    if (!cancelDialog.appointment) return;
    setIsCancelling(true);
    try {
      const {
        error
      } = await supabase.from('appointment').update({
        status: 'cancelled'
      }).eq('appointment_id', cancelDialog.appointment.appointment_id).eq('tenant_id', tenantId);
      if (error) throw error;
      toast({
        title: 'Success',
        description: 'Appointment cancelled successfully'
      });
      setCancelDialog({
        open: false,
        appointment: null
      });
      fetchAppointments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsCancelling(false);
    }
  };
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">⏳ Awaiting Approval</Badge>;
      case 'approved':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">✓ Confirmed</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">✗ Declined</Badge>;
      case 'cancelled':
        return <Badge className="bg-muted text-muted-foreground">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  const filterByStatus = (status: string | null) => {
    if (!status) return appointments;
    return appointments.filter(a => a.status === status);
  };
  const AppointmentCard = ({
    appointment
  }: {
    appointment: Appointment;
  }) => <Card className="hover-lift">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{appointment.property.property_type}</CardTitle>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <MapPin className="w-3 h-3" />
              <span className="line-clamp-1">{appointment.property.location}</span>
            </div>
          </div>
          {getStatusBadge(appointment.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-1 text-lg font-bold text-primary">
          
          <span>RM {appointment.property.rental_price.toLocaleString()}</span>
          <span className="text-sm font-normal text-muted-foreground">/mo</span>
        </div>

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
          <p className="text-xs text-muted-foreground mb-2">Property Owner:</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{appointment.property_owner?.name || 'Owner'}</span>
            </div>
            {appointment.status === 'approved' && appointment.property_owner?.contact_no && <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-3 h-3" />
                <span>{appointment.property_owner.contact_no}</span>
              </div>}
          </div>
        </div>

        {appointment.status === 'pending' && <Button variant="outline" size="sm" className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => setCancelDialog({
        open: true,
        appointment
      })}>
            <X className="w-4 h-4 mr-1" />Cancel Appointment
          </Button>}

        {appointment.status === 'approved' && <p className="text-sm text-green-600 bg-green-500/10 p-3 rounded-lg">
            🎉 Your appointment is confirmed! Contact the owner for any questions.
          </p>}

        {appointment.status === 'rejected' && <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
            The owner was unable to accommodate this viewing. Feel free to browse other properties.
          </p>}
      </CardContent>
    </Card>;
  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }
  const pendingCount = filterByStatus('pending').length;
  const approvedCount = filterByStatus('approved').length;
  const rejectedCount = filterByStatus('rejected').length;
  return <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My Appointments</h2>
        <p className="text-muted-foreground">Track your property viewing appointments</p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="all">All ({appointments.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approvedCount})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({rejectedCount})</TabsTrigger>
        </TabsList>

        {['all', 'pending', 'approved', 'rejected'].map(tab => <TabsContent key={tab} value={tab} className="mt-6">
            {filterByStatus(tab === 'all' ? null : tab).length === 0 ? <Card><CardContent className="flex flex-col items-center justify-center py-12"><p className="text-muted-foreground">No {tab === 'all' ? '' : tab} appointments</p></CardContent></Card> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filterByStatus(tab === 'all' ? null : tab).map(appointment => <AppointmentCard key={appointment.appointment_id} appointment={appointment} />)}
              </div>}
          </TabsContent>)}
      </Tabs>

      <Dialog open={cancelDialog.open} onOpenChange={open => setCancelDialog({
      open,
      appointment: cancelDialog.appointment
    })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this viewing appointment?
            </DialogDescription>
          </DialogHeader>
          {cancelDialog.appointment && <div className="py-4 space-y-2 text-sm">
              <p><strong>Property:</strong> {cancelDialog.appointment.property.property_type} at {cancelDialog.appointment.property.location}</p>
              <p><strong>Date:</strong> {format(new Date(cancelDialog.appointment.appointment_date), 'MMMM d, yyyy')}</p>
              <p><strong>Time:</strong> {cancelDialog.appointment.appointment_time}</p>
            </div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog({
            open: false,
            appointment: null
          })}>Keep Appointment</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={isCancelling}>
              {isCancelling ? 'Cancelling...' : 'Cancel Appointment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>;
};
export default TenantAppointments;