'use client'

import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { Toast as ToastPrimitive } from 'radix-ui'
import { useSyncExternalStore } from 'react'

import { Button, IconButton } from '../button/button'

import { getToasts, removeToast, subscribe, type ToastItem } from './toast-store'

const DEFAULT_DURATION = 5000
const EMPTY: ToastItem[] = []

export interface ToasterProps {
  /** Accessible label of the toast region; {hotkey} is replaced with the shortcut (F8). */
  label?: string
  /** Accessible name of each toast's dismiss button. */
  dismissLabel?: string
}

/**
 * Renders toasts created with toast(). Place it once, where the toasts should live: at the app
 * root on the web, inside the shadow root in the extension. F8 moves focus to the toast region.
 */
export function Toaster({
  label = 'Notifications ({hotkey})',
  dismissLabel = 'Dismiss',
}: ToasterProps) {
  // Server snapshot is empty: toasts only exist on the client
  const toasts = useSyncExternalStore(subscribe, getToasts, () => EMPTY)

  return (
    <ToastPrimitive.Provider duration={DEFAULT_DURATION} label={label}>
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} dismissLabel={dismissLabel} />
      ))}
      <ToastPrimitive.Viewport className="fixed bottom-0 end-0 z-50 flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
    </ToastPrimitive.Provider>
  )
}

function ToastCard({ item, dismissLabel }: { item: ToastItem; dismissLabel: string }) {
  const { id, title, description, variant = 'default', action, duration, open } = item

  return (
    <ToastPrimitive.Root
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) removeToast(id)
      }}
      duration={duration}
      // Errors interrupt (assertive); everything else waits for a pause (polite)
      type={variant === 'danger' ? 'foreground' : 'background'}
      className="bg-surface-raised border-border flex items-start gap-3 rounded-lg border p-4 shadow-lg"
    >
      {variant === 'success' && (
        <CircleCheck aria-hidden className="text-success size-5 shrink-0" />
      )}
      {variant === 'danger' && <CircleAlert aria-hidden className="text-danger size-5 shrink-0" />}
      <div className="flex flex-1 flex-col gap-1">
        <ToastPrimitive.Title className="text-fg text-sm font-medium">{title}</ToastPrimitive.Title>
        {description && (
          <ToastPrimitive.Description className="text-fg-muted text-sm">
            {description}
          </ToastPrimitive.Description>
        )}
      </div>
      {action && (
        <ToastPrimitive.Action altText={action.altText} asChild>
          <Button variant="secondary" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        </ToastPrimitive.Action>
      )}
      <ToastPrimitive.Close asChild>
        <IconButton aria-label={dismissLabel} variant="ghost" size="sm" className="-me-1 -mt-1">
          <X aria-hidden />
        </IconButton>
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  )
}
