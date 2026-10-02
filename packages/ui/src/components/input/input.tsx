'use client'

import { type ComponentProps, type ReactNode, useId } from 'react'

import { cn } from '../../lib/cn'

export type InputProps = ComponentProps<'input'>

/** Styled text input. Prefer TextField, which also wires up the label and messages. */
export function Input({ className, type = 'text', ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        'border-border-input bg-surface text-fg h-10 w-full rounded-md border px-3 text-sm',
        'placeholder:text-fg-muted',
        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
        'aria-invalid:border-danger',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export interface TextFieldProps extends Omit<InputProps, 'id'> {
  /** Visible label. Always required: placeholders are not labels. */
  label: ReactNode
  /** Help text under the label, linked with aria-describedby. */
  description?: ReactNode
  /** Error message. When set, the input is marked aria-invalid and linked to the message. */
  error?: ReactNode
  /** Override the generated id, e.g. to point an external label at the input. */
  id?: string
}

export function TextField({
  label,
  description,
  error,
  id,
  required,
  className,
  'aria-describedby': ariaDescribedBy,
  ...props
}: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const descriptionId = `${inputId}-description`
  const errorId = `${inputId}-error`
  const hasError = Boolean(error)

  const describedBy =
    [ariaDescribedBy, description ? descriptionId : null, hasError ? errorId : null]
      .filter(Boolean)
      .join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-fg text-sm font-medium">
        {label}
        {/* Screen readers announce the native required state; the asterisk is visual only */}
        {required && (
          <span aria-hidden className="text-danger ms-0.5">
            *
          </span>
        )}
      </label>
      {description && (
        <p id={descriptionId} className="text-fg-muted text-sm">
          {description}
        </p>
      )}
      <Input
        id={inputId}
        required={required}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {hasError && (
        <p id={errorId} className="text-danger text-sm">
          {error}
        </p>
      )}
    </div>
  )
}
