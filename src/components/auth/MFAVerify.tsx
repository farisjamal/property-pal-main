import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { Building2, Shield, Loader2 } from 'lucide-react';

interface MFAVerifyProps {
  onVerified: () => void;
  onCancel: () => void;
}

const MFAVerify = ({ onVerified, onCancel }: MFAVerifyProps) => {
  const [code, setCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Get the user's verified TOTP factor
    const loadFactor = async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error || !data) {
        toast({
          title: 'MFA Error',
          description: 'Could not load MFA factors.',
          variant: 'destructive',
        });
        onCancel();
        return;
      }

      const totpFactor = data.totp.find((f) => f.status === 'verified');
      if (!totpFactor) {
        // No verified TOTP factor — skip MFA
        onVerified();
        return;
      }

      setFactorId(totpFactor.id);
      setIsInitializing(false);
    };

    loadFactor();
  }, []);

  const handleVerify = async () => {
    if (code.length !== 6 || !factorId) return;
    setIsLoading(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      onVerified();
    } catch (error: any) {
      toast({
        title: 'Invalid Code',
        description: 'The code you entered is incorrect. Please try again.',
        variant: 'destructive',
      });
      setCode('');
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />
      </div>

      <Card className="w-full max-w-md relative z-10 glass">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-gradient-primary">
              <Building2 className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
            <Shield className="w-5 h-5" />
            Two-Factor Verification
          </CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={setCode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <div className="space-y-2">
            <Button
              className="w-full bg-gradient-primary"
              onClick={handleVerify}
              disabled={code.length !== 6 || isLoading}
            >
              {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</> : 'Verify'}
            </Button>
            <Button variant="ghost" className="w-full" onClick={onCancel}>
              Cancel and sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MFAVerify;
