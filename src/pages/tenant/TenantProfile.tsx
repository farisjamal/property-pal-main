import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Lock, Mail, Phone, Calendar, Save, Loader2, KeyRound, Heart, MapPin, Bed, Bath, Trash2, ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { encryptData, decryptData, batchDecrypt } from '@/utils/security';
import { logSensitiveDataAccess, logProfileUpdate } from '@/utils/auditLog';

interface ProfileData {
  name: string;
  email: string;
  contact_no: string;
  date_of_birth: string;
  gender: string;
  ic_no: string;
}

interface FavoriteProperty {
  property_id: number;
  property_type: string;
  location: string;
  rental_price: number;
  num_bedroom: number;
  num_bathroom: number;
  images: string[] | null;
}

const TenantProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    name: '',
    email: '',
    contact_no: '',
    date_of_birth: '',
    gender: '',
    ic_no: '',
  });
  const [favorites, setFavorites] = useState<FavoriteProperty[]>([]);
  const [tenantId, setTenantId] = useState<number | null>(null);

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('tenant')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setTenantId(data.tenant_id);

        // Decrypt sensitive fields using batch decrypt for efficiency
        const [decryptedContactNo, decryptedIcNo] = await batchDecrypt([
          data.contact_no,
          data.ic_no
        ]);

        // Log sensitive data access
        if (decryptedContactNo || decryptedIcNo) {
          const accessedFields = [];
          if (decryptedContactNo) accessedFields.push('contact_no');
          if (decryptedIcNo) accessedFields.push('ic_no');
          logSensitiveDataAccess('TENANT', data.tenant_id.toString(), accessedFields);
        }

        setProfile({
          name: data.name || '',
          email: data.email || '',
          contact_no: decryptedContactNo || '',
          date_of_birth: data.date_of_birth || '',
          gender: data.gender || '',
          ic_no: decryptedIcNo || '',
        });

        // Fetch favorites
        const { data: favData, error: favError } = await supabase
          .from('favorites')
          .select(`
            property_id,
            property:property_id(
              property_id,
              property_type,
              location,
              rental_price,
              num_bedroom,
              num_bathroom,
              images
            )
          `)
          .eq('tenant_id', data.tenant_id);

        if (!favError && favData) {
          const propertyList = favData
            .map(f => f.property as unknown as FavoriteProperty)
            .filter(Boolean);
          setFavorites(propertyList);
        }
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const removeFavorite = async (propertyId: number) => {
    if (!tenantId) return;

    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('property_id', propertyId);

      if (error) throw error;
      setFavorites(favorites.filter(f => f.property_id !== propertyId));
      toast({ title: 'Removed', description: 'Property removed from favorites' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Encrypt sensitive fields before saving
      const encryptedContactNo = profile.contact_no ? await encryptData(profile.contact_no) : null;
      const encryptedIcNo = profile.ic_no ? await encryptData(profile.ic_no) : null;

      const { error } = await supabase
        .from('tenant')
        .update({
          name: profile.name,
          contact_no: encryptedContactNo,
          date_of_birth: profile.date_of_birth || null,
          gender: profile.gender || null,
          ic_no: encryptedIcNo,
        })
        .eq('user_id', user!.id);

      if (error) throw error;

      // Log profile update
      const updatedFields = ['name'];
      if (encryptedContactNo) updatedFields.push('contact_no');
      if (encryptedIcNo) updatedFields.push('ic_no');
      if (profile.date_of_birth) updatedFields.push('date_of_birth');
      if (profile.gender) updatedFields.push('gender');

      if (tenantId) {
        logProfileUpdate('TENANT', tenantId.toString(), updatedFields);
      }

      toast({ title: 'Success', description: 'Profile updated successfully' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: 'Success', description: 'Password changed successfully' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!user?.email) {
      toast({ title: 'Error', description: 'Email not found', variant: 'destructive' });
      return;
    }

    setIsResettingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast({ title: 'Success', description: 'Password reset link sent to your email' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsResettingPassword(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="w-5 h-5" />Profile Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <Input id="email" value={profile.email} disabled className="bg-muted" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_no">Phone Number</Label>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <Input id="contact_no" value={profile.contact_no} onChange={(e) => setProfile({ ...profile, contact_no: e.target.value })} placeholder="+60 123 456 789" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <Input id="date_of_birth" type="date" value={profile.date_of_birth} onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Input id="gender" value={profile.gender} onChange={(e) => setProfile({ ...profile, gender: e.target.value })} placeholder="Male / Female" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ic_no">IC Number</Label>
                <Input id="ic_no" value={profile.ic_no} onChange={(e) => setProfile({ ...profile, ic_no: e.target.value })} placeholder="XXXXXX-XX-XXXX" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5" />Change Password</CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" required />
            </div>
            <div className="flex items-center justify-between">
              <Button type="button" variant="link" className="text-sm px-0" onClick={handleForgotPassword} disabled={isResettingPassword}>
                <KeyRound className="w-4 h-4 mr-1" />
                {isResettingPassword ? 'Sending...' : 'Forgot password? Send reset link'}
              </Button>
              <Button type="submit" disabled={isChangingPassword}>
                {isChangingPassword ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Changing...</> : 'Change Password'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Saved Properties */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Heart className="w-5 h-5" />Saved Properties</CardTitle>
          <CardDescription>Properties you've bookmarked for later</CardDescription>
        </CardHeader>
        <CardContent>
          {favorites.length === 0 ? (
            <div className="text-center py-8">
              <Heart className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No saved properties yet</p>
              <Link to="/tenant/properties">
                <Button variant="outline" className="mt-4">Browse Properties</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {favorites.map((property) => (
                <div
                  key={property.property_id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="w-20 h-20 rounded-md overflow-hidden bg-muted flex-shrink-0">
                    {property.images && property.images.length > 0 ? (
                      <img
                        src={property.images[0]}
                        alt={property.property_type}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium">{property.property_type}</h4>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {property.location}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-sm">
                      <span className="font-semibold text-primary">RM {property.rental_price.toLocaleString()}/mo</span>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Bed className="w-3 h-3" />{property.num_bedroom}
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Bath className="w-3 h-3" />{property.num_bathroom}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link to="/tenant/properties">
                      <Button variant="outline" size="sm">View</Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFavorite(property.property_id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TenantProfile;
