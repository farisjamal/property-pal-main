import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Shield, Loader2, ShieldOff } from 'lucide-react';
import MFASetup from './MFASetup';

const MFASection = () => {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisabling, setIsDisabling] = useState(false);
  const { toast } = useToast();

  const checkMFAStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const verifiedFactor = data.totp.find((f) => f.status === 'verified');
      if (verifiedFactor) {
        setMfaEnabled(true);
        setFactorId(verifiedFactor.id);
      } else {
        setMfaEnabled(false);
        setFactorId(null);
      }
    } catch (error: any) {
      console.error('Error checking MFA status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkMFAStatus();
  }, []);

  const handleDisableMFA = async () => {
    if (!factorId) return;
    setIsDisabling(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;

      setMfaEnabled(false);
      setFactorId(null);
      toast({
        title: 'MFA Disabled',
        description: 'Two-factor authentication has been removed from your account.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to disable MFA.',
        variant: 'destructive',
      });
    } finally {
      setIsDisabling(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (mfaEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            MFA is active on your account. You are required to enter a code from your authenticator app when logging in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={handleDisableMFA}
            disabled={isDisabling}
          >
            {isDisabling ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Disabling...</>
            ) : (
              <><ShieldOff className="w-4 h-4 mr-2" />Disable MFA</>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <MFASetup onComplete={checkMFAStatus} />;
};

export default MFASection;
