import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import base from './base.js'

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...base,
  {
    files: ['**/*.tsx', '**/*.jsx'],
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
    },
  },
  {
    // Apps use @glint/ui components only; Radix is an implementation detail of packages/ui
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'radix-ui', message: 'Use components from @glint/ui instead.' }],
          patterns: [{ group: ['@radix-ui/*'], message: 'Use components from @glint/ui instead.' }],
        },
      ],
    },
  },
]
