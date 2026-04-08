# visualJS — See How JavaScript Thinks

An interactive JavaScript execution visualizer. Write real JS, click **▶ Visualize**, and step through every instruction — watching the CPU, memory, and call stack update in real time.

**Live:** [visualjs.dev](https://visualjs.dev) (coming soon)

## Quick Start

```bash
git clone https://github.com/HenryOnilude/visual-learning-javascript.git
cd visual-learning-javascript
npm install
npm run dev      # → http://localhost:5173
npm run test     # 161 unit tests
npm run build    # production build + SEO pages
```

## Modules

9 interactive modules, each teaching a core JavaScript concept:

| Route | Module | What You See |
|-------|--------|-------------|
| `#/variables` | **varStore** | Heap memory slots, byte sizes, type tags |
| `#/if-gate` | **ifGate** | Branch flowchart — true/false paths light up |
| `#/for-loop` | **forLoop** | Loop ring with iteration counter and body highlighting |
| `#/function` | **fnCall** | Call stack frames push/pop, return values flow back |
| `#/array` | **arrayFlow** | Array cells with index scanning and O(n) cost badges |
| `#/objects` | **objExplorer** | Property hash map, key→bucket→O(1) visualization |
| `#/data-structures` | **dataStructures** | Stack/queue push-pop, Map/Set operations |
| `#/async` | **asyncAwait** | Event loop, microtask queue, Promise timeline |
| `#/closures` | **closures** | Nested scope boxes with captured variable highlighting |

## Architecture

```
index.html
  └─ App.svelte              ← hash router, lazy-loads modules
       ├─ Home.svelte         ← landing page with live demo
       └─ ModuleShell.svelte  ← shared layout for all 9 modules
            ├─ CodeEditor.svelte   (CodeMirror 6)
            ├─ CpuDash.svelte      (SVG CPU dashboard)
            ├─ OnboardingTour.svelte (first-run tooltips)
            └─ <Module>.svelte     (module-specific visualization)
```

### How It Works

1. **Acorn** parses user code into an AST
2. **Custom interpreter** (`interpreter.js`) walks the AST and produces an array of execution steps — each step captures line index, variables, memory ops, call stack, phase, and output
3. **Step controls** let you scrub forward/backward through the step array
4. **CpuDash** renders each step as an SVG CPU visualization (registers, phase, program counter)
5. **Module panels** render step-specific data (heap cards, scope chains, array cells, etc.)

The interpreter runs in a **Web Worker** for non-blocking execution, with a **500-step limit** to prevent infinite loops.

### Key Design Decisions

- **No runtime eval** — the interpreter walks the AST directly, so we capture every intermediate state
- **Shared shell** — `ModuleShell.svelte` handles code editing, step controls, playback, timeline, and keyboard shortcuts; modules only provide the visualization snippets
- **Accessibility themes** — 3 themes (default dark, comfort, dyslexia) via CSS custom properties (`--a11y-*`), managed by `a11y-theme.js`
- **Hash routing** — SPA with `#/module` routes, no server config needed
- **Shareable URLs** — base64-encoded code + step index in the URL hash

## Features

- **Step-by-step execution** — scrub through every instruction with ⟪ ◁ ▷ ⟫ controls
- **Auto-play** — adjustable speed (0.5x – 4x) with keyboard shortcuts
- **Shareable URLs** — share any code + step position via a single link
- **Mobile responsive** — stacked layout with Code/Visual tab switcher on ≤768px
- **First-run onboarding** — 4-step guided tour for new users
- **SEO landing pages** — per-module pages with structured data, sitemap, robots.txt
- **Infinite loop protection** — 500-step limit with friendly truncation message
- **161 unit tests** — interpreter, shell logic, URL state, and Home component

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Svelte 5 (runes: `$state`, `$derived`) |
| Parser | Acorn (ESTree AST) |
| Code Editor | CodeMirror 6 |
| Build | Vite 7 |
| Tests | Vitest + Testing Library + happy-dom |
| E2E | Playwright (configured, not yet used) |

## Project Structure

```
src/
  lib/
    interpreter.js       ← AST walker, step generator, step limit
    interpreter.test.js  ← 99 interpreter tests
    shell-logic.js       ← shared step utilities (phase colors, markers, etc.)
    shell-logic.test.js  ← 35 shell logic tests
    url-state.js         ← shareable URL encoding/decoding
    url-state.test.js    ← 20 URL state tests
    a11y-theme.js        ← accessibility theme system (3 themes)
    ModuleShell.svelte   ← shared module layout (code panel + visual panel)
    CodeEditor.svelte    ← CodeMirror 6 wrapper
    CpuDash.svelte       ← SVG CPU dashboard
    OnboardingTour.svelte ← first-run guided tooltips
    Home.svelte          ← landing page
    Variables.svelte     ← module: variables & memory
    IfGate.svelte        ← module: conditionals
    ForLoop.svelte       ← module: iteration
    FnCall.svelte        ← module: functions & call stack
    ArrayFlow.svelte     ← module: arrays
    ObjExplorer.svelte   ← module: objects & hash maps
    DataStructures.svelte ← module: stack, queue, map, set
    AsyncAwait.svelte    ← module: async/await & event loop
    Closures.svelte      ← module: closures & scope chain
scripts/
  generate-seo-pages.js  ← build-time SEO page + sitemap generator
```

## License

MIT
