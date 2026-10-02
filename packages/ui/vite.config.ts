import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Used by Storybook and by the Vitest storybook project
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
