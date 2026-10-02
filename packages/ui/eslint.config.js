import react from '@glint/config/eslint/react'
import storybook from 'eslint-plugin-storybook'

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...react,
  ...storybook.configs['flat/recommended'],
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // This package is the only place allowed to wrap Radix primitives
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // Play functions must use Storybook's instrumented helpers so steps show in the UI
    files: ['**/*.stories.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'vitest', message: 'Import test helpers from storybook/test instead.' },
            {
              name: '@testing-library/user-event',
              message: 'Import userEvent from storybook/test instead.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ['storybook-static/**'],
  },
]
