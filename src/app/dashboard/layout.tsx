import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/supabase/server";
import DashboardNav from "@/components/dashboard/dashboard-nav";
import { RealtimeProvider } from "@/components/dashboard/realtime-provider";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/auth/signin");
  }

  // Redirect admin users to admin dashboard
  if (profile.role === "admin") {
    redirect("/admin");
  }

  return (
    <RealtimeProvider>
      <div className="flex h-screen bg-gray-100">
        <DashboardNav profile={profile} />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </RealtimeProvider>
  );
}