import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  test: {
    // Exclude Playwright E2E specs — those run via `npm run test:e2e`
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
})
