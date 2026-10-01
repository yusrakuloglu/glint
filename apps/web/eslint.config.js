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
    ignores: ['next-env.d.ts'],
  },
]
