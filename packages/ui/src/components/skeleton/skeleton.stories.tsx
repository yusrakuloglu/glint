import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { Skeleton } from './skeleton'

const meta = {
  title: 'Components/Skeleton',
  component: Skeleton,
  args: { className: 'h-4 w-48' },
} satisfies Meta<typeof Skeleton>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[aria-hidden]')).toBeInTheDocument()
  },
}

/** Recommended pattern: the region is aria-busy and has a text alternative for screen readers. */
export const LinkCardLoading: Story = {
  render: () => (
    <section
      aria-busy="true"
      aria-labelledby="links-heading"
      className="flex max-w-md flex-col gap-3"
    >
      <h2 id="links-heading" className="text-fg text-lg font-semibold">
        Saved links
      </h2>
      <p className="sr-only">Loading saved links</p>
      {[0, 1, 2].map((item) => (
        <div key={item} className="bg-surface border-border flex gap-3 rounded-lg border p-4">
          <Skeleton className="size-12 shrink-0" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </section>
  ),
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole('region', { name: 'Saved links' })

    await expect(region).toHaveAttribute('aria-busy', 'true')
    await expect(within(region).getByText('Loading saved links')).toBeInTheDocument()
  },
}

export const LinkCardLoadingDark: Story = {
  ...LinkCardLoading,
  globals: { theme: 'dark' },
}
