import { afterEach, describe, expect, it, vi } from 'vitest'

import { dismissToast, getToasts, removeToast, subscribe, toast } from './toast-store'

afterEach(() => {
  for (const item of getToasts()) {
    removeToast(item.id)
  }
})

describe('toast store', () => {
  it('adds an open toast and returns a unique id', () => {
    const first = toast({ title: 'Link saved' })
    const second = toast({ title: 'Link deleted', variant: 'danger' })

    expect(first).not.toBe(second)
    expect(getToasts()).toEqual([
      { id: first, title: 'Link saved', open: true },
      { id: second, title: 'Link deleted', variant: 'danger', open: true },
    ])
  })

  it('closes a single toast by id', () => {
    const first = toast({ title: 'A' })
    const second = toast({ title: 'B' })

    dismissToast(first)

    expect(getToasts().map(({ id, open }) => ({ id, open }))).toEqual([
      { id: first, open: false },
      { id: second, open: true },
    ])
  })

  it('closes every toast when no id is given', () => {
    toast({ title: 'A' })
    toast({ title: 'B' })

    dismissToast()

    expect(getToasts().every((item) => !item.open)).toBe(true)
  })

  it('removes a toast from the list', () => {
    const id = toast({ title: 'A' })

    removeToast(id)

    expect(getToasts()).toEqual([])
  })

  it('returns a new array on every change so useSyncExternalStore re-renders', () => {
    const before = getToasts()
    toast({ title: 'A' })

    expect(getToasts()).not.toBe(before)
  })

  it('notifies subscribers until they unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)

    const id = toast({ title: 'A' })
    dismissToast(id)
    unsubscribe()
    removeToast(id)

    expect(listener).toHaveBeenCalledTimes(2)
  })
})
