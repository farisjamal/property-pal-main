import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Home, Calendar, UserCog, ArrowRight, ShieldAlert } from 'lucide-react';

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
    { title: 'Total Tenants', value: stats.totalUsers, icon: Users, hoverBorder: 'hover:border-blue-500/50' },
    { title: 'Property Owners', value: stats.totalOwners, icon: UserCog, hoverBorder: 'hover:border-purple-500/50' },
    { title: 'Properties', value: stats.totalProperties, icon: Home, hoverBorder: 'hover:border-primary/50' },
    { title: 'Appointments', value: stats.totalAppointments, icon: Calendar, hoverBorder: 'hover:border-orange-500/50' },
  ];

  if (userProfile?.roleId !== 1) {
    return <div className="flex items-center justify-center h-64"><p className="text-destructive font-semibold">Unauthorized: Admin access required</p></div>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      
      {/* Metric Cards - Stripe Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((stat, i) => (
          <Card key={stat.title} className={`bg-card/90 backdrop-blur-md border border-border transition-colors duration-200 shadow-sm ${stat.hoverBorder}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {stat.title}
              </CardTitle>
              <stat.icon className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
               <div className="text-3xl font-semibold tracking-tight text-foreground">{stat.value}</div>
               <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">Registered in system <ArrowRight className="w-3 h-3" /></p>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.pendingAppointments > 0 && (
        <Card className="bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-900/50 shadow-sm overflow-hidden relative">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              Action Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.pendingAppointments} Pending Appointment{stats.pendingAppointments > 1 ? 's' : ''}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  There are appointments waiting for owner approval across properties.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminDashboard;
