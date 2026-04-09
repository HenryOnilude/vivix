/**
 * Parser module — Acorn-based parsing, friendly error messages, and
 * unsupported-syntax checking.
 *
 * Extracted from interpreter.js for single-responsibility.
 */

import * as acorn from 'acorn';

// ── Parse code into AST, returning { ast, error } ──
export function parseCode(code) {
  try {
    const ast = acorn.parse(code, {
      ecmaVersion: 2020,
      sourceType: 'script',
      locations: true,
    });
    return { ast, error: null };
  } catch (e) {
    const fe = friendlyError(e.message, code);
    return { ast: null, error: `Syntax error: ${e.message}`, friendly: fe };
  }
}

// ── Beginner-friendly error messages ──────────────────────────────────────────
/**
 * Wraps a raw error message with a beginner-friendly explanation.
 * Returns { friendly: string, hint: string, raw: string }.
 *
 * @param {string} raw       — the original error message
 * @param {string} code      — full source code (for context)
 * @param {number|string} line — line number where the error occurred (1-indexed or '?')
 */
export function friendlyError(raw, code = '', line = '?') {
  const msg = raw || '';
  const lines = code.split('\n');
  const srcLine = typeof line === 'number' && line >= 1 && line <= lines.length
    ? lines[line - 1].trim()
    : '';

  // ── Syntax errors ───────────────────────────────────────────────────────
  if (/Unexpected token/i.test(msg)) {
    return {
      friendly: 'There\'s a character or symbol JavaScript wasn\'t expecting here.',
      hint: 'Common causes:\n• A missing closing bracket ), ], or }\n• A typo in a keyword (e.g. "fucntion" instead of "function")\n• A missing operator between two values\n\nTry reading the line carefully and matching every opening bracket with a closing one.',
      raw
    };
  }

  if (/Unexpected end of input/i.test(msg) || /Unterminated/i.test(msg)) {
    return {
      friendly: 'Your code ends before JavaScript expected it to.',
      hint: 'This usually means:\n• A missing closing } for an if, for, or function block\n• A string that was opened with " or \' but never closed\n• A missing ) at the end of a function call\n\nCount your opening and closing brackets — they should match!',
      raw
    };
  }

  if (/Missing initializer in const/i.test(msg)) {
    return {
      friendly: 'A `const` variable must be given a value when it\'s declared.',
      hint: 'Unlike `let`, `const` requires an initial value because it can\'t be changed later.\n\nChange:\n  const x;\nTo:\n  const x = 0;',
      raw
    };
  }

  // ── Reference errors (undefined variables) ──────────────────────────────
  if (/is not defined/i.test(msg)) {
    const match = msg.match(/(\w+)\s+is not defined/i);
    const varName = match ? match[1] : 'the variable';
    return {
      friendly: `You tried to use "${varName}" but it hasn't been declared yet.`,
      hint: `Before using a variable, you need to create it with let, const, or var.\n\nTry adding this before line ${line}:\n  let ${varName} = /* some value */;\n\nOther possibilities:\n• "${varName}" might be misspelled — check the name carefully\n• It might be declared inside a different scope (like inside an if or for block)`,
      raw
    };
  }

  // ── Type errors ─────────────────────────────────────────────────────────
  if (/is not a function/i.test(msg)) {
    const match = msg.match(/(\S+)\s+is not a function/i);
    const name = match ? match[1] : 'this value';
    return {
      friendly: `You tried to call "${name}" as a function, but it isn't one.`,
      hint: `This means "${name}" is a value (like a number, string, or object) rather than a function.\n\nCommon causes:\n• Misspelled function name\n• Forgot to define the function before calling it\n• Overwriting a function with a non-function value\n\nCheck that "${name}" is declared with: function ${name}(...) { ... }`,
      raw
    };
  }

  if (/Cannot read propert/i.test(msg) || /Cannot access/i.test(msg)) {
    const propMatch = msg.match(/propert(?:y|ies)\s+['"]?(\w+)['"]?/i);
    const prop = propMatch ? propMatch[1] : 'a property';
    return {
      friendly: `You tried to access ".${prop}" on something that is undefined or null.`,
      hint: `This happens when you try to read a property of a value that doesn't exist yet.\n\nFor example:\n  let user;         // user is undefined\n  user.name;        // Error! Can't read "name" of undefined\n\nFix: Make sure the variable holds an object before accessing its properties:\n  let user = { name: "Alice" };\n  user.name;        // "Alice"`,
      raw
    };
  }

  if (/Assignment to constant/i.test(msg) || /Assignment to const/i.test(msg)) {
    return {
      friendly: 'You tried to change a `const` variable, which isn\'t allowed.',
      hint: '`const` means "constant" — once set, it can\'t be changed.\n\nTwo options:\n1. Use `let` instead of `const` if you need to change it later\n2. Keep `const` and don\'t reassign it\n\nconst is great for values that should never change, like:\n  const PI = 3.14159;\n  const APP_NAME = "Vivix";',
      raw
    };
  }

  // ── Range / overflow errors ─────────────────────────────────────────────
  if (/Maximum call stack/i.test(msg) || /too much recursion/i.test(msg)) {
    return {
      friendly: 'Your code called itself too many times (infinite recursion).',
      hint: 'A function that calls itself needs a "base case" — a condition that stops the recursion.\n\nFor example:\n  function countdown(n) {\n    if (n <= 0) return;  // base case — stops here!\n    countdown(n - 1);   // recursive call\n  }\n\nWithout the base case, the function calls itself forever until the computer runs out of memory.',
      raw
    };
  }

  if (/Invalid array length/i.test(msg)) {
    return {
      friendly: 'You tried to create an array with an invalid size.',
      hint: 'Array lengths must be non-negative whole numbers.\n\nFor example:\n  new Array(-1)    // Error!\n  new Array(3.5)   // Error!\n  new Array(3)     // OK — creates an array with 3 empty slots',
      raw
    };
  }

  // ── Loop guard (our interpreter-specific) ───────────────────────────────
  if (/loop guard|infinite loop|10000/i.test(msg)) {
    return {
      friendly: 'Your loop ran over 10,000 times — it looks like an infinite loop.',
      hint: 'An infinite loop happens when the loop\'s exit condition is never met.\n\nCheck:\n• Is the loop variable being updated? (e.g. i++ in a for loop)\n• Will the condition ever become false?\n• Did you accidentally use = (assignment) instead of === (comparison)?\n\nExample of a bug:\n  for (let i = 0; i < 10; i--)  // i-- goes the wrong way!',
      raw
    };
  }

  // ── Interpreter-specific: unsupported syntax ────────────────────────────
  if (/Unsupported feature/i.test(msg)) {
    return {
      friendly: 'Your code uses a feature this visualizer doesn\'t support yet.',
      hint: 'The visualizer supports most common JavaScript, but some advanced features aren\'t available yet:\n• async/await — try using the Async module instead\n• import/export — write all code in one block\n• generators (yield) — not yet supported\n• optional chaining (?.) — use regular property access\n\nTry rewriting your code with simpler syntax.',
      raw
    };
  }

  // ── Fallback ────────────────────────────────────────────────────────────
  return {
    friendly: 'Something went wrong while running your code.',
    hint: `The error message was: "${raw}"\n\nSome things to try:\n• Check for typos in variable and function names\n• Make sure every { has a matching }\n• Make sure every ( has a matching )\n• Check that variables are declared before they're used`,
    raw
  };
}

// ── Unsupported-syntax guard ────────────────────────────────────────────────
/**
 * Walk an Acorn AST and report the first unsupported language feature.
 * Returns { ok: true } or { ok: false, message: string }.
 *
 * @param {object} ast
 * @returns {{ ok: boolean, message?: string }}
 */
export function checkSupported(ast) {
  /** Features we know the interpreter cannot handle */
  const UNSUPPORTED_TYPES = {
    AwaitExpression:            'async/await',
    YieldExpression:            'generators (yield)',
    ImportDeclaration:          'import statements',
    ExportNamedDeclaration:     'export statements',
    ExportDefaultDeclaration:   'export statements',
    ExportAllDeclaration:       'export statements',
    TaggedTemplateExpression:   'tagged template literals',
    ChainExpression:            'optional chaining (?.)',
  };

  const errors = [];

  function walk(node) {
    if (!node || typeof node !== 'object') return;

    // Async functions (async flag on function nodes)
    if (node.async === true && (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression'  ||
      node.type === 'ArrowFunctionExpression'
    )) {
      const line = node.loc ? node.loc.start.line : '?';
      errors.push(`async functions (line ${line})`);
    }

    if (UNSUPPORTED_TYPES[node.type]) {
      const line = node.loc ? node.loc.start.line : '?';
      errors.push(`${UNSUPPORTED_TYPES[node.type]} (line ${line})`);
    }

    // Walk all child properties
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'loc' || key === 'range' ||
          key === 'start' || key === 'end') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(c => { if (c && typeof c === 'object' && c.type) walk(c); });
      } else if (child && typeof child === 'object' && child.type) {
        walk(child);
      }
    }
  }

  if (ast && ast.body) ast.body.forEach(walk);

  if (errors.length === 0) return { ok: true };
  const unique = [...new Set(errors)];
  return {
    ok:      false,
    message: `Unsupported feature: ${unique[0]}. This visualizer doesn't support this syntax yet.`
  };
}
