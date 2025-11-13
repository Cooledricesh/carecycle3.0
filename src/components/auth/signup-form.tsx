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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OrganizationSearchDialog } from "./OrganizationSearchDialog";
import { CreateOrganizationDialog } from "./CreateOrganizationDialog";
import { Building2, UserPlus, Search } from "lucide-react";

type OrganizationMode = "create" | "join";

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
  const [currentStep, setCurrentStep] = useState<"basic" | "organization">("basic");
  const [organizationMode, setOrganizationMode] = useState<OrganizationMode>("join");
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
      // CRITICAL: Call signUp directly from client for proper session management
      // @supabase/ssr's createBrowserClient automatically handles localStorage persistence
      const supabase = createClient();

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: trimmedName,
            role,
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.user) {
        throw new Error("회원가입 중 오류가 발생했습니다.");
      }

      // Session is automatically stored in localStorage by @supabase/ssr
      // No need for manual setSession or resetClient calls

      // Basic signup successful, now show organization selection
      setUserId(data.user.id);
      setCurrentStep("organization");
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
          requested_role: role, // API expects requested_role, not role
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
      // Reopen dialog on error to allow user to retry
      setShowOrgSearch(true);
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
              {currentStep === "basic" ? "새 계정을 만드세요" : "조직을 선택하세요"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={currentStep} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="basic" disabled>
                1. 기본 정보
              </TabsTrigger>
              <TabsTrigger value="organization" disabled>
                2. 조직 선택
              </TabsTrigger>
            </TabsList>

            {/* Step 1: Basic Information */}
            <TabsContent value="basic" className="space-y-4">
              <form onSubmit={handleSignUp}>
                <div className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">이름</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="홍길동"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
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
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="role">직군</Label>
                    <Select
                      value={role}
                      onValueChange={(value: "nurse" | "doctor") => setRole(value)}
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
                    <Label htmlFor="password">비밀번호</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="repeat-password">비밀번호 확인</Label>
                    <Input
                      id="repeat-password"
                      type="password"
                      required
                      value={repeatPassword}
                      onChange={(e) => setRepeatPassword(e.target.value)}
                    />
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "계정 생성 중..." : "다음 단계"}
                  </Button>
                </div>
              </form>
            </TabsContent>

            {/* Step 2: Organization Selection */}
            <TabsContent value="organization" className="space-y-4">
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground text-center">
                  조직을 생성하거나 기존 조직에 가입하세요
                </div>

                <RadioGroup
                  value={organizationMode}
                  onValueChange={(value) => setOrganizationMode(value as OrganizationMode)}
                  className="space-y-3"
                >
                  <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                    <RadioGroupItem value="join" id="join" />
                    <div className="flex-1 space-y-1">
                      <Label
                        htmlFor="join"
                        className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        <UserPlus className="h-4 w-4" />
                        기존 조직 가입
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        이미 존재하는 조직을 검색하여 가입 요청을 보냅니다
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                    <RadioGroupItem value="create" id="create" />
                    <div className="flex-1 space-y-1">
                      <Label
                        htmlFor="create"
                        className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        <Building2 className="h-4 w-4" />
                        새 조직 생성
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        새로운 조직을 생성하고 관리자로 등록됩니다
                      </p>
                    </div>
                  </div>
                </RadioGroup>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setCurrentStep("basic");
                      setError(null);
                    }}
                  >
                    이전
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={() => {
                      if (organizationMode === "join") {
                        setShowOrgSearch(true);
                      } else {
                        setShowOrgCreate(true);
                      }
                    }}
                  >
                    {organizationMode === "join" ? (
                      <span className="flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        조직 검색
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        조직 생성
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-4 text-center text-sm">
            이미 계정이 있으신가요?{" "}
            <Link href="/auth/signin" className="underline underline-offset-4">
              로그인
            </Link>
          </div>
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