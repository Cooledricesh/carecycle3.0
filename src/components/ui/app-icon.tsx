'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface AppIconProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  priority?: boolean;
}

const sizeMap = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
  '2xl': 96,
};

export function AppIcon({ size = 'md', className, priority = false }: AppIconProps) {
  const dimensions = sizeMap[size];

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <Image
        src="/icon.png"
        alt="케어스케줄러 로고"
        width={dimensions}
        height={dimensions}
        priority={priority}
        className="rounded-lg object-contain"
      />
    </div>
  );
}