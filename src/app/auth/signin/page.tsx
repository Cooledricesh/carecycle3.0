"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { user, profile, loading, signIn, error: authError } = useAuthContext();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo");

  useEffect(() => {
    // If user exists, redirect immediately regardless of loading state
    if (user) {
      const destination = redirectTo || (profile?.role === "admin" ? "/admin" : "/dashboard");
      console.log('🔄 Redirecting authenticated user to:', destination);
      // Force immediate redirect
      window.location.replace(destination);
    }
  }, [user, profile?.role, redirectTo]);
  
  // Additional check with timeout as fallback
  useEffect(() => {
    if (user && loading) {
      // If still loading after 2 seconds but user exists, force redirect
      const timeout = setTimeout(() => {
        console.log('⚠️ Loading timeout - forcing redirect');
        const destination = redirectTo || "/dashboard";
        window.location.replace(destination);
      }, 2000);
      
      return () => clearTimeout(timeout);
    }
  }, [user, loading, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Use centralized signIn method from AuthProvider
      const { data, error: signInError } = await signIn(email, password);

      if (signInError) {
        console.error('🔐 Sign in error:', signInError);
        setError(signInError);
        setIsLoading(false);
        return;
      }

      if (data) {
        // Success - redirect immediately
        console.log('🔐 Sign in successful, redirecting...');
        const destination = redirectTo || "/dashboard";
        window.location.replace(destination);
        // Keep loading state true since we're redirecting
        return;
      }
    } catch (err) {
      console.error('🔐 Sign in error:', err);
      setError(err instanceof Error ? err.message : '로그인 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto flex h-screen w-screen flex-col items-center justify-center">
      <Card className="mx-auto max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">로그인</CardTitle>
          <CardDescription>
            케어스케줄러에 로그인하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="nurse@hospital.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading || !!user}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">비밀번호</Label>
                <Link
                  href="/auth/forgot-password"
                  className="ml-auto inline-block text-sm underline"
                >
                  비밀번호를 잊으셨나요?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading || !!user}
              />
            </div>
            {(error || authError?.message) && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                {error || authError?.message}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading || !!user}>
              {isLoading ? "로그인 중..." : (user ? "리다이렉트 중..." : "로그인")}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            계정이 없으신가요?{" "}
            <Link href="/auth/signup" className="underline">
              회원가입
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SignInPageSkeleton() {
  return (
    <div className="container mx-auto flex h-screen w-screen flex-col items-center justify-center">
      <Card className="mx-auto max-w-sm">
        <CardHeader>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInPageSkeleton />}>
      <SignInForm />
    </Suspense>
  );
}