'use client';

/**
 * Accept Invitation Page
 *
 * Public page for accepting invitations and creating accounts
 */

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { TermsDialog } from '@/components/auth/TermsDialog';
import { PrivacyPolicyDialog } from '@/components/auth/PrivacyPolicyDialog';

interface PageProps {
  params: Promise<{ token: string }>;
}

const signupSchema = z.object({
  name: z.string().min(2, '이름은 최소 2자 이상이어야 합니다'),
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다'),
  confirmPassword: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다'),
});

interface VerificationResponse {
  valid: boolean;
  email?: string;
  role?: string;
  organization_name?: string;
  reason?: string;
}

export default function AcceptInvitationPage({ params }: PageProps) {
  const { token } = use(params);
  const router = useRouter();

  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationData, setVerificationData] = useState<VerificationResponse | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<{
    name?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyPolicyAgreed, setPrivacyPolicyAgreed] = useState(false);

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const response = await fetch(`/api/auth/invitations/verify/${token}`);
        const data: VerificationResponse = await response.json();

        setVerificationData(data);
      } catch (error) {
        setVerificationData({
          valid: false,
          reason: 'Failed to verify invitation token',
        });
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Check passwords match
    if (formData.password !== formData.confirmPassword) {
      setErrors({ confirmPassword: '비밀번호가 일치하지 않습니다' });
      return;
    }

    // Validate
    const validation = signupSchema.safeParse(formData);

    if (!validation.success) {
      const fieldErrors: {
        name?: string;
        password?: string;
        confirmPassword?: string;
      } = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof typeof fieldErrors] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    // Clear errors
    setErrors({});

    // Submit
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/signup/with-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          name: formData.name,
          password: formData.password,
          termsAgreed,
          privacyPolicyAgreed,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || error.error || '계정 생성에 실패했습니다');
      }

      setSubmitSuccess(true);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/auth/signin');
      }, 2000);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '계정 생성에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="container mx-auto flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              초대장 확인 중...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!verificationData?.valid) {
    return (
      <div className="container mx-auto flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>유효하지 않은 초대</CardTitle>
            <CardDescription>이 초대장은 더 이상 유효하지 않습니다</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {verificationData?.reason || '알 수 없는 오류'}
              </AlertDescription>
            </Alert>

            <div className="mt-4">
              <Button onClick={() => router.push('/auth/signin')} variant="outline" className="w-full">
                로그인 페이지로 이동
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitSuccess) {
    return (
      <div className="container mx-auto flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>계정 생성 완료!</CardTitle>
            <CardDescription>로그인 페이지로 이동 중...</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                계정이 성공적으로 생성되었습니다. 잠시 후 로그인 페이지로 이동합니다.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>초대 수락</CardTitle>
          <CardDescription>
            {verificationData.organization_name}에 가입하기 위해 계정을 생성하세요
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="mb-6 space-y-2">
            <div className="text-sm">
              <span className="font-medium">이메일:</span> {verificationData.email}
            </div>
            <div className="text-sm">
              <span className="font-medium">역할:</span>{' '}
              <span className="capitalize">
                {verificationData.role === 'admin' ? '관리자' :
                 verificationData.role === 'doctor' ? '주치의' : '스텝'}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                type="text"
                placeholder="홍길동"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name ? <p className="text-sm text-red-500">{errors.name}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="최소 6자 이상"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={errors.password ? 'border-red-500' : ''}
              />
              {errors.password ? <p className="text-sm text-red-500">{errors.password}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">비밀번호 확인</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="비밀번호 재입력"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                className={errors.confirmPassword ? 'border-red-500' : ''}
              />
              {errors.confirmPassword ? (
                <p className="text-sm text-red-500">{errors.confirmPassword}</p>
              ) : null}
            </div>

            {/* Terms Agreement */}
            <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms-agree"
                    checked={termsAgreed}
                    onCheckedChange={(checked) => setTermsAgreed(checked === true)}
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="terms-agree"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      <TermsDialog>
                        <button type="button" className="underline hover:text-blue-600">
                          서비스 이용약관
                        </button>
                      </TermsDialog>
                      에 동의합니다 (필수)
                    </label>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="privacy-agree"
                    checked={privacyPolicyAgreed}
                    onCheckedChange={(checked) => setPrivacyPolicyAgreed(checked === true)}
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="privacy-agree"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      <PrivacyPolicyDialog>
                        <button type="button" className="underline hover:text-blue-600">
                          개인정보처리방침
                        </button>
                      </PrivacyPolicyDialog>
                      에 동의합니다 (필수)
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {submitError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSubmitting || !termsAgreed || !privacyPolicyAgreed}>
              {isSubmitting ? '계정 생성 중...' : '계정 생성'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
