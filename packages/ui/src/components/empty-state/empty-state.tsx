import { type ComponentProps, type ReactNode } from 'react'

import { cn } from '../../lib/cn'

export interface EmptyStateProps extends Omit<ComponentProps<'div'>, 'title'> {
  title: ReactNode
  description?: ReactNode
  /** Decorative icon; it is hidden from assistive technology. */
  icon?: ReactNode
  /** Usually a Button, e.g. "Save your first link". */
  action?: ReactNode
  /** Heading level that fits the surrounding page outline. */
  headingLevel?: 2 | 3 | 4
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  headingLevel = 2,
  className,
  ...props
}: EmptyStateProps) {
  const Heading = `h${String(headingLevel)}` as 'h2' | 'h3' | 'h4'

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 px-6 py-12 text-center',
        '[&_svg]:size-10',
        className
      )}
      {...props}
    >
      {icon && (
        <div aria-hidden className="text-fg-muted">
          {icon}
        </div>
      )}
      <Heading className="text-fg text-lg font-semibold">{title}</Heading>
      {description && <p className="text-fg-muted max-w-sm text-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
