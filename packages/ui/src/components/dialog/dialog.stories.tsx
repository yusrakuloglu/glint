import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test'

import { openModalA11y } from '../../test-utils/a11y'
import { Button } from '../button/button'
import { TextField } from '../input/input'

import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from './dialog'

interface DemoProps {
  onSave: () => void
}

function RenameCollectionDialog({ onSave }: DemoProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">Rename collection</Button>
      </DialogTrigger>
      <DialogContent
        title="Rename collection"
        description="The new name is visible to everyone you shared the collection with."
      >
        <TextField label="Name" defaultValue="Reading list" />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={onSave}>Save</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const meta = {
  title: 'Components/Dialog',
  component: RenameCollectionDialog,
  args: { onSave: fn() },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof RenameCollectionDialog>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Open: Story = {
  parameters: openModalA11y,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Rename collection' }))
    const dialog = await screen.findByRole('dialog', { name: 'Rename collection' })

    await expect(dialog).toHaveAccessibleDescription(
      'The new name is visible to everyone you shared the collection with.'
    )
  },
}

export const OpenDark: Story = {
  ...Open,
  globals: { theme: 'dark' },
}

export const FocusManagement: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Rename collection' })

    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    const dialog = await screen.findByRole('dialog')
    const dialogScope = within(dialog)

    // Focus starts on the first field, not on the close button
    await waitFor(() => expect(dialogScope.getByRole('textbox', { name: 'Name' })).toHaveFocus())

    // Tab cycles inside the dialog: Name → Cancel → Save → Close → back to Name
    await userEvent.tab()
    await expect(dialogScope.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await userEvent.tab()
    await expect(dialogScope.getByRole('button', { name: 'Save' })).toHaveFocus()
    await userEvent.tab()
    await expect(dialogScope.getByRole('button', { name: 'Close' })).toHaveFocus()
    await userEvent.tab()
    await expect(dialogScope.getByRole('textbox', { name: 'Name' })).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await expect(trigger).toHaveFocus()
  },
}

export const SaveAction: Story = {
  play: async ({ args, canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Rename collection' })

    await userEvent.click(trigger)
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Save' })
    )

    await expect(args.onSave).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await expect(trigger).toHaveFocus()
  },
}

export const CloseButton: Story = {
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Rename collection' }))
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Close' })
    )

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await expect(args.onSave).not.toHaveBeenCalled()
  },
}

export const WithoutDescription: Story = {
  parameters: openModalA11y,
  render: () => (
    <Dialog defaultOpen>
      <DialogContent title="Keyboard shortcuts">
        <p className="text-fg text-sm">Press ⌘K to search.</p>
      </DialogContent>
    </Dialog>
  ),
  play: async () => {
    const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })

    await expect(dialog).not.toHaveAttribute('aria-describedby')
  },
}
