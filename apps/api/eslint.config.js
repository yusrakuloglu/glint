import nest from '@glint/config/eslint/nest'

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...nest,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: ['src/generated/**', 'dist-worker/**'],
  },
]
