import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/server";
import AdminNav from "@/components/admin/admin-nav";

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/auth/signin");
  }

  // Only admins can access admin routes
  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <AdminNav profile={profile} />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}