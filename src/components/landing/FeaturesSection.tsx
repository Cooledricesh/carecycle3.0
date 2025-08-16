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
    <section className="bg-white px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            간호사를 위한 핵심 기능
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            의료 스케줄링을 간소화하고 환자 케어 품질을 향상시키는 모든 기능
          </p>
        </div>

        {/* Features grid - 4 columns on large screens, 2 on medium, 1 on small */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <Card key={index} className="relative overflow-hidden transition-all duration-200 hover:shadow-lg">
                {feature.isPopular && (
                  <div className="absolute right-4 top-4">
                    <Badge variant="default" className="bg-primary">
                      인기
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="pb-4">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <IconComponent className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl font-semibold text-gray-900">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <p className="mb-4 text-gray-600">
                    {feature.description}
                  </p>
                  
                  <ul className="space-y-2">
                    {feature.benefits.map((benefit, benefitIndex) => (
                      <li key={benefitIndex} className="flex items-start space-x-2">
                        <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                        <span className="text-sm text-gray-600">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <p className="text-lg text-gray-600">
            케어스케줄러로 업무 효율성을 높여보세요
          </p>
          <div className="mt-4 flex items-center justify-center space-x-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span>몇 분 안에 간단한 설정 완료</span>
          </div>
        </div>
      </div>
    </section>
  );
}