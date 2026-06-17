import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Building2, Mail, Lock, User, Phone, CheckCircle, Home, Shield, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';
import { encryptData, hashPin } from '@/security/encryption';
import { logLogin, logFailedLogin } from '@/security/auditLog';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import MFAVerify from '@/components/auth/MFAVerify';
import PasswordStrengthMeter from '@/components/auth/PasswordStrengthMeter';
import { validatePasswordFull } from '@/security/passwordValidation';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  // Password content is gated by validatePasswordFull (composition + strength +
  // breach) in handleRegister — the single source of truth shared with reset.
  password: z.string(),
  contactNo: z.string().optional(),
  roleId: z.number().min(2).max(3),
  securityPin: z.string().length(6, "Security PIN must be exactly 6 digits").regex(/^\d+$/, "PIN must contain only numbers"),
});

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60_000; // 1 minute

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [mfaPending, setMfaPending] = useState(false);
  const [pendingRoleId, setPendingRoleId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('login');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
    contactNo: '',
    securityPin: '',
    roleId: 3,
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  // Lockout countdown timer
  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, lockoutUntil - Date.now());
      setLockoutRemaining(Math.ceil(remaining / 1000));
      if (remaining <= 0) {
        setLockoutUntil(null);
        setLoginAttempts(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  useEffect(() => {
    // Check if already logged in
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if MFA verification is still needed
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData && aalData.nextLevel === 'aal2' && aalData.currentLevel !== 'aal2') {
          // User has MFA enrolled but hasn't verified yet — show MFA screen
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role_id')
            .eq('user_id', session.user.id)
            .maybeSingle();
          if (roleData) {
            setPendingRoleId(roleData.role_id);
            setMfaPending(true);
          }
          return;
        }

        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role_id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (roleData) {
          redirectBasedOnRole(roleData.role_id);
        }
      }
    };
    checkSession();
  }, []);

  const redirectBasedOnRole = (roleId: number) => {
    switch (roleId) {
      case 1:
        navigate('/admin');
        break;
      case 2:
        navigate('/owner');
        break;
      case 3:
        navigate('/tenant');
        break;
      default:
        navigate('/');
    }
  };

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLockedOut) {
      toast({
        title: 'Too many attempts',
        description: `Please wait ${lockoutRemaining} seconds before trying again.`,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Validate input
      const validated = loginSchema.parse(loginData);

      // Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (authError) throw authError;

      // Get user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (roleError || !roleData) {
        throw new Error('User role not found. Please contact support.');
      }

      // Check if MFA verification is needed before redirecting
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData && aalData.nextLevel === 'aal2' && aalData.currentLevel !== 'aal2') {
        // User has MFA enrolled — show verification screen instead of redirecting
        setPendingRoleId(roleData.role_id);
        setMfaPending(true);
        setLoginAttempts(0);
        setLockoutUntil(null);
        return; // Don't redirect yet — wait for MFA verification
      }

      // No MFA — log successful login and redirect
      await logLogin(authData.user.id);
      setLoginAttempts(0);
      setLockoutUntil(null);

      toast({
        title: 'Welcome back!',
        description: 'Login successful.',
      });

      redirectBasedOnRole(roleData.role_id);
    } catch (error: any) {
      console.error('Login error:', error);

      let message = error.message;
      if (error instanceof z.ZodError) {
        message = error.errors[0].message;
      } else if (error.message?.includes('Invalid login credentials')) {
        message = 'Invalid email or password';
      }

      // Log failed login attempt and track rate limiting
      await logFailedLogin(loginData.email, message);

      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS);
        setLockoutRemaining(Math.ceil(LOCKOUT_DURATION_MS / 1000));
      }

      const attemptsLeft = MAX_LOGIN_ATTEMPTS - newAttempts;
      toast({
        title: 'Login Failed',
        description: attemptsLeft > 0
          ? `${message}. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`
          : `${message}. Too many failed attempts. Please wait 1 minute.`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      z.string().email('Please enter a valid email address').parse(forgotEmail);
    } catch (err: any) {
      const message = err instanceof z.ZodError ? err.errors[0].message : 'Invalid email';
      toast({ title: 'Invalid Email', description: message, variant: 'destructive' });
      return;
    }

    setForgotSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;

      toast({
        title: 'Check your email',
        description: 'If an account exists for that email, a password reset link has been sent.',
      });
      setForgotOpen(false);
      setForgotEmail('');
    } catch (error: any) {
      // Don't leak whether email exists — show same confirmation
      toast({
        title: 'Check your email',
        description: 'If an account exists for that email, a password reset link has been sent.',
      });
      setForgotOpen(false);
      setForgotEmail('');
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate input
      const validated = registerSchema.parse(registerData);

      const strongCheck = await validatePasswordFull(validated.password, {
        email: validated.email,
        name: validated.name,
      });
      if (!strongCheck.valid) {
        toast({
          title: 'Weak Password',
          description: strongCheck.errors[0],
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // ENCRYPTION DEMO: Encrypt the contact number
      const encryptedContact = validated.contactNo
        ? await encryptData(validated.contactNo)
        : null;

      // HASHING DEMO: Hash the security PIN
      const hashedPin = await hashPin(validated.securityPin);

      // Create auth account with user metadata for the trigger
      const redirectUrl = `${window.location.origin}/`;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name: validated.name,
            role_id: validated.roleId,
            contact_no: encryptedContact, // Send CIPHERTEXT to DB
            security_pin_hash: hashedPin, // Send HASH to DB
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Registration failed');

      // Note: The database trigger 'handle_new_user' automatically creates:
      // 1. users table record
      // 2. user_roles record
      // 3. Profile record (tenant/property_owner) based on role_id

      // Email confirmation is enforced server-side — never auto-login here.
      // Surface a screen prompting the user to verify via the emailed link.
      setRegisteredEmail(validated.email);
      toast({
        title: 'Confirm your email',
        description: `We've sent a confirmation link to ${validated.email}.`,
      });
    } catch (error: any) {
      console.error('Registration error:', error);

      let message = error.message;
      if (error instanceof z.ZodError) {
        message = error.errors[0].message;
      } else if (error.message?.includes('already registered')) {
        message = 'This email is already registered. Please log in instead.';
      } else if (error.message?.includes('temporarily unavailable')) {
        message = error.message;
      }

      toast({
        title: 'Registration Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!registeredEmail) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: registeredEmail,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      toast({
        title: 'Confirmation email sent',
        description: `We've re-sent the link to ${registeredEmail}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Could not resend email',
        description: error.message ?? 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle MFA verification callback
  const handleMFAVerified = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await logLogin(user.id);
    }
    setMfaPending(false);
    toast({
      title: 'Welcome back!',
      description: 'Login successful.',
    });
    if (pendingRoleId) {
      redirectBasedOnRole(pendingRoleId);
    }
  };

  const handleMFACancelled = async () => {
    await supabase.auth.signOut();
    setMfaPending(false);
    setPendingRoleId(null);
  };

  // Show MFA verification screen if pending
  if (mfaPending) {
    return <MFAVerify onVerified={handleMFAVerified} onCancel={handleMFACancelled} />;
  }

  return (
    <div className="min-h-screen flex relative">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      {/* ── Left panel: Brand identity ── */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-[42%] relative flex-col justify-between p-12 bg-mesh-dark overflow-hidden">
        {/* Ambient glows */}
        <div className="absolute top-1/4 -left-16 w-72 h-72 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 -right-8 w-56 h-56 bg-property-warm/12 rounded-full blur-3xl pointer-events-none" />

        {/* Right-edge gradient fade — blends seamlessly into the right panel */}
        <div
          className="absolute top-0 right-0 w-10 h-full pointer-events-none z-20"
          style={{ background: 'linear-gradient(to right, transparent, hsl(var(--background)))' }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
              <Home className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="brand-fg font-display font-semibold text-xl tracking-tight">PropertyPal</span>
          </Link>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-7">
          <h2 className="font-display font-light text-[clamp(2.8rem,5vw,4rem)] leading-[0.95] brand-fg">
            Your perfect
            <br />
            <em className="text-primary not-italic">home</em> awaits.
          </h2>
          <p className="brand-fg-soft text-base leading-relaxed max-w-xs">
            Browse verified properties, schedule viewings, and connect with trusted owners — all from one secure platform.
          </p>

          {/* Feature list */}
          <div className="space-y-3.5">
            {[
              "Verified property listings",
              "Instant appointment booking",
              "AES-256 encrypted data",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-3 h-3 text-primary" />
                </div>
                <span className="brand-fg-muted text-sm font-medium">{feature}</span>
              </div>
            ))}
          </div>

          {/* Security note */}
          <div className="flex items-center gap-2.5 pt-2">
            <Shield className="w-4 h-4 text-primary/70 shrink-0" />
            <span className="brand-fg-dim text-xs">
              All data encrypted at rest and in transit
            </span>
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="brand-fg-subtle text-xs">© 2026 PropertyPal. All rights reserved.</p>
        </div>
      </div>

      {/* ── Right panel: Auth forms ── */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-background overflow-y-auto">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <Link to="/" className="lg:hidden mb-8 flex items-center gap-3 group w-fit">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold text-lg">PropertyPal</span>
          </Link>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* Tab selector */}
            <TabsList className="grid w-full grid-cols-2 h-11 bg-muted/50 p-1 mb-8">
              <TabsTrigger value="login" className="rounded-md font-medium text-sm">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="register" className="rounded-md font-medium text-sm">
                Create Account
              </TabsTrigger>
            </TabsList>

            {/* ── Login tab ── */}
            <TabsContent value="login">
              <div className="mb-7">
                <h1 className="text-2xl font-semibold text-foreground tracking-tight">Welcome back</h1>
                <p className="text-muted-foreground text-sm mt-1.5">Sign in to your account to continue</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-sm font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password" className="text-sm font-medium">Password</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(loginData.email);
                        setForgotOpen(true);
                      }}
                      className="text-xs font-medium text-primary hover:underline focus:outline-none focus:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Enter your password"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>

                {loginAttempts > 0 && !isLockedOut && (
                  <p className="text-sm text-destructive font-medium">
                    {MAX_LOGIN_ATTEMPTS - loginAttempts} attempt{MAX_LOGIN_ATTEMPTS - loginAttempts !== 1 ? 's' : ''} remaining
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 font-medium bg-primary hover:bg-primary/90 mt-2"
                  disabled={isLoading || isLockedOut}
                >
                  {isLockedOut
                    ? `Locked out (${lockoutRemaining}s)`
                    : isLoading
                    ? 'Signing in...'
                    : 'Sign In'}
                </Button>
              </form>
            </TabsContent>

            {/* ── Register tab ── */}
            <TabsContent value="register">
              {registeredEmail ? (
                <div className="text-center py-4">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <Mail className="h-7 w-7 text-primary" />
                  </div>
                  <h1 className="text-2xl font-semibold text-foreground tracking-tight">Check your email</h1>
                  <p className="text-muted-foreground text-sm mt-2">
                    We've sent a confirmation link to{' '}
                    <span className="font-medium text-foreground">{registeredEmail}</span>.
                    Click the link in that email to activate your account before signing in.
                  </p>
                  <p className="text-muted-foreground text-xs mt-4">
                    Didn't get it? Check your spam folder, or resend below.
                  </p>

                  <div className="mt-6 space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-11 font-medium"
                      onClick={handleResendConfirmation}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Sending...' : 'Resend confirmation email'}
                    </Button>
                    <Button
                      type="button"
                      className="w-full h-11 font-medium"
                      onClick={() => {
                        setRegisteredEmail(null);
                        setActiveTab('login');
                      }}
                    >
                      Back to sign in
                    </Button>
                  </div>
                </div>
              ) : (
              <>
              <div className="mb-7">
                <h1 className="text-2xl font-semibold text-foreground tracking-tight">Create account</h1>
                <p className="text-muted-foreground text-sm mt-1.5">Join thousands of users on PropertyPal</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="register-name" className="text-sm font-medium">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Your full name"
                      value={registerData.name}
                      onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="register-email" className="text-sm font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="you@example.com"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="register-password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-password"
                      type={showRegisterPassword ? 'text' : 'password'}
                      placeholder="Create a strong password"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      className="pl-10 pr-10 h-11"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword((prev) => !prev)}
                      aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <PasswordStrengthMeter
                    password={registerData.password}
                    userInputs={[registerData.email, registerData.name]}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="register-contact" className="text-sm font-medium">
                    Contact Number{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-contact"
                      type="tel"
                      placeholder="+60 12-345 6789"
                      value={registerData.contactNo}
                      onChange={(e) => setRegisterData({ ...registerData, contactNo: e.target.value })}
                      className="pl-10 h-11"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="register-pin" className="text-sm font-medium">
                    Security PIN{" "}
                    <span className="text-muted-foreground font-normal">(6 digits)</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-pin"
                      type="password"
                      maxLength={6}
                      placeholder="6-digit PIN"
                      value={registerData.securityPin}
                      onChange={(e) => setRegisterData({ ...registerData, securityPin: e.target.value })}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="register-role" className="text-sm font-medium">I am a</Label>
                  <Select
                    value={registerData.roleId.toString()}
                    onValueChange={(value) => setRegisterData({ ...registerData, roleId: parseInt(value) })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">Property Owner</SelectItem>
                      <SelectItem value="3">Tenant / Looking to Rent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 font-medium bg-primary hover:bg-primary/90 mt-2"
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>
              </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Forgot-password dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              Enter the email address linked to your account. We'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email" className="text-sm font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="pl-10 h-11"
                  required
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setForgotOpen(false)}
                disabled={forgotSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={forgotSubmitting}>
                {forgotSubmitting ? 'Sending...' : 'Send reset link'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;
