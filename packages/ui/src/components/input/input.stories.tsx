import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'

import { Input, TextField } from './input'

const meta = {
  title: 'Components/TextField',
  component: TextField,
  args: {
    label: 'Link URL',
    placeholder: 'https://example.com/article',
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TextField>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox', { name: 'Link URL' })

    // Clicking the label focuses the input
    await userEvent.click(canvas.getByText('Link URL'))
    await expect(input).toHaveFocus()

    await userEvent.type(input, 'https://glint.dev')
    await expect(input).toHaveValue('https://glint.dev')
  },
}

export const WithDescription: Story = {
  args: {
    description: 'Paste the address of the page you want to save.',
  },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Link URL' })

    await expect(input).toHaveAccessibleDescription(
      'Paste the address of the page you want to save.'
    )
    await expect(input).not.toHaveAttribute('aria-invalid')
  },
}

export const WithError: Story = {
  args: {
    description: 'Paste the address of the page you want to save.',
    error: 'Enter a valid URL.',
    defaultValue: 'not a url',
  },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Link URL' })

    await expect(input).toBeInvalid()
    // Description first, then the error
    await expect(input).toHaveAccessibleDescription(
      'Paste the address of the page you want to save. Enter a valid URL.'
    )
  },
}

export const WithErrorDark: Story = {
  ...WithError,
  globals: { theme: 'dark' },
}

export const Required: Story = {
  args: { required: true },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Link URL' })

    await expect(input).toBeRequired()
  },
}

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'https://example.com' },
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Link URL' })

    await userEvent.tab()
    await expect(input).not.toHaveFocus()
  },
}

export const KeepsCustomDescribedBy: Story = {
  render: (args) => (
    <>
      <p id="url-hint" className="text-fg-muted mb-2 text-sm">
        Only http and https links are supported.
      </p>
      <TextField {...args} aria-describedby="url-hint" error="Enter a valid URL." />
    </>
  ),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole('textbox', { name: 'Link URL' })

    await expect(input).toHaveAccessibleDescription(
      'Only http and https links are supported. Enter a valid URL.'
    )
  },
}

export const TabOrder: Story = {
  render: (args) => (
    <form className="flex flex-col gap-4">
      <TextField {...args} label="Title" placeholder="" />
      <TextField {...args} label="Link URL" />
    </form>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.tab()
    await expect(canvas.getByRole('textbox', { name: 'Title' })).toHaveFocus()
    await userEvent.tab()
    await expect(canvas.getByRole('textbox', { name: 'Link URL' })).toHaveFocus()
  },
}

export const BareInput: Story = {
  render: () => <Input aria-label="Search links" type="search" placeholder="Search" />,
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('searchbox', { name: 'Search links' })
    ).toBeVisible()
  },
}
