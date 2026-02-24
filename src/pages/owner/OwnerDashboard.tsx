import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  ArrowRight,
  MapPin,
  Plus,
  TrendingUp,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';

interface RecentAppointment {
  appointment_id: number;
  appointment_date: string;
  appointment_time: string;
  status: string;
  tenant: { name: string } | null;
  property: { property_type: string; location: string } | null;
}

interface DashboardStats {
  properties: number;
  pending: number;
  approved: number;
  totalAppointments: number;
}

const statusConfig = {
  pending: { label: 'Pending', className: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800' },
  approved: { label: 'Approved', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800' },
  rejected: { label: 'Rejected', className: 'bg-red-500/10 text-red-600 border-red-200 dark:border-red-800' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground border-border' },
};

const OwnerDashboard = () => {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({ properties: 0, pending: 0, approved: 0, totalAppointments: 0 });
  const [recentAppointments, setRecentAppointments] = useState<RecentAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Get owner_id
      const { data: ownerData } = await supabase
        .from('property_owner')
        .select('owner_id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (!ownerData) return;

      // Fetch property count
      const { count: propCount } = await supabase
        .from('property')
        .select('property_id', { count: 'exact', head: true })
        .eq('owner_id', ownerData.owner_id);

      // Fetch appointments with joins
      const { data: appointments } = await supabase
        .from('appointment')
        .select('appointment_id, appointment_date, appointment_time, status, tenant:tenant_id(name), property:property_id(property_type, location)')
        .eq('owner_id', ownerData.owner_id)
        .order('created_at', { ascending: false });

      const appts = (appointments as unknown as RecentAppointment[]) || [];

      setStats({
        properties: propCount || 0,
        pending: appts.filter(a => a.status === 'pending').length,
        approved: appts.filter(a => a.status === 'approved').length,
        totalAppointments: appts.length,
      });
      setRecentAppointments(appts.slice(0, 4));
    } catch (err) {
      console.error('Owner dashboard fetch error:', err);
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
      label: 'My Properties',
      value: stats.properties,
      icon: Building2,
      iconClass: 'text-primary',
      bgClass: 'bg-primary/8',
      action: () => navigate('/owner/properties'),
    },
    {
      label: 'Pending Requests',
      value: stats.pending,
      icon: Clock,
      iconClass: 'text-amber-500',
      bgClass: 'bg-amber-500/8',
      action: () => navigate('/owner/appointments'),
    },
    {
      label: 'Approved',
      value: stats.approved,
      icon: CheckCircle,
      iconClass: 'text-emerald-500',
      bgClass: 'bg-emerald-500/8',
      action: () => navigate('/owner/appointments'),
    },
    {
      label: 'Total Viewings',
      value: stats.totalAppointments,
      icon: TrendingUp,
      iconClass: 'text-blue-500',
      bgClass: 'bg-blue-500/8',
      action: () => navigate('/owner/appointments'),
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
          Manage your properties and review appointment requests from tenants.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <button
            key={card.label}
            onClick={card.action}
            className="card-elevated p-5 text-left animate-fade-up group"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <div className="flex items-start justify-between mb-4">
              <p className="text-xs font-medium text-muted-foreground leading-tight max-w-[6rem]">
                {card.label}
              </p>
              <div className={`w-8 h-8 rounded-lg ${card.bgClass} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200`}>
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
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <div className="card-elevated p-6 animate-fade-up" style={{ animationDelay: '0.35s' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base">Quick Actions</h2>
          <Users className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2 border-2 hover:bg-primary/5 hover:border-primary/30 transition-all"
            onClick={() => navigate('/owner/properties')}
          >
            <Plus className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">Add Property</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2 border-2 hover:bg-amber-500/5 hover:border-amber-500/30 transition-all"
            onClick={() => navigate('/owner/appointments')}
          >
            <Clock className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-medium">Review Requests</span>
            {stats.pending > 0 && (
              <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-xs">
                {stats.pending} pending
              </Badge>
            )}
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2 border-2 hover:bg-primary/5 hover:border-primary/30 transition-all"
            onClick={() => navigate('/owner/properties')}
          >
            <Building2 className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium">Manage Properties</span>
          </Button>
        </div>
      </div>

      {/* Recent appointment requests */}
      <div className="animate-fade-up" style={{ animationDelay: '0.45s' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base">Recent Requests</h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/owner/appointments')}
          >
            View all
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted/50 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : recentAppointments.length === 0 ? (
          <div className="card-elevated p-10 text-center">
            <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No appointment requests yet.</p>
            <Button
              className="mt-4 bg-primary hover:bg-primary/90 font-medium"
              onClick={() => navigate('/owner/properties')}
            >
              Add Your First Property
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {recentAppointments.map(appt => {
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
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm leading-tight">
                          {appt.tenant?.name || 'Tenant'}
                        </p>
                      </div>
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

export default OwnerDashboard;
