"use client";

import { useState } from "react";
import { useAuth } from "@/providers/auth-provider-simple";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Phone, Building, Shield, Save, Key } from "lucide-react";
import { Profile } from "@/lib/database.types";
import { useIsMobile } from "@/hooks/useIsMobile";
import { touchTarget, responsiveText, responsivePadding } from "@/lib/utils";

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const { toast } = useToast();
  const supabase = createClient();
  const isMobile = useIsMobile();
  
  useEffect(() => {
    if (user) {
      // Fetch profile data
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data, error }) => {
          if (data) setProfile(data);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    care_type: "",
    role: "nurse",
  });

  // Update form data when profile is loaded or updated
  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        care_type: profile.care_type || "",
        role: profile.role || "nurse",
      });
    }
  }, [profile]);
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!profile) {
        throw new Error("프로필 정보를 찾을 수 없습니다");
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          name: formData.name,
          phone: formData.phone,
          care_type: formData.care_type,
        })
        .eq("id", profile.id);
      
      if (error) throw error;

      // Refresh profile data
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();
      if (updatedProfile) setProfile(updatedProfile);
      
      toast({
        title: "프로필 업데이트 완료",
        description: "프로필 정보가 성공적으로 업데이트되었습니다.",
      });
    } catch (error) {
      console.error("Profile update error:", error);
      toast({
        title: "업데이트 실패",
        description: "프로필 업데이트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "비밀번호 불일치",
        description: "새 비밀번호와 확인 비밀번호가 일치하지 않습니다.",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "비밀번호가 너무 짧습니다",
        description: "비밀번호는 최소 6자 이상이어야 합니다.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      toast({
        title: "비밀번호 변경 완료",
        description: "비밀번호가 성공적으로 변경되었습니다.",
      });

      // Reset password form
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error("Password change error:", error);
      toast({
        title: "비밀번호 변경 실패",
        description: "비밀번호 변경 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">프로필 정보를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className={`${responsivePadding.page} space-y-4 sm:space-y-6`}>
      {/* Header */}
      <div>
        <h1 className={`${responsiveText.h1} font-bold`}>프로필 설정</h1>
        <p className="text-xs sm:text-base text-gray-500 mt-1">
          계정 정보와 보안 설정을 관리합니다
        </p>
      </div>

      {/* Profile Overview Card */}
      <Card>
        <CardContent className={`pt-6 ${isMobile ? 'px-4' : ''}`}>
          <div className={`flex ${isMobile ? 'flex-col items-center text-center' : 'items-center'} ${isMobile ? 'space-y-3' : 'space-x-4'}`}>
            <Avatar className={`${isMobile ? 'h-16 w-16' : 'h-20 w-20'}`}>
              <AvatarFallback className={`${isMobile ? 'text-xl' : 'text-2xl'}`}>
                {profile.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h2 className={`${responsiveText.h2} font-semibold`}>{profile.name}</h2>
              <p className="text-xs sm:text-base text-gray-500">{profile.email}</p>
              <div className={`flex ${isMobile ? 'justify-center' : ''} items-center gap-2`}>
                <Shield className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                <span className="text-xs sm:text-sm text-gray-600">
                  {profile.role === "admin" ? "관리자" :
                   profile.role === "doctor" ? "의사" :
                   profile.role === "nurse" ? "간호사" : "스텝"}
                </span>
                {profile.care_type && (
                  <>
                    <span className="text-gray-400">•</span>
                    <span className="text-xs sm:text-sm text-gray-600">
                      {profile.care_type}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Profile and Security */}
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className={`${isMobile ? 'grid w-full grid-cols-2' : ''}`}>
          <TabsTrigger value="profile" className="text-xs sm:text-sm">프로필 정보</TabsTrigger>
          <TabsTrigger value="security" className="text-xs sm:text-sm">보안 설정</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader className={isMobile ? 'p-4' : ''}>
              <CardTitle className={responsiveText.h3}>기본 정보</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                프로필 정보를 수정하고 업데이트할 수 있습니다
              </CardDescription>
            </CardHeader>
            <CardContent className={isMobile ? 'p-4 pt-0' : ''}>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
                  <div className="space-y-2">
                    <Label htmlFor="name">이름</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className={`pl-10 ${touchTarget.input}`}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">이메일</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        className={`pl-10 ${touchTarget.input}`}
                        disabled
                        title="이메일은 변경할 수 없습니다"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">전화번호</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        className={`pl-10 ${touchTarget.input}`}
                        placeholder="010-0000-0000"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="care_type">진료 유형</Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="care_type"
                        value={formData.care_type}
                        onChange={(e) =>
                          setFormData({ ...formData, care_type: e.target.value })
                        }
                        className={`pl-10 ${touchTarget.input}`}
                        placeholder="진료 유형"
                      />
                    </div>
                  </div>
                </div>

                <div className={`flex ${isMobile ? 'w-full' : 'justify-end'}`}>
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className={`${isMobile ? 'w-full' : ''} ${touchTarget.button}`}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isLoading ? "저장 중..." : "변경사항 저장"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>비밀번호 변경</CardTitle>
              <CardDescription>
                계정 보안을 위해 주기적으로 비밀번호를 변경해주세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">새 비밀번호</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="newPassword"
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) =>
                          setPasswordData({
                            ...passwordData,
                            newPassword: e.target.value,
                          })
                        }
                        className={`pl-10 ${touchTarget.input}`}
                        placeholder="최소 6자 이상"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">새 비밀번호 확인</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) =>
                          setPasswordData({
                            ...passwordData,
                            confirmPassword: e.target.value,
                          })
                        }
                        className={`pl-10 ${touchTarget.input}`}
                        placeholder="비밀번호 재입력"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={isLoading}>
                    <Key className="mr-2 h-4 w-4" />
                    {isLoading ? "변경 중..." : "비밀번호 변경"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}