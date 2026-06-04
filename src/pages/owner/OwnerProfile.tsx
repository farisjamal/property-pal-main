import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Lock, Mail, Phone, Calendar, Save, Loader2, KeyRound } from 'lucide-react';
import { encryptData, decryptData, batchDecrypt } from '@/security/encryption';
import { logSensitiveDataAccess, logProfileUpdate } from '@/security/auditLog';
import { validatePassword } from '@/security/passwordValidation';
import MFASection from '@/components/auth/MFASection';

interface ProfileData {
  name: string;
  email: string;
  contact_no: string;
  date_of_birth: string;
  gender: string;
  ic_no: string;
}

const OwnerProfile = () => {
  const { user, userProfile } = useAuth();
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
        .from('property_owner')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
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
          logSensitiveDataAccess('OWNER', data.owner_id.toString(), accessedFields);
        }

        setProfile({
          name: data.name || '',
          email: data.email || '',
          contact_no: decryptedContactNo || '',
          date_of_birth: data.date_of_birth || '',
          gender: data.gender || '',
          ic_no: decryptedIcNo || '',
        });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
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
        .from('property_owner')
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

      if (userProfile?.profileId) {
        logProfileUpdate('OWNER', userProfile.profileId.toString(), updatedFields);
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
    const { valid, errors } = validatePassword(newPassword);
    if (!valid) {
      toast({ title: 'Weak Password', description: `Password requires: ${errors.join(', ')}`, variant: 'destructive' });
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
        redirectTo: `${window.location.origin}/reset-password`,
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

      {/* Two-Factor Authentication */}
      <MFASection />
    </div>
  );
};

export default OwnerProfile;
