import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Used by Storybook and by the Vitest storybook project
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // Pre-bundle up front; discovering these mid-run makes Vite reload and fail browser tests
    include: ['class-variance-authority', 'lucide-react', 'radix-ui', 'storybook/test'],
  },
})
