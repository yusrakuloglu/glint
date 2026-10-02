import type { Meta, StoryObj } from '@storybook/react-vite'

const surfaces = ['bg', 'surface', 'surface-raised'] as const

const textTokens = [
  { name: 'fg', className: 'text-fg' },
  { name: 'fg-muted', className: 'text-fg-muted' },
  { name: 'primary', className: 'text-primary' },
  { name: 'danger', className: 'text-danger' },
  { name: 'success', className: 'text-success' },
  { name: 'warning', className: 'text-warning' },
] as const

const surfaceClass: Record<(typeof surfaces)[number], string> = {
  bg: 'bg-bg',
  surface: 'bg-surface',
  'surface-raised': 'bg-surface-raised',
}

const actions = [
  { name: 'primary', className: 'bg-primary text-primary-fg' },
  { name: 'primary-hover', className: 'bg-primary-hover text-primary-fg' },
  { name: 'danger', className: 'bg-danger text-danger-fg' },
  { name: 'danger-hover', className: 'bg-danger-hover text-danger-fg' },
] as const

/** Semantic color tokens rendered on each surface; axe checks every pair in the active theme. */
function ColorTokens() {
  return (
    <div className="flex flex-col gap-6 font-sans">
      <section aria-labelledby="text-on-surfaces" className="flex flex-col gap-3">
        <h2 id="text-on-surfaces" className="text-fg text-lg font-semibold">
          Text on surfaces
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {surfaces.map((surface) => (
            <div
              key={surface}
              className={`${surfaceClass[surface]} border-border flex flex-col gap-1 rounded-lg border p-4`}
            >
              <p className="text-fg-muted text-xs">{surface}</p>
              {textTokens.map((token) => (
                <p key={token.name} className={token.className}>
                  {token.name}
                </p>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="actions" className="flex flex-col gap-3">
        <h2 id="actions" className="text-fg text-lg font-semibold">
          Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          {actions.map((action) => (
            <span key={action.name} className={`${action.className} rounded-md px-3 py-2`}>
              {action.name}
            </span>
          ))}
        </div>
      </section>

      <section aria-labelledby="lines" className="flex flex-col gap-3">
        <h2 id="lines" className="text-fg text-lg font-semibold">
          Lines
        </h2>
        <div className="flex flex-wrap gap-3">
          <span className="border-border text-fg rounded-md border px-3 py-2">border</span>
          <span className="border-border-input text-fg rounded-md border px-3 py-2">
            border-input
          </span>
          <span className="ring-ring text-fg rounded-md px-3 py-2 ring-2">ring</span>
        </div>
      </section>
    </div>
  )
}

const meta = {
  title: 'Foundations/Colors',
  component: ColorTokens,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ColorTokens>

export default meta

type Story = StoryObj<typeof meta>

export const Light: Story = {
  globals: { theme: 'light' },
}

export const Dark: Story = {
  globals: { theme: 'dark' },
}
