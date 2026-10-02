'use client'

import { Tooltip as TooltipPrimitive } from 'radix-ui'
import { type ReactElement, type ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { usePortalContainer } from '../../lib/portal-container'

export interface TooltipProps {
  /** Supplementary text. Never put essential information only in a tooltip. */
  content: ReactNode
  /** A single focusable element, e.g. an IconButton. */
  children: ReactElement
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Hover delay in ms. Keyboard focus opens the tooltip immediately. */
  delayDuration?: number
  className?: string
}

/**
 * Shows a label on hover and keyboard focus; Escape closes it. Each tooltip has its own
 * provider, so no app-level setup is needed.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  delayDuration = 300,
  className,
}: TooltipProps) {
  const container = usePortalContainer()

  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal container={container}>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            className={cn(
              'bg-fg text-bg z-50 max-w-xs rounded-md px-2 py-1 text-xs font-medium',
              className
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-fg" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
