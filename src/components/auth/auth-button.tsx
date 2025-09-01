import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/auth/signin">로그인</Link>
        </Button>
        <Button asChild size="sm" variant="default">
          <Link href="/auth/signup">회원가입</Link>
        </Button>
      </div>
    );
  }

  // Get user profile for additional info
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm">
        {profile?.name || user.email}
        {profile?.role === "admin" && " (관리자)"}
      </span>
      <LogoutButton />
    </div>
  );
}