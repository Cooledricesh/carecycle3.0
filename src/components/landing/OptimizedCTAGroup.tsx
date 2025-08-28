'use client';

import { ArrowRight, LogIn, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/providers/auth-provider";

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
  const { user, loading, initialized } = useAuthContext();
  const [showButtons, setShowButtons] = useState(false);

  useEffect(() => {
    // Show buttons immediately if auth is initialized
    if (initialized) {
      setShowButtons(true);
    } else {
      // Show buttons after a very short delay to prevent flicker
      const timer = setTimeout(() => {
        setShowButtons(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [initialized]);

  // If not initialized yet, show default buttons (not logged in state)
  // This prevents the loading skeleton from showing on initial render
  if (!showButtons) {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4 ${className}`}>
        <Button 
          variant="outline" 
          size={variant === 'compact' ? 'default' : 'lg'} 
          onClick={onSignIn}
          disabled={!initialized}
          className="w-full sm:w-auto min-h-[44px] px-4 sm:px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 bg-white hover:bg-gray-50 transition-opacity"
          style={{ opacity: initialized ? 1 : 0.6 }}
          aria-label="로그인하기"
        >
          <LogIn className="mr-2 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span className="whitespace-nowrap">로그인</span>
        </Button>
        
        <Button 
          size={variant === 'compact' ? 'default' : 'lg'} 
          onClick={onSignUp}
          disabled={!initialized}
          className="group w-full sm:w-auto min-h-[44px] px-4 sm:px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-opacity"
          style={{ opacity: initialized ? 1 : 0.6 }}
          aria-label="회원가입하기"
        >
          <UserPlus className="mr-2 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span className="whitespace-nowrap">회원가입</span>
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  // If user is authenticated and auth is initialized, show dashboard button
  if (user && initialized) {
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

  // Default: show sign in/up buttons
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