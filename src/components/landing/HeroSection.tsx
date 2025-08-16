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
    <section className="relative overflow-hidden bg-white px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 lg:gap-16">
          {/* Left Column - Copy and CTA */}
          <div className="text-left">
            {/* Badge */}
            <Badge variant="secondary" className="mb-6 bg-primary/10 text-primary">
              Reliable Care Workflow
            </Badge>

            {/* Main heading */}
            <h1 className="text-3xl font-bold tracking-tight text-primary md:text-4xl lg:text-5xl">
              반복 검사·주사 일정,<br />
              누락 0%를 위해
            </h1>

            {/* Subtitle */}
            <p className="mt-6 text-lg leading-8 text-secondary">
              자동 일정 생성과 초간단 체크리스트로 업무 시간을 줄이세요.
              중형 병원 간호사를 위한 스마트 스케줄링 시스템.
            </p>

            {/* CTA Buttons */}
            {showAuthButtons && (
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button 
                  size="lg" 
                  className="bg-primary hover:bg-primary/90 px-8 py-3 text-base font-medium"
                  onClick={onLearnMore}
                  aria-label="핵심 기능 보기"
                >
                  핵심 기능 보기
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="border-primary text-primary hover:bg-primary/5 px-8 py-3 text-base font-medium"
                  onClick={onGetStarted}
                  aria-label="로그인 또는 회원가입"
                >
                  로그인 또는 회원가입
                </Button>
              </div>
            )}

            {/* Trust indicators */}
            <div className="mt-8 flex items-center gap-6 text-sm text-secondary">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>무료 체험</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span>보안 인증</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span>100+ 병원 사용</span>
              </div>
            </div>
          </div>

          {/* Right Column - Visual Element */}
          <div className="w-full">
            <Card className="shadow-xl border-0 bg-gradient-to-br from-primary/5 to-white">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-primary">
                  오늘 해야 할 항목 요약
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Sample stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-white p-4 shadow-sm">
                      <div className="text-2xl font-bold text-primary">24</div>
                      <div className="text-sm text-secondary">예정된 검사</div>
                    </div>
                    <div className="rounded-lg bg-white p-4 shadow-sm">
                      <div className="text-2xl font-bold text-green-600">18</div>
                      <div className="text-sm text-secondary">완료된 항목</div>
                    </div>
                  </div>
                  
                  {/* Progress indicator */}
                  <div className="rounded-lg bg-white p-4 shadow-sm">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-secondary">일일 진행률</span>
                      <span className="text-sm font-bold text-primary">75%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200">
                      <div className="h-2 w-3/4 rounded-full bg-primary"></div>
                    </div>
                  </div>

                  {/* Efficiency metric */}
                  <div className="flex items-center justify-center rounded-lg bg-green-50 p-4">
                    <TrendingUp className="mr-2 h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-700">
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