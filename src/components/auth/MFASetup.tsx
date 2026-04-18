import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, Loader2, Copy, Check } from 'lucide-react';

type SetupStep = 'idle' | 'enrolling' | 'verifying' | 'complete';

interface MFASetupProps {
  onComplete?: () => void;
}

const MFASetup = ({ onComplete }: MFASetupProps) => {
  const [step, setStep] = useState<SetupStep>('idle');
  const [qrUri, setQrUri] = useState('');
  const [secret, setSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleEnroll = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'PropertyPal Authenticator',
      });

      if (error) throw error;

      setQrUri(data.totp.uri);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setStep('verifying');
    } catch (error: any) {
      toast({
        title: 'MFA Setup Failed',
        description: error.message || 'Could not start MFA enrollment.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verifyCode.length !== 6) return;
    setIsLoading(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: verifyCode,
      });
      if (verifyError) throw verifyError;

      setStep('complete');
      toast({
        title: 'MFA Enabled',
        description: 'Two-factor authentication has been activated on your account.',
      });
      onComplete?.();
    } catch (error: any) {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Invalid code. Please try again.',
        variant: 'destructive',
      });
      setVerifyCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const copySecret = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === 'idle') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account using an authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleEnroll} disabled={isLoading}>
            {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Setting up...</> : 'Enable MFA'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'verifying') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Set Up Authenticator
          </CardTitle>
          <CardDescription>
            Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-white rounded-lg">
              <QRCodeSVG value={qrUri} size={200} />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center">
              Can't scan? Enter this key manually:
            </p>
            <div className="flex items-center justify-center gap-2">
              <code className="text-xs bg-muted px-3 py-1.5 rounded font-mono break-all">
                {secret}
              </code>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copySecret}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-center">Enter the 6-digit code from your app:</p>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={verifyCode} onChange={setVerifyCode}>
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
            <Button
              className="w-full"
              onClick={handleVerify}
              disabled={verifyCode.length !== 6 || isLoading}
            >
              {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying...</> : 'Verify & Activate'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // step === 'complete'
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-green-600" />
          MFA Enabled
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Two-factor authentication is active on your account. You will be asked for a code from your authenticator app each time you log in.
        </p>
      </CardContent>
    </Card>
  );
};

export default MFASetup;
