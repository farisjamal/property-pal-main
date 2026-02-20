import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { encryptData, decryptData } from '@/utils/security';
import { logUserCreation, logUserDeletion, logSensitiveDataAccess } from '@/utils/auditLog';

interface Tenant {
  tenant_id: number;
  user_id: string;
  name: string;
  email: string | null;
  contact_no: string | null;
  gender: string | null;
  age: number | null;
  created_at: string | null;
}

const AdminUsers = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    contact_no: '',
    gender: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase
        .from('tenant')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Decrypt sensitive fields for display
      const decryptedData = await Promise.all(
        (data || []).map(async (tenant) => {
          // Log sensitive data access for each tenant
          const accessedFields = [];
          let decryptedContactNo = tenant.contact_no;

          if (tenant.contact_no) {
            try {
              decryptedContactNo = await decryptData(tenant.contact_no);
              accessedFields.push('contact_no');
            } catch (e) {
              console.error('Failed to decrypt contact_no for tenant', tenant.tenant_id);
            }
          }

          if (accessedFields.length > 0) {
            logSensitiveDataAccess('TENANT', tenant.tenant_id.toString(), accessedFields);
          }

          return {
            ...tenant,
            contact_no: decryptedContactNo,
          };
        })
      );

      setTenants(decryptedData);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (editingTenant) {
        // Update existing tenant
        // Encrypt contact number before saving
        const encryptedContactNo = formData.contact_no ? await encryptData(formData.contact_no) : null;

        const { error } = await supabase
          .from('tenant')
          .update({
            name: formData.name,
            email: formData.email,
            contact_no: encryptedContactNo,
            gender: formData.gender || null,
          })
          .eq('tenant_id', editingTenant.tenant_id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Tenant updated successfully',
        });
      } else {
        // Create new tenant via server-side Edge Function (preserves admin session)
        const encryptedContactNo = formData.contact_no ? await encryptData(formData.contact_no) : null;

        const { data: result, error: createError } = await supabase.functions.invoke('admin-create-user', {
          body: {
            email: formData.email,
            password: formData.password,
            role_id: 3,
            name: formData.name,
            contact_no: encryptedContactNo,
            gender: formData.gender || null,
          },
        });

        if (createError) throw createError;
        if (result?.error) throw new Error(result.error);

        // Log user creation
        if (result?.profile) {
          logUserCreation('TENANT', result.profile.tenant_id.toString(), formData.email);
        }

        toast({
          title: 'Success',
          description: 'Tenant created successfully',
        });
      }

      setIsDialogOpen(false);
      setEditingTenant(null);
      setFormData({ name: '', email: '', password: '', contact_no: '', gender: '' });
      fetchTenants();
    } catch (error: any) {
      console.error('Admin user operation error:', error);
      
      let userMessage = 'An error occurred. Please try again.';
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        userMessage = 'This email is already registered.';
      } else if (error.message?.includes('foreign key')) {
        userMessage = 'Cannot complete operation: this record is referenced by other data.';
      } else if (error.message?.includes('permission') || error.message?.includes('policy')) {
        userMessage = 'You do not have permission to perform this action.';
      }
      
      toast({
        title: 'Error',
        description: userMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (tenant: Tenant) => {
    if (!confirm('Are you sure you want to delete this tenant?')) return;

    try {
      // Delete from tenant table (will cascade)
      const { error } = await supabase
        .from('tenant')
        .delete()
        .eq('tenant_id', tenant.tenant_id);

      if (error) throw error;

      // Log user deletion
      logUserDeletion('TENANT', tenant.tenant_id.toString(), tenant.email || 'Unknown');

      toast({
        title: 'Success',
        description: 'Tenant deleted successfully',
      });
      fetchTenants();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (tenant: Tenant) => {
    setEditingTenant(tenant);
    // Contact number is already decrypted in fetchTenants
    setFormData({
      name: tenant.name,
      email: tenant.email || '',
      password: '',
      contact_no: tenant.contact_no || '',
      gender: tenant.gender || '',
    });
    setIsDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingTenant(null);
    setFormData({ name: '', email: '', password: '', contact_no: '', gender: '' });
    setIsDialogOpen(true);
  };

  const filteredTenants = tenants.filter(tenant =>
    tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (tenant.email && tenant.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Manage Tenants</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog} className="bg-gradient-primary">
                <Plus className="w-4 h-4 mr-2" />
                Add Tenant
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTenant ? 'Edit Tenant' : 'Add New Tenant'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={!!editingTenant}
                  />
                </div>
                {!editingTenant && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="contact">Contact Number</Label>
                  <Input
                    id="contact"
                    value={formData.contact_no}
                    onChange={(e) => setFormData({ ...formData, contact_no: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Input
                    id="gender"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    placeholder="Male / Female / Other"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Saving...' : editingTenant ? 'Update Tenant' : 'Create Tenant'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No tenants found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTenants.map((tenant) => (
                      <TableRow key={tenant.tenant_id}>
                        <TableCell className="font-medium">{tenant.name}</TableCell>
                        <TableCell>{tenant.email || '-'}</TableCell>
                        <TableCell>{tenant.contact_no || '-'}</TableCell>
                        <TableCell>{tenant.gender || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(tenant)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(tenant)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsers;
