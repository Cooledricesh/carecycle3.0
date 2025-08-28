"use client";

import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/singleton";
import { Profile } from "@/lib/database.types";

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null,
  });
  const router = useRouter();
  const supabase = getSupabaseClient();

  useEffect(() => {
    let mounted = true;

    async function getSession() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (mounted) {
          if (session?.user) {
            // Fetch user profile
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", session.user.id)
              .single();

            if (profileError && profileError.code !== "PGRST116") {
              console.error("Error fetching profile:", profileError);
            }

            setAuthState({
              user: session.user,
              profile: profile || null,
              loading: false,
              error: null,
            });
          } else {
            setAuthState({
              user: null,
              profile: null,
              loading: false,
              error: null,
            });
          }
        }
      } catch (error) {
        if (mounted) {
          setAuthState({
            user: null,
            profile: null,
            loading: false,
            error: error instanceof Error ? error.message : "Authentication error",
          });
        }
      }
    }

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_IN" && session?.user) {
        // Fetch user profile on sign in
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        setAuthState({
          user: session.user,
          profile: profile || null,
          loading: false,
          error: null,
        });
      } else if (event === "SIGNED_OUT") {
        setAuthState({
          user: null,
          profile: null,
          loading: false,
          error: null,
        });
        router.push("/");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔐 Starting sign in process for:', email);
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      
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

      // Fetch full profile data
      const { data: fullProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user!.id)
        .single();

      setAuthState({
        user: data.user!,
        profile: fullProfile || null,
        loading: false,
        error: null
      });
      return { data, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sign in failed";
      setAuthState(prev => ({ ...prev, loading: false, error: errorMessage }));
      return { data: null, error: errorMessage };
    }
  };

  const signUp = async (email: string, password: string, userData: { name: string; role?: "nurse" | "admin" }) => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      
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
      setAuthState(prev => ({ ...prev, loading: false, error: errorMessage }));
      return { data: null, error: errorMessage };
    }
  };

  const signOut = async () => {
    try {
      console.log("SignOut: Starting logout process");
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      
      console.log("SignOut: Calling supabase.auth.signOut()");
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("SignOut: Error from Supabase:", error);
        throw error;
      }
      
      console.log("SignOut: Successfully signed out from Supabase");
      
      // Clear the auth state immediately
      setAuthState({
        user: null,
        profile: null,
        loading: false,
        error: null,
      });
      
      console.log("SignOut: Redirecting to landing page");
      // Use window.location for immediate navigation
      window.location.href = "/";
    } catch (error) {
      console.error("SignOut: Caught error:", error);
      const errorMessage = error instanceof Error ? error.message : "Sign out failed";
      setAuthState(prev => ({ ...prev, loading: false, error: errorMessage }));
      // Still try to redirect even if there's an error
      console.log("SignOut: Redirecting to landing page after error");
      window.location.href = "/";
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

  return {
    ...authState,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    isAuthenticated: !!authState.user,
    isAdmin: authState.profile?.role === "admin",
    isNurse: authState.profile?.role === "nurse",
  };
}