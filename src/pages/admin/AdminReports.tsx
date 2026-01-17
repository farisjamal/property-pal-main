import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FileText, Download, RefreshCw } from 'lucide-react';

interface ReportData {
  totalUsers: number;
  totalOwners: number;
  totalProperties: number;
  totalAppointments: number;
  usersByRole: { name: string; value: number }[];
  propertiesByStatus: { name: string; value: number }[];
  appointmentsByStatus: { name: string; value: number }[];
  avgPropertiesPerOwner: number;
  approvalRate: number;
}

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#22c55e'];

const AdminReports = () => {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const generateReport = async () => {
    setIsLoading(true);

    try {
      // Step 1: Retrieve user data from D2 (tenant)
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('tenant')
        .select('tenant_id, created_at');

      if (tenantsError) throw tenantsError;

      // Step 2: Retrieve property owner data from D3
      const { data: ownersData, error: ownersError } = await supabase
        .from('property_owner')
        .select('owner_id, name, email, created_at');

      if (ownersError) throw ownersError;

      // Step 3: Retrieve property data from D4
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('property')
        .select('property_id, property_type, location, rental_price, availability_status, owner_id, created_at');

      if (propertiesError) throw propertiesError;

      // Step 4: Retrieve appointment data from D5
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointment')
        .select('appointment_id, appointment_date, status, tenant_id, property_id, owner_id, created_at');

      if (appointmentsError) throw appointmentsError;

      // Step 5: AGGREGATE ALL DATA
      const tenants = tenantsData || [];
      const owners = ownersData || [];
      const properties = propertiesData || [];
      const appointments = appointmentsData || [];

      // Count by status
      const availableCount = properties.filter(p => p.availability_status === 'Available').length;
      const occupiedCount = properties.filter(p => p.availability_status === 'Occupied').length;
      const reservedCount = properties.filter(p => p.availability_status === 'Reserved').length;

      const pendingCount = appointments.filter(a => a.status === 'pending').length;
      const approvedCount = appointments.filter(a => a.status === 'approved').length;
      const rejectedCount = appointments.filter(a => a.status === 'rejected').length;
      const cancelledCount = appointments.filter(a => a.status === 'cancelled').length;

      const aggregatedData: ReportData = {
        totalUsers: tenants.length,
        totalOwners: owners.length,
        totalProperties: properties.length,
        totalAppointments: appointments.length,
        
        usersByRole: [
          { name: 'Property Owners', value: owners.length },
          { name: 'Tenants', value: tenants.length },
        ],
        
        propertiesByStatus: [
          { name: 'Available', value: availableCount },
          { name: 'Occupied', value: occupiedCount },
          { name: 'Reserved', value: reservedCount },
        ],
        
        appointmentsByStatus: [
          { name: 'Pending', value: pendingCount },
          { name: 'Approved', value: approvedCount },
          { name: 'Rejected', value: rejectedCount },
          { name: 'Cancelled', value: cancelledCount },
        ],
        
        avgPropertiesPerOwner: owners.length > 0 ? properties.length / owners.length : 0,
        approvalRate: appointments.length > 0 
          ? (approvedCount / appointments.length) * 100 
          : 0,
      };

      // Step 6 & 7: Set and display report
      setReportData(aggregatedData);

      toast({
        title: 'Report Generated',
        description: 'The report has been generated successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            System Reports
          </CardTitle>
          <Button onClick={generateReport} disabled={isLoading} className="bg-gradient-primary">
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Generate Report
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {!reportData ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Click "Generate Report" to aggregate data from all tables and generate analytics.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-gradient">{reportData.totalUsers}</div>
                    <p className="text-sm text-muted-foreground">Total Tenants</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-gradient">{reportData.totalOwners}</div>
                    <p className="text-sm text-muted-foreground">Property Owners</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-gradient">{reportData.totalProperties}</div>
                    <p className="text-sm text-muted-foreground">Properties</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-gradient">{reportData.totalAppointments}</div>
                    <p className="text-sm text-muted-foreground">Appointments</p>
                  </CardContent>
                </Card>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-primary">{reportData.avgPropertiesPerOwner.toFixed(1)}</div>
                    <p className="text-sm text-muted-foreground">Avg. Properties per Owner</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-accent">{reportData.approvalRate.toFixed(1)}%</div>
                    <p className="text-sm text-muted-foreground">Appointment Approval Rate</p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Properties by Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Properties by Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={reportData.propertiesByStatus}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {reportData.propertiesByStatus.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Appointments by Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Appointments by Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={reportData.appointmentsByStatus}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="value" name="Count" fill="#8b5cf6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminReports;
