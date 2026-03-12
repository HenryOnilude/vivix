# visualJS — See How JavaScript Thinks

A visual JavaScript runtime, one concept at a time. Type real JS, hit Play, watch it execute as physics-based animations.

**Stack:** Svelte + Acorn (AST) + GSAP (animation) + D3.js (dashboard)

## Setup

```bash
cd visual-learning && npm install && npm run dev
```

## Modules

| Module | Concept | Metaphor |
|--------|---------|----------|
| **ifGate** | Conditionals | Circle passes through or bounces off a gate |
| **forLoop** | Iteration | Circle orbits a track, one lap per iteration |
| **fnCall** | Functions | Value drops into a box, transformed output emerges |
| **arrayFlow** | Array Methods | Elements flow through a pipeline (filter, map, reduce) |

## Architecture

Each module follows the same three-layer pattern:

1. **Acorn** parses input into an AST (viewable via Show AST button)
2. **new Function()** evaluates with a sandboxed scope (pre-defined variables per module)
3. **GSAP** animates the result with physics-based metaphors
4. **D3** tracks every run on a mini dashboard (persisted in localStorage)
