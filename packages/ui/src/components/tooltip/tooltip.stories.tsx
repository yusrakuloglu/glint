import type { Meta, StoryObj } from '@storybook/react-vite'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { expect, screen, userEvent, waitFor, within } from 'storybook/test'

import { PortalContainerProvider } from '../../lib/portal-container'
import { IconButton } from '../button/button'

import { Tooltip } from './tooltip'

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  args: {
    content: 'Delete link',
    children: (
      <IconButton aria-label="Delete link" variant="ghost">
        <Trash2 aria-hidden />
      </IconButton>
    ),
  },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Tooltip>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const KeyboardFocus: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Delete link' })

    await userEvent.tab()
    await expect(trigger).toHaveFocus()
    const tooltip = await screen.findByRole('tooltip')
    await expect(tooltip).toHaveTextContent('Delete link')
    await expect(trigger).toHaveAccessibleDescription('Delete link')

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
    // Escape closes the tooltip without moving focus
    await expect(trigger).toHaveFocus()
  },
}

export const Hover: Story = {
  args: { delayDuration: 0 },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Delete link' })

    await userEvent.hover(trigger)
    await expect(await screen.findByRole('tooltip')).toHaveTextContent('Delete link')
    await userEvent.unhover(trigger)
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
  },
}

export const OpenDark: Story = {
  globals: { theme: 'dark' },
  play: async () => {
    await userEvent.tab()
    await expect(await screen.findByRole('tooltip')).toBeInTheDocument()
  },
}

/** Overlays follow PortalContainerProvider, e.g. into the extension's shadow root. */
function ShadowRootDemo() {
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null)

  return (
    <div
      data-testid="shadow-host"
      ref={(host) => {
        if (host && !host.shadowRoot) {
          setShadowRoot(host.attachShadow({ mode: 'open' }))
        }
      }}
    >
      {shadowRoot &&
        createPortal(
          <PortalContainerProvider container={shadowRoot}>
            <Tooltip content="Delete link">
              <button type="button">Delete</button>
            </Tooltip>
          </PortalContainerProvider>,
          shadowRoot
        )}
    </div>
  )
}

export const InShadowRoot: Story = {
  render: () => <ShadowRootDemo />,
  // Shadow DOM content has no Tailwind styles in this demo; axe cannot judge it meaningfully
  parameters: { a11y: { test: 'off' } },
  play: async ({ canvasElement }) => {
    const host = within(canvasElement).getByTestId('shadow-host')
    const shadowRoot = await waitFor(() => {
      if (!host.shadowRoot?.querySelector('button')) throw new Error('shadow root not ready')
      return host.shadowRoot
    })

    // user-event's tab() does not traverse into shadow roots, so focus the trigger directly
    shadowRoot.querySelector('button')?.focus()
    await waitFor(() => expect(shadowRoot.querySelector('[role="tooltip"]')).not.toBeNull())
    // Nothing leaked to document.body
    await expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
  },
}
