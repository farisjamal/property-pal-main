import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Calendar, TrendingUp, Sparkles, PlusCircle, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface OwnerStats {
  properties: number;
  pending: number;
  totalAppts: number;
}

const OwnerDashboard = () => {
  const { user } = useAuth();
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [stats, setStats] = useState<OwnerStats>({ properties: 0, pending: 0, totalAppts: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('property_owner')
        .select('owner_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelled && data) setOwnerId(data.owner_id);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const fetchStats = async (id: number) => {
    const [propsRes, pendingRes, totalRes] = await Promise.all([
      supabase
        .from('property')
        .select('property_id', { count: 'exact', head: true })
        .eq('owner_id', id),
      supabase
        .from('appointment')
        .select('appointment_id', { count: 'exact', head: true })
        .eq('owner_id', id)
        .eq('status', 'pending'),
      supabase
        .from('appointment')
        .select('appointment_id', { count: 'exact', head: true })
        .eq('owner_id', id),
    ]);
    setStats({
      properties: propsRes.count || 0,
      pending: pendingRes.count || 0,
      totalAppts: totalRes.count || 0,
    });
    setIsLoading(false);
  };

  useEffect(() => {
    if (!ownerId) return;
    fetchStats(ownerId);

    const channel = supabase
      .channel(`owner-dashboard-${ownerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'property', filter: `owner_id=eq.${ownerId}` },
        () => fetchStats(ownerId),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointment', filter: `owner_id=eq.${ownerId}` },
        () => fetchStats(ownerId),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [ownerId]);

  const renderValue = (value: number) =>
    isLoading
      ? <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      : <span className="text-3xl font-semibold tracking-tight text-foreground">{value}</span>;

  const propertiesSubtext = isLoading
    ? 'Loading…'
    : stats.properties === 0
      ? 'No listings yet'
      : `${stats.properties} ${stats.properties === 1 ? 'listing' : 'listings'} active`;

  const pendingSubtext = isLoading
    ? 'Loading…'
    : stats.pending === 0
      ? 'No pending requests'
      : 'Awaiting approval';

  const totalSubtext = isLoading
    ? 'Loading…'
    : stats.totalAppts === 0
      ? 'No bookings yet'
      : 'Historically booked';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">

      {/* Enterprise Welcome Card */}
      <Card className="bg-card/90 backdrop-blur-md border border-border shadow-sm overflow-hidden">
        <CardContent className="p-8 sm:p-10">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary text-foreground text-[11px] font-semibold tracking-widest uppercase mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              Owner Overview
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              Manage Your Portfolio Like a Pro
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed max-w-2xl">
              Monitor your properties and seamlessly review appointment requests from potential tenants. Maintain full control of your real estate investments from one unified dashboard.
            </p>
            <div className="pt-5 flex flex-wrap gap-3">
              <Button asChild size="default" className="rounded-lg shadow-sm font-medium">
                <Link to="/owner/properties">
                  <PlusCircle className="w-4 h-4 mr-2" /> Add/Manage Properties
                </Link>
              </Button>
              <Button asChild variant="outline" size="default" className="rounded-lg border-border bg-background hover:bg-secondary/50 font-medium">
                <Link to="/owner/appointments">
                  <Calendar className="w-4 h-4 mr-2" /> Check Appointments
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        <Card className="bg-card/90 backdrop-blur-md border border-border hover:border-primary/50 transition-colors duration-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">My Properties</CardTitle>
            <Building2 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="h-9 flex items-center">{renderValue(stats.properties)}</div>
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">{propertiesSubtext} <ArrowRight className="w-3 h-3" /></p>
          </CardContent>
        </Card>

        <Card className="bg-card/90 backdrop-blur-md border border-border hover:border-orange-500/50 transition-colors duration-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Pending Requests</CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="h-9 flex items-center">{renderValue(stats.pending)}</div>
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">{pendingSubtext} <ArrowRight className="w-3 h-3" /></p>
          </CardContent>
        </Card>

        <Card className="bg-card/90 backdrop-blur-md border border-border hover:border-green-500/50 transition-colors duration-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Total Appts</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="h-9 flex items-center">{renderValue(stats.totalAppts)}</div>
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">{totalSubtext} <ArrowRight className="w-3 h-3" /></p>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default OwnerDashboard;
