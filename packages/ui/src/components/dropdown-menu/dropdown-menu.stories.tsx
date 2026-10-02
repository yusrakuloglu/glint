import type { Meta, StoryObj } from '@storybook/react-vite'
import { Archive, ChevronDown, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'

import { openModalA11y } from '../../test-utils/a11y'
import { Button } from '../button/button'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from './dropdown-menu'

interface DemoProps {
  onEdit: () => void
  onDelete: () => void
}

function LinkActionsMenu({ onEdit, onDelete }: DemoProps) {
  const [showSummary, setShowSummary] = useState(true)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">
          Actions
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Link</DropdownMenuLabel>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil aria-hidden />
          Edit
          <DropdownMenuShortcut>E</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Archive aria-hidden />
          Archive
        </DropdownMenuItem>
        <DropdownMenuCheckboxItem checked={showSummary} onCheckedChange={setShowSummary}>
          Show summary
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="danger" onSelect={onDelete}>
          <Trash2 aria-hidden />
          Delete
          <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const meta = {
  title: 'Components/DropdownMenu',
  component: LinkActionsMenu,
  args: { onEdit: fn(), onDelete: fn() },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof LinkActionsMenu>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Open: Story = {
  parameters: openModalA11y,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Actions' }))
    await expect(await screen.findByRole('menu')).toBeVisible()
  },
}

export const OpenDark: Story = {
  ...Open,
  globals: { theme: 'dark' },
}

export const KeyboardNavigation: Story = {
  play: async ({ args, canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Actions' })

    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    const menu = await screen.findByRole('menu')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => expect(within(menu).getByRole('menuitem', { name: /Edit/ })).toHaveFocus())

    // Disabled items are skipped
    await userEvent.keyboard('{ArrowDown}')
    await expect(within(menu).getByRole('menuitemcheckbox', { name: 'Show summary' })).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}{Enter}')
    await expect(args.onDelete).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    await expect(trigger).toHaveFocus()
  },
}

export const EscapeReturnsFocus: Story = {
  play: async ({ args, canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Actions' })

    await userEvent.tab()
    await userEvent.keyboard('{ArrowDown}')
    await screen.findByRole('menu')

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    await expect(trigger).toHaveFocus()
    await expect(args.onEdit).not.toHaveBeenCalled()
  },
}

export const Typeahead: Story = {
  play: async ({ args }) => {
    await userEvent.tab()
    await userEvent.keyboard(' ')
    const menu = await screen.findByRole('menu')

    await userEvent.keyboard('d')
    await expect(within(menu).getByRole('menuitem', { name: /Delete/ })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onDelete).toHaveBeenCalledOnce()
  },
}

export const CheckboxItem: Story = {
  parameters: openModalA11y,
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Actions' })

    await userEvent.click(trigger)
    const item = within(await screen.findByRole('menu')).getByRole('menuitemcheckbox', {
      name: 'Show summary',
    })
    await expect(item).toHaveAttribute('aria-checked', 'true')

    await userEvent.click(item)
    await userEvent.click(trigger)
    await expect(
      within(await screen.findByRole('menu')).getByRole('menuitemcheckbox', {
        name: 'Show summary',
      })
    ).toHaveAttribute('aria-checked', 'false')
  },
}
