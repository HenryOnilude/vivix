/**
 * Shared utilities for all visual learning modules.
 * Eliminates duplication of formatting, type-checking, and deep-copy helpers.
 */

// ── Deep clone ──
export function dc(o) {
  return JSON.parse(JSON.stringify(o));
}

// ── Format value for display ──
export function fv(val) {
  if (val === undefined) return 'undefined';
  if (val === null) return 'null';
  if (typeof val === 'string') return `"${val}"`;
  if (typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return `[${val.map(v => typeof v === 'string' ? `"${v}"` : typeof v === 'object' && v !== null ? JSON.stringify(v) : v).join(', ')}]`;
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

// ── Type color (for syntax highlighting) ──
export function tc(val) {
  if (typeof val === 'number') return '#ffcc66';
  if (typeof val === 'string') return '#ff8866';
  if (typeof val === 'boolean') return val ? '#00ff88' : '#ff4466';
  if (Array.isArray(val)) return '#88aaff';
  if (typeof val === 'object' && val !== null) return '#c084fc';
  if (val === null) return '#94a3b8';
  if (val === undefined) return '#64748b';
  return '#aaa';
}

// ── Type badge label ──
export function tb(val) {
  if (Array.isArray(val)) return 'arr';
  if (typeof val === 'object' && val !== null) return 'obj';
  if (typeof val === 'number') return 'num';
  if (typeof val === 'string') return 'str';
  if (typeof val === 'boolean') return 'bool';
  if (val === null) return 'null';
  if (val === undefined) return 'undef';
  return typeof val;
}

// ── Safe expression evaluator ──
export function evalExpr(expr, vars) {
  const keys = Object.keys(vars);
  const vals = Object.values(vars);
  return new Function(...keys, `return (${expr});`)(...vals);
}

// ── Find next non-empty, non-brace, non-comment line ──
export function findNextLine(lines, from) {
  for (let i = from; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t !== '' && t !== '{' && t !== '}' && !t.startsWith('//')) return i;
  }
  return -1;
}

// ── Find closing brace for a block starting at line s ──
export function findBlockEnd(lines, s) {
  let depth = 0;
  for (let i = s; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') depth++;
      if (ch === '}') { depth--; if (depth <= 0) return i; }
    }
  }
  return lines.length - 1;
}

// ── Byte size estimate for a JS value ──
export function byteSize(val) {
  const t = typeof val;
  if (t === 'number') return 8;
  if (t === 'boolean') return 4;
  if (t === 'string') return (String(val).length * 2) + 16;
  if (val === null || val === undefined) return 8;
  if (Array.isArray(val)) return 16 + val.length * 8;
  if (t === 'object') return 16 + Object.keys(val).length * 16;
  return 8;
}

// ── Total bytes for all vars ──
export function totalBytes(vars) {
  return Object.values(vars).reduce((sum, v) => sum + byteSize(v), 0);
}

// ── Complexity bar data (shared across all modules) ──
export const COMPLEXITY_BARS = [
  { label: 'O(1)', h: 10, color: '#4ade80' },
  { label: 'O(lg)', h: 25, color: '#a3e635' },
  { label: 'O(n)', h: 45, color: '#facc15' },
  { label: 'O(n·lg)', h: 70, color: '#fb923c' },
  { label: 'O(n²)', h: 100, color: '#f87171' },
];

// ── Dynamic complexity analyser ──────────────────────────────────────────────
/**
 * Heuristically derive time/space complexity from an Acorn AST.
 * Rules:
 *   0 loops  → O(1)
 *   1 loop   → O(n)   [O(n·lg) if .sort() also present]
 *   2+ loops → O(n²)  [simplified]
 *
 * @param {object} ast  — result of acorn.parse(...)
 * @returns {{ time:string, space:string, timeWhy:string, spaceWhy:string, dynamic:boolean }}
 */
export function analyzeComplexity(ast) {
  let maxLoopDepth  = 0;
  let currentDepth  = 0;
  let hasSort       = false;
  let dynamicAllocs = 0; // ArrayExpression / ObjectExpression at top-level

  const LOOP_TYPES = new Set([
    'ForStatement', 'WhileStatement', 'DoWhileStatement',
    'ForOfStatement', 'ForInStatement',
  ]);

  function walk(node) {
    if (!node || typeof node !== 'object') return;

    if (LOOP_TYPES.has(node.type)) {
      currentDepth++;
      maxLoopDepth = Math.max(maxLoopDepth, currentDepth);
      walk(node.body);
      currentDepth--;
      // Also walk loop init/test/update but don't count as depth
      if (node.init)   walk(node.init);
      if (node.test)   walk(node.test);
      if (node.update) walk(node.update);
      return;
    }

    if (node.type === 'CallExpression') {
      if (node.callee && node.callee.type === 'MemberExpression' &&
          !node.callee.computed && node.callee.property &&
          node.callee.property.name === 'sort') {
        hasSort = true;
      }
    }

    if (node.type === 'ArrayExpression' || node.type === 'ObjectExpression') {
      dynamicAllocs++;
    }

    // Walk all child properties generically
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

  // ── Time complexity ──────────────────────────────────────────────────────
  let time, timeWhy;
  if (maxLoopDepth === 0) {
    time    = 'O(1)';
    timeWhy = 'No loops detected — each statement runs a fixed number of times regardless of input size.';
  } else if (maxLoopDepth === 1) {
    if (hasSort) {
      time    = 'O(n·lg)';
      timeWhy = 'One loop plus a .sort() call — the sort dominates at O(n log n), so total time is O(n log n).';
    } else {
      time    = 'O(n)';
      timeWhy = 'One loop detected — it runs n times, giving linear time growth.';
    }
  } else {
    time    = 'O(n²)';
    timeWhy = `${maxLoopDepth} nested loops detected — each adds a factor of n, giving O(n${maxLoopDepth > 2 ? maxLoopDepth : '²'}) growth.`;
  }

  // ── Space complexity (heuristic) ─────────────────────────────────────────
  let space, spaceWhy;
  if (dynamicAllocs === 0) {
    space    = 'O(1)';
    spaceWhy = 'No dynamic array or object literals detected — variables use constant space.';
  } else {
    space    = 'O(n)';
    spaceWhy = 'Array or object literals detected — space grows with the amount of data stored.';
  }

  return { time, space, timeWhy, spaceWhy, dynamic: true };
}

// ── Playback controller factory ──
export function createPlayback(getSteps, onUpdate) {
  let timer = null;
  let playing = false;

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    playing = false;
  }

  function toggle(getCurrentStep, getTotalSteps, setStep) {
    if (playing) { stop(); return false; }
    const current = getCurrentStep();
    const total = getTotalSteps();
    if (current >= total - 1) setStep(0);
    playing = true;
    timer = setInterval(() => {
      const c = getCurrentStep();
      const t = getTotalSteps();
      if (c < t - 1) setStep(c + 1);
      else stop();
      if (onUpdate) onUpdate(playing);
    }, 1800);
    return true;
  }

  function destroy() { stop(); }

  return { stop, toggle, destroy, isPlaying: () => playing };
}
