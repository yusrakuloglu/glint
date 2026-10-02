import { describe, expect, it } from 'vitest'

import { cn } from './cn'

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('drops falsy values', () => {
    expect(cn('px-2', false, null, undefined, '', 'py-1')).toBe('px-2 py-1')
  })

  it('supports conditional objects and arrays', () => {
    expect(cn(['px-2', { 'py-1': true, hidden: false }])).toBe('px-2 py-1')
  })

  it('lets the later Tailwind utility win on conflict', () => {
    expect(cn('px-2 text-sm', 'px-4')).toBe('text-sm px-4')
  })

  it('keeps utilities that target different variants', () => {
    expect(cn('bg-surface', 'dark:bg-surface-raised')).toBe('bg-surface dark:bg-surface-raised')
  })
})
