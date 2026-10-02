import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArrowRight, Plus, Trash2 } from 'lucide-react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { Button, IconButton } from './button'

const meta = {
  title: 'Components/Button',
  component: Button,
  args: {
    children: 'Save link',
    onClick: fn(),
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Button>

export default meta

type Story = StoryObj<typeof meta>

export const Primary: Story = {}

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-3">
      <Button {...args} variant="primary">
        Primary
      </Button>
      <Button {...args} variant="secondary">
        Secondary
      </Button>
      <Button {...args} variant="ghost">
        Ghost
      </Button>
      <Button {...args} variant="danger">
        Delete
      </Button>
    </div>
  ),
}

export const VariantsDark: Story = {
  ...Variants,
  globals: { theme: 'dark' },
}

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </div>
  ),
}

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Plus aria-hidden />
        Add link
      </>
    ),
  },
}

export const KeyboardActivation: Story = {
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Save link' })

    await userEvent.tab()
    await expect(button).toHaveFocus()

    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    await expect(args.onClick).toHaveBeenCalledTimes(2)
  },
}

export const DefaultsToTypeButton: Story = {
  render: () => (
    <form>
      <Button>Inside a form</Button>
    </form>
  ),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Inside a form' })
    const form = canvasElement.querySelector('form')
    const onSubmit = fn((event: SubmitEvent) => {
      event.preventDefault()
    })
    form?.addEventListener('submit', onSubmit)

    await expect(button).toHaveAttribute('type', 'button')
    await userEvent.click(button)
    await expect(onSubmit).not.toHaveBeenCalled()
  },
}

export const Loading: Story = {
  args: { loading: true, children: 'Saving' },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Saving' })

    await expect(button).toHaveAttribute('aria-disabled', 'true')
    await expect(button).toHaveAttribute('aria-busy', 'true')

    // Still focusable, so focus is not lost while the action runs
    await userEvent.tab()
    await expect(button).toHaveFocus()

    await userEvent.keyboard('{Enter}')
    await userEvent.click(button)
    await expect(args.onClick).not.toHaveBeenCalled()
  },
}

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Save link' })

    await expect(button).toBeDisabled()
    await userEvent.tab()
    await expect(button).not.toHaveFocus()
  },
}

export const AsLink: Story = {
  args: {
    asChild: true,
    variant: 'secondary',
    children: (
      <a href="#links">
        All links
        <ArrowRight aria-hidden />
      </a>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('link', { name: 'All links' })).toHaveAttribute('href', '#links')
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument()
  },
}

export const Icon: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <IconButton aria-label="Delete link" variant="ghost" size="sm" onClick={args.onClick}>
        <Trash2 aria-hidden />
      </IconButton>
      <IconButton aria-label="Delete link" variant="secondary" onClick={args.onClick}>
        <Trash2 aria-hidden />
      </IconButton>
      <IconButton aria-label="Deleting link" variant="danger" size="lg" loading>
        <Trash2 aria-hidden />
      </IconButton>
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const [small] = canvas.getAllByRole('button', { name: 'Delete link' })

    await userEvent.tab()
    await expect(small).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(args.onClick).toHaveBeenCalledOnce()

    await expect(canvas.getByRole('button', { name: 'Deleting link' })).toHaveAttribute(
      'aria-busy',
      'true'
    )
  },
}
