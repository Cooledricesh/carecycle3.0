"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AppIcon } from "@/components/ui/app-icon";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OrganizationSearchDialog } from "./OrganizationSearchDialog";
import { CreateOrganizationDialog } from "./CreateOrganizationDialog";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"nurse" | "doctor">("nurse");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [signupStep, setSignupStep] = useState<"basic" | "organization">("basic");
  const [userId, setUserId] = useState<string | null>(null);
  const [showOrgSearch, setShowOrgSearch] = useState(false);
  const [showOrgCreate, setShowOrgCreate] = useState(false);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      setIsLoading(false);
      return;
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("이름을 입력해주세요.");
      setIsLoading(false);
      return;
    }

    setName(trimmedName);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          name: trimmedName,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "회원가입 중 오류가 발생했습니다.");
      }

      // Basic signup successful, now show organization selection
      setUserId(data.user.id);
      setSignupStep("organization");
      setShowOrgSearch(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "회원가입 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectOrganization = async (organizationId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Create join request
      const response = await fetch("/api/join-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organization_id: organizationId,
          email,
          name,
          role,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "가입 요청에 실패했습니다.");
      }

      // Show awaiting approval message
      setAwaitingApproval(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "가입 요청에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrganization = async (organizationId: string, organizationName: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // User is automatically assigned as admin when creating organization
      // Just redirect to dashboard
      router.push("/dashboard");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "조직 생성에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // Render awaiting approval message
  if (awaitingApproval) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex justify-center">
              <AppIcon size="xl" />
            </div>
            <div className="text-center">
              <CardTitle className="text-2xl">승인 대기 중</CardTitle>
              <CardDescription>관리자 승인을 기다리고 있습니다</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-sm text-muted-foreground">
              <p>가입 요청이 성공적으로 제출되었습니다.</p>
              <p className="mt-2">관리자가 승인하면 이메일로 알림을 받게 됩니다.</p>
            </div>
            <div className="pt-4">
              <Button
                onClick={() => router.push("/auth/signin")}
                className="w-full"
              >
                로그인 페이지로 이동
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <AppIcon size="xl" />
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl">회원가입</CardTitle>
            <CardDescription>
              {signupStep === "basic" ? "새 계정을 만드세요" : "조직을 선택하세요"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="name">이름</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="홍길동"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={signupStep === "organization"}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="staff@hospital.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={signupStep === "organization"}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">직군</Label>
                <Select
                  value={role}
                  onValueChange={(value: "nurse" | "doctor") => setRole(value)}
                  disabled={signupStep === "organization"}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="직군을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nurse">스텝</SelectItem>
                    <SelectItem value="doctor">의사</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">비밀번호</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={signupStep === "organization"}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="repeat-password">비밀번호 확인</Label>
                </div>
                <Input
                  id="repeat-password"
                  type="password"
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  disabled={signupStep === "organization"}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              {signupStep === "basic" && (
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "계정 생성 중..." : "회원가입"}
                </Button>
              )}
            </div>
            <div className="mt-4 text-center text-sm">
              이미 계정이 있으신가요?{" "}
              <Link href="/auth/signin" className="underline underline-offset-4">
                로그인
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Organization Search Dialog */}
      <OrganizationSearchDialog
        open={showOrgSearch}
        onOpenChange={setShowOrgSearch}
        onSelectOrganization={handleSelectOrganization}
        onCreateNew={() => {
          setShowOrgSearch(false);
          setShowOrgCreate(true);
        }}
      />

      {/* Create Organization Dialog */}
      <CreateOrganizationDialog
        open={showOrgCreate}
        onOpenChange={setShowOrgCreate}
        onSuccess={handleCreateOrganization}
      />
    </div>
  );
}