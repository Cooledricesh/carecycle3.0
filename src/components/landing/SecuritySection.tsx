'use client';

import { Shield, Lock, Eye, FileCheck, Server, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SecurityFeature {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

interface Certification {
  name: string;
  description: string;
  verified: boolean;
}

const securityFeatures: SecurityFeature[] = [
  {
    icon: Shield,
    title: "HIPAA 준수",
    description: "의료 데이터 보호를 위한 건강보험 이동성 및 책임에 관한 법률 요구 사항을 완전히 준수합니다.",
  },
  {
    icon: Lock,
    title: "종단간 암호화",
    description: "모든 데이터는 업계 표준 AES-256 암호화 프로토콜을 사용하여 전송 중과 저장 시 암호화됩니다.",
  },
  {
    icon: Eye,
    title: "감사 추적",
    description: "모든 사용자 행동과 데이터 접근에 대한 포괄적인 로깅으로 완전한 컴플라이언스 추적을 제공합니다.",
  },
  {
    icon: FileCheck,
    title: "데이터 검증",
    description: "다중 계층 데이터 검증으로 데이터 무결성을 보장하고 무단 접근이나 손상을 방지합니다.",
  },
  {
    icon: Server,
    title: "보안 인프라",
    description: "SOC 2 Type II 인증 클라우드 인프라에서 호스팅되며 99.9% 가동시간을 보장합니다.",
  },
  {
    icon: Award,
    title: "정기 감사",
    description: "인증된 제3자 보안 회사의 분기별 보안 감사 및 침투 테스트를 실시합니다.",
  },
];

const certifications: Certification[] = [
  {
    name: "HIPAA 준수",
    description: "의료 데이터 보호 표준",
    verified: true,
  },
  {
    name: "SOC 2 Type II",
    description: "보안, 가용성 및 기밀성",
    verified: true,
  },
  {
    name: "ISO 27001",
    description: "정보 보안 관리",
    verified: true,
  },
  {
    name: "GDPR 준비완료",
    description: "유럽 데이터 보호 규정",
    verified: true,
  },
];

export function SecuritySection() {
  return (
    <section className="bg-white px-4 py-12 sm:py-16 lg:py-24 sm:px-6 lg:px-8" aria-labelledby="security-section-heading">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="text-center">
          <Badge variant="outline" className="mb-3 sm:mb-4 border-green-200 bg-green-50 px-3 py-1 text-green-700" aria-label="엔터프라이즈 보안 배지">
            <Shield className="mr-2 h-3 w-3" aria-hidden="true" />
            엔터프라이즈 보안
          </Badge>
          <h2 id="security-section-heading" className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-gray-900">
            의료급 보안 및 컴플라이언스
          </h2>
          <p className="mx-auto mt-3 sm:mt-4 max-w-2xl text-base sm:text-lg text-gray-600">
            환자 데이터는 은행급 보안과 완전한 의료 컴플라이언스로 보호됩니다
          </p>
        </div>

        {/* Security features grid */}
        <div className="mt-10 sm:mt-12 lg:mt-16 grid gap-6 sm:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {securityFeatures.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <Card 
                key={index} 
                className="border-0 shadow-sm transition-all duration-200 hover:shadow-md focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-offset-2"
                role="listitem"
              >
                <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
                  <div className="mb-3 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-green-100" aria-hidden="true">
                    <IconComponent className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                  </div>
                  <CardTitle className="text-base sm:text-lg font-semibold text-gray-900">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Certifications section */}
        <div className="mt-12 sm:mt-16 lg:mt-20" role="region" aria-labelledby="certifications-heading">
          <div className="text-center">
            <h3 id="certifications-heading" className="text-xl sm:text-2xl font-bold text-gray-900">
              신뢰할 수 있는 인증 및 컴플라이언스
            </h3>
            <p className="mt-2 text-sm sm:text-base text-gray-600">
              독립적으로 검증된 보안 및 컴플라이언스 표준
            </p>
          </div>

          <div className="mt-6 sm:mt-8 grid gap-4 sm:gap-6 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4" role="list">
            {certifications.map((cert, index) => (
              <div key={index} className="text-center" role="listitem">
                <div className="mx-auto flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-green-50" aria-hidden="true">
                  <Award className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                </div>
                <h4 className="mt-3 sm:mt-4 text-sm sm:text-base font-semibold text-gray-900">{cert.name}</h4>
                <p className="mt-1 text-xs sm:text-sm text-gray-600">{cert.description}</p>
                {cert.verified && (
                  <div className="mt-2 inline-flex items-center rounded-full bg-green-100 px-2 sm:px-2.5 py-0.5 text-xs font-medium text-green-800" aria-label="검증된 인증">
                    <div className="mr-1 h-1.5 w-1.5 rounded-full bg-green-400" aria-hidden="true"></div>
                    검증됨
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Security commitment section */}
        <div className="mt-10 sm:mt-12 lg:mt-16 rounded-xl sm:rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-8" role="region" aria-labelledby="commitment-heading">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-blue-100" aria-hidden="true">
              <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            </div>
            <h3 id="commitment-heading" className="mt-3 sm:mt-4 text-lg sm:text-xl font-bold text-gray-900">
              보안에 대한 우리의 약속
            </h3>
            <p className="mt-3 sm:mt-4 max-w-2xl mx-auto text-sm sm:text-base text-gray-600">
              우리는 의료 데이터 보호의 중요성을 깊이 이해하고 있습니다. 보안 우선 접근 방식으로 
              환자 정보가 항상 최고 수준의 업계 표준으로 보호되도록 보장합니다.
            </p>
            
            <div className="mt-6 sm:mt-8 grid gap-4 grid-cols-3" role="list">
              <div className="text-center" role="listitem">
                <div className="text-xl sm:text-2xl font-bold text-blue-600" aria-label="24시간 7일 보안 모니터링">24/7</div>
                <div className="text-xs sm:text-sm text-gray-600">보안 모니터링</div>
              </div>
              <div className="text-center" role="listitem">
                <div className="text-xl sm:text-2xl font-bold text-blue-600" aria-label="99.9% 가동시간 서비스 수준 계약">99.9%</div>
                <div className="text-xs sm:text-sm text-gray-600">가동시간 SLA</div>
              </div>
              <div className="text-center" role="listitem">
                <div className="text-xl sm:text-2xl font-bold text-blue-600" aria-label="1초 미만 응답 시간">&lt;1s</div>
                <div className="text-xs sm:text-sm text-gray-600">응답 시간</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}