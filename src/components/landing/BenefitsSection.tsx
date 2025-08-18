'use client';

import { TrendingUp, Clock, UserCheck, DollarSign, Heart, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Benefit {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  metric: string;
  metricLabel: string;
  highlight?: string;
}

const benefits: Benefit[] = [
  {
    icon: Clock,
    title: "행정 업무 시간 절약",
    description: "수동 스케줄링 작업에 소요되는 시간을 줄여 환자 케어에 더 집중할 수 있습니다.",
    metric: "75%",
    metricLabel: "시간 절약",
    highlight: "하루 최대 3시간",
  },
  {
    icon: TrendingUp,
    title: "업무 효율성 증가",
    description: "간소화된 워크플로우와 자동화 프로세스로 전반적인 생산성을 향상시킵니다.",
    metric: "40%",
    metricLabel: "효율성 증대",
    highlight: "검증된 결과",
  },
  {
    icon: UserCheck,
    title: "노쇼율 감소",
    description: "자동 알림과 확인을 통해 예약 누락을 크게 줄입니다.",
    metric: "60%",
    metricLabel: "노쇼율 감소",
    highlight: "참석률 향상",
  },
  {
    icon: DollarSign,
    title: "비용 절감",
    description: "최적화된 스케줄링과 초과 근무 감소로 운영비용을 절약합니다.",
    metric: "5천만원+",
    metricLabel: "연간 절약",
    highlight: "부서당",
  },
  {
    icon: Heart,
    title: "환자 케어 개선",
    description: "환자와의 상호작용 시간 증가로 더 나은 건강 결과를 얻습니다.",
    metric: "95%",
    metricLabel: "만족도",
    highlight: "환자 응답",
  },
  {
    icon: Target,
    title: "컴플라이언스 향상",
    description: "치료 일정과 프로토콜에 대한 일관된 준수를 보장합니다.",
    metric: "99%",
    metricLabel: "준수율",
    highlight: "치료 순응도",
  },
];

export function BenefitsSection() {
  return (
    <section className="bg-gray-50 px-4 py-12 sm:py-16 lg:py-24 sm:px-6 lg:px-8" aria-labelledby="benefits-section-heading">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="text-center">
          <Badge variant="outline" className="mb-3 sm:mb-4 px-3 py-1" aria-label="검증된 결과 배지">
            검증된 결과
          </Badge>
          <h2 id="benefits-section-heading" className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-gray-900">
            의료 운영을 혁신하세요
          </h2>
          <p className="mx-auto mt-3 sm:mt-4 max-w-2xl text-base sm:text-lg text-gray-600">
            효율성, 비용 절약, 환자 만족도에서 측정 가능한 개선 효과를 확인하세요
          </p>
        </div>

        {/* Benefits grid */}
        <div className="mt-10 sm:mt-12 lg:mt-16 grid gap-6 sm:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {benefits.map((benefit, index) => {
            const IconComponent = benefit.icon;
            return (
              <Card 
                key={index} 
                className="group relative overflow-hidden border-0 bg-white shadow-sm transition-all duration-300 hover:shadow-lg focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2"
                role="listitem"
              >
                <CardContent className="p-4 sm:p-6">
                  {/* Icon and metric */}
                  <div className="mb-3 sm:mb-4 flex items-start justify-between">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-blue-50 transition-colors group-hover:bg-blue-100" aria-hidden="true">
                      <IconComponent className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                    </div>
                    <div className="text-right">
                      <div className="text-xl sm:text-2xl font-bold text-blue-600" aria-label={`${benefit.metric} ${benefit.metricLabel}`}>{benefit.metric}</div>
                      <div className="text-xs text-gray-500">{benefit.metricLabel}</div>
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="mb-2 text-base sm:text-lg font-semibold text-gray-900">
                    {benefit.title}
                  </h3>
                  <p className="mb-3 text-xs sm:text-sm text-gray-600 leading-relaxed">
                    {benefit.description}
                  </p>

                  {/* Highlight */}
                  {benefit.highlight && (
                    <div className="inline-flex items-center rounded-full bg-green-50 px-2 sm:px-3 py-1">
                      <div className="h-2 w-2 rounded-full bg-green-400 mr-1.5 sm:mr-2 flex-shrink-0" aria-hidden="true"></div>
                      <span className="text-xs font-medium text-green-700">
                        {benefit.highlight}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Bottom section with additional stats */}
        <div className="mt-10 sm:mt-12 lg:mt-16 rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 sm:p-8 text-center text-white" role="region" aria-labelledby="stats-heading">
          <h3 id="stats-heading" className="text-xl sm:text-2xl lg:text-3xl font-bold">
            500+ 의료기관과 함께하세요
          </h3>
          <p className="mt-3 sm:mt-4 text-sm sm:text-base lg:text-lg opacity-90">
            이미 케어스케줄러로 스케줄링 효율성을 개선하고 있습니다
          </p>
          
          <div className="mt-6 sm:mt-8 grid grid-cols-2 gap-4 sm:gap-8 sm:grid-cols-4" role="list">
            <div role="listitem">
              <div className="text-2xl sm:text-3xl font-bold" aria-label="500개 이상의 의료기관">500+</div>
              <div className="text-xs sm:text-sm opacity-80">의료기관</div>
            </div>
            <div role="listitem">
              <div className="text-2xl sm:text-3xl font-bold" aria-label="1만명 이상의 활성 간호사">10K+</div>
              <div className="text-xs sm:text-sm opacity-80">활성 간호사</div>
            </div>
            <div role="listitem">
              <div className="text-2xl sm:text-3xl font-bold" aria-label="100만개 이상의 예약 스케줄">1M+</div>
              <div className="text-xs sm:text-sm opacity-80">예약 스케줄</div>
            </div>
            <div role="listitem">
              <div className="text-2xl sm:text-3xl font-bold" aria-label="99.9% 가동시간 보장">99.9%</div>
              <div className="text-xs sm:text-sm opacity-80">가동시간 보장</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}