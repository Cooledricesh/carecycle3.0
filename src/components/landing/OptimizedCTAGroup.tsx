'use client';

import { ArrowRight, LogIn, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider-simple";

interface OptimizedCTAGroupProps {
  onSignIn?: () => void;
  onSignUp?: () => void;
  onDashboard?: () => void;
  variant?: 'default' | 'compact';
  className?: string;
}

export function OptimizedCTAGroup({ 
  onSignIn, 
  onSignUp, 
  onDashboard, 
  variant = 'default',
  className = '' 
}: OptimizedCTAGroupProps) {
  const { user, loading } = useAuth();
  const [showButtons, setShowButtons] = useState(false);

  useEffect(() => {
    // Show buttons immediately if auth is loaded
    if (!loading) {
      setShowButtons(true);
    } else {
      // Show buttons after a very short delay to prevent flicker
      const timer = setTimeout(() => {
        setShowButtons(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // If not initialized yet, show default buttons (not logged in state)
  // This prevents the loading skeleton from showing on initial render
  if (!showButtons) {
    return (
      <div className={`flex items-center justify-center gap-1.5 sm:gap-2 md:gap-3 ${className}`}>
        <Button
          variant="outline"
          size={variant === 'compact' ? 'sm' : 'lg'}
          onClick={onSignIn}
          disabled={loading}
          className="h-7 sm:h-8 md:h-9 px-2 sm:px-3 md:px-4 text-[11px] sm:text-xs md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 bg-white hover:bg-gray-50 transition-opacity"
          style={{ opacity: loading ? 0.6 : 1 }}
          aria-label="로그인하기"
        >
          <LogIn className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 flex-shrink-0" aria-hidden="true" />
          <span className="whitespace-nowrap">로그인</span>
        </Button>

        <Button
          size={variant === 'compact' ? 'sm' : 'lg'}
          onClick={onSignUp}
          disabled={loading}
          className="group h-7 sm:h-8 md:h-9 px-2 sm:px-3 md:px-4 text-[11px] sm:text-xs md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-opacity"
          style={{ opacity: loading ? 0.6 : 1 }}
          aria-label="회원가입하기"
        >
          <UserPlus className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 flex-shrink-0" aria-hidden="true" />
          <span className="whitespace-nowrap">회원가입</span>
          <ArrowRight className="ml-1 h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  // If user is authenticated and auth is initialized, show dashboard button
  if (user && !loading) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <Button
          size={variant === 'compact' ? 'sm' : 'lg'}
          onClick={onDashboard}
          className="group h-7 sm:h-8 md:h-9 px-2 sm:px-3 md:px-4 text-[11px] sm:text-xs md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          aria-label="대시보드로 이동"
        >
          대시보드로 이동
          <ArrowRight className="ml-1 h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  // Default: show sign in/up buttons
  return (
    <div className={`flex items-center justify-center gap-1.5 sm:gap-2 md:gap-3 ${className}`}>
      <Button
        variant="outline"
        size={variant === 'compact' ? 'sm' : 'lg'}
        onClick={onSignIn}
        className="h-7 sm:h-8 md:h-9 px-2 sm:px-3 md:px-4 text-[11px] sm:text-xs md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 bg-white hover:bg-gray-50"
        aria-label="로그인하기"
      >
        <LogIn className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 flex-shrink-0" aria-hidden="true" />
        <span className="whitespace-nowrap">로그인</span>
      </Button>

      <Button
        size={variant === 'compact' ? 'sm' : 'lg'}
        onClick={onSignUp}
        className="group h-7 sm:h-8 md:h-9 px-2 sm:px-3 md:px-4 text-[11px] sm:text-xs md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label="회원가입하기"
      >
        <UserPlus className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 flex-shrink-0" aria-hidden="true" />
        <span className="whitespace-nowrap">회원가입</span>
        <ArrowRight className="ml-1 h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
      </Button>
    </div>
  );
}