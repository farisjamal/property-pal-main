import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { logLogout } from '@/utils/auditLog';

interface UserProfile {
  roleId: number;
  roleName: string;
  profileId: number;
  name: string;
  email: string;
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

      setUserProfile({
        roleId,
        roleName,
        profileId: profileData?.profileId || 0,
        name: profileData?.name || '',
        email: profileData?.email || '',
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
