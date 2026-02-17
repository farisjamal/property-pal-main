import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Search, Home } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { encryptData, decryptData, batchDecrypt } from '@/utils/security';
import { logUserCreation, logUserDeletion, logSensitiveDataAccess } from '@/utils/auditLog';

interface PropertyOwner {
  owner_id: number;
  user_id: string;
  name: string;
  email: string | null;
  contact_no: string | null;
  gender: string | null;
  ic_no: string | null;
  created_at: string | null;
  propertyCount?: number;
}

const AdminPropertyOwners = () => {
  const [owners, setOwners] = useState<PropertyOwner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState<PropertyOwner | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    contact_no: '',
    gender: '',
    ic_no: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchOwners();
  }, []);

  const fetchOwners = async () => {
    try {
      // Fetch owners
      const { data: ownersData, error: ownersError } = await supabase
        .from('property_owner')
        .select('*')
        .order('created_at', { ascending: false });

      if (ownersError) throw ownersError;

      // Fetch property counts for each owner
      const { data: propertiesData } = await supabase
        .from('property')
        .select('owner_id');

      const propertyCountMap = new Map<number, number>();
      propertiesData?.forEach(p => {
        const count = propertyCountMap.get(p.owner_id) || 0;
        propertyCountMap.set(p.owner_id, count + 1);
      });

      // Decrypt sensitive fields for display
      const ownersWithCounts = await Promise.all(
        (ownersData || []).map(async (owner) => {
          const accessedFields = [];
          let decryptedContactNo = owner.contact_no;
          let decryptedIcNo = owner.ic_no;

          // Batch decrypt both fields
          if (owner.contact_no || owner.ic_no) {
            try {
              const [decContact, decIc] = await batchDecrypt([owner.contact_no, owner.ic_no]);
              if (owner.contact_no && decContact) {
                decryptedContactNo = decContact;
                accessedFields.push('contact_no');
              }
              if (owner.ic_no && decIc) {
                decryptedIcNo = decIc;
                accessedFields.push('ic_no');
              }
            } catch (e) {
              console.error('Failed to decrypt fields for owner', owner.owner_id);
            }
          }

          if (accessedFields.length > 0) {
            logSensitiveDataAccess('OWNER', owner.owner_id.toString(), accessedFields);
          }

          return {
            ...owner,
            contact_no: decryptedContactNo,
            ic_no: decryptedIcNo,
          propertyCount: propertyCountMap.get(owner.owner_id) || 0,
        };
        })
      );

      setOwners(ownersWithCounts);
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
      if (editingOwner) {
        // Update existing owner
        // Encrypt sensitive fields before saving
        const encryptedContactNo = formData.contact_no ? await encryptData(formData.contact_no) : null;
        const encryptedIcNo = formData.ic_no ? await encryptData(formData.ic_no) : null;

        const { error } = await supabase
          .from('property_owner')
          .update({
            name: formData.name,
            email: formData.email,
            contact_no: encryptedContactNo,
            gender: formData.gender || null,
            ic_no: encryptedIcNo,
          })
          .eq('owner_id', editingOwner.owner_id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Property owner updated successfully',
        });
      } else {
        // Create new owner with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error('Failed to create user');

        // Create user record (password is managed by Supabase Auth)
        await supabase.from('users').insert({
          user_id: authData.user.id,
          email: formData.email,
          role_id: 2,
        });

        // Create user_roles record
        await supabase.from('user_roles').insert({
          user_id: authData.user.id,
          role_id: 2,
        });

        // Encrypt sensitive fields before saving
        const encryptedContactNo = formData.contact_no ? await encryptData(formData.contact_no) : null;
        const encryptedIcNo = formData.ic_no ? await encryptData(formData.ic_no) : null;

        // Create property owner profile
        const { data: newOwner, error: ownerError } = await supabase
          .from('property_owner')
          .insert({
            user_id: authData.user.id,
            name: formData.name,
            email: formData.email,
            contact_no: encryptedContactNo,
            gender: formData.gender || null,
            ic_no: encryptedIcNo,
          })
          .select()
          .single();

        if (ownerError) throw ownerError;

        // Log user creation
        if (newOwner) {
          logUserCreation('OWNER', newOwner.owner_id.toString(), formData.email);
        }

        toast({
          title: 'Success',
          description: 'Property owner created successfully',
        });
      }

      setIsDialogOpen(false);
      setEditingOwner(null);
      setFormData({ name: '', email: '', password: '', contact_no: '', gender: '', ic_no: '' });
      fetchOwners();
    } catch (error: any) {
      console.error('Admin property owner operation error:', error);
      
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

  const handleDelete = async (owner: PropertyOwner) => {
    if (!confirm('Are you sure you want to delete this property owner? All their properties will also be deleted.')) return;

    try {
      const { error } = await supabase
        .from('property_owner')
        .delete()
        .eq('owner_id', owner.owner_id);

      if (error) throw error;

      // Log user deletion
      logUserDeletion('OWNER', owner.owner_id.toString(), owner.email || 'Unknown');

      toast({
        title: 'Success',
        description: 'Property owner deleted successfully',
      });
      fetchOwners();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (owner: PropertyOwner) => {
    setEditingOwner(owner);
    setFormData({
      name: owner.name,
      email: owner.email || '',
      password: '',
      contact_no: owner.contact_no || '',
      gender: owner.gender || '',
      ic_no: owner.ic_no || '',
    });
    setIsDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingOwner(null);
    setFormData({ name: '', email: '', password: '', contact_no: '', gender: '', ic_no: '' });
    setIsDialogOpen(true);
  };

  const filteredOwners = owners.filter(owner =>
    owner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (owner.email && owner.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Manage Property Owners</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog} className="bg-gradient-primary">
                <Plus className="w-4 h-4 mr-2" />
                Add Property Owner
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingOwner ? 'Edit Property Owner' : 'Add New Property Owner'}</DialogTitle>
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
                    disabled={!!editingOwner}
                  />
                </div>
                {!editingOwner && (
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
                  <Label htmlFor="ic">IC Number</Label>
                  <Input
                    id="ic"
                    value={formData.ic_no}
                    onChange={(e) => setFormData({ ...formData, ic_no: e.target.value })}
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
                  {isLoading ? 'Saving...' : editingOwner ? 'Update Owner' : 'Create Owner'}
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
                    <TableHead>Properties</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOwners.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No property owners found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOwners.map((owner) => (
                      <TableRow key={owner.owner_id}>
                        <TableCell className="font-medium">{owner.name}</TableCell>
                        <TableCell>{owner.email || '-'}</TableCell>
                        <TableCell>{owner.contact_no || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="gap-1">
                            <Home className="w-3 h-3" />
                            {owner.propertyCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(owner)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(owner)}
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

export default AdminPropertyOwners;
