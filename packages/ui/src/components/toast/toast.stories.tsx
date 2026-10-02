import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'

import { Button } from '../button/button'

import { dismissToast, toast, type ToastOptions } from './toast-store'
import { Toaster } from './toaster'

function ToastDemo(options: ToastOptions) {
  return (
    <>
      <Button
        onClick={() => {
          toast(options)
        }}
      >
        Show toast
      </Button>
      <Toaster />
    </>
  )
}

const meta = {
  title: 'Components/Toast',
  component: ToastDemo,
  args: {
    title: 'Link saved',
    description: 'It will be summarized in a moment.',
    // Long enough that toasts do not disappear mid-test
    duration: 60_000,
  },
  beforeEach: () => {
    dismissToast()
  },
} satisfies Meta<typeof ToastDemo>

export default meta

type Story = StoryObj<typeof meta>

async function showToast(canvasElement: HTMLElement) {
  await userEvent.click(within(canvasElement).getByRole('button', { name: 'Show toast' }))
  return screen.findByRole('region', { name: /Notifications/ })
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const region = await showToast(canvasElement)

    await expect(await within(region).findByText('Link saved')).toBeVisible()
  },
}

export const Success: Story = {
  args: { variant: 'success', title: 'Collection shared' },
  play: async ({ canvasElement }) => {
    await showToast(canvasElement)
  },
}

export const Danger: Story = {
  args: { variant: 'danger', title: 'Could not save link', description: 'Check your connection.' },
  play: async ({ canvasElement }) => {
    await showToast(canvasElement)
  },
}

export const DangerDark: Story = {
  ...Danger,
  globals: { theme: 'dark' },
}

export const UndoAction: Story = {
  args: {
    title: 'Link deleted',
    description: undefined,
    action: { label: 'Undo', altText: 'Restore it from the trash', onClick: fn() },
  },
  play: async ({ args, canvasElement }) => {
    const region = await showToast(canvasElement)

    await userEvent.click(await within(region).findByRole('button', { name: 'Undo' }))

    await expect(args.action?.onClick).toHaveBeenCalledOnce()
    await waitFor(() => expect(within(region).queryByText('Link deleted')).not.toBeInTheDocument())
  },
}

export const KeyboardHotkey: Story = {
  args: {
    title: 'Link deleted',
    description: undefined,
    action: { label: 'Undo', altText: 'Restore it from the trash', onClick: fn() },
  },
  play: async ({ args, canvasElement }) => {
    const region = await showToast(canvasElement)
    await within(region).findByText('Link deleted')

    // F8 jumps to the toast region from anywhere on the page
    await userEvent.keyboard('[F8]')
    await waitFor(() => expect(region.contains(document.activeElement)).toBe(true))

    // The toast itself is focusable so screen readers read it, then its buttons follow
    await userEvent.tab()
    await expect(document.activeElement).toHaveTextContent('Link deleted')
    await userEvent.tab()
    await expect(within(region).getByRole('button', { name: 'Undo' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(args.action?.onClick).toHaveBeenCalledOnce()
  },
}

export const Dismiss: Story = {
  play: async ({ canvasElement }) => {
    const region = await showToast(canvasElement)

    await userEvent.click(await within(region).findByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(within(region).queryByText('Link saved')).not.toBeInTheDocument())
  },
}

export const AutoDismiss: Story = {
  args: { duration: 300 },
  play: async ({ canvasElement }) => {
    const region = await showToast(canvasElement)
    await within(region).findByText('Link saved')

    // Move the pointer away so hovering the button does not pause the timer
    await userEvent.unhover(within(canvasElement).getByRole('button', { name: 'Show toast' }))
    await waitFor(() => expect(within(region).queryByText('Link saved')).not.toBeInTheDocument(), {
      timeout: 3000,
    })
  },
}
