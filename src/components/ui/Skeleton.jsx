import React from 'react';
import { cn } from '@/lib/utils';

export const Skeleton = ({ className, ...props }) => (
  <div
    aria-hidden="true"
    className={cn('animate-pulse rounded-md bg-muted/60', className)}
    {...props}
  />
);

export default Skeleton;
