'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-react'
import { Slot } from 'radix-ui'
import { type ComponentProps, type MouseEvent, type ReactElement } from 'react'

import { cn } from '../../lib/cn'

export const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap',
    'motion-safe:transition-colors',
    'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    'aria-disabled:cursor-not-allowed aria-disabled:opacity-70',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-fg hover:bg-primary-hover',
        secondary: 'border-border-input bg-surface text-fg hover:bg-surface-hover border',
        ghost: 'text-fg hover:bg-surface-hover',
        danger: 'bg-danger text-danger-fg hover:bg-danger-hover',
      },
      size: {
        sm: 'h-8 px-3 text-sm [&_svg]:size-4',
        md: 'h-10 px-4 text-sm [&_svg]:size-4',
        lg: 'h-12 px-6 text-base [&_svg]:size-5',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

type ButtonVariantProps = VariantProps<typeof buttonVariants>

export interface ButtonProps extends ComponentProps<'button'>, ButtonVariantProps {
  /** Render the child element (e.g. a link) with button styles instead of a `<button>`. */
  asChild?: boolean
  /**
   * Shows a spinner and ignores clicks. The button stays focusable (aria-disabled instead of
   * disabled) so keyboard focus is not lost while an action is running.
   */
  loading?: boolean
}

export function Button({
  asChild = false,
  loading = false,
  variant,
  size,
  className,
  type,
  children,
  onClick,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className)

  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    )
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (loading) {
      event.preventDefault()
      return
    }
    onClick?.(event)
  }

  return (
    <button
      // Native default is "submit", which silently submits surrounding forms
      type={type ?? 'button'}
      className={classes}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={handleClick}
      {...props}
    >
      {loading && <LoaderCircle aria-hidden className="motion-safe:animate-spin" />}
      {children}
    </button>
  )
}

export interface IconButtonProps extends Omit<ButtonProps, 'asChild' | 'children'> {
  /** Required: an icon has no text, so this is the button's accessible name. */
  'aria-label': string
  /** A single icon element, e.g. `<Trash2 />` from lucide-react. */
  children: ReactElement
}

const iconSizes: Record<NonNullable<ButtonVariantProps['size']>, string> = {
  sm: 'w-8 px-0',
  md: 'w-10 px-0',
  lg: 'w-12 px-0',
}

export function IconButton({ size, className, children, loading, ...props }: IconButtonProps) {
  return (
    <Button
      size={size}
      loading={loading}
      className={cn(iconSizes[size ?? 'md'], className)}
      {...props}
    >
      {/* The spinner replaces the icon instead of sitting next to it */}
      {loading ? null : children}
    </Button>
  )
}
