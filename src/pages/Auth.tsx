import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Building2, Mail, Lock, User, Phone } from 'lucide-react';
import { z } from 'zod';
import { encryptData, hashPin } from '@/utils/security';
import { logLogin, logFailedLogin } from '@/utils/auditLog';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  contactNo: z.string().optional(),
  roleId: z.number().min(2).max(3),
  securityPin: z.string().length(6, "Security PIN must be exactly 6 digits").regex(/^\d+$/, "PIN must contain only numbers"),
});

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
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

  useEffect(() => {
    // Check if already logged in
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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

      // Log successful login
      await logLogin(authData.user.id);

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

      // Log failed login attempt
      await logFailedLogin(loginData.email, message);

      toast({
        title: 'Login Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate input
      const validated = registerSchema.parse(registerData);


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

      toast({
        title: 'Registration Successful!',
        description: 'Please check your email to confirm your account, or log in directly if email confirmation is disabled.',
      });

      // Try to log in immediately (works if email confirmation is disabled)
      const { data: loginData } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (loginData.session) {
        redirectBasedOnRole(validated.roleId);
      }
    } catch (error: any) {
      console.error('Registration error:', error);

      let message = error.message;
      if (error instanceof z.ZodError) {
        message = error.errors[0].message;
      } else if (error.message?.includes('already registered')) {
        message = 'This email is already registered. Please log in instead.';
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
          <CardTitle className="text-2xl font-bold">Property Appointment System</CardTitle>
          <CardDescription>Sign in to your account or create a new one</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="Enter your email"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Enter your password"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full bg-gradient-primary" disabled={isLoading}>
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Enter your full name"
                      value={registerData.name}
                      onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="Enter your email"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="Create a password (min 6 characters)"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-contact">Contact Number (Optional)</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-contact"
                      type="tel"
                      placeholder="Enter your phone number"
                      value={registerData.contactNo}
                      onChange={(e) => setRegisterData({ ...registerData, contactNo: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-pin">Security PIN (6 Digits)</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-pin"
                      type="password"
                      maxLength={6}
                      placeholder="Enter 6-digit PIN"
                      value={registerData.securityPin}
                      onChange={(e) => setRegisterData({ ...registerData, securityPin: e.target.value })}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-role">Register as</Label>
                  <Select
                    value={registerData.roleId.toString()}
                    onValueChange={(value) => setRegisterData({ ...registerData, roleId: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">Property Owner</SelectItem>
                      <SelectItem value="3">Tenant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full bg-gradient-primary" disabled={isLoading}>
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
