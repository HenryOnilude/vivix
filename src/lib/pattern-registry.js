/**
 * Pattern Registry — detects high-level JavaScript patterns from AST nodes
 * and maps them to pre-written three-layer brain text explanations.
 *
 * Each pattern entry contains:
 *   id        — unique pattern key
 *   detect    — function(node, ctx) → match object or null
 *   template  — function(match) → { what, why, connects } (40-60 words total)
 *
 * The interpreter queries the registry at each step via:
 *   queryPattern(node, ctx) → { id, what, why, connects } | null
 *
 * ctx (context) provides:
 *   scope      — current variable bindings { name → value }
 *   parentScopes — array of ancestor scope bindings (outermost first)
 *   fnName     — name of the enclosing function (if any)
 *   ast        — the full program AST
 */

import * as acorn from 'acorn';

// ═══════════════════════════════════════════════════════
// AST WALKING UTILITIES
// ═══════════════════════════════════════════════════════

/**
 * Walk an AST subtree depth-first, calling visitor(node, parent) for every node.
 * Returns early if visitor returns `false`.
 */
export function walkAST(node, visitor, parent = null) {
  if (!node || typeof node !== 'object') return;
  if (visitor(node, parent) === false) return;
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'loc' || key === 'range' ||
        key === 'start' || key === 'end') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) {
        if (c && typeof c === 'object' && c.type) walkAST(c, visitor, node);
      }
    } else if (child && typeof child === 'object' && child.type) {
      walkAST(child, visitor, node);
    }
  }
}

/**
 * Collect all nodes of a given type inside a subtree.
 */
export function collectNodes(root, type) {
  const found = [];
  walkAST(root, (n) => { if (n.type === type) found.push(n); });
  return found;
}

/**
 * Collect all Identifier names referenced inside a subtree.
 */
export function collectIdentifiers(root) {
  const names = new Set();
  walkAST(root, (n) => { if (n.type === 'Identifier') names.add(n.name); });
  return names;
}

/**
 * Extract the function body node from FunctionDeclaration, FunctionExpression,
 * or ArrowFunctionExpression.
 */
export function getFunctionBody(fnNode) {
  if (!fnNode) return null;
  if (fnNode.body && fnNode.body.type === 'BlockStatement') return fnNode.body;
  if (fnNode.body) return fnNode.body; // arrow concise body
  return null;
}

/**
 * Get the declared name of a function node, or null for anonymous.
 */
export function getFunctionName(fnNode) {
  if (fnNode.id && fnNode.id.name) return fnNode.id.name;
  return null;
}

/**
 * Collect parameter names from a function node.
 */
export function getParamNames(fnNode) {
  if (!fnNode.params) return [];
  return fnNode.params.map(p => {
    if (p.type === 'Identifier') return p.name;
    if (p.type === 'AssignmentPattern' && p.left && p.left.type === 'Identifier') return p.left.name;
    if (p.type === 'RestElement' && p.argument && p.argument.type === 'Identifier') return p.argument.name;
    return null;
  }).filter(Boolean);
}

// ═══════════════════════════════════════════════════════
// PATTERN DETECTORS
// ═══════════════════════════════════════════════════════

// ── 1. RECURSION ─────────────────────────────────────────────────────────────

/**
 * Detect recursion: FunctionDeclaration or ArrowFunctionExpression whose body
 * contains a CallExpression targeting the function's own identifier.
 *
 * Returns { fnName, paramNames, callArgs } or null.
 */
export function detectRecursion(node, ctx = {}) {
  // Must be a function-like node
  if (node.type !== 'FunctionDeclaration' &&
      node.type !== 'FunctionExpression' &&
      node.type !== 'ArrowFunctionExpression') return null;

  // Determine the function's own name
  let fnName = getFunctionName(node);

  // For arrow / anonymous function expressions assigned to a variable,
  // the caller can supply ctx.fnName (from the VariableDeclarator id).
  if (!fnName && ctx.fnName) fnName = ctx.fnName;
  if (!fnName) return null;

  const body = getFunctionBody(node);
  if (!body) return null;

  // Search the body for a CallExpression whose callee is this function's name
  let selfCall = null;
  walkAST(body, (n) => {
    if (selfCall) return false; // already found, stop early
    if (n.type === 'CallExpression' &&
        n.callee && n.callee.type === 'Identifier' &&
        n.callee.name === fnName) {
      selfCall = n;
      return false;
    }
  });

  if (!selfCall) return null;

  return {
    pattern: 'recursion',
    fnName,
    paramNames: getParamNames(node),
    callArgs: selfCall.arguments.length,
  };
}

// ── 2. CLOSURES ──────────────────────────────────────────────────────────────

/**
 * Detect closures: a function that references Identifiers bound in a parent
 * scope rather than its own local scope.
 *
 * Returns { fnName, captured } or null.
 */
export function detectClosure(node, ctx = {}) {
  if (node.type !== 'FunctionDeclaration' &&
      node.type !== 'FunctionExpression' &&
      node.type !== 'ArrowFunctionExpression') return null;

  const body = getFunctionBody(node);
  if (!body) return null;

  // Collect local bindings: params + any var/let/const declarations in body
  const locals = new Set(getParamNames(node));
  walkAST(body, (n) => {
    if (n.type === 'VariableDeclarator' && n.id && n.id.type === 'Identifier') {
      locals.add(n.id.name);
    }
    if (n.type === 'FunctionDeclaration' && n.id) {
      locals.add(n.id.name);
    }
  });

  // Collect all identifiers used in the body
  const used = collectIdentifiers(body);

  // Built-ins / globals to ignore
  const BUILTINS = new Set([
    'undefined', 'null', 'true', 'false', 'NaN', 'Infinity',
    'console', 'Math', 'JSON', 'Object', 'Array', 'String',
    'Number', 'Boolean', 'Date', 'RegExp', 'Error', 'Map', 'Set',
    'Promise', 'Symbol', 'parseInt', 'parseFloat', 'isNaN',
    'isFinite', 'setTimeout', 'setInterval', 'clearTimeout',
    'clearInterval', 'arguments', 'this',
  ]);

  // Determine parent-scope bindings
  const parentBindings = new Set();
  const parentScopes = ctx.parentScopes || [];
  for (const scope of parentScopes) {
    for (const name of Object.keys(scope)) parentBindings.add(name);
  }
  // Also check the current scope for outer variables
  if (ctx.scope) {
    for (const name of Object.keys(ctx.scope)) parentBindings.add(name);
  }

  // The function's own name is not a capture
  const fnName = getFunctionName(node) || ctx.fnName || null;
  if (fnName) locals.add(fnName);

  // Captured = used ∩ parentBindings − locals − builtins
  const captured = [];
  for (const name of used) {
    if (!locals.has(name) && !BUILTINS.has(name) && parentBindings.has(name)) {
      captured.push(name);
    }
  }

  if (captured.length === 0) return null;

  return {
    pattern: 'closure',
    fnName,
    captured: [...new Set(captured)],
  };
}

// ── 3. ASYNC / AWAIT ─────────────────────────────────────────────────────────

/**
 * Detect async patterns: async function declarations, await expressions,
 * Promise constructors, or .then/.catch/.finally calls.
 *
 * Returns { subPattern, fnName? } or null.
 */
export function detectAsyncAwait(node, _ctx = {}) {
  // async function declaration / expression
  if ((node.type === 'FunctionDeclaration' ||
       node.type === 'FunctionExpression' ||
       node.type === 'ArrowFunctionExpression') && node.async) {
    return {
      pattern: 'async-await',
      subPattern: 'async-function',
      fnName: getFunctionName(node) || _ctx.fnName || null,
    };
  }

  // await expression
  if (node.type === 'AwaitExpression') {
    return {
      pattern: 'async-await',
      subPattern: 'await',
    };
  }

  // new Promise(...)
  if (node.type === 'NewExpression' &&
      node.callee && node.callee.type === 'Identifier' &&
      node.callee.name === 'Promise') {
    return {
      pattern: 'async-await',
      subPattern: 'promise-constructor',
    };
  }

  // .then / .catch / .finally
  if (node.type === 'CallExpression' &&
      node.callee && node.callee.type === 'MemberExpression' &&
      node.callee.property && node.callee.property.type === 'Identifier') {
    const method = node.callee.property.name;
    if (method === 'then' || method === 'catch' || method === 'finally') {
      return {
        pattern: 'async-await',
        subPattern: `promise-${method}`,
      };
    }
  }

  return null;
}

// ── 4. SCOPE CHAIN ───────────────────────────────────────────────────────────

/**
 * Detect scope-chain lookup: an Identifier reference that is not declared in
 * the local scope and must be resolved by traversing parent scopes.
 *
 * Returns { varName, resolvedIn } or null.
 */
export function detectScopeChain(node, ctx = {}) {
  if (node.type !== 'Identifier') return null;
  const name = node.name;

  const BUILTINS = new Set([
    'undefined', 'null', 'true', 'false', 'NaN', 'Infinity',
    'console', 'Math', 'JSON', 'Object', 'Array', 'String',
    'Number', 'Boolean', 'Date', 'RegExp', 'Error', 'Map', 'Set',
    'Promise', 'Symbol', 'parseInt', 'parseFloat', 'isNaN',
    'isFinite', 'setTimeout', 'setInterval', 'arguments', 'this',
  ]);
  if (BUILTINS.has(name)) return null;

  // Check local scope first
  const localScope = ctx.scope || {};
  if (name in localScope) return null; // local — no chain traversal

  // Walk parent scopes from innermost to outermost
  const parentScopes = ctx.parentScopes || [];
  for (let i = parentScopes.length - 1; i >= 0; i--) {
    if (name in parentScopes[i]) {
      const depth = parentScopes.length - i;
      const label = i === 0 ? 'global' : `parent-${depth}`;
      return {
        pattern: 'scope-chain',
        varName: name,
        resolvedIn: label,
        depth,
      };
    }
  }

  return null;
}

// ── 5. HOISTING & TDZ ───────────────────────────────────────────────────────

/**
 * Detect hoisting / TDZ patterns:
 *   - var declarations (hoisted + initialised to undefined)
 *   - let/const declarations (hoisted but in TDZ until the declaration)
 *   - Identifier access that occurs before its let/const declaration (TDZ violation)
 *
 * Returns { subPattern, varName, keyword } or null.
 */
export function detectHoistingTDZ(node, ctx = {}) {
  // var declaration — hoisted
  if (node.type === 'VariableDeclaration' && node.kind === 'var') {
    const names = node.declarations
      .filter(d => d.id && d.id.type === 'Identifier')
      .map(d => d.id.name);
    if (names.length === 0) return null;
    return {
      pattern: 'hoisting-tdz',
      subPattern: 'var-hoist',
      varNames: names,
      keyword: 'var',
    };
  }

  // let / const declaration — TDZ until this point
  if (node.type === 'VariableDeclaration' && (node.kind === 'let' || node.kind === 'const')) {
    const names = node.declarations
      .filter(d => d.id && d.id.type === 'Identifier')
      .map(d => d.id.name);
    if (names.length === 0) return null;
    return {
      pattern: 'hoisting-tdz',
      subPattern: 'tdz-declaration',
      varNames: names,
      keyword: node.kind,
    };
  }

  // Identifier reference — check if it is accessing a let/const before declaration
  if (node.type === 'Identifier' && ctx.ast) {
    const name = node.name;
    const nodeLoc = node.loc ? node.loc.start.line : null;
    if (!nodeLoc) return null;

    // Find a let/const declaration for this name that appears after this reference
    let declLine = null;
    let declKeyword = null;
    walkAST(ctx.ast, (n) => {
      if (n.type === 'VariableDeclaration' && (n.kind === 'let' || n.kind === 'const')) {
        for (const d of n.declarations) {
          if (d.id && d.id.type === 'Identifier' && d.id.name === name) {
            const dLine = n.loc ? n.loc.start.line : null;
            if (dLine && dLine > nodeLoc) {
              declLine = dLine;
              declKeyword = n.kind;
            }
          }
        }
      }
    });

    if (declLine) {
      return {
        pattern: 'hoisting-tdz',
        subPattern: 'tdz-access',
        varName: name,
        keyword: declKeyword,
        declLine,
        accessLine: nodeLoc,
      };
    }
  }

  return null;
}

// ── 6. PROTOTYPE CHAIN ───────────────────────────────────────────────────────

/**
 * Detect prototype-chain patterns:
 *   - Object.create(...)
 *   - Object.setPrototypeOf(...)
 *   - .prototype = ... assignments
 *   - MemberExpression traversing __proto__
 *
 * Returns { subPattern, target? } or null.
 */
export function detectPrototypeChain(node, _ctx = {}) {
  // Object.create(...)
  if (node.type === 'CallExpression' &&
      node.callee && node.callee.type === 'MemberExpression' &&
      node.callee.object && node.callee.object.type === 'Identifier' &&
      node.callee.object.name === 'Object' &&
      node.callee.property && node.callee.property.type === 'Identifier' &&
      node.callee.property.name === 'create') {
    return {
      pattern: 'prototype-chain',
      subPattern: 'object-create',
    };
  }

  // Object.setPrototypeOf(...)
  if (node.type === 'CallExpression' &&
      node.callee && node.callee.type === 'MemberExpression' &&
      node.callee.object && node.callee.object.type === 'Identifier' &&
      node.callee.object.name === 'Object' &&
      node.callee.property && node.callee.property.type === 'Identifier' &&
      node.callee.property.name === 'setPrototypeOf') {
    return {
      pattern: 'prototype-chain',
      subPattern: 'set-prototype-of',
    };
  }

  // .prototype assignment:  Foo.prototype.bar = ...
  if (node.type === 'AssignmentExpression' &&
      node.left && node.left.type === 'MemberExpression') {
    // Direct: Foo.prototype = ...
    if (node.left.property && node.left.property.type === 'Identifier' &&
        node.left.property.name === 'prototype') {
      const target = node.left.object && node.left.object.type === 'Identifier'
        ? node.left.object.name : null;
      return {
        pattern: 'prototype-chain',
        subPattern: 'prototype-assign',
        target,
      };
    }
    // Nested: Foo.prototype.method = ...
    if (node.left.object && node.left.object.type === 'MemberExpression' &&
        node.left.object.property && node.left.object.property.type === 'Identifier' &&
        node.left.object.property.name === 'prototype') {
      const target = node.left.object.object && node.left.object.object.type === 'Identifier'
        ? node.left.object.object.name : null;
      const method = node.left.property && node.left.property.type === 'Identifier'
        ? node.left.property.name : null;
      return {
        pattern: 'prototype-chain',
        subPattern: 'prototype-method',
        target,
        method,
      };
    }
  }

  // __proto__ access
  if (node.type === 'MemberExpression' &&
      node.property && node.property.type === 'Identifier' &&
      (node.property.name === '__proto__' || node.property.name === 'prototype')) {
    // Avoid duplicate with assignment (handled above)
    return {
      pattern: 'prototype-chain',
      subPattern: 'proto-access',
    };
  }

  // Object.getPrototypeOf(...)
  if (node.type === 'CallExpression' &&
      node.callee && node.callee.type === 'MemberExpression' &&
      node.callee.object && node.callee.object.type === 'Identifier' &&
      node.callee.object.name === 'Object' &&
      node.callee.property && node.callee.property.type === 'Identifier' &&
      node.callee.property.name === 'getPrototypeOf') {
    return {
      pattern: 'prototype-chain',
      subPattern: 'get-prototype-of',
    };
  }

  return null;
}

// ═══════════════════════════════════════════════════════
// THREE-LAYER EXPLANATION TEMPLATES
// ═══════════════════════════════════════════════════════

/**
 * Template format:
 *   what     — mechanical description of the state change (active voice, no "you")
 *   why      — V8 design rationale
 *   connects — forward signal or backward reference to adjacent steps
 *
 * 40-60 words total across all three layers. Continuous prose, no bullet points.
 */

const templates = {

  // ── RECURSION ──────────────────────────────────────────────────────────────

  'recursion': (match) => ({
    what: `The engine parses ${match.fnName} and detects a self-referencing call inside the body, establishing a recursive binding that pushes a new frame onto the call stack per invocation.`,
    why: `V8 allocates a fresh activation record each call so every frame holds independent arguments and local state, preventing shared-mutation across depth.`,
    connects: `The base-case condition determines when the stack unwinds and returns accumulated values.`,
  }),

  // ── CLOSURES ───────────────────────────────────────────────────────────────

  'closure': (match) => ({
    what: `The engine creates ${match.fnName ? match.fnName : 'an anonymous function'} and binds a back-link to the parent scope, capturing ${match.captured.join(', ')} as live references rather than copied values.`,
    why: `V8 promotes captured variables to a heap-resident Context object so the inner function retains access even after the outer frame is destroyed.`,
    connects: `When the closure executes, the engine resolves ${match.captured[0]} by following that back-link before checking the global scope.`,
  }),

  // ── ASYNC / AWAIT ──────────────────────────────────────────────────────────

  'async-await': (match) => {
    const sub = match.subPattern;
    if (sub === 'async-function') {
      return {
        what: `The engine marks ${match.fnName || 'the function'} as async, wrapping its return value in an implicit Promise and enabling await suspension points within the body.`,
        why: `V8 compiles async functions into a state-machine of generator-like checkpoints, allowing the event loop to continue processing microtasks during each suspension.`,
        connects: `The first await expression ahead will pause execution and enqueue the continuation as a microtask on the Promise job queue.`,
      };
    }
    if (sub === 'await') {
      return {
        what: `The engine suspends the current async frame at the await expression, saving the local state and yielding control back to the event loop.`,
        why: `V8 stores the suspended frame in a JSAsyncFunctionObject so the microtask queue can resume it once the awaited Promise settles.`,
        connects: `When the Promise resolves, the engine restores this frame from the saved state and continues execution at the next statement.`,
      };
    }
    if (sub === 'promise-constructor') {
      return {
        what: `The engine allocates a new Promise object on the heap with pending status, executing the executor callback synchronously to wire up resolve and reject handlers.`,
        why: `V8 runs the executor immediately so side-effects register before the constructor returns, guaranteeing predictable scheduling of the first .then handler.`,
        connects: `Any .then or .catch chained onto this Promise will enqueue as microtasks once the executor calls resolve or reject.`,
      };
    }
    // .then / .catch / .finally
    const method = sub.replace('promise-', '');
    return {
      what: `The engine registers a .${method} handler on the Promise, creating a new derived Promise in the chain without executing the callback yet.`,
      why: `V8 defers the callback to the microtask queue so the current synchronous call stack completes first, preserving run-to-completion semantics.`,
      connects: `The callback fires after the parent Promise settles, and its return value becomes the resolution of the derived Promise downstream.`,
    };
  },

  // ── SCOPE CHAIN ────────────────────────────────────────────────────────────

  'scope-chain': (match) => ({
    what: `The engine looks up "${match.varName}" in the local scope, fails to find it, and walks ${match.depth} level${match.depth > 1 ? 's' : ''} up the scope chain to resolve it in the ${match.resolvedIn} execution context.`,
    why: `V8 links each scope to its lexical parent at parse time, so variable resolution follows a deterministic chain rather than a dynamic runtime search.`,
    connects: `Caching this lookup in an inline cache allows subsequent accesses to skip the chain traversal entirely.`,
  }),

  // ── HOISTING & TDZ ─────────────────────────────────────────────────────────

  'hoisting-tdz': (match) => {
    if (match.subPattern === 'var-hoist') {
      return {
        what: `The engine hoists ${match.varNames.join(', ')} to the top of the function scope during compilation, initialising ${match.varNames.length > 1 ? 'each' : 'it'} to undefined before any code executes.`,
        why: `V8 processes var bindings in the creation phase so the scope record is fully allocated before the execution phase begins, avoiding mid-block resizing.`,
        connects: `The assignment ahead overwrites the undefined placeholder with the intended value at the original source location.`,
      };
    }
    if (match.subPattern === 'tdz-declaration') {
      return {
        what: `The engine registers ${match.varNames.join(', ')} as ${match.keyword} in the scope record but marks ${match.varNames.length > 1 ? 'them' : 'it'} uninitialised, creating a temporal dead zone from the block start to this declaration.`,
        why: `V8 enforces the TDZ to surface accidental use-before-declaration bugs that var silently hides by returning undefined.`,
        connects: `Any reference to ${match.varNames[0]} before this line throws a ReferenceError, and the TDZ ends once this initialiser executes.`,
      };
    }
    // tdz-access
    return {
      what: `The engine encounters a reference to "${match.varName}" at line ${match.accessLine}, but the ${match.keyword} declaration does not appear until line ${match.declLine}, placing this access inside the temporal dead zone.`,
      why: `V8 marks ${match.keyword} bindings as uninitialised until the declaration executes, throwing a ReferenceError to prevent reading indeterminate state.`,
      connects: `Moving the declaration above this reference or switching to var eliminates the TDZ violation.`,
    };
  },

  // ── PROTOTYPE CHAIN ────────────────────────────────────────────────────────

  'prototype-chain': (match) => {
    if (match.subPattern === 'object-create') {
      return {
        what: `The engine allocates a new object whose internal [[Prototype]] slot points to the argument passed to Object.create, establishing a direct prototype link.`,
        why: `V8 creates a fresh hidden class for the new object and wires its prototype chain at allocation time so property lookups can traverse the chain in a predictable order.`,
        connects: `Property accesses on this object that miss locally will delegate up the prototype chain to the linked parent.`,
      };
    }
    if (match.subPattern === 'set-prototype-of') {
      return {
        what: `The engine mutates the [[Prototype]] of an existing object via Object.setPrototypeOf, rewiring the prototype chain at runtime.`,
        why: `V8 must invalidate cached hidden classes and inline caches when the prototype changes, making this operation expensive compared to setting the chain at creation.`,
        connects: `Subsequent property lookups on this object now follow the new prototype link rather than the original one.`,
      };
    }
    if (match.subPattern === 'prototype-assign') {
      return {
        what: `The engine replaces the .prototype property on ${match.target || 'the constructor'}, changing the object that new instances will inherit from.`,
        why: `V8 reads .prototype at construction time to set the new object's [[Prototype]], so replacing it affects only instances created after this assignment.`,
        connects: `Existing instances retain the old prototype link and are unaffected by this change.`,
      };
    }
    if (match.subPattern === 'prototype-method') {
      return {
        what: `The engine adds "${match.method}" to ${match.target || 'the constructor'}.prototype, making it available to all instances through prototype delegation.`,
        why: `V8 stores shared methods on the prototype rather than copying them into each instance, saving heap memory and enabling inline-cache sharing across instances.`,
        connects: `When an instance calls .${match.method}(), the engine finds it on the prototype after a single chain step.`,
      };
    }
    if (match.subPattern === 'get-prototype-of') {
      return {
        what: `The engine reads the [[Prototype]] internal slot of the target object via Object.getPrototypeOf, returning the parent in the prototype chain.`,
        why: `V8 exposes this introspection to allow explicit chain inspection without relying on the deprecated __proto__ accessor.`,
        connects: `The returned prototype can be compared or traversed further to map the full inheritance hierarchy.`,
      };
    }
    // proto-access (.__proto__ or .prototype read)
    return {
      what: `The engine accesses the prototype link on the object, traversing one level up the prototype chain to locate inherited properties.`,
      why: `V8 uses hidden classes to store prototype chain shapes, so repeated traversals of the same chain hit optimised inline caches after the first lookup.`,
      connects: `If the property is not found here, the engine continues walking up until reaching Object.prototype, then returns undefined.`,
    };
  },
};

// ═══════════════════════════════════════════════════════
// REGISTRY LOOKUP TABLE
// ═══════════════════════════════════════════════════════

/**
 * Ordered list of detectors. The registry tests each detector in order and
 * returns the first match. Order mirrors conceptual priority:
 *   recursion → closure → async/await → scope-chain → hoisting/tdz → prototype-chain
 */
const detectors = [
  { id: 'recursion',        detect: detectRecursion },
  { id: 'closure',          detect: detectClosure },
  { id: 'async-await',      detect: detectAsyncAwait },
  { id: 'scope-chain',      detect: detectScopeChain },
  { id: 'hoisting-tdz',     detect: detectHoistingTDZ },
  { id: 'prototype-chain',  detect: detectPrototypeChain },
];

/**
 * Query the pattern registry for a given AST node and execution context.
 *
 * @param {object} node — the current AST node
 * @param {object} ctx  — { scope, parentScopes, fnName, ast }
 * @returns {{ id, what, why, connects, match } | null}
 */
export function queryPattern(node, ctx = {}) {
  if (!node || !node.type) return null;
  for (const { id, detect } of detectors) {
    const match = detect(node, ctx);
    if (match) {
      const template = templates[id];
      if (!template) continue;
      const { what, why, connects } = template(match);
      return { id, what, why, connects, match };
    }
  }
  return null;
}

/**
 * Query ALL matching patterns for a given AST node (not just the first).
 * Useful when a single node triggers multiple patterns (e.g. a recursive
 * closure).
 *
 * @param {object} node
 * @param {object} ctx
 * @returns {Array<{ id, what, why, connects, match }>}
 */
export function queryAllPatterns(node, ctx = {}) {
  if (!node || !node.type) return [];
  const results = [];
  for (const { id, detect } of detectors) {
    const match = detect(node, ctx);
    if (match) {
      const template = templates[id];
      if (!template) continue;
      const { what, why, connects } = template(match);
      results.push({ id, what, why, connects, match });
    }
  }
  return results;
}

/**
 * Scan an entire AST and return all detected patterns with their locations.
 *
 * @param {object} ast      — Acorn Program AST
 * @param {object} ctx      — base context (scope, parentScopes)
 * @returns {Array<{ id, what, why, connects, match, loc }>}
 */
export function scanAST(node, ctx = {}) {
  const results = [];
  const enrichedCtx = { ...ctx, ast: node };

  walkAST(node, (n, parent) => {
    // For arrow / function expressions assigned to a variable, inject fnName
    let localCtx = enrichedCtx;
    if (parent && parent.type === 'VariableDeclarator' && parent.id &&
        parent.id.type === 'Identifier' &&
        (n.type === 'ArrowFunctionExpression' || n.type === 'FunctionExpression')) {
      localCtx = { ...enrichedCtx, fnName: parent.id.name };
    }

    const hit = queryPattern(n, localCtx);
    if (hit) {
      results.push({
        ...hit,
        loc: n.loc || null,
      });
    }
  });

  return results;
}

/**
 * Convenience: parse a code string and scan for all patterns.
 *
 * @param {string} code
 * @param {object} ctx — optional context overrides
 * @returns {{ patterns: Array, error: string|null }}
 */
export function detectPatterns(code, ctx = {}) {
  let ast;
  try {
    ast = acorn.parse(code, { ecmaVersion: 2020, sourceType: 'script', locations: true });
  } catch (e) {
    return { patterns: [], error: e.message };
  }
  const patterns = scanAST(ast, ctx);
  return { patterns, error: null };
}
