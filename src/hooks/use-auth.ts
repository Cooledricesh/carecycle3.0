"use client";

import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  const supabase = createClient();

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
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check user approval status
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('approval_status, is_active, role')
        .eq('id', data.user!.id)
        .single();

      if (profileError) {
        await supabase.auth.signOut();
        throw new Error('프로필을 불러올 수 없습니다.');
      }

      // Check approval status
      if (profile.approval_status === 'pending') {
        await supabase.auth.signOut();
        throw new Error('계정이 승인 대기 중입니다. 관리자의 승인을 기다려주세요.');
      }

      if (profile.approval_status === 'rejected') {
        await supabase.auth.signOut();
        throw new Error('계정 승인이 거부되었습니다. 관리자에게 문의하세요.');
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        throw new Error('계정이 비활성화되었습니다. 관리자에게 문의하세요.');
      }

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
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear the auth state immediately
      setAuthState({
        user: null,
        profile: null,
        loading: false,
        error: null,
      });
      
      // Navigate to landing page
      router.push("/");
      router.refresh(); // Force a refresh to clear any cached data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sign out failed";
      setAuthState(prev => ({ ...prev, loading: false, error: errorMessage }));
      // Still try to redirect even if there's an error
      router.push("/");
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