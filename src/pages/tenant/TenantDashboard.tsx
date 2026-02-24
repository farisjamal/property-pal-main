import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Calendar,
  CheckCircle,
  Heart,
  Clock,
  MapPin,
  ArrowRight,
  Building2,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';

interface AppointmentSummary {
  appointment_id: number;
  appointment_date: string;
  appointment_time: string;
  status: string;
  property: { property_type: string; location: string } | null;
}

interface DashboardStats {
  total: number;
  pending: number;
  approved: number;
  saved: number;
}

const statusConfig = {
  pending: { label: 'Pending', className: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800' },
  approved: { label: 'Approved', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800' },
  rejected: { label: 'Rejected', className: 'bg-red-500/10 text-red-600 border-red-200 dark:border-red-800' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground border-border' },
};

const TenantDashboard = () => {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({ total: 0, pending: 0, approved: 0, saved: 0 });
  const [recentAppointments, setRecentAppointments] = useState<AppointmentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Get tenant_id
      const { data: tenantData } = await supabase
        .from('tenant')
        .select('tenant_id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (!tenantData) return;

      // Fetch appointments
      const { data: appointments } = await supabase
        .from('appointment')
        .select('appointment_id, appointment_date, appointment_time, status, property:property_id(property_type, location)')
        .eq('tenant_id', tenantData.tenant_id)
        .order('created_at', { ascending: false });

      // Fetch favorites count
      const { count: favCount } = await supabase
        .from('favorites')
        .select('property_id', { count: 'exact', head: true })
        .eq('tenant_id', tenantData.tenant_id);

      const appts = (appointments as unknown as AppointmentSummary[]) || [];
      setStats({
        total: appts.length,
        pending: appts.filter(a => a.status === 'pending').length,
        approved: appts.filter(a => a.status === 'approved').length,
        saved: favCount || 0,
      });
      setRecentAppointments(appts.slice(0, 3));
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const today = new Date();
  const greeting =
    today.getHours() < 12 ? 'Good morning' :
    today.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  const statCards = [
    {
      label: 'Total Appointments',
      value: stats.total,
      icon: Calendar,
      iconClass: 'text-primary',
      bgClass: 'bg-primary/8',
    },
    {
      label: 'Pending Review',
      value: stats.pending,
      icon: Clock,
      iconClass: 'text-amber-500',
      bgClass: 'bg-amber-500/8',
    },
    {
      label: 'Approved',
      value: stats.approved,
      icon: CheckCircle,
      iconClass: 'text-emerald-500',
      bgClass: 'bg-emerald-500/8',
    },
    {
      label: 'Saved Properties',
      value: stats.saved,
      icon: Heart,
      iconClass: 'text-rose-500',
      bgClass: 'bg-rose-500/8',
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="animate-fade-up">
        <p className="text-sm text-muted-foreground font-medium mb-1">
          {format(today, 'EEEE, MMMM d, yyyy')}
        </p>
        <h1 className="font-display font-light text-[clamp(1.8rem,4vw,2.8rem)] leading-tight tracking-[-0.02em] text-foreground">
          {greeting}
          {userProfile?.name && (
            <span className="text-primary italic">{`, ${userProfile.name.split(' ')[0]}`}</span>
          )}
        </h1>
        <p className="text-muted-foreground mt-1.5">
          Browse properties and track your viewing appointments.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div
            key={card.label}
            className="card-elevated p-5 animate-fade-up"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <div className="flex items-start justify-between mb-4">
              <p className="text-xs font-medium text-muted-foreground leading-tight max-w-[6rem]">
                {card.label}
              </p>
              <div className={`w-8 h-8 rounded-lg ${card.bgClass} flex items-center justify-center shrink-0`}>
                <card.icon className={`w-4 h-4 ${card.iconClass}`} />
              </div>
            </div>
            <div className="font-display font-medium text-[2.2rem] leading-none text-foreground">
              {isLoading ? (
                <div className="h-9 w-10 bg-muted rounded-lg animate-pulse" />
              ) : (
                card.value
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div
        className="card-elevated p-6 animate-fade-up"
        style={{ animationDelay: '0.35s' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base">Quick Actions</h2>
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2 border-2 hover:bg-primary/5 hover:border-primary/30 transition-all"
            onClick={() => navigate('/tenant/properties')}
          >
            <Search className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">Browse Properties</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2 border-2 hover:bg-primary/5 hover:border-primary/30 transition-all"
            onClick={() => navigate('/tenant/appointments')}
          >
            <Calendar className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-medium">My Appointments</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2 border-2 hover:bg-primary/5 hover:border-primary/30 transition-all"
            onClick={() => navigate('/tenant/profile')}
          >
            <Building2 className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium">Edit Profile</span>
          </Button>
        </div>
      </div>

      {/* Recent appointments */}
      <div className="animate-fade-up" style={{ animationDelay: '0.45s' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base">Recent Appointments</h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/tenant/appointments')}
          >
            View all
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted/50 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : recentAppointments.length === 0 ? (
          <div className="card-elevated p-10 text-center">
            <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No appointments yet.</p>
            <Button
              className="mt-4 bg-primary hover:bg-primary/90 font-medium"
              onClick={() => navigate('/tenant/properties')}
            >
              Browse Properties
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {recentAppointments.map((appt) => {
              const sc = statusConfig[appt.status as keyof typeof statusConfig] || statusConfig.pending;
              return (
                <div
                  key={appt.appointment_id}
                  className="card-elevated p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm leading-tight">
                        {appt.property?.property_type || 'Property'}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{appt.property?.location || '—'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-medium">
                        {format(new Date(appt.appointment_date), 'MMM d, yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">{appt.appointment_time}</p>
                    </div>
                    <Badge className={`text-xs shrink-0 ${sc.className}`}>{sc.label}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TenantDashboard;
