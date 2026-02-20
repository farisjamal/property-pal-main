import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Home, Calendar, UserCog } from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  totalOwners: number;
  totalProperties: number;
  totalAppointments: number;
  pendingAppointments: number;
}

const AdminDashboard = () => {
  const { userProfile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalOwners: 0,
    totalProperties: 0,
    totalAppointments: 0,
    pendingAppointments: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.roleId === 1) fetchStats();
  }, [userProfile]);

  const fetchStats = async () => {
    try {
      // Fetch counts from each table
      const [usersRes, ownersRes, propertiesRes, appointmentsRes] = await Promise.all([
        supabase.from('tenant').select('tenant_id', { count: 'exact', head: true }),
        supabase.from('property_owner').select('owner_id', { count: 'exact', head: true }),
        supabase.from('property').select('property_id', { count: 'exact', head: true }),
        supabase.from('appointment').select('appointment_id, status'),
      ]);

      const appointments = appointmentsRes.data || [];
      const pendingCount = appointments.filter(a => a.status === 'pending').length;

      setStats({
        totalUsers: usersRes.count || 0,
        totalOwners: ownersRes.count || 0,
        totalProperties: propertiesRes.count || 0,
        totalAppointments: appointments.length,
        pendingAppointments: pendingCount,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    { title: 'Total Tenants', value: stats.totalUsers, icon: Users, color: 'bg-blue-500' },
    { title: 'Property Owners', value: stats.totalOwners, icon: UserCog, color: 'bg-green-500' },
    { title: 'Properties', value: stats.totalProperties, icon: Home, color: 'bg-purple-500' },
    { title: 'Appointments', value: stats.totalAppointments, icon: Calendar, color: 'bg-orange-500' },
  ];

  if (userProfile?.roleId !== 1) {
    return <div className="flex items-center justify-center h-64"><p className="text-destructive">Unauthorized: Admin access required</p></div>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.title} className="hover-lift">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="w-4 h-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.pendingAppointments > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="text-orange-700 dark:text-orange-400">
              ⏳ {stats.pendingAppointments} Pending Appointment{stats.pendingAppointments > 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              There are appointments waiting for owner approval.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminDashboard;
