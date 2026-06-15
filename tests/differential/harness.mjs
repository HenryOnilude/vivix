/**
 * Vivix — Differential test harness
 *
 * Runs each JavaScript program through:
 *   (a) Vivix's custom AST-walking interpreter  (in-process via interpret())
 *   (b) Node's real V8 engine                   (in an isolated subprocess)
 * ...then compares the FINAL top-level variable state and reports divergence.
 *
 * Design notes / safety:
 *   - The V8 side runs in a child `node` process with a hard timeout so an
 *     infinite loop in a test case can never lock the machine.
 *   - The interpreter side is bounded by its own MAX_STEPS / loop guards.
 *   - Acorn is treated as a black box: it's used only to discover which
 *     top-level names to compare, never tested itself.
 *   - Every diverging case is written to ./regression-corpus/ so that once a
 *     bug is fixed it stays fixed.
 *
 * Usage:  node tests/differential/harness.mjs
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import { interpret } from '../../src/lib/interpreter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = join(__dirname, 'regression-corpus');
const V8_TIMEOUT_MS = 5000;

// ── Normalisation: turn any runtime value into a JSON-comparable shape ───────
// Shared verbatim between the in-process interpreter side and the injected V8
// side so both produce identical canonical strings for identical values.
const TO_COMPARABLE_SRC = `
function toComparable(v, seen) {
  seen = seen || new Set();
  if (v === undefined) return '<undefined>';
  if (v === null) return null;
  const t = typeof v;
  if (t === 'number') {
    if (Number.isNaN(v)) return '<NaN>';
    if (v === Infinity) return '<Infinity>';
    if (v === -Infinity) return '<-Infinity>';
    return v;
  }
  if (t === 'string' || t === 'boolean') return v;
  if (t === 'function') return '<function>';
  if (t === 'symbol') return '<symbol>';
  if (t === 'bigint') return '<bigint:' + v.toString() + '>';
  if (Array.isArray(v)) {
    if (seen.has(v)) return '<circular>';
    seen.add(v);
    return v.map(function (x) { return toComparable(x, seen); });
  }
  if (t === 'object') {
    if (seen.has(v)) return '<circular>';
    seen.add(v);
    var out = {};
    Object.keys(v).sort().forEach(function (k) { out[k] = toComparable(v[k], seen); });
    return out;
  }
  return String(v);
}
`;
// Make toComparable available in THIS module too.
// eslint-disable-next-line no-eval
const toComparable = (0, eval)(TO_COMPARABLE_SRC + '\ntoComparable');

// ── Discover top-level declared names (Acorn used purely as scaffolding) ─────
function topLevelNames(code) {
  const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: false });
  const names = [];
  const pushPattern = (id) => {
    if (!id) return;
    if (id.type === 'Identifier') names.push(id.name);
    else if (id.type === 'ObjectPattern') id.properties.forEach((p) => {
      if (p.type === 'RestElement') pushPattern(p.argument);
      else pushPattern(p.value);
    });
    else if (id.type === 'ArrayPattern') id.elements.forEach((el) => el && pushPattern(el.type === 'RestElement' ? el.argument : el));
  };
  for (const node of ast.body) {
    if (node.type === 'VariableDeclaration') node.declarations.forEach((d) => pushPattern(d.id));
    else if (node.type === 'FunctionDeclaration' && node.id) names.push(node.id.name);
    else if (node.type === 'ClassDeclaration' && node.id) names.push(node.id.name);
  }
  return [...new Set(names)];
}

// ── Run a program through real V8 in an isolated subprocess ──────────────────
function runV8(code, names) {
  const captureObj = '{' + names.map((n) => JSON.stringify(n) + ': ' + n).join(', ') + '}';
  const program =
    code + '\n;{\n' +
    TO_COMPARABLE_SRC + '\n' +
    'const __diff_capture = ' + captureObj + ';\n' +
    "process.stdout.write('__DIFF__' + JSON.stringify(toComparable(__diff_capture)));\n" +
    '}\n';

  const dir = mkdtempSync(join(tmpdir(), 'vivix-diff-'));
  const file = join(dir, 'case.mjs');
  writeFileSync(file, program, 'utf8');
  try {
    const out = execFileSync('node', [file], {
      timeout: V8_TIMEOUT_MS,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const marker = out.indexOf('__DIFF__');
    if (marker === -1) return { kind: 'error', detail: 'no capture marker in stdout' };
    return { kind: 'ok', state: JSON.parse(out.slice(marker + '__DIFF__'.length)) };
  } catch (e) {
    if (e.killed || e.signal === 'SIGTERM') return { kind: 'timeout' };
    const stderr = String(e.stderr || '');
    const m = stderr.match(/^\s*\w*Error:.*$/m) || stderr.match(/^(\w*Error)\b.*$/m);
    const line = m ? m[0].trim() : (stderr.split('\n').find((l) => l.trim()) || e.message).trim();
    const type = (line.match(/(\w*Error)/) || [])[1] || 'Error';
    return { kind: 'throw', errorType: type, detail: line };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Run a program through Vivix's interpreter (in-process, bounded) ──────────
function runInterpreter(code, names) {
  let result;
  try {
    result = interpret(code, {});
  } catch (e) {
    return { kind: 'error', detail: 'interpret() threw: ' + e.message };
  }
  if (result.error) {
    const type = (String(result.error).match(/(\w*Error)/) || [])[1] || 'Error';
    return { kind: 'throw', errorType: type, detail: String(result.error), truncated: !!result.truncated };
  }
  const steps = result.steps || [];
  const last = steps[steps.length - 1];
  const vars = (last && last.vars) || {};
  const state = {};
  for (const n of names) state[n] = toComparable(vars[n]);
  return { kind: 'ok', state, truncated: !!result.truncated };
}

// ── Stable stringify: sort object keys at every level so insertion order
//    can never cause a false divergence (only values/structure matter). ──────
function stableStringify(v) {
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

// ── Compare two run outcomes ─────────────────────────────────────────────────
function compare(v8, interp) {
  if (v8.kind === 'timeout') return { match: false, reason: 'V8 timed out (could not establish ground truth)' };
  if (v8.kind === 'throw' && interp.kind === 'throw') {
    return interp.errorType === v8.errorType
      ? { match: true, reason: `both threw ${v8.errorType}` }
      : { match: false, reason: `error type mismatch: V8 ${v8.errorType} vs interp ${interp.errorType}` };
  }
  if (v8.kind === 'throw' && interp.kind !== 'throw') {
    return { match: false, reason: `V8 threw ${v8.errorType}; interpreter did NOT throw` };
  }
  if (interp.kind === 'throw' && v8.kind === 'ok') {
    return { match: false, reason: `interpreter threw ${interp.errorType}; V8 completed normally` };
  }
  if (v8.kind === 'ok' && interp.kind === 'ok') {
    const a = stableStringify(v8.state);
    const b = stableStringify(interp.state);
    return a === b ? { match: true, reason: 'final state identical' } : { match: false, reason: 'final state differs' };
  }
  return { match: false, reason: `unhandled: V8 ${v8.kind}, interp ${interp.kind}` };
}

// ── Test cases ───────────────────────────────────────────────────────────────
const CASES = [
  {
    id: '01-loop-closure-scoping',
    title: 'Loop-closure scoping (for-let captures per-iteration binding)',
    code: [
      'const funcs = [];',
      'for (let i = 0; i < 5; i++) {',
      '  funcs.push(() => i);',
      '}',
      'const results = [funcs[0](), funcs[1](), funcs[2](), funcs[3](), funcs[4]()];',
    ].join('\n'),
  },
  {
    id: '02-temporal-dead-zone',
    title: 'Temporal Dead Zone (read let before declaration)',
    code: [
      'let result;',
      'try {',
      '  result = value;',
      '} catch (e) {',
      "  result = 'threw ' + e.name;",
      '}',
      'let value = 42;',
    ].join('\n'),
  },
  {
    id: '03-try-finally-return-override',
    title: 'try/finally return override (finally wins)',
    code: [
      'function f() {',
      '  try {',
      "    return 'try';",
      '  } finally {',
      "    return 'finally';",
      '  }',
      '}',
      'const result = f();',
    ].join('\n'),
  },
  {
    id: '04-closure-over-mutated-outer',
    title: 'Closure sees mutated outer variable (not a snapshot)',
    code: [
      'function makeReader() {',
      '  let x = 1;',
      '  function read() { return x; }',
      '  x = 2;',
      '  return read;',
      '}',
      'const reader = makeReader();',
      'const result = reader();',
    ].join('\n'),
  },
  {
    id: '05-arrow-lexical-this',
    title: 'Arrow function lexically inherits this from enclosing method',
    code: [
      'const obj = {',
      '  val: 42,',
      '  getVal() {',
      '    const arrow = () => this.val;',
      '    return arrow();',
      '  }',
      '};',
      'const result = obj.getVal();',
    ].join('\n'),
  },
  {
    id: '06-block-shadowing-toplevel',
    title: 'Variable shadowing across nested block scopes (top level)',
    code: [
      'let x = 1;',
      'let mid, inner, after;',
      '{',
      '  let x = 2;',
      '  mid = x;',
      '  {',
      '    let x = 3;',
      '    inner = x;',
      '  }',
      '  after = x;',
      '}',
      'const top = x;',
    ].join('\n'),
  },

  // ── Bonus cases: divergences found by reading execStmtSimple (function bodies)
  {
    id: '07-block-shadowing-in-function',
    title: 'BONUS: shadowing in nested block INSIDE a function body',
    bonus: true,
    code: [
      'function f() {',
      '  let x = 1;',
      '  const out = {};',
      '  {',
      '    let x = 2;',
      '    out.inner = x;',
      '  }',
      '  out.outer = x;',
      '  return out;',
      '}',
      'const result = f();',
    ].join('\n'),
  },
  {
    id: '08-finally-side-effect',
    title: 'BONUS: finally side-effect runs even when try returns',
    bonus: true,
    code: [
      'const log = [];',
      'function f() {',
      '  try {',
      "    log.push('try');",
      '    return 1;',
      '  } finally {',
      "    log.push('finally');",
      '  }',
      '}',
      'const result = f();',
    ].join('\n'),
  },
];

// ── Driver ───────────────────────────────────────────────────────────────────
function corpusFile(c, v8, interp, cmp) {
  const header = [
    '/**',
    ` * REGRESSION CORPUS — ${c.id}`,
    ` * ${c.title}`,
    ' *',
    ` * Divergence: ${cmp.reason}`,
    ` * V8 (truth):    ${describe(v8)}`,
    ` * Interpreter:   ${describe(interp)}`,
    ' *',
    ' * Captured by tests/differential/harness.mjs. Once the interpreter is',
    ' * fixed, this program should produce the V8 result above.',
    ' */',
    '',
  ].join('\n');
  return header + c.code + '\n';
}

function describe(r) {
  if (r.kind === 'ok') return 'state = ' + JSON.stringify(r.state);
  if (r.kind === 'throw') return 'threw ' + r.errorType + ' (' + r.detail + ')';
  if (r.kind === 'timeout') return 'timed out';
  return r.kind + (r.detail ? ' (' + r.detail + ')' : '');
}

function main() {
  mkdirSync(CORPUS_DIR, { recursive: true });
  // Clear stale corpus entries so the folder always reflects the latest run.
  for (const f of readdirSync(CORPUS_DIR)) {
    if (f.endsWith('.mjs')) rmSync(join(CORPUS_DIR, f), { force: true });
  }
  const diverged = [];
  let line = '─'.repeat(78);

  console.log('\nVIVIX DIFFERENTIAL DIVERGENCE REPORT');
  console.log(line);

  for (const c of CASES) {
    const names = topLevelNames(c.code);
    const v8 = runV8(c.code, names);
    const interp = runInterpreter(c.code, names);
    const cmp = compare(v8, interp);

    console.log(`\n[${c.id}] ${c.title}`);
    console.log('  program:');
    console.log(c.code.split('\n').map((l) => '    ' + l).join('\n'));
    console.log('  V8 (truth):  ' + describe(v8));
    console.log('  interpreter: ' + describe(interp));
    console.log('  → ' + (cmp.match ? 'MATCH ✓' : 'DIVERGE ✗') + '  (' + cmp.reason + ')');

    if (!cmp.match) {
      const fpath = join(CORPUS_DIR, c.id + '.mjs');
      writeFileSync(fpath, corpusFile(c, v8, interp, cmp), 'utf8');
      diverged.push({ id: c.id, title: c.title, reason: cmp.reason, bonus: !!c.bonus, file: fpath });
    }
  }

  console.log('\n' + line);
  const requested = CASES.filter((c) => !c.bonus).length;
  const divRequested = diverged.filter((d) => !d.bonus).length;
  const divBonus = diverged.filter((d) => d.bonus).length;
  console.log(`SUMMARY: ${diverged.length} divergence(s) total`);
  console.log(`  • ${divRequested}/${requested} of the requested cases diverge`);
  if (divBonus) console.log(`  • ${divBonus} additional divergence(s) from bonus cases`);
  if (diverged.length) {
    console.log('\nCorpus files written:');
    diverged.forEach((d) => console.log('  - ' + d.file));
  }
  console.log(line + '\n');
}

main();
