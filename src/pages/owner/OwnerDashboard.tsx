import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Calendar, TrendingUp } from 'lucide-react';

const OwnerDashboard = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="hover-lift"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">My Properties</CardTitle><Building2 className="w-4 h-4 text-primary" /></CardHeader><CardContent><div className="text-3xl font-bold">0</div></CardContent></Card>
      <Card className="hover-lift"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending Requests</CardTitle><Calendar className="w-4 h-4 text-orange-500" /></CardHeader><CardContent><div className="text-3xl font-bold">0</div></CardContent></Card>
      <Card className="hover-lift"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Appointments</CardTitle><TrendingUp className="w-4 h-4 text-green-500" /></CardHeader><CardContent><div className="text-3xl font-bold">0</div></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Welcome to Owner Portal</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Manage your properties and review appointment requests from potential tenants.</p></CardContent></Card>
  </div>
);

export default OwnerDashboard;
