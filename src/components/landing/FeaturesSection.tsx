'use client';

import { Calendar, Clock, Bell, BarChart3, Shield, Users, Zap, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Feature {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  benefits: string[];
  isPopular?: boolean;
}

const features: Feature[] = [
  {
    icon: Calendar,
    title: "자동 일정 생성",
    description: "최초·실행일 기준 다음 예정일 자동 계산",
    benefits: ["반복 주기 자동 계산", "일정 충돌 방지", "스마트 스케줄링"],
    isPopular: true,
  },
  {
    icon: CheckCircle,
    title: "2–3클릭 체크리스트",
    description: "빠른 체크로 기록 누락 방지",
    benefits: ["간편한 체크 인터페이스", "실시간 진행 상황", "누락 알림"],
  },
  {
    icon: Bell,
    title: "실시간 알림",
    description: "예정일 1주 전부터 안전하게",
    benefits: ["사전 알림 시스템", "우선순위 관리", "팀 공유 알림"],
  },
  {
    icon: BarChart3,
    title: "대시보드",
    description: "완료/미완료 현황 한눈에",
    benefits: ["실시간 현황 파악", "성과 지표 분석", "업무 효율 측정"],
  },
];

export function FeaturesSection() {
  return (
    <section className="bg-white px-4 py-12 sm:py-16 lg:py-24 sm:px-6 lg:px-8" aria-labelledby="features-section-heading">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="text-center">
          <h2 id="features-section-heading" className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-gray-900">
            간호사를 위한 핵심 기능
          </h2>
          <p className="mx-auto mt-3 sm:mt-4 max-w-2xl text-base sm:text-lg text-gray-600">
            의료 스케줄링을 간소화하고 환자 케어 품질을 향상시키는 모든 기능
          </p>
        </div>

        {/* Features grid - Responsive: 1 -> 2 -> 4 columns */}
        <div className="mt-10 sm:mt-12 lg:mt-16 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" role="list">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <Card 
                key={index} 
                className="relative overflow-hidden transition-all duration-200 hover:shadow-lg focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2"
                role="listitem"
              >
                {feature.isPopular && (
                  <div className="absolute right-3 top-3 sm:right-4 sm:top-4">
                    <Badge variant="default" className="bg-primary text-xs sm:text-sm" aria-label="인기 기능">
                      인기
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
                  <div className="mb-3 sm:mb-4 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-primary/10" aria-hidden="true">
                    <IconComponent className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg sm:text-xl font-semibold text-gray-900">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="p-4 sm:p-6 pt-0">
                  <p className="mb-3 sm:mb-4 text-sm sm:text-base text-gray-600">
                    {feature.description}
                  </p>
                  
                  <ul className="space-y-2" role="list">
                    {feature.benefits.map((benefit, benefitIndex) => (
                      <li key={benefitIndex} className="flex items-start space-x-2">
                        <CheckCircle className="mt-0.5 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 text-green-500" aria-hidden="true" />
                        <span className="text-xs sm:text-sm text-gray-600">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 sm:mt-16 text-center">
          <p className="text-base sm:text-lg text-gray-600">
            케어스케줄러로 업무 효율성을 높여보세요
          </p>
          <div className="mt-3 sm:mt-4 flex items-center justify-center space-x-2 text-xs sm:text-sm text-gray-500">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4" aria-hidden="true" />
            <span>몇 분 안에 간단한 설정 완료</span>
          </div>
        </div>
      </div>
    </section>
  );
}