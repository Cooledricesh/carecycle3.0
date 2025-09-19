'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

const sizeMap = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
  '2xl': 96,
} as const;

type AppIconSize = keyof typeof sizeMap;

interface AppIconProps {
  size?: AppIconSize;
  className?: string;
  priority?: boolean;
}

function isValidSize(size: unknown): size is AppIconSize {
  return typeof size === 'string' && size in sizeMap;
}

export function AppIcon({ size = 'md', className, priority = false }: AppIconProps) {
  const validSize = isValidSize(size) ? size : 'md';
  const dimensions = sizeMap[validSize];

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