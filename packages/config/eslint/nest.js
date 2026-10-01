import base from './base.js'

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...base,
  {
    files: ['**/*.ts'],
    rules: {
      // NestJS uses classes extensively
      '@typescript-eslint/no-extraneous-class': 'off',
      // Decorators often use empty functions
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
]
