# Launch Copy — Ready to Post

Use these templates when sharing Vivix. Replace `https://vivix.dev` with your deployed URL once you have one.

---

## Reddit — r/learnjavascript

**Title:** I built a tool that lets you see inside JavaScript as it runs — CPU, memory, call stack, all visualized step by step

**Body:**

Hey everyone! I built **Vivix** — an interactive JavaScript execution visualizer.

You write real JS, click play, and step through every instruction one at a time. As you step, you see:

- **Heap memory** — variables appear with their types, values, and byte sizes
- **CPU dashboard** — program counter, operation phase, write counter
- **Call stack** — frames push and pop as functions are called
- **Memory map** — see exactly how many bytes each variable takes
- **Explanation strip** — plain English description of what's happening at each step

There are **9 modules** covering variables, conditionals, loops, functions, arrays, objects, data structures, async/await, and closures. Each has its own purpose-built visualization.

**Tech:** Svelte 5, Acorn parser, custom AST interpreter (no eval), CodeMirror 6, 332 unit tests.

It's completely free, no sign-up, runs in your browser.

- **Try it:** https://vivix.dev
- **Source:** https://github.com/HenryOnilude/visual-learning-javascript

Would love to hear what you think — especially which concepts you'd want visualized next!

---

## Reddit — r/webdev

**Title:** I built an interactive JavaScript visualizer that shows CPU state, memory allocation, and call stacks in real time [open source]

**Body:**

I've been working on **Vivix** — a tool that visualizes JavaScript execution at a low level.

Instead of just showing "this variable equals 5", it shows:
- The heap memory slot being allocated
- The byte size (8 bytes for a number, 5 bytes for "Alex")
- The CPU operation (DECLARE, COMPARE, CALL)
- Call stack frames pushing/popping
- A memory map showing total allocation

It's built with **Svelte 5** (runes), **Acorn** for parsing, and a **custom AST interpreter** — no `eval()`, so every intermediate state is captured. The interpreter runs in a Web Worker with a 500-step limit.

9 modules: variables, conditionals, loops, functions, arrays, objects, data structures, async/await, closures.

**332 tests**, mobile responsive, shareable URLs, accessibility themes.

- **Live:** https://vivix.dev
- **GitHub:** https://github.com/HenryOnilude/visual-learning-javascript

Open source (MIT). Feedback welcome!

---

## Hacker News — Show HN

**Title:** Show HN: Vivix – Step through JavaScript and watch the CPU, memory, and call stack respond

**Body:**

I built an interactive JavaScript execution visualizer. You write code, click play, and step through each instruction — watching variables appear in heap memory, call stack frames push/pop, byte sizes update, and the CPU dashboard tick through operations.

It's powered by a custom AST interpreter (Acorn → ESTree → step array) running in a Web Worker. No eval — we walk the AST directly to capture every intermediate state. 500-step limit prevents infinite loops.

9 modules covering core JS concepts (variables through closures), each with a purpose-built visualization. Svelte 5, CodeMirror 6, 332 tests.

Try it: https://vivix.dev
Source: https://github.com/HenryOnilude/visual-learning-javascript

---

## Dev.to

**Title:** I built a JavaScript visualizer that shows you what the engine actually does

**Tags:** javascript, webdev, opensource, learning

**Body:**

## The problem

When I was learning JavaScript, I kept reading things like "variables are stored in memory" and "functions push frames onto the call stack." But I never *saw* it happen.

## The solution

I built **Vivix** — an interactive tool where you write real JavaScript, click play, and step through execution one instruction at a time.

At each step, you see:
- 🧠 **Heap memory** — variables with types, values, and byte sizes
- 📊 **CPU dashboard** — program counter, operation, write counter
- 📦 **Call stack** — frames push and pop in real time
- 🗺️ **Memory map** — byte-level allocation visualization

## 9 interactive modules

Each covers a core concept with its own visualization:

| Module | What you see |
|--------|-------------|
| Variables | Heap slots, byte sizes, type tags |
| Conditionals | Branch flowchart, true/false paths |
| Loops | Iteration counter, loop ring |
| Functions | Call stack push/pop, return flow |
| Arrays | Cell scanning, O(n) cost badges |
| Objects | Hash map, key→bucket→O(1) |
| Data Structures | Stack/queue operations |
| Async/Await | Event loop, microtask queue |
| Closures | Nested scope boxes |

## How it works

```
Your Code → Acorn Parser → AST → Custom Interpreter → Step Array → Visualizer
```

The key insight: instead of using `eval()`, I wrote a custom AST walker that produces an array of execution steps. Each step captures the line, variables, memory ops, call stack, phase, and output. Then the UI just renders whichever step you're on.

The interpreter runs in a **Web Worker** with a 500-step limit to prevent infinite loops.

## Tech stack

- **Svelte 5** with runes (`$state`, `$derived`)
- **Acorn** for parsing
- **CodeMirror 6** for the editor
- **332 unit tests** (Vitest)
- Mobile responsive, shareable URLs, accessibility themes

## Try it

- **Live:** https://vivix.dev
- **GitHub:** [github.com/HenryOnilude/visual-learning-javascript](https://github.com/HenryOnilude/visual-learning-javascript)

Free, no sign-up, open source (MIT). Would love feedback — especially on which concepts to add next!

---

## Twitter/X

**Tweet:**

I built Vivix — an interactive tool that lets you see inside JavaScript as it runs.

Step through real code and watch:
⚡ CPU dashboard tick through operations
🧠 Variables appear in heap memory
📦 Call stack frames push & pop
🗺️ Memory map show byte allocation

9 modules · Svelte 5 · Open source

https://vivix.dev

---

## Posting Strategy

1. **Deploy first** — get a live URL (Netlify/Vercel)
2. **Record a GIF** — 30-60 seconds of the Variables module stepping through code
3. **Post to r/learnjavascript first** (most receptive audience)
4. **Wait 24h**, then post to r/webdev
5. **Submit to Hacker News** as "Show HN" (best on weekday mornings US time)
6. **Publish on Dev.to** (can cross-post anytime)
7. **Tweet** with the GIF attached

### Best times to post
- **Reddit:** Tuesday–Thursday, 8-10am EST
- **Hacker News:** Tuesday–Thursday, 8-11am EST
- **Dev.to:** Any weekday morning
