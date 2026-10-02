import type { Meta, StoryObj } from '@storybook/react-vite'
import { BookmarkPlus, SearchX } from 'lucide-react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { Button } from '../button/button'

import { EmptyState } from './empty-state'

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState,
  args: {
    icon: <BookmarkPlus />,
    title: 'No saved links yet',
    description: 'Save a page with the browser extension and it will show up here.',
  },
} satisfies Meta<typeof EmptyState>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByRole('heading', { level: 2, name: 'No saved links yet' })
    ).toBeVisible()
  },
}

export const WithAction: Story = {
  render: (args) => {
    const onSave = fn()
    return <EmptyState {...args} action={<Button onClick={onSave}>Save your first link</Button>} />
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Save your first link' })

    await userEvent.tab()
    await expect(button).toHaveFocus()
  },
}

export const NoSearchResults: Story = {
  args: {
    icon: <SearchX />,
    title: 'No results',
    description: 'Try a different search or clear the filters.',
    headingLevel: 3,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { level: 3 })).toHaveTextContent(
      'No results'
    )
  },
}

export const Dark: Story = {
  ...WithAction,
  globals: { theme: 'dark' },
}
