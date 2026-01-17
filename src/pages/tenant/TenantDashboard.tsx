import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Calendar, CheckCircle } from 'lucide-react';

const TenantDashboard = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="hover-lift"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Properties Viewed</CardTitle><Search className="w-4 h-4 text-primary" /></CardHeader><CardContent><div className="text-3xl font-bold">0</div></CardContent></Card>
      <Card className="hover-lift"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending Appointments</CardTitle><Calendar className="w-4 h-4 text-orange-500" /></CardHeader><CardContent><div className="text-3xl font-bold">0</div></CardContent></Card>
      <Card className="hover-lift"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Confirmed</CardTitle><CheckCircle className="w-4 h-4 text-green-500" /></CardHeader><CardContent><div className="text-3xl font-bold">0</div></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Welcome to Tenant Portal</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Browse available properties and book viewing appointments with property owners.</p></CardContent></Card>
  </div>
);

export default TenantDashboard;
