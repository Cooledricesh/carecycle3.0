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

      // Add timeout to prevent infinite waiting
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
      );

      const fetchPromise = supabase
        .from('profiles')
        .select('id, email, name, role, organization_id, care_type, is_active, approval_status')
        .eq('id', userId)
        .single();

      // Race between fetch and timeout
      const result = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (result.error) {
        console.error('[Auth] Error fetching profile:', result.error);
        // User will continue without profile data
        setProfile(null);
      } else {
        setProfile(result.data);
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

    // CRITICAL: Use getSession() not getUser() - see AUTH_FAILURE_ANALYSIS.md
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!mounted) return;

      setUser(session?.user ?? null);

      // Fetch profile if user exists
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      } else {
        setProfile(null);
      }

      setLoading(false);
    };

    initializeAuth();

    // Listen for changes on auth state (AFTER initial session)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // Skip INITIAL_SESSION - already handled by getSession()
      if (event === 'INITIAL_SESSION') {
        return;
      }

      // Handle auth changes
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null);

        // Fetch profile for signed in user
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          setProfile(null);
        }

        setLoading(false);
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
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