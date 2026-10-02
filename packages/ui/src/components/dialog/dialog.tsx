'use client'

import { X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { type ComponentProps, type ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { usePortalContainer } from '../../lib/portal-container'
import { IconButton } from '../button/button'

/*
 * Keyboard (from Radix): focus moves into the dialog on open and is trapped there, Escape
 * closes it, and focus returns to the element that opened it.
 */

export const Dialog = DialogPrimitive.Root

/** Use with asChild and a Button. */
export const DialogTrigger = DialogPrimitive.Trigger

/** Closes the dialog; use with asChild around a Button (e.g. "Cancel"). */
export const DialogClose = DialogPrimitive.Close

export interface DialogContentProps extends Omit<
  ComponentProps<typeof DialogPrimitive.Content>,
  'title'
> {
  /** Required: becomes the dialog's accessible name. */
  title: ReactNode
  /** Optional: becomes the dialog's accessible description. */
  description?: ReactNode
  /** Accessible name of the close button. */
  closeLabel?: string
}

export function DialogContent({
  title,
  description,
  closeLabel = 'Close',
  className,
  children,
  ...props
}: DialogContentProps) {
  const container = usePortalContainer()

  return (
    <DialogPrimitive.Portal container={container}>
      <DialogPrimitive.Overlay className="bg-overlay fixed inset-0 z-50" />
      <DialogPrimitive.Content
        // Without a description, opt out explicitly so Radix does not warn about a missing one
        {...(description ? {} : { 'aria-describedby': undefined })}
        className={cn(
          'bg-surface-raised border-border fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border p-6 shadow-lg',
          'focus-visible:outline-none',
          className
        )}
        {...props}
      >
        <div className="flex flex-col gap-1.5 pe-8">
          <DialogPrimitive.Title className="text-fg text-lg font-semibold">
            {title}
          </DialogPrimitive.Title>
          {description && (
            <DialogPrimitive.Description className="text-fg-muted text-sm">
              {description}
            </DialogPrimitive.Description>
          )}
        </div>
        {children}
        {/* Last in DOM order so initial focus lands on the content, not on "close" */}
        <DialogPrimitive.Close asChild>
          <IconButton
            aria-label={closeLabel}
            variant="ghost"
            size="sm"
            className="absolute end-4 top-4"
          >
            <X aria-hidden />
          </IconButton>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

/** Right-aligned action row; on narrow screens buttons stack with the primary action on top. */
export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}
