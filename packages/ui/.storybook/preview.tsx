import type { Decorator, Preview } from '@storybook/react-vite'

import './preview.css'

type Theme = 'system' | 'light' | 'dark'

/** Mirrors how apps pick a theme: data-theme on the root element, or none for system. */
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme as Theme
  if (theme === 'system') {
    delete document.documentElement.dataset.theme
  } else {
    document.documentElement.dataset.theme = theme
  }
  return <Story />
}

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: 'Color theme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'system', title: 'System' },
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'light',
  },
  parameters: {
    // Fail story tests on any axe violation instead of only reporting it
    a11y: { test: 'error' },
    controls: { expanded: true },
  },
  tags: ['autodocs'],
}

export default preview
