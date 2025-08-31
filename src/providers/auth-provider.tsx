"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User } from "@supabase/supabase-js";
import { getSupabaseClient, resetSupabaseClient } from "@/lib/supabase/client";
import { Profile } from "@/lib/database.types";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  error: Error | null;
  signOut: () => Promise<void>;
  forceSignOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ data: any; error: string | null }>;
  signUp: (email: string, password: string, userData: { name: string; role?: "nurse" | "admin" }) => Promise<{ data: any; error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isNurse: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const supabase = getSupabaseClient();

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching profile:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error fetching profile:", error);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // First get the session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('[AuthProvider] Session error:', sessionError);
          throw sessionError;
        }

        // If session exists, validate it with getUser
        if (session) {
          console.log('[AuthProvider] Session found, validating...');
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          
          if (userError || !user) {
            console.log('[AuthProvider] Invalid session detected, clearing...');
            // Invalid session - clear everything
            await supabase.auth.signOut();
            if (typeof window !== 'undefined') {
              localStorage.clear();
              sessionStorage.clear();
            }
            setUser(null);
            setProfile(null);
          } else if (mounted) {
            // Valid session
            console.log('[AuthProvider] Valid session confirmed');
            setUser(user);
            const profileData = await fetchProfile(user.id);
            setProfile(profileData);
          }
        } else if (mounted) {
          // No session
          console.log('[AuthProvider] No session found');
          setUser(null);
          setProfile(null);
        }

        if (mounted) {
          setError(null);
          setLoading(false);
          setInitialized(true);
        }
      } catch (err) {
        console.error("Error initializing auth:", err);
        if (mounted) {
          // Handle specific Supabase errors during initialization
          if (err instanceof Error && (
            err.message.includes('refresh_token_not_found') || 
            err.message.includes('over_request_rate_limit')
          )) {
            console.log('[AuthProvider] Rate limit or token error during init - clearing session');
            setUser(null);
            setProfile(null);
            setError(null); // Don't show error to user for these cases
          } else {
            setError(err instanceof Error ? err : new Error("인증 초기화 중 오류가 발생했습니다"));
          }
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log('[AuthProvider] Auth state change:', event, !!session)
      
      try {
        setUser(session?.user ?? null);

        if (session?.user) {
          const profileData = await fetchProfile(session.user.id);
          setProfile(profileData);
        } else {
          setProfile(null);
          // Important: Immediately set loading to false when user signs out
          setLoading(false);
        }

        setError(null); // Clear any previous errors on successful auth change
        
        // Add delay to ensure auth state is fully stabilized before queries
        // Only delay for sign in events, not sign out
        if (session?.user) {
          setTimeout(() => {
            if (mounted) {
              setLoading(false);
              setInitialized(true);
            }
          }, 100)
        } else {
          // For sign out, update immediately
          setLoading(false);
          setInitialized(true);
        }
      } catch (error) {
        console.error('[AuthProvider] Error handling auth state change:', error);
        
        // Handle specific Supabase errors gracefully
        if (error instanceof Error) {
          if (error.message.includes('refresh_token_not_found') || 
              error.message.includes('over_request_rate_limit')) {
            console.log('[AuthProvider] Rate limit or token error - clearing session');
            // Clear session and redirect to login
            setUser(null);
            setProfile(null);
            setError(null); // Don't show error to user for these cases
            if (typeof window !== 'undefined' && window.location.pathname !== '/') {
              window.location.href = '/auth/signin';
            }
          } else {
            setError(error);
          }
        }
        
        if (mounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array - only run once on mount

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔐 Starting sign in process for:', email);
      setError(null);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('🔐 Auth response:', { data: !!data, error: error?.message });
      if (error) throw error;

      // Check user approval status
      console.log('🔐 Fetching profile for user:', data.user!.id);
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('approval_status, is_active, role')
        .eq('id', data.user!.id)
        .single();

      console.log('🔐 Profile response:', { profile, error: profileError?.message });
      if (profileError) {
        console.log('🔐 Profile error, signing out');
        await supabase.auth.signOut();
        throw new Error('프로필을 불러올 수 없습니다.');
      }

      // Check approval status
      if ((profile as any)?.approval_status === 'pending') {
        await supabase.auth.signOut();
        throw new Error('계정이 승인 대기 중입니다. 관리자의 승인을 기다려주세요.');
      }

      if ((profile as any)?.approval_status === 'rejected') {
        await supabase.auth.signOut();
        throw new Error('계정 승인이 거부되었습니다. 관리자에게 문의하세요.');
      }

      if (!(profile as any)?.is_active) {
        await supabase.auth.signOut();
        throw new Error('계정이 비활성화되었습니다. 관리자에게 문의하세요.');
      }

      return { data, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sign in failed";
      setError(error instanceof Error ? error : new Error(errorMessage));
      return { data: null, error: errorMessage };
    }
  };

  const signUp = async (email: string, password: string, userData: { name: string; role?: "nurse" | "admin" }) => {
    try {
      setError(null);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData,
        },
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sign up failed";
      setError(error instanceof Error ? error : new Error(errorMessage));
      return { data: null, error: errorMessage };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Password reset failed";
      return { error: errorMessage };
    }
  };

  const updatePassword = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Password update failed";
      return { error: errorMessage };
    }
  };

  const signOut = async () => {
    try {
      console.log("SignOut: Starting logout process");
      setError(null);
      
      // Clear state first to immediately update UI
      setUser(null);
      setProfile(null);
      setLoading(false); // Important: set loading to false to enable input fields
      
      console.log("SignOut: Calling supabase.auth.signOut()");
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("SignOut: Error from Supabase:", error);
        throw error;
      }
      
      console.log("SignOut: Successfully signed out from Supabase");
      
      // Comprehensive cleanup of all possible auth data
      if (typeof window !== 'undefined') {
        // Clear all localStorage items that might contain session data
        const keysToRemove = [
          'sb-rbtzwpfuhbjfmdkpigbt-auth-token',
          'sb-rbtzwpfuhbjfmdkpigbt-auth-token-0', 
          'sb-rbtzwpfuhbjfmdkpigbt-auth-token-1',
          'carecycle-auth', // Legacy key if it exists
          'supabase.auth.token' // Another possible key
        ];
        
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
        });
        
        // Clear all Supabase-related items from localStorage
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-') || key.includes('supabase')) {
            localStorage.removeItem(key);
          }
        });
        
        // Clear sessionStorage completely
        sessionStorage.clear();
        
        // Clear all cookies
        document.cookie.split(";").forEach(c => {
          const eqPos = c.indexOf("=");
          const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
          if (name.startsWith('sb-') || name.includes('supabase') || name === 'carecycle-auth') {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.vercel.app`;
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
          }
        });
      }
      
      // Reset the Supabase client to clear any cached session
      resetSupabaseClient();
      
      console.log("SignOut: Redirecting to landing page");
      // Use window.location.replace for complete page reload
      window.location.replace("/");
    } catch (error) {
      console.error("SignOut: Caught error:", error);
      const errorMessage = error instanceof Error ? error.message : "Sign out failed";
      setError(error instanceof Error ? error : new Error(errorMessage));
      
      // Reset client even on error
      resetSupabaseClient();
      
      // Still try to redirect even if there's an error
      console.log("SignOut: Redirecting to landing page after error");
      window.location.replace("/");
    }
  };

  const forceSignOut = async () => {
    console.log("ForceSignOut: Clearing all auth data");
    
    // Clear all localStorage
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear all cookies
      document.cookie.split(";").forEach(c => {
        const eqPos = c.indexOf("=");
        const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      });
    }
    
    // Clear state
    setUser(null);
    setProfile(null);
    setError(null);
    
    // Sign out from Supabase
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("ForceSignOut: Error signing out from Supabase:", error);
    }
    
    // Reset the Supabase client
    resetSupabaseClient();
    
    // Force reload to clear everything
    window.location.replace("/");
  };

  const value = {
    user,
    profile,
    loading,
    initialized,
    error,
    signOut,
    forceSignOut,
    refreshProfile,
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    isAuthenticated: !!user,
    isAdmin: profile?.role === "admin",
    isNurse: profile?.role === "nurse",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}