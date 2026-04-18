import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Calendar, CheckCircle, Home, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const TenantDashboard = () => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
    
    {/* Enterprise Welcome Card */}
    <Card className="bg-card/90 backdrop-blur-md border border-border shadow-sm overflow-hidden">
      <CardContent className="p-8 sm:p-10">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary text-foreground text-[11px] font-semibold tracking-widest uppercase mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            Welcome Back
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Your Property Journey Starts Here
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed max-w-2xl">
            Browse premium available properties and book viewing appointments seamlessly with property owners. Find your ideal space through our streamlined platform.
          </p>
          <div className="pt-5 flex flex-wrap gap-3">
            <Button asChild size="default" className="rounded-lg shadow-sm font-medium">
              <Link to="/tenant/properties">
                <Search className="w-4 h-4 mr-2" /> Browse Properties
              </Link>
            </Button>
            <Button asChild variant="outline" size="default" className="rounded-lg border-border bg-background hover:bg-secondary/50 font-medium">
              <Link to="/tenant/appointments">
                <Calendar className="w-4 h-4 mr-2" /> View Appointments
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Metric Cards - Stripe Style */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      
      <Card className="bg-card/90 backdrop-blur-md border border-border hover:border-primary/50 transition-colors duration-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Properties Viewed</CardTitle>
          <Home className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold tracking-tight text-foreground">0</div>
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">No activity <ArrowRight className="w-3 h-3" /></p>
        </CardContent>
      </Card>

      <Card className="bg-card/90 backdrop-blur-md border border-border hover:border-orange-500/50 transition-colors duration-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Pending Appts</CardTitle>
          <Calendar className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold tracking-tight text-foreground">0</div>
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">Awaiting response <ArrowRight className="w-3 h-3" /></p>
        </CardContent>
      </Card>

      <Card className="bg-card/90 backdrop-blur-md border border-border hover:border-green-500/50 transition-colors duration-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Confirmed</CardTitle>
          <CheckCircle className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold tracking-tight text-foreground">0</div>
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">Ready for viewing <ArrowRight className="w-3 h-3" /></p>
        </CardContent>
      </Card>

    </div>
  </div>
);

export default TenantDashboard;
