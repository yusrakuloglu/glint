import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // esbuild cannot emit decorator metadata, which Nest DI relies on
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.int-spec.ts'],
          // Starts one Postgres container and migrates a template database
          globalSetup: ['src/testing/integration/global-setup.ts'],
          hookTimeout: 120_000,
        },
      },
    ],
  },
})
