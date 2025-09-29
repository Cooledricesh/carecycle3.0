'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/providers/auth-provider-simple';
import { AppIcon } from '@/components/ui/app-icon';
import { 
  HeroSection, 
  FeaturesSection, 
  OptimizedCTAGroup as CTAGroup, 
  BenefitsSection, 
  SecuritySection 
} from '@/components/landing';

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Navigation handlers
  const handleGetStarted = () => {
    router.push('/auth/signup');
  };

  const handleLearnMore = () => {
    const featuresSection = document.getElementById('features');
    featuresSection?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSignIn = () => {
    router.push('/auth/signin');
  };

  const handleSignUp = () => {
    router.push('/auth/signup');
  };

  const handleDashboard = () => {
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50" role="banner" aria-label="사이트 헤더">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-12 sm:h-14 md:h-16">
            <div className="flex items-center space-x-2">
              <AppIcon size="sm" priority />
              <span className="text-lg sm:text-xl font-bold text-gray-900">케어스케줄러</span>
            </div>

            <nav className="hidden md:flex items-center space-x-8" role="navigation" aria-label="주요 메뉴">
              <a
                href="#features"
                className="text-gray-600 hover:text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded px-2 py-1"
                aria-label="제품 기능 섹션으로 이동"
              >
                기능
              </a>
              <a
                href="#benefits"
                className="text-gray-600 hover:text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded px-2 py-1"
                aria-label="제품 혜택 섹션으로 이동"
              >
                혜택
              </a>
              <a
                href="#security"
                className="text-gray-600 hover:text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded px-2 py-1"
                aria-label="보안 정보 섹션으로 이동"
              >
                보안
              </a>
            </nav>

            <div className="flex items-center space-x-2 sm:space-x-3">
              <CTAGroup
                onSignIn={handleSignIn}
                onSignUp={handleSignUp}
                onDashboard={handleDashboard}
                variant="compact"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main role="main" aria-label="케어스케줄러 제품 소개">
        {/* Hero Section */}
        <HeroSection
          onGetStarted={handleGetStarted}
          onLearnMore={handleLearnMore}
        />

        {/* Features Section */}
        <section id="features" aria-labelledby="features-heading">
          <h2 id="features-heading" className="sr-only">제품 기능</h2>
          <FeaturesSection />
        </section>

        {/* Benefits Section */}
        <section id="benefits" aria-labelledby="benefits-heading">
          <h2 id="benefits-heading" className="sr-only">제품 혜택</h2>
          <BenefitsSection />
        </section>

        {/* Security Section */}
        <section id="security" aria-labelledby="security-heading">
          <h2 id="security-heading" className="sr-only">보안 정보</h2>
          <SecuritySection />
        </section>
      </main>

      {/* Final CTA Section */}
      <section className="py-12 sm:py-16 bg-gradient-to-r from-blue-600 to-indigo-600" aria-labelledby="cta-heading">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 id="cta-heading" className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">
            의료 스케줄링을 혁신할 준비가 되셨나요?
          </h2>
          <p className="text-lg sm:text-xl text-blue-100 mb-6 sm:mb-8 max-w-2xl mx-auto">
            이미 업무 효율성을 개선한 수많은 의료진들과 함께하세요.
            지금 무료 체험을 시작해보세요.
          </p>
          
          <CTAGroup
            onSignIn={handleSignIn}
            onSignUp={handleSignUp}
            onDashboard={handleDashboard}
            className="justify-center"
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 sm:py-12" role="contentinfo" aria-label="사이트 푸터">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <AppIcon size="sm" />
                <span className="text-xl font-bold">케어스케줄러</span>
              </div>
              <p className="text-gray-400 mb-4">
                반복 검사 및 주사 일정 자동화 스마트 스케줄링 시스템.
              </p>
              <p className="text-gray-500 text-sm">
                © 2025 CareScheduler. All rights reserved.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">제품</h3>
              <ul className="space-y-2 text-gray-400" role="list">
                <li>
                  <a 
                    href="#features" 
                    className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded px-2 py-1 inline-block"
                    aria-label="제품 기능 섹션으로 이동"
                  >
                    기능
                  </a>
                </li>
                <li>
                  <a 
                    href="#benefits" 
                    className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded px-2 py-1 inline-block"
                    aria-label="제품 혜택 섹션으로 이동"
                  >
                    혜택
                  </a>
                </li>
                <li>
                  <a 
                    href="#security" 
                    className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded px-2 py-1 inline-block"
                    aria-label="보안 정보 섹션으로 이동"
                  >
                    보안
                  </a>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">지원</h3>
              <ul className="space-y-2 text-gray-400" role="list">
                <li>
                  <Link 
                    href="/auth/signin" 
                    className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded px-2 py-1 inline-block"
                    aria-label="로그인 페이지로 이동"
                  >
                    로그인
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/auth/signup" 
                    className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded px-2 py-1 inline-block"
                    aria-label="회원가입 페이지로 이동"
                  >
                    회원가입
                  </Link>
                </li>
                {user && (
                  <li>
                    <Link 
                      href="/dashboard" 
                      className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded px-2 py-1 inline-block"
                      aria-label="대시보드로 이동"
                    >
                      대시보드
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
