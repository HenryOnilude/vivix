/**
 * Tests for Pattern Registry — detectors + three-layer templates.
 */

import { describe, it, expect } from 'vitest';
import * as acorn from 'acorn';
import {
  walkAST, collectNodes, collectIdentifiers,
  getFunctionBody, getFunctionName, getParamNames,
  detectRecursion, detectClosure, detectAsyncAwait,
  detectScopeChain, detectHoistingTDZ, detectPrototypeChain,
  queryPattern, queryAllPatterns, scanAST, detectPatterns,
} from './pattern-registry.js';

// ── Helper: parse code and return the AST ──
function parse(code) {
  return acorn.parse(code, { ecmaVersion: 2020, sourceType: 'script', locations: true });
}

// ── Helper: get first node of a given type ──
function firstNode(ast, type) {
  let found = null;
  walkAST(ast, (n) => {
    if (!found && n.type === type) { found = n; return false; }
  });
  return found;
}

// ═══════════════════════════════════════════════════════
// AST WALKING UTILITIES
// ═══════════════════════════════════════════════════════

describe('walkAST', () => {
  it('visits all nodes depth-first', () => {
    const ast = parse('let x = 1;');
    const types = [];
    walkAST(ast, (n) => { types.push(n.type); });
    expect(types).toContain('Program');
    expect(types).toContain('VariableDeclaration');
    expect(types).toContain('VariableDeclarator');
    expect(types).toContain('Literal');
  });

  it('stops walking a subtree when visitor returns false', () => {
    const ast = parse('let x = 1; let y = 2;');
    const types = [];
    walkAST(ast, (n) => {
      types.push(n.type);
      if (n.type === 'VariableDeclaration') return false;
    });
    // Should see Program and both VariableDeclarations, but not deeper nodes
    expect(types.filter(t => t === 'VariableDeclaration').length).toBe(2);
    expect(types).not.toContain('Literal');
  });
});

describe('collectNodes', () => {
  it('collects all nodes of a specific type', () => {
    const ast = parse('let a = 1; let b = 2; let c = 3;');
    const literals = collectNodes(ast, 'Literal');
    expect(literals.length).toBe(3);
    expect(literals.map(n => n.value)).toEqual([1, 2, 3]);
  });
});

describe('collectIdentifiers', () => {
  it('collects all identifier names', () => {
    const ast = parse('let x = y + z;');
    const names = collectIdentifiers(ast);
    expect(names.has('x')).toBe(true);
    expect(names.has('y')).toBe(true);
    expect(names.has('z')).toBe(true);
  });
});

describe('getFunctionBody / getFunctionName / getParamNames', () => {
  it('extracts body, name, and params from FunctionDeclaration', () => {
    const ast = parse('function add(a, b) { return a + b; }');
    const fn = firstNode(ast, 'FunctionDeclaration');
    expect(getFunctionName(fn)).toBe('add');
    expect(getParamNames(fn)).toEqual(['a', 'b']);
    expect(getFunctionBody(fn).type).toBe('BlockStatement');
  });

  it('handles rest parameters', () => {
    const ast = parse('function foo(...args) {}');
    const fn = firstNode(ast, 'FunctionDeclaration');
    expect(getParamNames(fn)).toEqual(['args']);
  });

  it('handles default parameters', () => {
    const ast = parse('function foo(x = 10) {}');
    const fn = firstNode(ast, 'FunctionDeclaration');
    expect(getParamNames(fn)).toEqual(['x']);
  });

  it('returns null name for anonymous function expression', () => {
    const ast = parse('let f = function() {};');
    const fn = firstNode(ast, 'FunctionExpression');
    expect(getFunctionName(fn)).toBe(null);
  });
});

// ═══════════════════════════════════════════════════════
// 1. RECURSION DETECTOR
// ═══════════════════════════════════════════════════════

describe('detectRecursion', () => {
  it('detects recursive FunctionDeclaration', () => {
    const ast = parse('function factorial(n) { if (n <= 1) return 1; return n * factorial(n - 1); }');
    const fn = firstNode(ast, 'FunctionDeclaration');
    const result = detectRecursion(fn);
    expect(result).not.toBeNull();
    expect(result.pattern).toBe('recursion');
    expect(result.fnName).toBe('factorial');
    expect(result.paramNames).toEqual(['n']);
    expect(result.callArgs).toBe(1);
  });

  it('detects recursive ArrowFunctionExpression via ctx.fnName', () => {
    const ast = parse('const fib = (n) => n <= 1 ? n : fib(n - 1) + fib(n - 2);');
    const arrow = firstNode(ast, 'ArrowFunctionExpression');
    const result = detectRecursion(arrow, { fnName: 'fib' });
    expect(result).not.toBeNull();
    expect(result.fnName).toBe('fib');
  });

  it('returns null for non-recursive function', () => {
    const ast = parse('function greet(name) { return "hello " + name; }');
    const fn = firstNode(ast, 'FunctionDeclaration');
    expect(detectRecursion(fn)).toBeNull();
  });

  it('returns null for non-function nodes', () => {
    const ast = parse('let x = 1;');
    const decl = firstNode(ast, 'VariableDeclaration');
    expect(detectRecursion(decl)).toBeNull();
  });

  it('returns null for anonymous function without ctx.fnName', () => {
    const ast = parse('let f = function() { f(); };');
    const fn = firstNode(ast, 'FunctionExpression');
    // No ctx.fnName, and function has no id
    expect(detectRecursion(fn)).toBeNull();
  });

  it('detects recursion in named FunctionExpression', () => {
    const ast = parse('let f = function factorial(n) { return factorial(n - 1); };');
    const fn = firstNode(ast, 'FunctionExpression');
    const result = detectRecursion(fn);
    expect(result).not.toBeNull();
    expect(result.fnName).toBe('factorial');
  });
});

// ═══════════════════════════════════════════════════════
// 2. CLOSURE DETECTOR
// ═══════════════════════════════════════════════════════

describe('detectClosure', () => {
  it('detects closure capturing parent variable', () => {
    const ast = parse('function outer() { let count = 0; function inner() { count++; } }');
    // Find the inner function
    const fns = collectNodes(ast, 'FunctionDeclaration');
    const inner = fns.find(f => f.id.name === 'inner');
    const result = detectClosure(inner, { scope: { count: 0 } });
    expect(result).not.toBeNull();
    expect(result.pattern).toBe('closure');
    expect(result.captured).toContain('count');
  });

  it('returns null when no parent scope is provided', () => {
    const ast = parse('function outer() { let count = 0; function inner() { count++; } }');
    const fns = collectNodes(ast, 'FunctionDeclaration');
    const inner = fns.find(f => f.id.name === 'inner');
    // No ctx at all — cannot determine what is a parent binding
    expect(detectClosure(inner)).toBeNull();
  });

  it('does not treat local variables as captured', () => {
    const ast = parse('function outer() { function inner() { let local = 1; return local; } }');
    const fns = collectNodes(ast, 'FunctionDeclaration');
    const inner = fns.find(f => f.id.name === 'inner');
    expect(detectClosure(inner, { scope: {} })).toBeNull();
  });

  it('ignores built-in identifiers', () => {
    const ast = parse('function foo() { console.log(Math.PI); }');
    const fn = firstNode(ast, 'FunctionDeclaration');
    expect(detectClosure(fn, { scope: {} })).toBeNull();
  });

  it('captures multiple variables', () => {
    const ast = parse('function make() { let a = 1; let b = 2; function inner() { return a + b; } }');
    const fns = collectNodes(ast, 'FunctionDeclaration');
    const inner = fns.find(f => f.id.name === 'inner');
    const result = detectClosure(inner, { scope: { a: 1, b: 2 } });
    expect(result.captured).toContain('a');
    expect(result.captured).toContain('b');
  });
});

// ═══════════════════════════════════════════════════════
// 3. ASYNC / AWAIT DETECTOR
// ═══════════════════════════════════════════════════════

describe('detectAsyncAwait', () => {
  it('detects async function declaration', () => {
    const ast = parse('async function fetchData() {}');
    const fn = firstNode(ast, 'FunctionDeclaration');
    const result = detectAsyncAwait(fn);
    expect(result).not.toBeNull();
    expect(result.pattern).toBe('async-await');
    expect(result.subPattern).toBe('async-function');
    expect(result.fnName).toBe('fetchData');
  });

  it('detects await expression', () => {
    // Parse as module so await is valid at top-level inside async
    const code = 'async function f() { await Promise.resolve(1); }';
    const ast = acorn.parse(code, { ecmaVersion: 2020, sourceType: 'module', locations: true });
    const awaitNode = firstNode(ast, 'AwaitExpression');
    const result = detectAsyncAwait(awaitNode);
    expect(result.subPattern).toBe('await');
  });

  it('detects new Promise(...)', () => {
    const ast = parse('let p = new Promise(function(resolve) { resolve(1); });');
    const newExpr = firstNode(ast, 'NewExpression');
    const result = detectAsyncAwait(newExpr);
    expect(result.subPattern).toBe('promise-constructor');
  });

  it('detects .then() call', () => {
    const ast = parse('p.then(function(v) { return v; });');
    const call = firstNode(ast, 'CallExpression');
    const result = detectAsyncAwait(call);
    expect(result.subPattern).toBe('promise-then');
  });

  it('detects .catch() call', () => {
    const ast = parse('p.catch(function(e) {});');
    const call = firstNode(ast, 'CallExpression');
    const result = detectAsyncAwait(call);
    expect(result.subPattern).toBe('promise-catch');
  });

  it('detects .finally() call', () => {
    const ast = parse('p.finally(function() {});');
    const call = firstNode(ast, 'CallExpression');
    const result = detectAsyncAwait(call);
    expect(result.subPattern).toBe('promise-finally');
  });

  it('returns null for regular function', () => {
    const ast = parse('function foo() {}');
    const fn = firstNode(ast, 'FunctionDeclaration');
    expect(detectAsyncAwait(fn)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════
// 4. SCOPE CHAIN DETECTOR
// ═══════════════════════════════════════════════════════

describe('detectScopeChain', () => {
  it('detects variable resolved in parent scope', () => {
    const ast = parse('x;');
    const id = firstNode(ast, 'Identifier');
    const result = detectScopeChain(id, {
      scope: {},
      parentScopes: [{ x: 10 }],
    });
    expect(result).not.toBeNull();
    expect(result.pattern).toBe('scope-chain');
    expect(result.varName).toBe('x');
    expect(result.resolvedIn).toBe('global');
    expect(result.depth).toBe(1);
  });

  it('returns null when variable is in local scope', () => {
    const ast = parse('x;');
    const id = firstNode(ast, 'Identifier');
    expect(detectScopeChain(id, { scope: { x: 5 } })).toBeNull();
  });

  it('ignores built-in identifiers', () => {
    const ast = parse('console;');
    const id = firstNode(ast, 'Identifier');
    expect(detectScopeChain(id, { scope: {}, parentScopes: [] })).toBeNull();
  });

  it('resolves in nearest parent (innermost first)', () => {
    const ast = parse('x;');
    const id = firstNode(ast, 'Identifier');
    const result = detectScopeChain(id, {
      scope: {},
      parentScopes: [{ x: 'global' }, { x: 'parent' }],
    });
    expect(result.resolvedIn).toBe('parent-1');
    expect(result.depth).toBe(1);
  });

  it('reports depth > 1 for deeply nested lookup', () => {
    const ast = parse('x;');
    const id = firstNode(ast, 'Identifier');
    const result = detectScopeChain(id, {
      scope: {},
      parentScopes: [{ x: 'global' }, {}, {}],
    });
    expect(result.depth).toBe(3);
    expect(result.resolvedIn).toBe('global');
  });
});

// ═══════════════════════════════════════════════════════
// 5. HOISTING & TDZ DETECTOR
// ═══════════════════════════════════════════════════════

describe('detectHoistingTDZ', () => {
  it('detects var declaration as hoisted', () => {
    const ast = parse('var x = 5;');
    const decl = firstNode(ast, 'VariableDeclaration');
    const result = detectHoistingTDZ(decl);
    expect(result).not.toBeNull();
    expect(result.pattern).toBe('hoisting-tdz');
    expect(result.subPattern).toBe('var-hoist');
    expect(result.varNames).toEqual(['x']);
    expect(result.keyword).toBe('var');
  });

  it('detects let declaration as TDZ', () => {
    const ast = parse('let y = 10;');
    const decl = firstNode(ast, 'VariableDeclaration');
    const result = detectHoistingTDZ(decl);
    expect(result.subPattern).toBe('tdz-declaration');
    expect(result.keyword).toBe('let');
  });

  it('detects const declaration as TDZ', () => {
    const ast = parse('const z = 42;');
    const decl = firstNode(ast, 'VariableDeclaration');
    const result = detectHoistingTDZ(decl);
    expect(result.subPattern).toBe('tdz-declaration');
    expect(result.keyword).toBe('const');
  });

  it('detects multiple var names in a single declaration', () => {
    const ast = parse('var a = 1, b = 2;');
    const decl = firstNode(ast, 'VariableDeclaration');
    const result = detectHoistingTDZ(decl);
    expect(result.varNames).toEqual(['a', 'b']);
  });

  it('returns null for non-declaration nodes without ast context', () => {
    const ast = parse('let x = 1;');
    const lit = firstNode(ast, 'Literal');
    expect(detectHoistingTDZ(lit)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════
// 6. PROTOTYPE CHAIN DETECTOR
// ═══════════════════════════════════════════════════════

describe('detectPrototypeChain', () => {
  it('detects Object.create()', () => {
    const ast = parse('let child = Object.create(parent);');
    const call = firstNode(ast, 'CallExpression');
    const result = detectPrototypeChain(call);
    expect(result).not.toBeNull();
    expect(result.subPattern).toBe('object-create');
  });

  it('detects Object.setPrototypeOf()', () => {
    const ast = parse('Object.setPrototypeOf(child, parent);');
    const call = firstNode(ast, 'CallExpression');
    const result = detectPrototypeChain(call);
    expect(result.subPattern).toBe('set-prototype-of');
  });

  it('detects Foo.prototype = ... assignment', () => {
    const ast = parse('Foo.prototype = {};');
    const assign = firstNode(ast, 'AssignmentExpression');
    const result = detectPrototypeChain(assign);
    expect(result.subPattern).toBe('prototype-assign');
    expect(result.target).toBe('Foo');
  });

  it('detects Foo.prototype.method = ... assignment', () => {
    const ast = parse('Foo.prototype.greet = function() {};');
    const assign = firstNode(ast, 'AssignmentExpression');
    const result = detectPrototypeChain(assign);
    expect(result.subPattern).toBe('prototype-method');
    expect(result.target).toBe('Foo');
    expect(result.method).toBe('greet');
  });

  it('detects Object.getPrototypeOf()', () => {
    const ast = parse('Object.getPrototypeOf(obj);');
    const call = firstNode(ast, 'CallExpression');
    const result = detectPrototypeChain(call);
    expect(result.subPattern).toBe('get-prototype-of');
  });

  it('detects __proto__ access', () => {
    const ast = parse('obj.__proto__;');
    const member = firstNode(ast, 'MemberExpression');
    const result = detectPrototypeChain(member);
    expect(result.subPattern).toBe('proto-access');
  });

  it('returns null for unrelated call expressions', () => {
    const ast = parse('Math.floor(1.5);');
    const call = firstNode(ast, 'CallExpression');
    expect(detectPrototypeChain(call)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════
// THREE-LAYER TEMPLATE VALIDATION
// ═══════════════════════════════════════════════════════

describe('Three-layer templates', () => {
  it('recursion template has what/why/connects with no second person', () => {
    const ast = parse('function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }');
    const fn = firstNode(ast, 'FunctionDeclaration');
    const result = queryPattern(fn);
    expect(result).not.toBeNull();
    expect(result.id).toBe('recursion');
    expect(result.what).toBeTruthy();
    expect(result.why).toBeTruthy();
    expect(result.connects).toBeTruthy();
    // No second person ("you")
    const full = result.what + result.why + result.connects;
    expect(full.toLowerCase()).not.toContain('you ');
    expect(full.toLowerCase()).not.toContain('your');
    // Should mention "the engine"
    expect(full.toLowerCase()).toContain('engine');
  });

  it('recursion template is 40-60 words total', () => {
    const ast = parse('function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }');
    const fn = firstNode(ast, 'FunctionDeclaration');
    const result = queryPattern(fn);
    const words = (result.what + ' ' + result.why + ' ' + result.connects).split(/\s+/).length;
    expect(words).toBeGreaterThanOrEqual(40);
    expect(words).toBeLessThanOrEqual(60);
  });

  it('closure template has correct structure', () => {
    const ast = parse('function outer() { let x = 1; function inner() { return x; } }');
    const fns = collectNodes(ast, 'FunctionDeclaration');
    const inner = fns.find(f => f.id.name === 'inner');
    const result = queryPattern(inner, { scope: { x: 1 } });
    expect(result.id).toBe('closure');
    const full = result.what + result.why + result.connects;
    expect(full.toLowerCase()).not.toContain('you ');
    expect(full.toLowerCase()).toContain('engine');
  });

  it('async-await template (async-function) has correct structure', () => {
    const ast = parse('async function fetchData() {}');
    const fn = firstNode(ast, 'FunctionDeclaration');
    const result = queryPattern(fn);
    expect(result.id).toBe('async-await');
    const full = result.what + result.why + result.connects;
    expect(full.toLowerCase()).not.toContain('you ');
  });

  it('scope-chain template mentions the variable name', () => {
    const ast = parse('x;');
    const id = firstNode(ast, 'Identifier');
    const result = queryPattern(id, { scope: {}, parentScopes: [{ x: 1 }] });
    expect(result.id).toBe('scope-chain');
    expect(result.what).toContain('x');
  });

  it('hoisting-tdz (var-hoist) template has correct structure', () => {
    const ast = parse('var counter = 0;');
    const decl = firstNode(ast, 'VariableDeclaration');
    const result = queryPattern(decl);
    expect(result.id).toBe('hoisting-tdz');
    const full = result.what + result.why + result.connects;
    expect(full.toLowerCase()).not.toContain('you ');
    expect(full.toLowerCase()).toContain('engine');
  });

  it('prototype-chain (object-create) template has correct structure', () => {
    const ast = parse('let child = Object.create(parent);');
    const call = firstNode(ast, 'CallExpression');
    const result = queryPattern(call);
    expect(result.id).toBe('prototype-chain');
    const full = result.what + result.why + result.connects;
    expect(full.toLowerCase()).not.toContain('you ');
  });
});

// ═══════════════════════════════════════════════════════
// REGISTRY QUERY API
// ═══════════════════════════════════════════════════════

describe('queryPattern', () => {
  it('returns null for non-matching node', () => {
    const ast = parse('let x = 1;');
    const lit = firstNode(ast, 'Literal');
    expect(queryPattern(lit)).toBeNull();
  });

  it('returns null for null/undefined input', () => {
    expect(queryPattern(null)).toBeNull();
    expect(queryPattern(undefined)).toBeNull();
    expect(queryPattern({})).toBeNull();
  });

  it('returns first matching pattern (priority order)', () => {
    // A recursive function that also captures from parent scope
    const ast = parse(`
      function outer() {
        let count = 0;
        function recurse(n) { count++; return n <= 0 ? count : recurse(n - 1); }
      }
    `);
    const fns = collectNodes(ast, 'FunctionDeclaration');
    const recurse = fns.find(f => f.id.name === 'recurse');
    // Recursion has higher priority than closure
    const result = queryPattern(recurse, { scope: { count: 0 } });
    expect(result.id).toBe('recursion');
  });
});

describe('queryAllPatterns', () => {
  it('returns multiple patterns for a node that matches several detectors', () => {
    const ast = parse(`
      function outer() {
        let count = 0;
        function recurse(n) { count++; return n <= 0 ? count : recurse(n - 1); }
      }
    `);
    const fns = collectNodes(ast, 'FunctionDeclaration');
    const recurse = fns.find(f => f.id.name === 'recurse');
    const results = queryAllPatterns(recurse, { scope: { count: 0 } });
    const ids = results.map(r => r.id);
    expect(ids).toContain('recursion');
    expect(ids).toContain('closure');
  });

  it('returns empty array for non-matching node', () => {
    expect(queryAllPatterns({ type: 'Literal', value: 1 })).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════
// FULL AST SCAN
// ═══════════════════════════════════════════════════════

describe('scanAST', () => {
  it('scans an entire AST and finds all patterns', () => {
    const ast = parse('function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }');
    const results = scanAST(ast);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe('recursion');
  });

  it('injects fnName for arrow functions assigned to variables', () => {
    const ast = parse('const fib = (n) => n <= 1 ? n : fib(n - 1) + fib(n - 2);');
    const results = scanAST(ast);
    const recur = results.find(r => r.id === 'recursion');
    expect(recur).toBeTruthy();
    expect(recur.match.fnName).toBe('fib');
  });

  it('detects var hoisting in a full program', () => {
    const ast = parse('var x = 1; var y = 2;');
    const results = scanAST(ast);
    const hoists = results.filter(r => r.id === 'hoisting-tdz');
    expect(hoists.length).toBe(2);
  });
});

describe('detectPatterns (convenience)', () => {
  it('parses code and returns patterns', () => {
    const { patterns, error } = detectPatterns(
      'function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }'
    );
    expect(error).toBeNull();
    expect(patterns.length).toBeGreaterThanOrEqual(1);
    expect(patterns[0].id).toBe('recursion');
  });

  it('returns error for invalid syntax', () => {
    const { patterns, error } = detectPatterns('function (');
    expect(error).toBeTruthy();
    expect(patterns).toEqual([]);
  });

  it('detects prototype-chain patterns in code string', () => {
    const { patterns } = detectPatterns('let child = Object.create(parent);');
    const proto = patterns.find(r => r.id === 'prototype-chain');
    expect(proto).toBeTruthy();
    expect(proto.match.subPattern).toBe('object-create');
  });
});
