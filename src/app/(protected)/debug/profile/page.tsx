'use client';

import { useAuth } from '@/providers/auth-provider-simple';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/database.types';
import { useToast } from '@/hooks/use-toast';
import { eventManager } from '@/lib/events/schedule-event-manager';
import { useQueryClient } from '@tanstack/react-query';

export default function DebugProfilePage() {
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [creating, setCreating] = useState(false);
  const supabase = createClient();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (user) {
      // Fetch profile data
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) setProfile(data);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const createProfile = async () => {
    if (!user) {
      toast({
        title: '오류',
        description: '로그인이 필요합니다.',
        variant: 'destructive'
      });
      return;
    }

    setCreating(true);
    try {
      // TODO: Fix TypeScript types for profiles table
      const { data, error } = await (supabase as any)
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email!,
          name: user.email!.split('@')[0],
          role: 'nurse',
          approval_status: 'approved',
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: '성공',
        description: '프로필이 생성되었습니다.',
      });

      eventManager.emitProfileChange();
      queryClient.invalidateQueries({ queryKey: ['profile'] });

      setTimeout(() => {
        setProfile(data);
      }, 500);
    } catch (error) {
      console.error('Profile creation error:', error);
      toast({
        title: '오류',
        description: '프로필 생성에 실패했습니다.',
        variant: 'destructive'
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">디버그: 프로필 상태</h1>

      <Card>
        <CardHeader>
          <CardTitle>인증 상태</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2">
            <div>
              <dt className="font-semibold">Loading:</dt>
              <dd>{loading ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="font-semibold">Ready:</dt>
              <dd>{!loading ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>사용자 정보</CardTitle>
        </CardHeader>
        <CardContent>
          {user ? (
            <dl className="space-y-2">
              <div>
                <dt className="font-semibold">ID:</dt>
                <dd className="font-mono text-sm">{user.id}</dd>
              </div>
              <div>
                <dt className="font-semibold">Email:</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt className="font-semibold">Created At:</dt>
                <dd>{new Date(user.created_at).toLocaleString()}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-gray-500">로그인되지 않음</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>프로필 정보</CardTitle>
        </CardHeader>
        <CardContent>
          {profile ? (
            <dl className="space-y-2">
              <div>
                <dt className="font-semibold">Name:</dt>
                <dd>{profile.name}</dd>
              </div>
              <div>
                <dt className="font-semibold">Role:</dt>
                <dd>{profile.role}</dd>
              </div>
              <div>
                <dt className="font-semibold">Department ID:</dt>
                <dd className="font-mono text-sm">{profile.department_id || 'Not set'}</dd>
              </div>
              <div>
                <dt className="font-semibold">Approval Status:</dt>
                <dd>{profile.approval_status}</dd>
              </div>
              <div>
                <dt className="font-semibold">Active:</dt>
                <dd>{profile.is_active ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          ) : (
            <div className="space-y-4">
              <p className="text-red-500">프로필이 없습니다!</p>
              {user && (
                <Button 
                  onClick={createProfile}
                  disabled={creating}
                >
                  {creating ? '생성 중...' : '프로필 생성'}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}