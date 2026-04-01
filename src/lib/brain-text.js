/**
 * Brain text generators — human-readable explanations for the CPU brain panel.
 *
 * Extracted from interpreter.js for single-responsibility.
 */

import { fv, byteSize, totalBytes } from './utils.js';

export function buildDeclBrain(name, val, keyword, vars) {
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

export function buildDoneBrain(vars, output, state) {
  const varCount = Object.keys(vars).length;
  const total = totalBytes(vars);
  let msg = `PROGRAM COMPLETE\n\nFinal state: ${varCount} variable${varCount !== 1 ? 's' : ''} in memory\nTotal heap: ~${total} bytes\nMemory writes: ${state.memOps}\nComparisons: ${state.comps}`;
  if (state.extra.loopIters) msg += `\nLoop iterations: ${state.extra.loopIters}`;
  if (state.extra.calls) msg += `\nFunction calls: ${state.extra.calls}`;
  if (state.extra.arrOps) msg += `\nArray operations: ${state.extra.arrOps}`;
  if (state.extra.objOps) msg += `\nObject operations: ${state.extra.objOps}`;
  if (state.extra.dsOps) msg += `\nDS operations: ${state.extra.dsOps}`;
  if (state.extra.closureRegistry) {
    const n = Object.keys(state.extra.closureRegistry).length;
    if (n > 0) msg += `\nClosures created: ${n}`;
  }
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
