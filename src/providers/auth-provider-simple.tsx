"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  useEffect(() => {
    const supabase = createClient();
    
    // CRITICAL: Use getSession() not getUser() - see AUTH_FAILURE_ANALYSIS.md
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes on auth state
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] Event:', event, 'User:', session?.user?.email);
      
      // Handle INITIAL_SESSION properly - see AUTH_FAILURE_ANALYSIS.md
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        setUser(session?.user ?? null);
        setLoading(false);
      }
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      }
      
      // Refresh the page on sign in/out to update server components
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
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