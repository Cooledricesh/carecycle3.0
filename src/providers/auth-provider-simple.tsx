"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface UserProfile {
  id: string
  email: string
  name: string
  role: string
  organization_id: string
  care_type: string | null
  is_active: boolean
  approval_status: string
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Fetch user profile including organization_id
  const fetchUserProfile = async (userId: string) => {
    try {
      const supabase = createClient();

      // Simple fetch without timeout - let Supabase handle its own timeout
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, name, role, organization_id, care_type, is_active, approval_status')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[Auth] Error fetching profile:', error);
        // User will continue without profile data
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('[Auth] Error in fetchUserProfile:', error);
      // Continuing without profile - may be RLS issue
      setProfile(null);
    }
  };

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    // Set loading to false immediately - we'll handle auth state from onAuthStateChange
    setLoading(false);

    // Listen for changes on auth state
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log('[Auth] Auth state changed:', event, !!session);

      // Handle all auth state changes including INITIAL_SESSION
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null);

        // Fetch profile for signed in user
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          setProfile(null);
        }
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
      }

      // Refresh the page on sign in/out to update server components
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        router.refresh();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};