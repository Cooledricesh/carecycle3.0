import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUserProfile } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';
import { RealtimeProvider } from '@/components/dashboard/realtime-provider';

interface AppLayoutProps {
  children: ReactNode;
}

export default async function AppLayout({ children }: AppLayoutProps) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect('/auth/signin');
  }

  return (
    <RealtimeProvider>
      <AppShell>{children}</AppShell>
    </RealtimeProvider>
  );
}