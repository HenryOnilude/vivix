/*
 * Entry point. Injects font preload hints *before* importing the rest of
 * the app so the two critical woff2 files start downloading in parallel
 * with the main JS chunks. This was the single biggest LCP improvement
 * after measuring CWV: previously the fonts were only fetched after
 * app.css had been parsed.
 */

// PostHog must initialise before anything else so the initial pageview
// is captured. The actual init lives in `./lib/posthog.js` so individual
// components can import it directly without a circular dep back to the
// entry module. We re-export here for backwards compatibility.
import { posthog } from './lib/posthog.js';
export { posthog };

// Vite `?url` imports with relative paths bypass the package exports
// restriction on the `geist` package and resolve to the hashed asset
// path in production (/dev path in development).
import geistSansUrl   from '../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2?url';
import geistMonoUrl   from '../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2?url';
import spaceGroteskUrl from '../node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2?url';

function preloadFont(href) {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'font';
  link.type = 'font/woff2';
  link.href = href;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}
preloadFont(geistSansUrl);
preloadFont(geistMonoUrl);
preloadFont(spaceGroteskUrl);

import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

const app = mount(App, {
  target: document.getElementById('app'),
});

export default app;
