# Vivix
### See Inside JavaScript As It Thinks

Instruction-level JavaScript execution visualizer mapping the call stack, heap memory, and event loop in real time.

[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-490%20passing-blue)](https://github.com/HenryOnilude/vivix)
[![Built with Svelte 5](https://img.shields.io/badge/built%20with-Svelte%205-orange)](https://svelte.dev)
[![Open Source](https://img.shields.io/badge/open%20source-heart-red)](https://github.com/HenryOnilude/vivix)

> ⭐ If Vivix helps you understand JavaScript, a star helps other developers find it.

<!-- HERO GIF: Add a GIF here showing the asyncFlow or event loop module in action. Recommended dimensions: 1200x675px -->

## The Origin Story

"I was using Python Tutor — it's really good but it was only showing the bones. I needed to see the muscles and flesh."

Vivix was built to move beyond high-level syntax explanations. While existing tools provide a logical overview, Vivix provides a physical narrative of how the engine processes code.

## Positioning

- Python Tutor shows **WHAT** your code does.
- Loupe shows **WHEN** your code does it.
- Vivix shows **HOW** the machine physically processes it.

## Feature Comparison

Vivix is the only tool that visualizes instruction-level execution alongside simultaneous heap memory. Existing tools often lack support for modern asynchronous patterns or physical memory states.

| Feature | Vivix | Python Tutor | Loupe | JSV9000 |
|---|---|---|---|---|
| Instruction-level stepping | Yes | Yes | No | No |
| Heap memory visualization | Yes | Partial | No | No |
| Async/Await support | Yes | No | No | No |
| Event loop visualization | Yes | No | Yes | Yes |
| Free-form input | Yes | Yes | Yes | No |
| No account required | Yes | Yes | Yes | Yes |

## 12 Modules + Free-Form Mode

<img width="901" height="797" alt="Screenshot 2026-04-30 at 13 27 59" src="https://github.com/user-attachments/assets/97b3fbd7-0e34-4ca7-bdf1-0b4af9523e43" />


**Free-Form Mode** — Paste any JavaScript and watch the engine narrate every step. Pattern detection identifies recursion, closures, async/await, scope chains, hoisting, and prototype patterns automatically.

1. **varStore** — Variables & Memory: Watch the CPU store values in memory.
2. **ifGate** — Conditionals: See how true and false control the flow.
3. **forLoop** — Iteration: Watch counters climb as the loop runs.
4. **fnCall** — Functions: Values go in, transformations come out.
5. **arrayFlow** — Array Methods: Elements flow through map, filter, and reduce.
6. **objExplorer** — Objects & Hash Maps: See key-value pairs stored in hash maps.
7. **dataStruct** — Data Structures: Stacks, queues, and maps — organized data.
8. **asyncFlow** — Async / Await: Watch promises resolve on a timeline.
9. **closureScope** — Closures & Scope: See which variables a closure captures.
10. **promiseChain** — Promise Methods: Watch .then() and .catch() chain through the microtask queue.
11. **eventListeners** — DOM Events: See how addEventListener registers callbacks and events dispatch.
12. **apiCalls** — HTTP & Fetch(): Trace fetch() requests through suspend, response, and parse.

## Getting Started

Vivix runs entirely in the browser at [vivix.dev](https://vivix.dev). Works in all modern browsers — Chrome, Firefox, Safari, and Edge. No account. No install. No configuration.

To run the repository locally:

```bash
git clone https://github.com/HenryOnilude/vivix.git
cd vivix
npm install
npm run dev
```

The development server will start at http://localhost:5173.

## Tech Stack

- **Framework:** Svelte 5 (using Runes: $state, $derived)
- **Parser:** Acorn AST
- **Code Editor:** CodeMirror 6
- **Animation:** GSAP (GreenSock Animation Platform)
- **Data Visualization:** D3.js
- **Build Tool:** Vite 7

<details>
<summary><strong>Architecture note — how the AST step stream drives animation</strong></summary>

The interpreter runs once per edit inside a Web Worker (`src/lib/interpreter.worker.js`) and produces a flat, immutable array of step snapshots — one per stack push, heap write, loop iteration, or branch evaluation. The UI never re-executes. Scrubbing the timeline, jumping to step 47, or hitting ⟵ at step 300 is a constant-time array index swap into reactive Svelte 5 `$state`.

That separation is what makes the animation layer possible. When the step index advances, `computeVarDiff` (`src/lib/shell-logic.js`) diffs the current step's `vars` against the previous step's, tagging each binding `new`, `changed`, or `same`. GSAP is then fired imperatively from that diff — a three-stage causal flourish (100 ms source-line pulse → 300 ms particle travel → 200 ms landing with `back.out(1.4)` + 600 ms glow fade, defined in `src/lib/animations.js`). Animations describe *cause* rather than clock time, so scrubbing backwards through an `await` resolution or a microtask-queue drain stays visually consistent instead of unwinding a linear timeline.

Two smaller decisions fell out of this shape:

- **Selective worker sanitization.** `postMessage` attempts the raw step array first (zero cost); only on `DataCloneError` does the worker run a `needsSanitize` probe and replace functions / symbols / regexps with descriptive placeholders. Closures-in-loops pay the sanitization cost; a `for` over primitives doesn't.
- **No linear easing, anywhere.** Data doesn't move linearly in the real world, so nothing in Vivix does either. Every animation has a `prefers-reduced-motion` branch that collapses to a single fade.

</details>

## Testing

- 490 tests passing
- Tests cover AST walker logic, async/await step execution, and shared shell utilities.
- Run tests locally using: `npm run test`

## Known Limitations

Vivix is an educational interpreter, not a full JavaScript engine. These trade-offs keep visualizations clear and focused on the concepts that matter most for learning.

- **Flat scope** — `let`/`const` inside blocks (if, for, while) share the outer scope. The classic "closure in a loop with `let`" pattern behaves like `var`.
- **No `this` in standalone functions** — `this` is only supported for class method calls, not general `this` binding.
- **Limited built-ins** — supports core methods (`push`, `pop`, `map`, `filter`, `reduce`, `Object.keys`, `Math.*`) but not the full standard library.
- **No prototypes or `new` outside classes** — use class syntax instead of constructor functions with `new`.
- **500-step limit** — prevents infinite loops but caps very long programs.

## Contributing

Contributions are welcome across all 12 modules. If you are interested in improving the visualization logic or pattern detection, please follow the tech stack guidelines (Svelte 5 / Acorn) and ensure all tests pass before submitting a PR.

## License

MIT — Free and open source.
