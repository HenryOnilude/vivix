import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  build: {
    // Chunk split so the initial page (Home.svelte) doesn't have to parse
    // any module-level dependencies. Everything used by ModuleShell and
    // its peers is already lazy-loaded via dynamic import() in App.svelte,
    // so we just need to isolate the heavy shared vendors so they cache
    // across routes rather than duplicating into each module bundle.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          // GSAP is pulled in by animations.js (ModuleShell). Keeping it
          // in its own chunk means the first module visit downloads it
          // once and every subsequent module reuses the cached file.
          if (id.includes('/gsap/')) return 'vendor-gsap';
          // @mlc-ai/web-llm is enormous (~5 MB) and is only loaded by
          // FreeForm via dynamic import — Rollup already isolates it,
          // but flag it explicitly so the chunk name is stable.
          if (id.includes('@mlc-ai')) return 'vendor-webllm';
          // CodeMirror is the next heaviest dep after web-llm.
          if (id.includes('codemirror') || id.includes('@codemirror')) return 'vendor-codemirror';
        },
      },
    },
    // Increase warning threshold for the WebLLM chunk which is expected
    // to be large; it is loaded strictly on demand.
    chunkSizeWarningLimit: 1500,
  },
  test: {
    // Exclude Playwright E2E specs — those run via `npm run test:e2e`
    exclude: ['tests/e2e/**', 'node_modules/**'],
    // Ensure Svelte resolves to client-side build for component tests
    alias: [
      { find: /^svelte$/, replacement: 'svelte' },
    ],
    server: {
      deps: {
        inline: [/svelte/],
      },
    },
  },
  resolve: {
    conditions: ['browser'],
  },
})
