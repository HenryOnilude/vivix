/**
 * Evaluator module — AST node evaluation, function/class creation,
 * simple statement execution, and closure detection helpers.
 *
 * Extracted from interpreter.js for single-responsibility.
 */

// ── Module-level flag: set to true during interpret() when trackClosures is on ──
export let _globalTrackClosures = false;
export function setGlobalTrackClosures(val) { _globalTrackClosures = val; }

// ── Map AST node to source line (0-indexed) ──
export function nodeLine(node) {
  return node && node.loc ? node.loc.start.line - 1 : -1;
}

// ── Find next meaningful line after current ──
export function findNextLine(lines, fromLine) {
  for (let i = fromLine + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t && t !== '{' && t !== '}' && !t.startsWith('//')) return i;
  }
  return -1;
}

// ── Safely evaluate an AST expression node against current vars ──
export function evalNode(node, vars) {
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

    case 'NewExpression': {
      const ctor = evalNode(node.callee, vars);
      const args = node.arguments.map(a => evalNode(a, vars));
      if (typeof ctor === 'function') return ctor(...args);
      return {};
    }

    case 'ThisExpression':
      return vars['this'] || {};

    case 'ClassExpression':
      return createClassFromNode(node, vars, node.superClass ? evalNode(node.superClass, vars) : null);

    case 'SequenceExpression':
      return node.expressions.reduce((_, expr) => evalNode(expr, vars), undefined);

    default:
      return undefined;
  }
}

export function evalBinary(node, vars) {
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

export function evalUnary(node, vars) {
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

export function evalAssign(node, vars) {
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

export function evalMember(node, vars) {
  const obj = evalNode(node.object, vars);
  if (obj === undefined || obj === null) return undefined;
  const prop = node.computed ? evalNode(node.property, vars) : node.property.name;

  // Built-in property access
  if (prop === 'length' && (Array.isArray(obj) || typeof obj === 'string')) return obj.length;

  return obj[prop];
}

export function evalCall(node, vars) {
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

    // Generic method call on objects (includes class prototype methods)
    if (obj && typeof obj[method] === 'function') {
      const args = node.arguments.map(a => evalNode(a, vars));
      const fn = obj[method];
      if (fn._isInterpreted) {
        fn._thisBinding = obj;
        return fn(...args);
      }
      return fn.call(obj, ...args);
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

export function createFuncFromNode(node, outerVars) {
  const paramNames = node.params.map(p => {
    if (p.type === 'Identifier') return p.name;
    if (p.type === 'AssignmentPattern') return p.left.name;
    return '_';
  });
  const defaults = node.params.map(p => {
    if (p.type === 'AssignmentPattern') return evalNode(p.right, outerVars);
    return undefined;
  });
  const paramSet = new Set(paramNames);

  const fn = function(...args) {
    const localVars = { ...outerVars };
    // If caller set _thisBinding, use it (for class method calls)
    if (fn._thisBinding !== undefined) {
      localVars['this'] = fn._thisBinding;
      fn._thisBinding = undefined; // consume it
    }
    paramNames.forEach((name, i) => {
      localVars[name] = i < args.length ? args[i] : defaults[i];
    });

    let returnVal = undefined;
    if (node.body.type === 'BlockStatement') {
      for (const stmt of node.body.body) {
        const result = execStmtSimple(stmt, localVars);
        if (result && result.__return__) { returnVal = result.value; break; }
      }
    } else {
      // Arrow with expression body
      returnVal = evalNode(node.body, localVars);
    }

    // trackClosures: write back primitive mutations to outer scope (closure semantics)
    if (_globalTrackClosures) {
      for (const key of Object.keys(outerVars)) {
        if (!paramSet.has(key) && localVars[key] !== outerVars[key]) {
          outerVars[key] = localVars[key];
        }
      }
    }

    return returnVal;
  };
  fn._isInterpreted = true;
  // Attach AST node and outer scope reference for closure detection
  if (_globalTrackClosures) {
    fn._astNode = node;
    fn._closureOuterVars = outerVars;
  }
  return fn;
}

// ── Closure-detection AST helpers ──────────────────────────────────────────

export function collectIdentifierRefs(node, refs = new Set()) {
  if (!node || typeof node !== 'object') return refs;
  if (node.type === 'Identifier') { refs.add(node.name); return refs; }
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'loc' || key === 'start' || key === 'end' || key === 'range') continue;
    const child = node[key];
    if (Array.isArray(child)) child.forEach(c => { if (c && typeof c === 'object') collectIdentifierRefs(c, refs); });
    else if (child && typeof child === 'object') collectIdentifierRefs(child, refs);
  }
  return refs;
}

export function collectDeclaredNames(bodyNode) {
  const names = new Set();
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclaration') {
      for (const d of node.declarations) {
        if (d.id && d.id.type === 'Identifier') names.add(d.id.name);
        else if (d.id && d.id.type === 'ObjectPattern') d.id.properties.forEach(p => { if (p.value && p.value.type === 'Identifier') names.add(p.value.name); });
        else if (d.id && d.id.type === 'ArrayPattern') d.id.elements.forEach(e => { if (e && e.type === 'Identifier') names.add(e.name); });
      }
    }
    if (node.type === 'FunctionDeclaration' && node.id) names.add(node.id.name);
    // Don't recurse into nested functions — they have their own scope
    if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') return;
    for (const key of Object.keys(node)) {
      if (['type','loc','start','end','range'].includes(key)) continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(c => { if (c && typeof c === 'object') walk(c); });
      else if (child && typeof child === 'object') walk(child);
    }
  }
  walk(bodyNode);
  return names;
}

const _CLOSURE_BUILTINS = new Set([
  'undefined','null','true','false','Infinity','NaN','console','Math','Object','Array',
  'String','Number','Boolean','parseInt','parseFloat','isNaN','isFinite','arguments','this',
]);

/** Returns the set of variable names captured from outer scope by a function node. */
export function detectClosureVarNames(funcNode, outerVarNames) {
  if (!funcNode || !funcNode.body) return new Set();
  const refs = collectIdentifierRefs(funcNode.body);
  const localNames = new Set(
    (funcNode.params || []).map(p =>
      p.type === 'Identifier' ? p.name :
      (p.type === 'AssignmentPattern' ? p.left.name : '_')
    )
  );
  if (funcNode.body.type === 'BlockStatement') {
    for (const n of collectDeclaredNames(funcNode.body)) localNames.add(n);
  }
  const captured = new Set();
  for (const ref of refs) {
    if (!localNames.has(ref) && outerVarNames.has(ref) && !_CLOSURE_BUILTINS.has(ref)) {
      captured.add(ref);
    }
  }
  return captured;
}

export function createClassFromNode(stmt, outerVars, parentClass) {
  // Find the constructor method
  let ctorNode = null;
  const methodDefs = [];
  const staticDefs = [];
  for (const item of stmt.body.body) {
    if (item.type === 'MethodDefinition') {
      if (item.kind === 'constructor') ctorNode = item.value;
      else if (item.static) staticDefs.push(item);
      else methodDefs.push(item);
    }
  }

  // Build the constructor function
  function ClassCtor(...args) {
    const instance = Object.create(ClassCtor.prototype);
    // Run constructor body
    if (ctorNode) {
      const localVars = { ...outerVars, this: instance };
      ctorNode.params.forEach((p, i) => {
        const name = p.type === 'Identifier' ? p.name : (p.type === 'AssignmentPattern' ? p.left.name : '_');
        localVars[name] = i < args.length ? args[i] : (p.type === 'AssignmentPattern' ? evalNode(p.right, outerVars) : undefined);
      });
      for (const s of ctorNode.body.body) {
        execStmtSimple(s, localVars);
      }
      // Copy this.* assignments back
      for (const [k, v] of Object.entries(localVars.this || {})) {
        instance[k] = v;
      }
    }
    return instance;
  }

  // Set up prototype chain
  if (parentClass) {
    ClassCtor.prototype = Object.create(parentClass.prototype || {});
    ClassCtor.prototype.constructor = ClassCtor;
  }

  // Add prototype methods
  for (const m of methodDefs) {
    const mName = m.key.type === 'Identifier' ? m.key.name : String(evalNode(m.key, outerVars));
    ClassCtor.prototype[mName] = createFuncFromNode(m.value, outerVars);
  }

  // Add static methods
  for (const m of staticDefs) {
    const mName = m.key.type === 'Identifier' ? m.key.name : String(evalNode(m.key, outerVars));
    ClassCtor[mName] = createFuncFromNode(m.value, outerVars);
  }

  return ClassCtor;
}

// Simple statement executor for function bodies (no step tracking)
export function execStmtSimple(stmt, vars) {
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
        const body = stmt.body.type === 'BlockStatement' ? stmt.body.body : [stmt.body];
        let brk = false;
        for (const s of body) {
          if (s.type === 'BreakStatement') { brk = true; break; }
          if (s.type === 'ContinueStatement') break;
          const r = execStmtSimple(s, vars);
          if (r && r.__return__) return r;
        }
        if (brk) break;
        if (stmt.update) evalNode(stmt.update, vars);
      }
      return null;
    }
    case 'WhileStatement': {
      let guard = 0;
      while (guard++ < 10000) {
        if (!evalNode(stmt.test, vars)) break;
        const body = stmt.body.type === 'BlockStatement' ? stmt.body.body : [stmt.body];
        let brk = false;
        for (const s of body) {
          if (s.type === 'BreakStatement') { brk = true; break; }
          if (s.type === 'ContinueStatement') break;
          const r = execStmtSimple(s, vars);
          if (r && r.__return__) return r;
        }
        if (brk) break;
      }
      return null;
    }
    case 'DoWhileStatement': {
      let guard = 0;
      while (guard++ < 10000) {
        const body = stmt.body.type === 'BlockStatement' ? stmt.body.body : [stmt.body];
        let brk = false;
        for (const s of body) {
          if (s.type === 'BreakStatement') { brk = true; break; }
          if (s.type === 'ContinueStatement') break;
          const r = execStmtSimple(s, vars);
          if (r && r.__return__) return r;
        }
        if (brk) break;
        if (!evalNode(stmt.test, vars)) break;
      }
      return null;
    }
    case 'ForOfStatement':
    case 'ForInStatement': {
      const iterable = evalNode(stmt.right, vars);
      const items = stmt.type === 'ForInStatement' ? Object.keys(iterable || {}) : (iterable || []);
      const varName = stmt.left.type === 'VariableDeclaration'
        ? stmt.left.declarations[0].id.name
        : (stmt.left.type === 'Identifier' ? stmt.left.name : '_');
      let guard = 0;
      for (const item of items) {
        if (guard++ > 10000) break;
        vars[varName] = item;
        const body = stmt.body.type === 'BlockStatement' ? stmt.body.body : [stmt.body];
        let brk = false;
        for (const s of body) {
          if (s.type === 'BreakStatement') { brk = true; break; }
          if (s.type === 'ContinueStatement') break;
          const r = execStmtSimple(s, vars);
          if (r && r.__return__) return r;
        }
        if (brk) break;
      }
      return null;
    }
    case 'SwitchStatement': {
      const disc = evalNode(stmt.discriminant, vars);
      let matched = false;
      let fell = false;
      for (const c of stmt.cases) {
        if (c.test) {
          const caseVal = evalNode(c.test, vars);
          if (!matched && !fell && disc !== caseVal) continue;
          matched = true;
        } else {
          if (!matched) matched = true;
        }
        if (matched) {
          let hitBreak = false;
          for (const s of c.consequent) {
            if (s.type === 'BreakStatement') { hitBreak = true; break; }
            const r = execStmtSimple(s, vars);
            if (r && r.__return__) return r;
          }
          if (hitBreak) break;
          fell = true;
        }
      }
      return null;
    }
    case 'TryStatement': {
      try {
        for (const s of stmt.block.body) {
          const r = execStmtSimple(s, vars);
          if (r && r.__return__) return r;
        }
      } catch (e) {
        if (stmt.handler) {
          if (stmt.handler.param) {
            const paramName = stmt.handler.param.type === 'Identifier' ? stmt.handler.param.name : 'err';
            vars[paramName] = e && e._thrownValue !== undefined ? e._thrownValue : (e ? e.message : 'error');
          }
          for (const s of stmt.handler.body.body) {
            const r = execStmtSimple(s, vars);
            if (r && r.__return__) return r;
          }
        }
      }
      if (stmt.finalizer) {
        for (const s of stmt.finalizer.body) {
          const r = execStmtSimple(s, vars);
          if (r && r.__return__) return r;
        }
      }
      return null;
    }
    case 'ThrowStatement': {
      const val = evalNode(stmt.argument, vars);
      const err = new Error(typeof val === 'string' ? val : String(val));
      err._thrownValue = val;
      throw err;
    }
    case 'ClassDeclaration': {
      const name = stmt.id ? stmt.id.name : null;
      const parentClass = stmt.superClass ? evalNode(stmt.superClass, vars) : null;
      if (name) vars[name] = createClassFromNode(stmt, vars, parentClass);
      return null;
    }
    case 'FunctionDeclaration': {
      const name = stmt.id ? stmt.id.name : null;
      if (name) vars[name] = createFuncFromNode(stmt, vars);
      return null;
    }
    case 'BlockStatement': {
      for (const s of stmt.body) {
        const r = execStmtSimple(s, vars);
        if (r && r.__return__) return r;
      }
      return null;
    }
    case 'BreakStatement':
    case 'ContinueStatement':
      return null;
    default:
      return null;
  }
}

// ── Helper: detect console.log calls ──
export function isConsoleLog(expr) {
  return expr.type === 'CallExpression' &&
    expr.callee.type === 'MemberExpression' &&
    expr.callee.object.type === 'Identifier' &&
    expr.callee.object.name === 'console' &&
    expr.callee.property.name === 'log';
}

export function detectPhase(val, options) {
  if (Array.isArray(val)) return 'ds-create';
  if (typeof val === 'object' && val !== null) return 'obj-create';
  if (typeof val === 'function') return 'fn-declare';
  return 'declare';
}
