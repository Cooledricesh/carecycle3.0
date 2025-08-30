import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUserProfile } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';

interface AppLayoutProps {
  children: ReactNode;
}

export default async function AppLayout({ children }: AppLayoutProps) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect('/auth/signin');
  }

  return <AppShell>{children}</AppShell>;
}