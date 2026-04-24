#!/usr/bin/env node
/**
 * generate-seo-pages.js
 *
 * Run after `vite build` to create:
 *   - dist/<module>/index.html  (one per module, SEO-rich, redirects to SPA)
 *   - dist/sitemap.xml
 *
 * Each landing page has unique <title>, <meta description>, structured data,
 * and a noscript fallback with real text content for crawlers.
 * On load it redirects to the hash-routed SPA: /#/<module>
 */

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DIST = join(process.cwd(), 'dist');

const SITE_NAME = 'Vivix';
const BASE_URL  = 'https://vivix.dev'; // Update when you have a real domain

const MODULES = [
  {
    slug: 'variables',
    title: 'JavaScript Variable Scope & Heap Visualizer',
    description: 'See exactly where JavaScript variables are stored in heap memory. Step through every declaration and watch the engine allocate memory in real-time.',
    h1: 'See How JavaScript Variables Work',
    body: `<p>JavaScript variables are the building blocks of every program. But what actually happens when you write <code>let x = 42</code>?</p>
<p>This interactive visualizer shows you step-by-step how the V8 engine:</p>
<ul>
  <li>Allocates memory slots for each variable</li>
  <li>Tags values with their types (number, string, boolean)</li>
  <li>Handles reassignment by overwriting memory</li>
  <li>Manages <code>const</code> vs <code>let</code> at the engine level</li>
</ul>
<p><strong>Perfect for beginners</strong> learning JavaScript fundamentals, or experienced developers curious about V8 internals.</p>`,
    keywords: 'JavaScript variables, let const var, memory allocation, V8 engine, learn JavaScript variables',
  },
  {
    slug: 'if-gate',
    title: 'JS Branching Logic & Condition Visualizer',
    description: 'Watch how the JavaScript engine evaluates conditions and processes if-else branching. See exactly which path the engine takes and why.',
    h1: 'See How JavaScript Conditionals Work',
    body: `<p>Conditional logic is how programs make decisions. But how does the engine actually evaluate <code>if (x > 10)</code>?</p>
<p>This visualizer shows the complete decision-making process:</p>
<ul>
  <li>How boolean expressions are evaluated step-by-step</li>
  <li>Which branch gets executed and why</li>
  <li>How compound conditions (<code>&&</code>, <code>||</code>) short-circuit</li>
  <li>The flow through if/else if/else chains</li>
</ul>`,
    keywords: 'JavaScript if else, conditionals, boolean logic, truthy falsy, learn JavaScript conditions',
  },
  {
    slug: 'for-loop',
    title: 'Step-by-Step JavaScript Loop Execution Visualizer',
    description: 'Watch how the JavaScript engine processes for loops instruction by instruction. See the call stack and memory update with every iteration.',
    h1: 'See How JavaScript Loops Iterate',
    body: `<p>Loops are where most beginners get confused. What does <code>i++</code> actually do? When does the condition get checked?</p>
<p>This visualizer breaks down each phase:</p>
<ul>
  <li><strong>Init</strong> — variable declaration (<code>let i = 0</code>)</li>
  <li><strong>Test</strong> — condition evaluation (<code>i < 10</code>)</li>
  <li><strong>Body</strong> — the code inside the loop</li>
  <li><strong>Update</strong> — the increment (<code>i++</code>)</li>
</ul>
<p>Watch nested loops, while loops, and see exactly how iteration count affects time complexity.</p>`,
    keywords: 'JavaScript for loop, while loop, iteration, loop visualization, time complexity, learn JavaScript loops',
  },
  {
    slug: 'function',
    title: 'JS Call Stack & Execution Context Visualizer',
    description: 'Visualize how JavaScript functions create execution contexts and push onto the call stack. See exactly what happens when a function returns.',
    h1: 'See How JavaScript Functions Execute',
    body: `<p>Functions are the core abstraction in JavaScript. But what happens under the hood when you call one?</p>
<p>This visualizer shows:</p>
<ul>
  <li>How the call stack grows with each function call</li>
  <li>How arguments are passed and local variables are scoped</li>
  <li>How return values travel back up the stack</li>
  <li>How recursion creates multiple stack frames</li>
</ul>`,
    keywords: 'JavaScript functions, call stack, recursion, return value, stack frame, learn JavaScript functions',
  },
  {
    slug: 'array',
    title: 'Visualizing JavaScript Array Memory & Operations',
    description: 'Step through JavaScript array operations and watch memory allocation in real-time. See exactly how the engine handles array methods.',
    h1: 'See How JavaScript Arrays Work in Memory',
    body: `<p>Arrays in JavaScript are more complex than they appear. How does <code>push()</code> grow the array? What happens during <code>splice()</code>?</p>
<p>This visualizer reveals:</p>
<ul>
  <li>Contiguous memory layout and V8's element kinds</li>
  <li>How push, pop, shift, and unshift modify the array</li>
  <li>How map, filter, and reduce create new arrays</li>
  <li>The real cost of array operations in time complexity</li>
</ul>`,
    keywords: 'JavaScript arrays, array methods, push pop, map filter reduce, array visualization, learn JavaScript arrays',
  },
  {
    slug: 'objects',
    title: 'JavaScript Object Allocation & Heap Visualizer',
    description: 'See how JavaScript objects are allocated and stored in heap memory. Watch property assignment and object creation at the engine level.',
    h1: 'See How JavaScript Objects Store Data',
    body: `<p>Objects are JavaScript's most flexible data structure. But how does <code>obj.name</code> find the value so quickly?</p>
<p>This visualizer shows:</p>
<ul>
  <li>Hash map internals — how keys map to bucket positions</li>
  <li>O(1) property access explained visually</li>
  <li>V8's hidden classes and inline caches</li>
  <li>How adding/deleting properties affects performance</li>
</ul>`,
    keywords: 'JavaScript objects, hash map, key value, object properties, V8 hidden classes, learn JavaScript objects',
  },
  {
    slug: 'data-structures',
    title: 'JavaScript Data Structures Visualizer — Stacks, Queues, Maps & Sets',
    description: 'Visualize stacks, queues, maps, and sets in JavaScript. See how each data structure organizes data for efficient access and modification.',
    h1: 'See How Data Structures Work in JavaScript',
    body: `<p>Choosing the right data structure is what separates good code from great code. But how do they actually work?</p>
<p>This visualizer covers:</p>
<ul>
  <li><strong>Stacks</strong> — LIFO ordering, push/pop operations</li>
  <li><strong>Queues</strong> — FIFO ordering, enqueue/dequeue</li>
  <li><strong>Maps</strong> — ordered key-value pairs with any key type</li>
  <li><strong>Sets</strong> — unique value collections</li>
</ul>`,
    keywords: 'JavaScript data structures, stack, queue, Map, Set, learn data structures JavaScript',
  },
  {
    slug: 'async',
    title: 'Async/Await & Microtask Queue Visualizer',
    description: 'Watch async/await execution step by step. See how the event loop, microtask queue, and call stack interact when JavaScript processes promises.',
    h1: 'See How Async JavaScript Actually Works',
    body: `<p>Async JavaScript is the #1 source of confusion for intermediate developers. What does <code>await</code> actually do?</p>
<p>This visualizer shows the complete async execution model:</p>
<ul>
  <li>The event loop — call stack, task queue, microtask queue</li>
  <li>How Promises resolve and chain</li>
  <li>How async/await pauses and resumes execution</li>
  <li>Why <code>setTimeout(fn, 0)</code> doesn't run immediately</li>
</ul>`,
    keywords: 'JavaScript async await, event loop, promises, microtask queue, setTimeout, learn async JavaScript',
  },
  {
    slug: 'closures',
    title: 'JavaScript Closure Memory & Scope Tracer',
    description: 'See how JavaScript closures capture variables in memory. Watch the scope chain form in real-time and understand why closures work the way they do.',
    h1: 'See How JavaScript Closures Work',
    body: `<p>Closures are one of the most powerful — and misunderstood — concepts in JavaScript. This visualizer makes them obvious.</p>
<p>Watch in real time as:</p>
<ul>
  <li>Inner functions capture variables from outer scopes</li>
  <li>Scope chains are built and traversed</li>
  <li>Captured variables persist after the outer function returns</li>
  <li>V8 creates closure contexts to keep variables alive</li>
</ul>
<p><strong>If you've ever been confused by closures in a job interview</strong>, spend 2 minutes stepping through the examples here.</p>`,
    keywords: 'JavaScript closures, scope, lexical scope, closure explained, learn JavaScript closures',
  },
  {
    slug: 'free-form',
    title: 'Custom JavaScript Execution Tracer & Visualizer',
    description: 'Paste any JavaScript and watch the engine execute it step by step. Trace your own code through the call stack, heap memory, and event loop.',
    h1: 'Run Your Own JavaScript Through the Engine',
    body: `<p>Every other Vivix module teaches one specific concept with curated examples. Free-form mode turns the visualiser loose on <em>any</em> code you paste.</p>
<p>Paste a snippet from a tutorial, a job-interview question, a gnarly bug you're debugging — and watch the engine:</p>
<ul>
  <li>Push and pop stack frames as functions are called and return</li>
  <li>Allocate variables and objects in heap memory, byte-by-byte</li>
  <li>Schedule tasks on the event loop when you hit <code>await</code>, <code>setTimeout</code>, or <code>.then()</code></li>
  <li>Detect patterns — recursion, closures, async/await, hoisting — and narrate what's happening</li>
</ul>
<p>No install, no account, no sign-up. The interpreter runs entirely in your browser.</p>`,
    keywords: 'JavaScript execution tracer, custom code visualizer, JS debugger, step through JavaScript, event loop visualizer, learn JavaScript by running code',
  },
];

function buildLandingPage(mod) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${mod.title} | ${SITE_NAME}</title>
  <meta name="description" content="${mod.description}"/>
  <meta name="keywords" content="${mod.keywords}"/>
  <link rel="canonical" href="${BASE_URL}/${mod.slug}/"/>
  <!-- Open Graph -->
  <meta property="og:title" content="${mod.title}"/>
  <meta property="og:description" content="${mod.description}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${BASE_URL}/${mod.slug}/"/>
  <meta property="og:site_name" content="${SITE_NAME}"/>
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${mod.title}"/>
  <meta name="twitter:description" content="${mod.description}"/>
  <!-- Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "${mod.title}",
    "description": "${mod.description}",
    "url": "${BASE_URL}/${mod.slug}/",
    "applicationCategory": "EducationalApplication",
    "operatingSystem": "Web",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "GBP" }
  }
  </script>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;max-width:680px;margin:40px auto;padding:0 20px;color:#e0e0e0;background:#0a0a0f;line-height:1.7}
    h1{font-size:1.8rem;color:#fff;margin-bottom:8px}
    a{color:#4ade80;text-decoration:none}a:hover{text-decoration:underline}
    code{background:#1a1a2e;padding:2px 6px;border-radius:4px;font-size:0.9em;color:#f0f0f0}
    .cta{display:inline-block;margin:24px 0;padding:12px 28px;background:#4ade80;color:#0a0a0f;font-weight:700;border-radius:8px;font-size:1rem;transition:opacity .15s}
    .cta:hover{opacity:0.85;text-decoration:none}
    ul{padding-left:20px}li{margin-bottom:6px}
    .back{font-size:0.85rem;color:#888;margin-bottom:24px;display:block}
    noscript{display:block;margin-top:16px;padding:12px;background:#1a1a2e;border-radius:8px;font-size:0.85rem}
  </style>
</head>
<body>
  <a href="/" class="back">&larr; Vivix Home</a>
  <h1>${mod.h1}</h1>
  ${mod.body}
  <a href="/#/${mod.slug}" class="cta">&#9654; Open Interactive Visualizer</a>
  <noscript>
    <p>This interactive visualizer requires JavaScript to run. Please enable JavaScript in your browser to use Vivix.</p>
  </noscript>
  <script>
    // Redirect browsers (not crawlers) to the SPA hash route
    if (!/bot|crawl|spider|slurp|archive/i.test(navigator.userAgent)) {
      window.location.replace('/#/${mod.slug}');
    }
  </script>
</body>
</html>`;
}

function buildSitemap() {
  const now = new Date().toISOString().split('T')[0];
  const urls = [
    `  <url><loc>${BASE_URL}/</loc><changefreq>weekly</changefreq><priority>1.0</priority><lastmod>${now}</lastmod></url>`,
    ...MODULES.map(m =>
      `  <url><loc>${BASE_URL}/${m.slug}/</loc><changefreq>monthly</changefreq><priority>0.8</priority><lastmod>${now}</lastmod></url>`
    ),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemapindex.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

function buildRobotsTxt() {
  return `User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`;
}

// ── Generate ──
console.log('Generating SEO landing pages...');

for (const mod of MODULES) {
  const dir = join(DIST, mod.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), buildLandingPage(mod));
  console.log(`  ✓ ${mod.slug}/index.html`);
}

writeFileSync(join(DIST, 'sitemap.xml'), buildSitemap());
console.log('  ✓ sitemap.xml');

writeFileSync(join(DIST, 'robots.txt'), buildRobotsTxt());
console.log('  ✓ robots.txt');

// SPA fallback: copy index.html → 404.html (GitHub Pages serves this for unknown routes)
const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf-8');
writeFileSync(join(DIST, '404.html'), indexHtml);
console.log('  ✓ 404.html (SPA fallback)');

console.log(`Done — ${MODULES.length} landing pages + sitemap + robots.txt + 404`);
