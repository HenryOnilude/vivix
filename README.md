<div align="center">

# Vivix

### See Inside JavaScript As It Thinks

#### Instruction-level JavaScript execution with simultaneous heap visualization

<img width="1319" height="844" alt="Screenshot 2026-04-10 at 17 26 56" src="https://github.com/user-attachments/assets/a9c4435a-2262-4166-8dae-41d7c6c99076" />

Most JavaScript visualizers show you the event loop at a high level. Vivix steps through every individual instruction — subexpression evaluation, heap mutations, stack operations — one tick at a time via the CPU dashboard. No account required, no install, completely free and open source.

[![Tests](https://img.shields.io/badge/tests-332%20passing-brightgreen)](https://github.com/HenryOnilude/visual-learning-javascript)
[![Svelte 5](https://img.shields.io/badge/svelte-5-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/HenryOnilude/visual-learning-javascript/pulls)

</div>

---
## What is this?

Most JS tutorials tell you what code does. **Vivix shows you.**

https://github.com/user-attachments/assets/e122c133-234b-4c5f-b483-c1ffc928f778

You write JavaScript, hit play, and step through execution one instruction at a time watching variables appear in heap memory, call stack frames push and pop, byte sizes update, and the CPU dashboard tick through each operation. It's like having X-ray vision for JavaScript.

**No sign-up. No install. Runs entirely in your browser.**

---

## 🎬 Demo

https://github.com/user-attachments/assets/40b2d503-50bc-45df-bbc6-b1950e017141

---

## What You Get

| | Feature | Details |
|---|---|---|
| 🔬 | **Step-by-step execution** | Scrub through every instruction with ⟪ ◁ ▷ ⟫ controls |
| 🧠 | **Live memory view** | Watch variables, types, and byte sizes appear in real time |
| 📊 | **CPU dashboard** | SVG registers, program counter, operation phase, write counter |
| 📦 | **Memory map** | See exactly how many bytes each variable occupies |
| 🔗 | **Shareable URLs** | Share any code + step position via a single link |
| ⏩ | **Auto-play** | Adjustable speed (0.5x – 4x) with keyboard shortcuts |
| 📱 | **Mobile responsive** | Stacked layout with Code/Visual tab switcher on small screens |
| 🎓 | **Guided onboarding** | 4-step tour for first-time users |
| ♿ | **Accessibility themes** | Default dark, comfort, and dyslexia-friendly modes |
| 🛡️ | **Infinite loop protection** | 500-step limit with friendly truncation message |

---

## 12 Interactive Modules

Each module teaches a core JavaScript concept with a purpose-built visualization:

<img width="945" height="715" alt="Screenshot 2026-04-10 at 17 54 33" src="https://github.com/user-attachments/assets/f1f40866-1f66-4bf7-b967-df7a90ea5f62" />


| Module | Concept | What You See |
|--------|---------|-------------|
| **varStore** | Variables & Memory | Heap memory slots, byte sizes, type tags |
| **ifGate** | Conditionals | Branch flowchart — true/false paths light up |
| **forLoop** | Iteration | Loop ring with iteration counter and body highlighting |
| **fnCall** | Functions | Call stack frames push/pop, return values flow back |
| **arrayFlow** | Array Methods | Array cells with index scanning and O(n) cost badges |
| **objExplorer** | Objects & Hash Maps | Property hash map, key→bucket→O(1) visualization |
| **dataStruct** | Data Structures | Stack/queue push-pop, Map/Set operations |
| **asyncFlow** | Async / Await | Event loop, microtask queue, Promise timeline |
| **closureScope** | Closures & Scope | Nested scope boxes with captured variable highlighting |

---

Quick Start

```bash
git clone https://github.com/HenryOnilude/vivix.git
cd vivix
npm install
npm run dev      # → http://localhost:5173
```

```bash
npm run test     # 332 unit tests
npm run build    # production build + SEO pages
```

---

## 🏗️ How It Works

```
Your Code → Acorn Parser → AST → Custom Interpreter → Step Array → Visualizer
```

1. **Acorn** parses user code into an AST
2. **Custom interpreter** (`interpreter.js`) walks the AST and produces an array of execution steps each step captures line index, variables, memory ops, call stack, phase, and output
3. **Step controls** let you scrub forward/backward through the step array
4. **CpuDash** renders each step as an SVG CPU visualization (registers, phase, program counter)
5. **Module panels** render step-specific data (heap cards, scope chains, array cells, etc.)

The interpreter runs in a **Web Worker** for non-blocking execution, with a **500-step limit** to prevent infinite loops.

### Key Design Decisions

- **No runtime eval** — the interpreter walks the AST directly, so we capture every intermediate state
- **Shared shell** — `ModuleShell.svelte` handles code editing, step controls, playback, timeline, and keyboard shortcuts; modules only provide the visualization
- **Accessibility themes** — 3 themes via CSS custom properties (`--a11y-*`)
- **Hash routing** — SPA with `#/module` routes, no server config needed
- **Shareable URLs** — base64-encoded code + step index in the URL hash

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Svelte 5 (runes: `$state`, `$derived`) |
| Parser | Acorn (ESTree AST) |
| Code Editor | CodeMirror 6 |
| Build | Vite 7 |
| Tests | Vitest + Testing Library + happy-dom (332 tests) |
| Styling | Custom CSS with CSS custom properties |

---

## 📁 Project Structure

```
src/lib/
  interpreter.js         ← AST walker, step generator (99 + 71 + 62 tests)
  async-executor.js      ← async/await step executor (38 tests)
  shell-logic.js         ← shared step utilities (35 tests)
  url-state.js           ← shareable URL encoding (20 tests)
  a11y-theme.js          ← accessibility theme system
  ModuleShell.svelte     ← shared module layout
  CodeEditor.svelte      ← CodeMirror 6 wrapper
  CpuDash.svelte         ← SVG CPU dashboard
  OnboardingTour.svelte  ← first-run guided tooltips
  Home.svelte            ← landing page with live demo
  Variables.svelte       ← varStore module
  IfGate.svelte          ← ifGate module
  ForLoop.svelte         ← forLoop module
  FnCall.svelte          ← fnCall module
  ArrayFlow.svelte       ← arrayFlow module
  ObjExplorer.svelte     ← objExplorer module
  DataStructures.svelte  ← dataStruct module
  AsyncAwait.svelte      ← asyncFlow module
  Closures.svelte        ← closureScope module
scripts/
  generate-seo-pages.js  ← build-time SEO pages + sitemap
```

---

## ⚠️ Known Limitations

The interpreter is an educational tool, not a full JS engine. A few simplifications:

- **Flat scope** — `let`/`const` inside blocks (if, for, while) share the outer scope. Variables declared in a block are visible outside it. This means the classic "closure in a loop with `let`" pattern behaves like `var` (all closures share the final value).
- **No `this` in standalone functions** — `this` is only supported for class method calls, not general `this` binding.
- **Limited built-ins** — supports core methods (`push`, `pop`, `map`, `filter`, `reduce`, `Object.keys`, `Math.*`, etc.) but not the full standard library.
- **No prototypes or `new` (outside classes)** — constructor functions with `new` are not supported; use the class syntax instead.
- **500-step limit** — prevents infinite loops but caps very long programs.

These trade-offs keep the visualizations clear and the codebase manageable while covering the concepts that matter most for learning.

---

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a PR.

```bash
npm run test     # run before submitting
```

---

## 📄 License

MIT — use it, learn from it, build on it.

---

<div align="center">

**Built by [Henry Onilude](https://github.com/HenryOnilude)**

If this helped you understand JavaScript better, consider giving it a ⭐

</div>
