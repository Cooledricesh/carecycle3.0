'use client';

import { CheckCircle, TrendingUp, Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HeroSectionProps {
  onGetStarted: () => void;
  onLearnMore: () => void;
  showAuthButtons?: boolean;
}

export function HeroSection({ onGetStarted, onLearnMore, showAuthButtons = true }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-white px-4 py-12 sm:py-16 md:py-20 lg:py-24 sm:px-6 lg:px-8" aria-labelledby="hero-heading">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 lg:gap-16">
          {/* Left Column - Copy and CTA */}
          <div className="text-left">
            {/* Badge */}
            <Badge variant="secondary" className="mb-6 bg-primary/10 text-primary">
              Reliable Care Workflow
            </Badge>

            {/* Main heading */}
            <h1 id="hero-heading" className="text-3xl font-bold tracking-tight text-primary sm:text-4xl md:text-4xl lg:text-5xl">
              반복 검사·주사 일정,<br className="hidden sm:inline" />
              <span className="block sm:inline">누락 0%를 위해</span>
            </h1>

            {/* Subtitle */}
            <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-7 sm:leading-8 text-secondary">
              자동 일정 생성과 초간단 체크리스트로 업무 시간을 줄이세요.
              중형 병원 스텝을 위한 스마트 스케줄링 시스템.
            </p>

            {/* CTA Buttons */}
            {showAuthButtons && (
              <div className="mt-6 sm:mt-8 flex flex-col gap-3 sm:flex-row">
                <Button 
                  size="lg" 
                  className="bg-primary hover:bg-primary/90 px-6 sm:px-8 py-3 text-sm sm:text-base font-medium min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  onClick={onLearnMore}
                  aria-label="핵심 기능 보기"
                >
                  핵심 기능 보기
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="border-primary text-primary hover:bg-primary/5 px-6 sm:px-8 py-3 text-sm sm:text-base font-medium min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  onClick={onGetStarted}
                  aria-label="회원 가입"
                >
                  회원 가입
                </Button>
              </div>
            )}

            {/* Trust indicators */}
            <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm text-secondary">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" aria-hidden="true" />
                <span>무료 체험</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary flex-shrink-0" aria-hidden="true" />
                <span>보안 인증</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary flex-shrink-0" aria-hidden="true" />
                <span>100+ 병원 사용</span>
              </div>
            </div>
          </div>

          {/* Right Column - Visual Element */}
          <div className="w-full mt-8 md:mt-0" aria-label="대시보드 미리보기 예시">
            <Card className="shadow-xl border-0 bg-gradient-to-br from-primary/5 to-white">
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl font-semibold text-primary">
                  오늘 해야 할 항목 요약
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Sample stats */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="rounded-lg bg-white p-3 sm:p-4 shadow-sm">
                      <div className="text-xl sm:text-2xl font-bold text-primary" aria-label="예정된 검사 수">24</div>
                      <div className="text-xs sm:text-sm text-secondary">예정된 검사</div>
                    </div>
                    <div className="rounded-lg bg-white p-3 sm:p-4 shadow-sm">
                      <div className="text-xl sm:text-2xl font-bold text-green-600" aria-label="완료된 항목 수">18</div>
                      <div className="text-xs sm:text-sm text-secondary">완료된 항목</div>
                    </div>
                  </div>
                  
                  {/* Progress indicator */}
                  <div className="rounded-lg bg-white p-3 sm:p-4 shadow-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-medium text-secondary">일일 진행률</span>
                      <span className="text-xs sm:text-sm font-bold text-primary" aria-label="진행률 75%">75%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200" role="progressbar" aria-valuenow={75} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-2 w-3/4 rounded-full bg-primary"></div>
                    </div>
                  </div>

                  {/* Efficiency metric */}
                  <div className="flex items-center justify-center rounded-lg bg-green-50 p-3 sm:p-4">
                    <TrendingUp className="mr-2 h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" aria-hidden="true" />
                    <span className="text-xs sm:text-sm font-medium text-green-700">
                      업무 효율 50% 향상
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}