export type ToastVariant = 'default' | 'success' | 'danger'

export interface ToastAction {
  label: string
  /** Required by Radix: tells screen reader users how to do the same thing without the toast. */
  altText: string
  onClick: () => void
}

export interface ToastOptions {
  title: string
  description?: string
  variant?: ToastVariant
  /** E.g. "Undo" after an optimistic delete. */
  action?: ToastAction
  /** Milliseconds before auto-dismiss. Paused while hovered or focused. */
  duration?: number
}

export interface ToastItem extends ToastOptions {
  id: string
  open: boolean
}

type Listener = () => void

let toasts: ToastItem[] = []
let nextId = 0
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

/** Shows a toast and returns its id. Works outside React (e.g. in mutation callbacks). */
export function toast(options: ToastOptions): string {
  nextId += 1
  const id = String(nextId)
  toasts = [...toasts, { ...options, id, open: true }]
  emit()
  return id
}

/** Closes one toast, or all of them when no id is given. */
export function dismissToast(id?: string) {
  toasts = toasts.map((item) =>
    id === undefined || item.id === id ? { ...item, open: false } : item
  )
  emit()
}

/** Removes a closed toast from the list (called once its close transition is done). */
export function removeToast(id: string) {
  toasts = toasts.filter((item) => item.id !== id)
  emit()
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getToasts(): ToastItem[] {
  return toasts
}
