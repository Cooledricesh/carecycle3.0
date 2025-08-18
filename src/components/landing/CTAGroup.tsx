'use client';

import { ArrowRight, LogIn, UserPlus } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
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
  const { user, loading, error } = useAuthContext();
  const { toast } = useToast();

  // Show error toast if there's an authentication error
  useEffect(() => {
    if (error) {
      toast({
        title: "인증 오류",
        description: "사용자 정보를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Show loading skeletons during auth check
  if (loading) {
    return (
      <div className={`flex items-center justify-center gap-4 ${className}`} aria-busy="true" aria-label="로딩 중">
        <Skeleton className="h-10 sm:h-11 w-28 sm:w-32" />
        <Skeleton className="h-10 sm:h-11 w-20 sm:w-24" />
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
          className="group min-h-[44px] px-4 sm:px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          aria-label="대시보드로 이동"
        >
          대시보드로 이동
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  // If user is not authenticated, show sign in/up buttons
  return (
    <div className={`flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4 ${className}`}>
      <Button 
        variant="outline" 
        size={variant === 'compact' ? 'default' : 'lg'} 
        onClick={onSignIn}
        className="w-full sm:w-auto min-h-[44px] px-4 sm:px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 bg-white hover:bg-gray-50"
        aria-label="로그인하기"
      >
        <LogIn className="mr-2 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span className="whitespace-nowrap">로그인</span>
      </Button>
      
      <Button 
        size={variant === 'compact' ? 'default' : 'lg'} 
        onClick={onSignUp}
        className="group w-full sm:w-auto min-h-[44px] px-4 sm:px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label="회원가입하기"
      >
        <UserPlus className="mr-2 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span className="whitespace-nowrap">회원가입</span>
        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
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