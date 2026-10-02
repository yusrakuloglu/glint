import { type ComponentProps } from 'react'

import { cn } from '../../lib/cn'

export type SkeletonProps = ComponentProps<'div'>

/**
 * Decorative loading placeholder, hidden from assistive technology. Mark the region that is
 * loading with aria-busy and give it a text alternative (see the stories).
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn('bg-surface-hover rounded-md motion-safe:animate-pulse', className)}
      {...props}
    />
  )
}
