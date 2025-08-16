'use client';

import { ArrowRight, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthContext } from "@/providers/auth-provider";

interface CTAGroupProps {
  onSignIn?: () => void;
  onSignUp?: () => void;
  onDashboard?: () => void;
  variant?: 'default' | 'compact';
  className?: string;
}

export function CTAGroup({ 
  onSignIn, 
  onSignUp, 
  onDashboard, 
  variant = 'default',
  className = '' 
}: CTAGroupProps) {
  const { user, loading } = useAuthContext();

  // Show loading skeletons during auth check
  if (loading) {
    return (
      <div className={`flex items-center justify-center gap-4 ${className}`}>
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-24" />
      </div>
    );
  }

  // If user is authenticated, show dashboard button
  if (user) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <Button 
          size={variant === 'compact' ? 'default' : 'lg'} 
          onClick={onDashboard}
          className="group"
          aria-label="대시보드로 이동"
        >
          대시보드로 이동
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
      </div>
    );
  }

  // If user is not authenticated, show sign in/up buttons
  return (
    <div className={`flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4 ${className}`}>
      <Button 
        size={variant === 'compact' ? 'default' : 'lg'} 
        onClick={onSignUp}
        className="group w-full sm:w-auto"
        aria-label="무료 체험 시작"
      >
        <UserPlus className="mr-2 h-4 w-4" />
        무료 체험 시작
        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
      </Button>
      
      <Button 
        variant="outline" 
        size={variant === 'compact' ? 'default' : 'lg'} 
        onClick={onSignIn}
        className="w-full sm:w-auto"
        aria-label="로그인"
      >
        <LogIn className="mr-2 h-4 w-4" />
        로그인
      </Button>
    </div>
  );
}

// Compact version for use in navigation or smaller spaces
export function CompactCTAGroup(props: Omit<CTAGroupProps, 'variant'>) {
  return <CTAGroup {...props} variant="compact" />;
}

// Default export with helpful component composition
CTAGroup.Compact = CompactCTAGroup;