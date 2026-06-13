import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { logLogout } from '@/security/auditLog';

interface UserProfile {
  roleId: number;
  roleName: string;
  profileId: number;
  name: string;
  email: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer profile fetching to avoid deadlock
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 0);
        } else {
          setUserProfile(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      // Get role from user_roles
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role_id, roles(role)')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError || !roleData) {
        console.error('Error fetching role:', roleError);
        setIsLoading(false);
        return;
      }

      const roleId = roleData.role_id;
      const roleName = (roleData.roles as any)?.role || '';

      // Get profile based on role
      let profileData: any = null;
      
      if (roleId === 1) {
        const { data } = await supabase
          .from('admin')
          .select('admin_id, name, email')
          .eq('user_id', userId)
          .maybeSingle();
        profileData = data ? { ...data, profileId: data.admin_id } : null;
      } else if (roleId === 2) {
        const { data } = await supabase
          .from('property_owner')
          .select('owner_id, name, email')
          .eq('user_id', userId)
          .maybeSingle();
        profileData = data ? { ...data, profileId: data.owner_id } : null;
      } else if (roleId === 3) {
        const { data } = await supabase
          .from('tenant')
          .select('tenant_id, name, email')
          .eq('user_id', userId)
          .maybeSingle();
        profileData = data ? { ...data, profileId: data.tenant_id } : null;
      }

      // Check email verification and MFA status from the current session user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const emailVerified = !!currentUser?.email_confirmed_at;
      const mfaEnabled = (currentUser?.factors ?? []).some(
        (f) => f.status === 'verified' && f.factor_type === 'totp'
      );

      setUserProfile({
        roleId,
        roleName,
        profileId: profileData?.profileId || 0,
        name: profileData?.name || '',
        email: profileData?.email || '',
        emailVerified,
        mfaEnabled,
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Session inactivity timeout (30 minutes)
  useEffect(() => {
    if (!user) return;

    const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    const WARNING_BEFORE_MS = 5 * 60 * 1000; // warn 5 min before
    let timeoutId: ReturnType<typeof setTimeout>;
    let warningId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      clearTimeout(warningId);
      sessionStorage.setItem('lastActivity', Date.now().toString());

      warningId = setTimeout(() => {
        // Could dispatch a custom event for a toast, but kept simple
        console.warn('Session expiring soon due to inactivity');
      }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);

      timeoutId = setTimeout(async () => {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setUserProfile(null);
        navigate('/auth');
      }, INACTIVITY_TIMEOUT_MS);
    };

    // Check if session was already expired before this mount
    const lastActivity = sessionStorage.getItem('lastActivity');
    if (lastActivity && Date.now() - Number(lastActivity) > INACTIVITY_TIMEOUT_MS) {
      supabase.auth.signOut();
      return;
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      clearTimeout(timeoutId);
      clearTimeout(warningId);
    };
  }, [user, navigate]);

  const signOut = async () => {
    // Log logout before signing out (while we still have user context)
    if (user?.id) {
      await logLogout(user.id);
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserProfile(null);
    navigate('/auth');
  };

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

  return {
    user,
    session,
    userProfile,
    isLoading,
    signOut,
    redirectBasedOnRole,
  };
};
