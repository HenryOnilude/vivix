/**
 * AST-based JavaScript interpreter using Acorn.
 * Replaces all regex-based interpreters across modules.
 * 
 * Produces step-by-step execution traces with:
 *   lineIndex, nextLineIndex, vars, output, highlight, phase,
 *   brain, memLabel, memOps, comps, and module-specific fields.
 */
import * as acorn from 'acorn';
import { dc, fv, byteSize, totalBytes } from './utils.js';

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
    return { ast: null, error: `Syntax error: ${e.message}` };
  }
}

// ── Map AST node to source line (0-indexed) ──
function nodeLine(node) {
  return node && node.loc ? node.loc.start.line - 1 : -1;
}

// ── Find next meaningful line after current ──
function findNextLine(lines, fromLine) {
  for (let i = fromLine + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t && t !== '{' && t !== '}' && !t.startsWith('//')) return i;
  }
  return -1;
}

// ── Safely evaluate an AST expression node against current vars ──
function evalNode(node, vars) {
  if (!node) return undefined;

  switch (node.type) {
    case 'Literal':
      return node.value;

    case 'Identifier':
      if (node.name in vars) return vars[node.name];
      // Built-in constants
      if (node.name === 'undefined') return undefined;
      if (node.name === 'true') return true;
      if (node.name === 'false') return false;
      if (node.name === 'null') return null;
      if (node.name === 'Infinity') return Infinity;
      if (node.name === 'NaN') return NaN;
      return undefined;

    case 'TemplateLiteral': {
      let result = '';
      for (let i = 0; i < node.quasis.length; i++) {
        result += node.quasis[i].value.cooked;
        if (i < node.expressions.length) {
          result += String(evalNode(node.expressions[i], vars));
        }
      }
      return result;
    }

    case 'BinaryExpression':
    case 'LogicalExpression':
      return evalBinary(node, vars);

    case 'UnaryExpression':
      return evalUnary(node, vars);

    case 'ConditionalExpression': {
      const test = evalNode(node.test, vars);
      return test ? evalNode(node.consequent, vars) : evalNode(node.alternate, vars);
    }

    case 'AssignmentExpression': {
      const val = evalAssign(node, vars);
      return val;
    }

    case 'UpdateExpression': {
      const name = node.argument.name;
      const old = vars[name];
      if (node.operator === '++') { vars[name] = old + 1; return node.prefix ? old + 1 : old; }
      if (node.operator === '--') { vars[name] = old - 1; return node.prefix ? old - 1 : old; }
      return old;
    }

    case 'MemberExpression':
      return evalMember(node, vars);

    case 'CallExpression':
      return evalCall(node, vars);

    case 'ArrayExpression':
      return node.elements.map(el => el ? evalNode(el, vars) : undefined);

    case 'ObjectExpression': {
      const obj = {};
      for (const prop of node.properties) {
        if (prop.type === 'SpreadElement') {
          const spread = evalNode(prop.argument, vars);
          if (typeof spread === 'object' && spread !== null) Object.assign(obj, spread);
        } else {
          const key = prop.key.type === 'Identifier' ? prop.key.name : evalNode(prop.key, vars);
          obj[key] = evalNode(prop.value, vars);
        }
      }
      return obj;
    }

    case 'SpreadElement':
      return evalNode(node.argument, vars);

    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return createFuncFromNode(node, vars);

    case 'SequenceExpression':
      return node.expressions.reduce((_, expr) => evalNode(expr, vars), undefined);

    default:
      return undefined;
  }
}

function evalBinary(node, vars) {
  const l = evalNode(node.left, vars);
  // Short-circuit for logical
  if (node.operator === '&&') return l ? evalNode(node.right, vars) : l;
  if (node.operator === '||') return l ? l : evalNode(node.right, vars);
  if (node.operator === '??') return l !== null && l !== undefined ? l : evalNode(node.right, vars);

  const r = evalNode(node.right, vars);
  switch (node.operator) {
    case '+': return l + r;
    case '-': return l - r;
    case '*': return l * r;
    case '/': return l / r;
    case '%': return l % r;
    case '**': return l ** r;
    case '===': return l === r;
    case '!==': return l !== r;
    case '==': return l == r;
    case '!=': return l != r;
    case '<': return l < r;
    case '>': return l > r;
    case '<=': return l <= r;
    case '>=': return l >= r;
    case '&': return l & r;
    case '|': return l | r;
    case '^': return l ^ r;
    case '<<': return l << r;
    case '>>': return l >> r;
    case '>>>': return l >>> r;
    case 'in': return l in r;
    case 'instanceof': return false; // simplified
    default: return undefined;
  }
}

function evalUnary(node, vars) {
  const arg = evalNode(node.argument, vars);
  switch (node.operator) {
    case '-': return -arg;
    case '+': return +arg;
    case '!': return !arg;
    case 'typeof': return typeof arg;
    case 'void': return undefined;
    default: return undefined;
  }
}

function evalAssign(node, vars) {
  const val = evalNode(node.right, vars);
  if (node.left.type === 'Identifier') {
    const name = node.left.name;
    switch (node.operator) {
      case '=': vars[name] = val; break;
      case '+=': vars[name] = vars[name] + val; break;
      case '-=': vars[name] = vars[name] - val; break;
      case '*=': vars[name] = vars[name] * val; break;
      case '/=': vars[name] = vars[name] / val; break;
      case '%=': vars[name] = vars[name] % val; break;
      default: vars[name] = val;
    }
    return vars[name];
  }
  if (node.left.type === 'MemberExpression') {
    const obj = evalNode(node.left.object, vars);
    const prop = node.left.computed ? evalNode(node.left.property, vars) : node.left.property.name;
    if (obj && typeof obj === 'object') {
      switch (node.operator) {
        case '=': obj[prop] = val; break;
        case '+=': obj[prop] = obj[prop] + val; break;
        case '-=': obj[prop] = obj[prop] - val; break;
        default: obj[prop] = val;
      }
      return obj[prop];
    }
  }
  return val;
}

function evalMember(node, vars) {
  const obj = evalNode(node.object, vars);
  if (obj === undefined || obj === null) return undefined;
  const prop = node.computed ? evalNode(node.property, vars) : node.property.name;

  // Built-in property access
  if (prop === 'length' && (Array.isArray(obj) || typeof obj === 'string')) return obj.length;

  return obj[prop];
}

function evalCall(node, vars) {
  // console.log
  if (node.callee.type === 'MemberExpression' &&
      node.callee.object.type === 'Identifier' &&
      node.callee.object.name === 'console' &&
      node.callee.property.name === 'log') {
    return '__CONSOLE_LOG__';
  }

  // Array/Object methods via member expression
  if (node.callee.type === 'MemberExpression') {
    const obj = evalNode(node.callee.object, vars);
    const method = node.callee.computed ? evalNode(node.callee.property, vars) : node.callee.property.name;

    // Static methods: Object.keys, Object.values, Object.entries
    if (node.callee.object.type === 'Identifier' && node.callee.object.name === 'Object') {
      const arg = evalNode(node.arguments[0], vars);
      if (method === 'keys') return Object.keys(arg || {});
      if (method === 'values') return Object.values(arg || {});
      if (method === 'entries') return Object.entries(arg || {});
    }

    if (Array.isArray(obj)) {
      const args = node.arguments.map(a => evalNode(a, vars));
      if (method === 'push') { obj.push(...args); return obj.length; }
      if (method === 'pop') return obj.pop();
      if (method === 'shift') return obj.shift();
      if (method === 'unshift') { obj.unshift(...args); return obj.length; }
      if (method === 'indexOf') return obj.indexOf(args[0]);
      if (method === 'includes') return obj.includes(args[0]);
      if (method === 'splice') return obj.splice(...args);
      if (method === 'join') return obj.join(args[0]);
      if (method === 'reverse') { obj.reverse(); return obj; }
      if (method === 'slice') return obj.slice(...args);
      if (method === 'concat') return obj.concat(...args);
      if (method === 'sort') {
        if (args[0] && typeof args[0] === 'function') { obj.sort(args[0]); }
        else { obj.sort(); }
        return obj;
      }
      if (method === 'map' && typeof args[0] === 'function') return obj.map(args[0]);
      if (method === 'filter' && typeof args[0] === 'function') return obj.filter(args[0]);
      if (method === 'reduce' && typeof args[0] === 'function') return args.length > 1 ? obj.reduce(args[0], args[1]) : obj.reduce(args[0]);
      if (method === 'forEach' && typeof args[0] === 'function') { obj.forEach(args[0]); return undefined; }
      if (method === 'find' && typeof args[0] === 'function') return obj.find(args[0]);
      if (method === 'findIndex' && typeof args[0] === 'function') return obj.findIndex(args[0]);
      if (method === 'every' && typeof args[0] === 'function') return obj.every(args[0]);
      if (method === 'some' && typeof args[0] === 'function') return obj.some(args[0]);
      if (method === 'flat') return obj.flat(args[0]);
    }

    if (typeof obj === 'string') {
      const args = node.arguments.map(a => evalNode(a, vars));
      if (method === 'charAt') return obj.charAt(args[0]);
      if (method === 'indexOf') return obj.indexOf(args[0]);
      if (method === 'slice') return obj.slice(...args);
      if (method === 'substring') return obj.substring(...args);
      if (method === 'toUpperCase') return obj.toUpperCase();
      if (method === 'toLowerCase') return obj.toLowerCase();
      if (method === 'split') return obj.split(args[0]);
      if (method === 'trim') return obj.trim();
      if (method === 'replace') return obj.replace(args[0], args[1]);
      if (method === 'includes') return obj.includes(args[0]);
      if (method === 'startsWith') return obj.startsWith(args[0]);
      if (method === 'endsWith') return obj.endsWith(args[0]);
      if (method === 'repeat') return obj.repeat(args[0]);
    }

    if (typeof obj === 'number') {
      const args = node.arguments.map(a => evalNode(a, vars));
      if (method === 'toFixed') return obj.toFixed(args[0]);
      if (method === 'toString') return obj.toString(args[0]);
    }

    // Generic method call on objects
    if (obj && typeof obj[method] === 'function') {
      const args = node.arguments.map(a => evalNode(a, vars));
      return obj[method](...args);
    }
  }

  // Math functions
  if (node.callee.type === 'MemberExpression' &&
      node.callee.object.type === 'Identifier' &&
      node.callee.object.name === 'Math') {
    const method = node.callee.property.name;
    const args = node.arguments.map(a => evalNode(a, vars));
    if (Math[method]) return Math[method](...args);
  }

  // User-defined function calls
  if (node.callee.type === 'Identifier') {
    const fn = vars[node.callee.name];
    if (typeof fn === 'function') {
      const args = node.arguments.map(a => evalNode(a, vars));
      return fn(...args);
    }
    // Built-in globals
    if (node.callee.name === 'parseInt') return parseInt(...node.arguments.map(a => evalNode(a, vars)));
    if (node.callee.name === 'parseFloat') return parseFloat(evalNode(node.arguments[0], vars));
    if (node.callee.name === 'String') return String(evalNode(node.arguments[0], vars));
    if (node.callee.name === 'Number') return Number(evalNode(node.arguments[0], vars));
    if (node.callee.name === 'Boolean') return Boolean(evalNode(node.arguments[0], vars));
    if (node.callee.name === 'isNaN') return isNaN(evalNode(node.arguments[0], vars));
    if (node.callee.name === 'isFinite') return isFinite(evalNode(node.arguments[0], vars));
  }

  return undefined;
}

function createFuncFromNode(node, outerVars) {
  const paramNames = node.params.map(p => {
    if (p.type === 'Identifier') return p.name;
    if (p.type === 'AssignmentPattern') return p.left.name;
    return '_';
  });
  const defaults = node.params.map(p => {
    if (p.type === 'AssignmentPattern') return evalNode(p.right, outerVars);
    return undefined;
  });

  return function(...args) {
    const localVars = { ...outerVars };
    paramNames.forEach((name, i) => {
      localVars[name] = i < args.length ? args[i] : defaults[i];
    });
    if (node.body.type === 'BlockStatement') {
      for (const stmt of node.body.body) {
        const result = execStmtSimple(stmt, localVars);
        if (result && result.__return__) return result.value;
      }
      return undefined;
    } else {
      // Arrow with expression body
      return evalNode(node.body, localVars);
    }
  };
}

// Simple statement executor for function bodies (no step tracking)
function execStmtSimple(stmt, vars) {
  if (!stmt) return null;
  switch (stmt.type) {
    case 'VariableDeclaration':
      for (const d of stmt.declarations) {
        const name = d.id.type === 'Identifier' ? d.id.name : null;
        if (name) vars[name] = d.init ? evalNode(d.init, vars) : undefined;
      }
      return null;
    case 'ExpressionStatement':
      evalNode(stmt.expression, vars);
      return null;
    case 'ReturnStatement':
      return { __return__: true, value: stmt.argument ? evalNode(stmt.argument, vars) : undefined };
    case 'IfStatement': {
      const test = evalNode(stmt.test, vars);
      if (test) {
        if (stmt.consequent.type === 'BlockStatement') {
          for (const s of stmt.consequent.body) {
            const r = execStmtSimple(s, vars);
            if (r && r.__return__) return r;
          }
        } else {
          return execStmtSimple(stmt.consequent, vars);
        }
      } else if (stmt.alternate) {
        if (stmt.alternate.type === 'BlockStatement') {
          for (const s of stmt.alternate.body) {
            const r = execStmtSimple(s, vars);
            if (r && r.__return__) return r;
          }
        } else {
          return execStmtSimple(stmt.alternate, vars);
        }
      }
      return null;
    }
    case 'ForStatement': {
      if (stmt.init) execStmtSimple(stmt.init, vars);
      let guard = 0;
      while (guard++ < 10000) {
        if (stmt.test && !evalNode(stmt.test, vars)) break;
        if (stmt.body.type === 'BlockStatement') {
          for (const s of stmt.body.body) {
            const r = execStmtSimple(s, vars);
            if (r && r.__return__) return r;
          }
        } else {
          const r = execStmtSimple(stmt.body, vars);
          if (r && r.__return__) return r;
        }
        if (stmt.update) evalNode(stmt.update, vars);
      }
      return null;
    }
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════
// STEP-BY-STEP INTERPRETER
// This is what modules call. It walks the AST and produces
// an array of step objects for visualization.
// ═══════════════════════════════════════════════════════

export function interpret(code, options = {}) {
  const lines = code.split('\n');
  const { ast, error } = parseCode(code);
  if (error) {
    return { steps: [], error };
  }

  const steps = [];
  const vars = {};
  const output = [];
  const state = { memOps: 0, comps: 0, extra: {} };

  // Module-specific counters
  if (options.trackLoops) state.extra.loopIters = 0;
  if (options.trackCalls) { state.extra.calls = 0; state.extra.maxDepth = 0; state.extra.stack = ['Global']; state.extra.frames = { Global: {} }; }
  if (options.trackArrays) state.extra.arrOps = 0;
  if (options.trackObjects) state.extra.objOps = 0;
  if (options.trackDS) state.extra.dsOps = 0;

  // Start step
  steps.push(makeStep(-1, findNextLine(lines, -1), vars, output, null, 'start',
    'V8 ENGINE STARTUP:\n\n' +
    '1. PARSING — V8\'s parser (similar to Acorn) reads your source code and builds an Abstract Syntax Tree (AST).\n' +
    '2. IGNITION — V8\'s bytecode interpreter compiles the AST into compact bytecode. This is fast to generate but runs slower than machine code.\n' +
    '3. EXECUTION — Ignition begins executing bytecode line by line. The Program Counter (PC) is set to the first instruction.\n\n' +
    'If a function or loop becomes "hot" (runs many times), V8\'s TurboFan JIT compiler will optimize it into native machine code for maximum speed.\n\n' +
    'The call stack starts with a single Global frame. All top-level variables live here.',
    'PC → line 1 | Ignition start', state, options));

  // Walk top-level statements (with runtime error recovery)
  try {
    for (let si = 0; si < ast.body.length; si++) {
      const stmt = ast.body[si];
      const nextStmt = si + 1 < ast.body.length ? ast.body[si + 1] : null;
      walkStatement(stmt, nextStmt, vars, output, lines, steps, state, options, 0);
    }
  } catch (runtimeErr) {
    // Return partial steps so the user can see what executed before the error
    const errLine = runtimeErr._interpLine != null ? runtimeErr._interpLine + 1 : '?';
    steps.push(makeStep(-1, -1, vars, output, null, 'error',
      `Runtime error on line ${errLine}: ${runtimeErr.message}\n\nThe interpreter could not continue past this point. Check your code for unsupported syntax or undefined variables.`,
      `ERROR at line ${errLine}`, state, options, true));
    return { steps, error: `Line ${errLine}: ${runtimeErr.message}` };
  }

  // Done step
  steps.push(makeStep(-1, -1, vars, output, null, 'done',
    buildDoneBrain(vars, output, state),
    `DONE | ${state.memOps} writes`, state, options, true));

  return { steps, error: null };
}

function walkStatement(stmt, nextStmt, vars, output, lines, steps, state, options, depth) {
  if (!stmt) return;
  const li = nodeLine(stmt);
  const nextLi = nextStmt ? nodeLine(nextStmt) : findNextLine(lines, li);

  switch (stmt.type) {
    case 'VariableDeclaration':
      walkVarDeclaration(stmt, nextLi, vars, output, lines, steps, state, options);
      break;

    case 'ExpressionStatement':
      walkExpressionStatement(stmt, nextLi, vars, output, lines, steps, state, options);
      break;

    case 'IfStatement':
      walkIfStatement(stmt, nextLi, vars, output, lines, steps, state, options, depth);
      break;

    case 'ForStatement':
      walkForStatement(stmt, nextLi, vars, output, lines, steps, state, options, depth);
      break;

    case 'WhileStatement':
      walkWhileStatement(stmt, nextLi, vars, output, lines, steps, state, options, depth);
      break;

    case 'FunctionDeclaration':
      walkFunctionDeclaration(stmt, nextLi, vars, output, lines, steps, state, options);
      break;

    case 'ReturnStatement':
      walkReturnStatement(stmt, nextLi, vars, output, lines, steps, state, options);
      break;

    case 'BlockStatement':
      for (let i = 0; i < stmt.body.length; i++) {
        walkStatement(stmt.body[i], stmt.body[i+1] || nextStmt, vars, output, lines, steps, state, options, depth);
      }
      break;

    default:
      break;
  }
}

// ── Variable Declaration ──
function walkVarDeclaration(stmt, nextLi, vars, output, lines, steps, state, options) {
  for (const decl of stmt.declarations) {
    const li = nodeLine(decl);

    if (decl.id.type === 'Identifier') {
      const name = decl.id.name;
      const val = decl.init ? evalNode(decl.init, vars) : undefined;
      vars[name] = val;
      state.memOps++;

      const phase = detectPhase(val, options);
      if (Array.isArray(val) && options.trackArrays) state.extra.arrOps++;
      if (typeof val === 'object' && val !== null && !Array.isArray(val) && options.trackObjects) state.extra.objOps++;
      if ((Array.isArray(val) || (typeof val === 'object' && val !== null && !Array.isArray(val))) && options.trackDS) state.extra.dsOps++;

      steps.push(makeStep(nodeLine(stmt), nextLi, vars, output, name, phase,
        buildDeclBrain(name, val, stmt.kind, vars),
        `${stmt.kind.toUpperCase()}: ${name} = ${fv(val)}`, state, options));
    }
    else if (decl.id.type === 'ObjectPattern') {
      // Destructuring: let { a, b } = obj;
      const srcVal = decl.init ? evalNode(decl.init, vars) : {};
      const names = [];
      for (const prop of decl.id.properties) {
        const key = prop.key.type === 'Identifier' ? prop.key.name : String(evalNode(prop.key, vars));
        const localName = prop.value.type === 'Identifier' ? prop.value.name : key;
        vars[localName] = srcVal ? srcVal[key] : undefined;
        state.memOps++;
        names.push(localName);
      }
      if (options.trackObjects) state.extra.objOps++;

      steps.push(makeStep(nodeLine(stmt), nextLi, vars, output, names[0], 'obj-destruct',
        `DESTRUCTURING:\n\n${names.map(n => `  ${n} = ${fv(vars[n])}`).join('\n')}\n\nEach destructured key is an O(1) hash lookup.\n\nV8 Internal — Inline Caches for Destructuring:\nV8 creates an inline cache (IC) for each destructured property. Since all properties are accessed from the same object with the same hidden class, V8 can use a monomorphic IC — the fastest access pattern. Each lookup becomes a direct memory offset read.`,
        `DESTRUCT: ${names.length} keys`, state, options));
    }
    else if (decl.id.type === 'ArrayPattern') {
      const srcVal = decl.init ? evalNode(decl.init, vars) : [];
      const names = [];
      for (let i = 0; i < decl.id.elements.length; i++) {
        const el = decl.id.elements[i];
        if (el && el.type === 'Identifier') {
          vars[el.name] = Array.isArray(srcVal) ? srcVal[i] : undefined;
          state.memOps++;
          names.push(el.name);
        }
      }
      steps.push(makeStep(nodeLine(stmt), nextLi, vars, output, names[0], 'declare',
        `ARRAY DESTRUCTURING:\n\n${names.map((n, i) => `  ${n} = [${i}] → ${fv(vars[n])}`).join('\n')}`,
        `DESTRUCT: ${names.length} elements`, state, options));
    }
  }
}

// ── Expression Statement ──
function walkExpressionStatement(stmt, nextLi, vars, output, lines, steps, state, options) {
  const expr = stmt.expression;
  const li = nodeLine(stmt);

  // console.log
  if (isConsoleLog(expr)) {
    const args = expr.arguments.map(a => evalNode(a, vars));
    const str = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    output.push(str);
    steps.push(makeStep(li, nextLi, vars, output, null, 'output',
      `console.log outputs: ${str}\n\nNo variables changed. I/O operation only.\n\nV8 Internal — Side Effects & Deoptimization:\nconsole.log is a "side effect" — it interacts with the outside world (stdout). V8's TurboFan optimizer is cautious around side effects because they can't be reordered or eliminated.\n\nInside a hot loop, console.log acts as a deoptimization barrier — TurboFan cannot move it, remove it, or optimize across it. This is why logging inside tight loops significantly slows down production code.`,
      `I/O: stdout ← ${str}`, state, options));
    return;
  }

  // Assignment expression: x = val
  if (expr.type === 'AssignmentExpression') {
    walkAssignmentExpr(expr, li, nextLi, vars, output, lines, steps, state, options);
    return;
  }

  // Update expression: i++, i--
  if (expr.type === 'UpdateExpression') {
    const name = expr.argument.name;
    const old = vars[name];
    evalNode(expr, vars);
    state.memOps++;
    steps.push(makeStep(li, nextLi, vars, output, name, 'assign',
      `UPDATE: ${name}${expr.operator}\n\nBefore: ${fv(old)}\nAfter: ${fv(vars[name])}\n\nV8 Internal — SMI Fast Path:\n${typeof vars[name] === 'number' && Number.isInteger(vars[name]) && vars[name] >= -1073741824 && vars[name] <= 1073741823 ? `The result (${vars[name]}) fits in a 31-bit SMI. V8 handles this increment entirely in the pointer tag — no heap allocation, no boxing. This is the fastest possible numeric operation in V8.` : `The result overflows the SMI range or is a double. V8 must allocate a HeapNumber on the heap to store it. This is slower than the SMI fast path.`}`,
      `${name}${expr.operator} → ${fv(vars[name])}`, state, options));
    return;
  }

  // Call expression (standalone): arr.push(x), etc.
  if (expr.type === 'CallExpression') {
    walkCallExpr(expr, li, nextLi, vars, output, lines, steps, state, options);
    return;
  }

  // Generic expression
  evalNode(expr, vars);
}

function walkAssignmentExpr(expr, li, nextLi, vars, output, lines, steps, state, options) {
  if (expr.left.type === 'Identifier') {
    const name = expr.left.name;
    const old = vars[name];
    evalNode(expr, vars);
    state.memOps++;

    steps.push(makeStep(li, nextLi, vars, output, name, 'assign',
      `REASSIGNMENT: ${name}\n\nBefore: ${fv(old)}\nAfter: ${fv(vars[name])}\n\nThe old value is overwritten in place.\n\nV8 Internal — Inline Cache (IC):\nV8 remembers the type of "${name}" from previous accesses. ${typeof old === typeof vars[name] ? `The type hasn't changed (${typeof vars[name]}), so V8's IC stays "monomorphic" — the fastest state. The next read of "${name}" is a single pointer dereference.` : `The type CHANGED (${typeof old} → ${typeof vars[name]}), which makes V8's IC "polymorphic" or "megamorphic" — slower because V8 must now check multiple types. This can prevent TurboFan optimization.`}`,
      `${name}: ${fv(old)} → ${fv(vars[name])}`, state, options));
  }
  else if (expr.left.type === 'MemberExpression') {
    const objName = expr.left.object.type === 'Identifier' ? expr.left.object.name : null;
    const prop = expr.left.computed ? evalNode(expr.left.property, vars) : expr.left.property.name;
    const old = objName ? dc(vars[objName]) : null;
    evalNode(expr, vars);
    state.memOps++;
    if (options.trackObjects) state.extra.objOps++;
    if (options.trackDS) state.extra.dsOps++;

    const phase = Array.isArray(vars[objName]) ? 'arr-set' : 'obj-set';
    steps.push(makeStep(li, nextLi, vars, output, objName, phase,
      `PROPERTY SET: ${objName}[${fv(prop)}] = ${fv(vars[objName]?.[prop])}\n\nO(1) hash map operation.\n\nV8 Internal — Hidden Class Transition:\nAdding a new property causes V8 to transition the object's hidden class (Map). Each unique property addition creates a new Map in the transition tree. Objects that add properties in the SAME ORDER share Maps, enabling fast inline-cached access.\n\nIf you add properties in inconsistent orders across similar objects, V8 falls into "dictionary mode" (slow properties) — losing the fast-path optimization.`,
      `SET: ${objName}[${fv(prop)}]`, state, options,
      false, { highlightKey: String(prop) }));
  }
}

function walkCallExpr(expr, li, nextLi, vars, output, lines, steps, state, options) {
  if (expr.callee.type === 'MemberExpression') {
    const objName = expr.callee.object.type === 'Identifier' ? expr.callee.object.name : null;
    const method = expr.callee.computed ? null : expr.callee.property.name;
    const obj = objName ? vars[objName] : evalNode(expr.callee.object, vars);
    const args = expr.arguments.map(a => evalNode(a, vars));

    // Array methods
    if (Array.isArray(obj) && method) {
      const oldArr = [...obj];
      let result;

      if (method === 'push') {
        result = obj.push(...args);
        state.memOps++;
        if (options.trackArrays) state.extra.arrOps++;
        if (options.trackDS) state.extra.dsOps++;
        steps.push(makeStep(li, nextLi, vars, output, objName, 'ds-push',
          `PUSH: ${objName}.push(${args.map(fv).join(', ')})\n\nElement added at index ${obj.length - 1}.\nNo other elements move — O(1).\n\nBefore: [${oldArr.map(fv).join(', ')}]\nAfter: [${obj.map(fv).join(', ')}]\n\nV8 Internal — Backing Store:\nArrays in V8 have a backing store (FixedArray) with extra capacity. Push appends to the end — if capacity remains, it's a single memory write. If the backing store is full, V8 allocates a new one ~1.5× larger and copies elements over (amortized O(1)).\n\nElements kind: ${obj.every(v => typeof v === 'number' && Number.isInteger(v)) ? 'PACKED_SMI — fastest, unboxed integers' : obj.every(v => typeof v === 'number') ? 'PACKED_DOUBLE — fast, unboxed doubles' : 'PACKED_ELEMENTS — tagged pointers (mixed types)'}`,
          `PUSH: ${objName}[${obj.length - 1}] ← ${fv(args[0])} | O(1)`, state, options,
          false, { highlightIndex: obj.length - 1 }));
        return;
      }

      if (method === 'pop') {
        result = obj.pop();
        state.memOps++;
        if (options.trackArrays) state.extra.arrOps++;
        if (options.trackDS) state.extra.dsOps++;
        steps.push(makeStep(li, nextLi, vars, output, objName, 'ds-pop',
          `POP: ${objName}.pop() → ${fv(result)}\n\nRemoves last element. O(1).\n\nBefore: [${oldArr.map(fv).join(', ')}]\nAfter: [${obj.map(fv).join(', ')}]\n\nV8 Internal:\nPop sets the last element slot to "the_hole" (V8's internal marker for deleted elements) and decrements the length. The backing store is NOT immediately shrunk — V8 avoids frequent reallocation. The removed value becomes eligible for GC if no other references exist.`,
          `POP: ${fv(result)} | O(1)`, state, options));
        return;
      }

      if (method === 'shift') {
        result = obj.shift();
        state.memOps++;
        if (options.trackArrays) state.extra.arrOps++;
        if (options.trackDS) state.extra.dsOps++;
        steps.push(makeStep(li, nextLi, vars, output, objName, 'ds-dequeue',
          `SHIFT: ${objName}.shift() → ${fv(result)}\n\nRemoves first element. All remaining elements shift left.\nThis is O(n) — ${obj.length} element${obj.length !== 1 ? 's' : ''} moved.\n\nBefore: [${oldArr.map(fv).join(', ')}]\nAfter: [${obj.map(fv).join(', ')}]\n\nV8 Internal — Expensive Operation:\nShift must copy every remaining element one position left in the backing store. Unlike pop (O(1)), shift touches every element — this is why queues built on arrays are slow.\n\nFor a proper O(1) queue, use a circular buffer or linked list. V8 cannot optimize away the element copying because shift fundamentally changes every element's index.`,
          `SHIFT: ${fv(result)} | O(n)`, state, options));
        return;
      }

      if (method === 'sort') {
        if (args[0] && typeof args[0] === 'function') obj.sort(args[0]);
        else obj.sort();
        state.comps += Math.ceil(obj.length * Math.log2(obj.length || 1));
        if (options.trackDS) state.extra.dsOps++;
        steps.push(makeStep(li, nextLi, vars, output, objName, 'ds-sort',
          `SORT: ${objName}.sort() — in-place\n\nBefore: [${oldArr.map(fv).join(', ')}]\nAfter: [${obj.map(fv).join(', ')}]\n\nTime: O(n log n). ~${Math.ceil(obj.length * Math.log2(obj.length || 1))} comparisons estimated.\n\nV8 Internal — TimSort:\nV8 uses TimSort (since 2019, implemented in Torque — V8's internal language). TimSort is a hybrid merge-sort + insertion-sort that exploits existing order in the data.\n\nKey details:\n  • Finds natural "runs" of already-sorted elements\n  • Small runs are extended with binary insertion sort\n  • Runs are merged with a modified merge sort\n  • Best case: O(n) if already sorted\n  • Worst case: O(n log n)\n  • Stable sort — equal elements keep their original order`,
          `SORT: ${objName} | O(n log n)`, state, options));
        return;
      }

      // Generic array method
      if (typeof obj[method] === 'function') {
        result = obj[method](...args);
        if (options.trackArrays) state.extra.arrOps++;
        steps.push(makeStep(li, nextLi, vars, output, objName, 'arr-method',
          `${objName}.${method}(${args.map(fv).join(', ')})\n\nResult: ${fv(result)}`,
          `${objName}.${method}()`, state, options));
        return;
      }
    }

    // Object static methods
    if (expr.callee.object.type === 'Identifier' && expr.callee.object.name === 'Object') {
      const result = evalCall(expr, vars);
      steps.push(makeStep(li, nextLi, vars, output, null, 'obj-method',
        `Object.${method}() — iterates all properties.\n\nResult: ${fv(result)}`,
        `Object.${method}()`, state, options));
      return;
    }
  }

  // User-defined function call
  if (expr.callee.type === 'Identifier') {
    const fnName = expr.callee.name;
    if (options.trackCalls) {
      state.extra.calls++;
      state.extra.stack.push(fnName);
      if (state.extra.stack.length > state.extra.maxDepth) state.extra.maxDepth = state.extra.stack.length;
    }

    const result = evalNode(expr, vars);
    
    steps.push(makeStep(li, nextLi, vars, output, null, 'fn-call',
      `FUNCTION CALL: ${fnName}(${expr.arguments.map(a => fv(evalNode(a, vars))).join(', ')})\n\nResult: ${fv(result)}\n\nV8 Internal — Call Stack Frame:\nV8 pushes a new frame onto the call stack containing:\n  • Return address — where to resume in the caller\n  • Arguments — ${expr.arguments.length} arg${expr.arguments.length !== 1 ? 's' : ''} passed\n  • Local variables — allocated as the function body executes\n  • Context pointer — link to outer scope for closure access\n\nV8 uses an inline cache (IC) at this call site. If ${fnName}() is always the same function, the IC is "monomorphic" and V8 can skip the lookup — jumping directly to the function's code.`,
      `CALL: ${fnName}()`, state, options));

    if (options.trackCalls && state.extra.stack.length > 1) {
      state.extra.stack.pop();
    }
    return;
  }

  // Fallback
  evalNode(expr, vars);
}

// ── If Statement ──
function walkIfStatement(stmt, nextLi, vars, output, lines, steps, state, options, depth) {
  const li = nodeLine(stmt);
  const condVal = evalNode(stmt.test, vars);
  state.comps++;

  // Build substituted condition string
  const condStr = lines[li] ? lines[li].trim() : '';

  steps.push(makeStep(li, null, vars, output, null, 'condition',
    `CONDITION: ${condStr}\n\nEvaluated: ${condVal ? 'TRUE' : 'FALSE'}\n\nThe CPU ${condVal ? 'enters the if-block' : 'skips the if-block'}.\n\nV8 Internal — Branch Prediction & Speculation:\nModern CPUs predict which branch will be taken BEFORE evaluating the condition. V8's TurboFan compiler uses type feedback from Ignition to speculate on the likely path.\n\n${condVal ? 'The TRUE branch is taken. If this pattern repeats, TurboFan will optimize by assuming TRUE and generating faster code for this path.' : 'The FALSE branch is taken. The if-block code is skipped entirely — those bytecodes are never executed.'}\n\nIf the prediction is wrong (the branch flips), V8 must "deoptimize" — discard the optimized machine code and fall back to Ignition bytecode. This is called a "deopt" and is expensive.`,
    `CMP: ${condVal ? 'TRUE → enter' : 'FALSE → skip'}`, state, options,
    false, { cond: !!condVal }));

  if (condVal) {
    const block = stmt.consequent;
    if (block.type === 'BlockStatement') {
      for (let i = 0; i < block.body.length; i++) {
        walkStatement(block.body[i], block.body[i+1] || null, vars, output, lines, steps, state, options, depth + 1);
      }
    } else {
      walkStatement(block, null, vars, output, lines, steps, state, options, depth + 1);
    }
    // Skip else
    if (stmt.alternate) {
      const elseLi = nodeLine(stmt.alternate);
      steps.push(makeStep(elseLi, nextLi, vars, output, null, 'skip',
        'TRUE path was taken — skipping else block entirely.',
        'SKIP: else block', state, options));
    }
  } else {
    // Skip if block
    if (stmt.consequent) {
      steps.push(makeStep(li, null, vars, output, null, 'skip',
        'Condition was FALSE — skipping if-block.',
        'SKIP: if-block', state, options));
    }
    if (stmt.alternate) {
      if (stmt.alternate.type === 'IfStatement') {
        walkIfStatement(stmt.alternate, nextLi, vars, output, lines, steps, state, options, depth);
      } else {
        const elseLi = nodeLine(stmt.alternate);
        steps.push(makeStep(elseLi, null, vars, output, null, 'else-enter',
          'Condition was FALSE — entering else block.',
          'ENTER: else block', state, options));
        if (stmt.alternate.type === 'BlockStatement') {
          for (let i = 0; i < stmt.alternate.body.length; i++) {
            walkStatement(stmt.alternate.body[i], stmt.alternate.body[i+1] || null, vars, output, lines, steps, state, options, depth + 1);
          }
        } else {
          walkStatement(stmt.alternate, null, vars, output, lines, steps, state, options, depth + 1);
        }
      }
    }
  }
}

// ── For Statement ──
function walkForStatement(stmt, nextLi, vars, output, lines, steps, state, options, depth) {
  const li = nodeLine(stmt);

  // Init
  if (stmt.init) {
    if (stmt.init.type === 'VariableDeclaration') {
      walkVarDeclaration(stmt.init, li, vars, output, lines, steps, state, options);
    } else {
      evalNode(stmt.init, vars);
    }
  }

  let guard = 0;
  while (guard++ < 500) {
    // Test
    if (stmt.test) {
      const testVal = evalNode(stmt.test, vars);
      state.comps++;
      if (options.trackLoops) state.extra.loopIters++;

      const iterNum = options.trackLoops ? state.extra.loopIters : guard;
      const isHot = iterNum >= 3;
      steps.push(makeStep(li, null, vars, output, null, 'loop-test',
        `LOOP TEST: ${testVal ? 'TRUE → execute body' : 'FALSE → exit loop'}\n\nIteration ${iterNum}` +
        `\n\nV8 Internal — ${isHot ? 'HOT LOOP DETECTED:' : 'Loop Profiling:'}\n` +
        (isHot ?
          `This loop has run ${iterNum} times. V8's Ignition interpreter has been collecting type feedback on every iteration — tracking what types the variables hold and which branches are taken.\n\n` +
          `At this point, TurboFan (V8's optimizing JIT compiler) would kick in and compile this loop into optimized machine code using On-Stack Replacement (OSR) — the running bytecode is swapped out for native code MID-EXECUTION without restarting the loop.\n\n` +
          `TurboFan optimizations applied:\n` +
          `  • Loop-invariant code motion — expressions that don't change are hoisted out\n` +
          `  • Bounds check elimination — array index checks are removed if proven safe\n` +
          `  • Inlining — small function calls inside the loop are expanded inline` :
          `V8's Ignition is still interpreting this loop as bytecode. Each iteration adds type feedback to the FeedbackVector. After enough iterations (~2-4 in practice), TurboFan will consider this loop "hot" and JIT-compile it.`),
        `LOOP: ${testVal ? 'continue' : 'exit'}${isHot ? ' | JIT' : ''}`, state, options,
        false, { loopIter: iterNum }));

      if (!testVal) break;
    }

    // Body
    const body = stmt.body.type === 'BlockStatement' ? stmt.body.body : [stmt.body];
    for (let i = 0; i < body.length; i++) {
      walkStatement(body[i], body[i+1] || null, vars, output, lines, steps, state, options, depth + 1);
    }

    // Update
    if (stmt.update) {
      const updateName = stmt.update.type === 'UpdateExpression' ? stmt.update.argument.name :
                         stmt.update.type === 'AssignmentExpression' ? (stmt.update.left.type === 'Identifier' ? stmt.update.left.name : null) : null;
      const oldVal = updateName ? vars[updateName] : null;
      evalNode(stmt.update, vars);
      if (updateName) state.memOps++;
    }
  }
}

// ── While Statement ──
function walkWhileStatement(stmt, nextLi, vars, output, lines, steps, state, options, depth) {
  const li = nodeLine(stmt);
  let guard = 0;
  while (guard++ < 500) {
    const testVal = evalNode(stmt.test, vars);
    state.comps++;
    if (options.trackLoops) state.extra.loopIters++;

    const whileIter = options.trackLoops ? state.extra.loopIters : guard;
    const whileHot = whileIter >= 3;
    steps.push(makeStep(li, null, vars, output, null, 'loop-test',
      `WHILE TEST: ${testVal ? 'TRUE → execute body' : 'FALSE → exit loop'}\n\nIteration ${whileIter}` +
      `\n\nV8 Internal — ${whileHot ? 'HOT LOOP → TurboFan JIT compiles this into native machine code via OSR.' : 'Ignition is collecting type feedback. TurboFan will optimize after ~2-4 iterations.'}`,
      `WHILE: ${testVal ? 'continue' : 'exit'}${whileHot ? ' | JIT' : ''}`, state, options));

    if (!testVal) break;

    const body = stmt.body.type === 'BlockStatement' ? stmt.body.body : [stmt.body];
    for (let i = 0; i < body.length; i++) {
      walkStatement(body[i], body[i+1] || null, vars, output, lines, steps, state, options, depth + 1);
    }
  }
}

// ── Function Declaration ──
function walkFunctionDeclaration(stmt, nextLi, vars, output, lines, steps, state, options) {
  const li = nodeLine(stmt);
  const name = stmt.id.name;
  vars[name] = createFuncFromNode(stmt, vars);
  state.memOps++;
  if (options.trackCalls) {
    state.extra.calls = state.extra.calls || 0;
  }

  const params = stmt.params.map(p => p.type === 'Identifier' ? p.name : '...').join(', ');
  steps.push(makeStep(li, nextLi, vars, output, name, 'fn-declare',
    `FUNCTION DECLARATION: ${name}(${params})\n\nThe function is stored as a value in memory. It is NOT executed yet — it will run when called.\n\nParameters: ${params || '(none)'}` +
    `\n\nV8 Internal — Lazy Compilation:\n` +
    `V8 uses "lazy parsing" — it only fully parses and compiles a function when it's first CALLED, not when it's declared. Right now, V8 does a quick "pre-parse" to check for syntax errors and find the function boundaries, but doesn't generate bytecode yet.\n\n` +
    `When ${name}() is called:\n` +
    `  1. Full parse → AST for the function body\n` +
    `  2. Ignition → bytecode generation\n` +
    `  3. FeedbackVector created → tracks argument types for future optimization\n` +
    `  4. If called often → TurboFan JIT compiles to native machine code`,
    `FUNC: ${name}(${params})`, state, options));
}

// ── Return Statement ──
function walkReturnStatement(stmt, nextLi, vars, output, lines, steps, state, options) {
  const li = nodeLine(stmt);
  const val = stmt.argument ? evalNode(stmt.argument, vars) : undefined;
  steps.push(makeStep(li, nextLi, vars, output, null, 'fn-return',
    `RETURN: ${fv(val)}\n\nThe function exits and returns this value to the caller.\n\nV8 Internal — Stack Frame Teardown:\nWhen a function returns, V8:\n  1. Places the return value in the accumulator register\n  2. Restores the caller's frame pointer (FP) and stack pointer (SP)\n  3. Pops the current frame off the call stack\n  4. Jumps back to the return address saved when the function was called\n\nAll local variables in this frame become unreachable and eligible for garbage collection.`,
    `RETURN: ${fv(val)}`, state, options));
}

// ═══ Helpers ═══

function isConsoleLog(expr) {
  return expr.type === 'CallExpression' &&
    expr.callee.type === 'MemberExpression' &&
    expr.callee.object.type === 'Identifier' &&
    expr.callee.object.name === 'console' &&
    expr.callee.property.name === 'log';
}

function detectPhase(val, options) {
  if (Array.isArray(val)) return 'ds-create';
  if (typeof val === 'object' && val !== null) return 'obj-create';
  if (typeof val === 'function') return 'fn-declare';
  return 'declare';
}

function makeStep(lineIndex, nextLineIndex, vars, output, highlight, phase, brain, memLabel, state, options, done = false, extra = {}) {
  const step = {
    lineIndex,
    nextLineIndex: nextLineIndex !== null ? nextLineIndex : -1,
    vars: dc(vars),
    output: [...output],
    highlight,
    phase,
    brain,
    memLabel,
    memOps: state.memOps,
    comps: state.comps,
    done: done || false,
    ...extra,
  };
  // Add module-specific fields
  if (options.trackLoops) step.loopIters = state.extra.loopIters || 0;
  if (options.trackCalls) {
    step.calls = state.extra.calls || 0;
    step.maxDepth = state.extra.maxDepth || 0;
    step.stack = [...(state.extra.stack || ['Global'])];
    step.frames = dc(state.extra.frames || {});
  }
  if (options.trackArrays) {
    step.arrOps = state.extra.arrOps || 0;
    // Build arrays map
    step.arrays = {};
    for (const [k, v] of Object.entries(vars)) {
      if (Array.isArray(v)) step.arrays[k] = [...v];
    }
  }
  if (options.trackObjects) step.objOps = state.extra.objOps || 0;
  if (options.trackDS) step.dsOps = state.extra.dsOps || 0;
  return step;
}

function buildDeclBrain(name, val, keyword, vars) {
  const tp = typeof val;
  const isArr = Array.isArray(val);
  const isObj = tp === 'object' && val !== null && !isArr;
  const bytes = byteSize(val);
  const total = totalBytes(vars);

  if (isArr) {
    const allInts = val.every(v => typeof v === 'number' && Number.isInteger(v));
    const allNums = val.every(v => typeof v === 'number');
    const elemKind = allInts ? 'PACKED_SMI_ELEMENTS' : allNums ? 'PACKED_DOUBLE_ELEMENTS' : 'PACKED_ELEMENTS';
    return `ARRAY CREATED: "${name}" on the heap.\n\n${val.length} elements: [${val.map(fv).join(', ')}]\n\n` +
      `V8 Internal — Elements Kind: ${elemKind}\n` +
      (allInts ? 'All elements are small integers (SMIs). V8 stores these unboxed — no heap allocation per element, just raw 31-bit integers. This is the fastest array type.\n' :
       allNums ? 'All elements are doubles. V8 stores these in a contiguous 64-bit float buffer — no boxing needed. Fast numeric operations.\n' :
       'Mixed types — V8 stores each element as a tagged pointer on the heap. This is slower than SMI or double arrays because each access requires type checking.\n') +
      `\nArrays in V8 are backed by a FixedArray (dense) or HashTable (sparse). Yours is dense — O(1) index access.\n\n` +
      `Size: ~${bytes} bytes | Total heap: ~${total} bytes`;
  }
  if (isObj) {
    const keys = Object.keys(val);
    return `OBJECT CREATED: "${name}" on the heap.\n\n${keys.length} properties:\n${keys.map(k => `  "${k}": ${fv(val[k])}`).join('\n')}\n\n` +
      `V8 Internal — Hidden Class (Map):\n` +
      `V8 assigns a hidden class to every object. When you create {${keys.join(', ')}}, V8 builds a transition chain:\n` +
      keys.map((k, i) => `  ${i === 0 ? '{}' : '{' + keys.slice(0, i).join(', ') + '}'} → add "${k}" → {${keys.slice(0, i + 1).join(', ')}}`).join('\n') + '\n\n' +
      `Objects sharing the same property order share the same hidden class. This enables V8\'s inline caches — subsequent property lookups become a single memory offset instead of a hash lookup.\n\n` +
      `Mode: "fast properties" (${keys.length} keys — well under the ~28 key threshold for dictionary mode).\n\n` +
      `Size: ~${bytes} bytes | Total heap: ~${total} bytes`;
  }
  if (tp === 'function') {
    return `FUNCTION DECLARATION: "${name}" stored in memory.\n\n` +
      `V8 Internal — Closure & Context:\n` +
      `V8 creates a JSFunction object on the heap containing:\n` +
      `  • SharedFunctionInfo — the parsed AST/bytecode (shared if this function is defined once)\n` +
      `  • Context — a reference to the outer scope\'s variables (this is how closures work)\n` +
      `  • FeedbackVector — empty for now; will collect type profiling data when the function is called\n\n` +
      `The function is NOT executed yet. The bytecode sits in memory waiting to be invoked. If called frequently, TurboFan will JIT-compile it into optimized machine code.`;
  }
  const isSmi = tp === 'number' && Number.isInteger(val) && val >= -1073741824 && val <= 1073741823;
  const v8Type = isSmi ? 'SMI (Small Integer) — stored directly in the pointer, no heap allocation. Fastest possible representation.' :
                 tp === 'number' ? 'HeapNumber — 64-bit IEEE 754 double allocated on the heap. V8 boxes non-SMI numbers.' :
                 tp === 'string' ? `String (${val.length <= 10 ? 'internalized' : 'heap-allocated'}) — ${val.length <= 10 ? 'short strings are "internalized" (deduplicated) in V8\'s string table for fast comparison.' : 'longer strings live on the heap. V8 uses SeqOneByteString or SeqTwoByteString depending on character encoding.'}` :
                 tp === 'boolean' ? 'Oddball — V8 pre-allocates singleton objects for true, false, null, and undefined. They\'re never garbage collected.' :
                 val === null ? 'Oddball (null) — a singleton V8 root object. Costs zero allocation.' :
                 val === undefined ? 'Oddball (undefined) — a singleton V8 root object. Costs zero allocation.' :
                 'Tagged value on the heap.';
  return `MEMORY ALLOCATION: "${name}" in the current scope.\n\n` +
    `Keyword: ${keyword} (${keyword === 'const' ? 'cannot be reassigned — V8 can optimize reads since the value never changes' : 'mutable binding — V8 must check for reassignment'})\n` +
    `Type: ${tp}\nValue: ${fv(val)}\n\n` +
    `V8 Internal — Tagged Values:\n${v8Type}\n\n` +
    `Size: ~${bytes} bytes\nTotal heap: ~${total} bytes across ${Object.keys(vars).length} variable${Object.keys(vars).length > 1 ? 's' : ''}.`;
}

function buildDoneBrain(vars, output, state) {
  const varCount = Object.keys(vars).length;
  const total = totalBytes(vars);
  let msg = `PROGRAM COMPLETE\n\nFinal state: ${varCount} variable${varCount !== 1 ? 's' : ''} in memory\nTotal heap: ~${total} bytes\nMemory writes: ${state.memOps}\nComparisons: ${state.comps}`;
  if (state.extra.loopIters) msg += `\nLoop iterations: ${state.extra.loopIters}`;
  if (state.extra.calls) msg += `\nFunction calls: ${state.extra.calls}`;
  if (state.extra.arrOps) msg += `\nArray operations: ${state.extra.arrOps}`;
  if (state.extra.objOps) msg += `\nObject operations: ${state.extra.objOps}`;
  if (state.extra.dsOps) msg += `\nDS operations: ${state.extra.dsOps}`;
  msg += '\n\nThe call stack is now empty — the Global frame is popped.';
  msg += '\n\nV8 GARBAGE COLLECTION:\n' +
    `After execution, V8\'s garbage collector (Orinoco) can reclaim unreachable memory.\n\n` +
    `• Young Generation (Scavenger) — short-lived objects (temporaries, loop variables) are collected quickly using a semi-space copying algorithm.\n` +
    `• Old Generation (Mark-Compact) — long-lived objects that survived multiple GC cycles are collected less frequently using mark-sweep-compact.\n\n` +
    `Your program allocated ~${total} bytes. ` +
    (total < 100 ? 'This is tiny — likely fits entirely in V8\'s young generation and would be collected in a single Scavenger pass.' :
     total < 1000 ? 'This is modest — most objects stay in the young generation. GC pause would be sub-millisecond.' :
     'Larger allocations may promote objects to old generation if they persist across GC cycles.');
  return msg;
}
