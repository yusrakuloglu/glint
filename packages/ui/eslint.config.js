import react from '@glint/config/eslint/react'

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...react,
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
]
