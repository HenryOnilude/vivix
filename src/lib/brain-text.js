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

// ── Closure-specific brain text (three-layer: what / why / connects) ──

/**
 * Brain text for the start step when trackClosures is active.
 */
export function buildClosureStartBrain() {
  return 'The engine initialises the Global scope as a heap-resident record that every top-level binding lives in. V8 stores scope records on the heap rather than the stack so that inner functions can maintain a back-link to parent bindings after the parent frame is destroyed. The first declaration ahead allocates into this Global heap record.';
}

/**
 * Brain text when a function declaration creates a closure (phase: closure-create via FunctionDeclaration).
 * @param {string} name — function name
 * @param {string} params — comma-separated param list
 * @param {string[]} capturedNames — names of variables captured from the outer scope
 */
export function buildClosureFnDeclareBrain(name, params, capturedNames) {
  const captured = capturedNames.join(', ');
  return `The engine stores "${name}(${params})" and attaches a back-link from its lexical environment to the parent scope's heap record, capturing [${captured}]. Because this back-link is a live reference, the garbage collector cannot reclaim the parent record even after the outer function returns — this is lexical environment persistence. Every future call to ${name} will resolve ${captured} by following that back-link.`;
}

/**
 * Brain text when a variable declaration results in a closure being created
 * (e.g. let counter = makeCounter(); where the returned function captures outer vars).
 * @param {string} name — variable name receiving the closure
 * @param {string[]} capturedNames — captured variable names
 * @param {*} val — the value assigned
 */
export function buildClosureCreateBrain(name, capturedNames, val) {
  const captured = capturedNames.join(', ');
  const tp = typeof val;
  if (tp === 'function') {
    return `The engine creates a closure for "${name}", capturing [${captured}] from the parent scope. V8 stores a back-link from this function's lexical environment to the parent scope's heap record — that heap record now cannot be garbage-collected because the inner function holds a live reference. The captured variable${capturedNames.length > 1 ? 's become' : ' becomes'} accessible whenever this closure executes.`;
  }
  if (tp === 'object' && val !== null && !Array.isArray(val)) {
    const methods = Object.entries(val).filter(([, v]) => typeof v === 'function').map(([k]) => k);
    if (methods.length > 0) {
      return `The engine returns an object whose method${methods.length > 1 ? 's' : ''} [${methods.join(', ')}] each hold a back-link to the parent scope's heap record, capturing [${captured}]. The parent frame is destroyed on return, but the heap record persists because these methods maintain live references — this is lexical environment persistence. Calling any method resolves ${captured} through that shared back-link.`;
    }
  }
  return `The engine assigns "${name}" from a closure-producing call, capturing [${captured}] via a back-link to the parent scope's heap record. That heap record survives the parent function's return because the returned value holds a live reference to it. Accessing ${captured} later follows this back-link to the original allocation.`;
}

/**
 * Brain text when a closure is invoked (phase: closure-call).
 * @param {string} name — variable name receiving the result
 * @param {string} calledName — the closure function being called
 * @param {string[]} capturedNames — captured variable names
 * @param {*} result — the result value
 */
export function buildClosureCallBrain(name, calledName, capturedNames, result) {
  const captured = capturedNames.join(', ');
  return `The engine invokes ${calledName}(), which follows its back-link to the parent scope's heap record to resolve [${captured}]. Any mutation to ${captured} writes directly into that heap record — all closures sharing the same back-link see the change immediately. The result ${fv(result)} lands in "${name}", confirming the heap record allocated at closure-creation time is still alive.`;
}

/**
 * Brain text for the done step when trackClosures is active.
 * @param {Record<string,*>} vars
 * @param {object} state
 */
export function buildClosureDoneBrain(vars, state) {
  const closureCount = state.extra.closureRegistry ? Object.keys(state.extra.closureRegistry).length : 0;
  const varCount = Object.keys(vars).length;
  const total = totalBytes(vars);
  return `The call stack is empty and the engine returns to idle with ${varCount} binding${varCount !== 1 ? 's' : ''} across ~${total} bytes. ${closureCount} closure${closureCount !== 1 ? 's' : ''} created heap records that persisted beyond their parent frame's lifetime through back-links — the garbage collector only reclaims these records once every referencing closure is itself unreachable. This is the full lifecycle of lexical environment persistence: allocation, back-link creation, survival past parent return, and eventual collection.`;
}

// ── FnCall-specific brain text (three-layer: what / why / connects) ──

/**
 * Brain text for the start step when trackCalls is active.
 */
export function buildFnCallStartBrain() {
  return 'The engine creates the Global frame — the bottom of the call stack that every top-level binding lives in. Stack frames exist so the engine can track exactly where to return after each call; LIFO ordering guarantees the most recent frame is always on top. The first function declaration ahead will be stored in this frame, ready for invocation.';
}

/**
 * Brain text when a function is declared (phase: fn-declare) under trackCalls.
 * @param {string} name — function name
 * @param {string} params — comma-separated param list
 */
export function buildFnCallFnDeclareBrain(name, params) {
  return `The engine stores "${name}(${params})" in the current frame without executing it — the body becomes a callable reference. Because stack frames use LIFO ordering, calling ${name} later will push a new frame on top containing its own locals and a return address pointing back to this frame. Execution will resume here once ${name} returns.`;
}

/**
 * Brain text when a function is called (phase: fn-call) under trackCalls.
 * @param {string} fnName — function being called
 * @param {number} argCount — number of arguments passed
 * @param {*} result — return value
 * @param {number} depth — current stack depth
 */
export function buildFnCallCallBrain(fnName, argCount, result, depth) {
  return `The engine pushes a new stack frame for ${fnName}() containing ${argCount} argument${argCount !== 1 ? 's' : ''}, a return address pointing back to the caller, and space for local variables — stack depth is now ${depth}. LIFO ordering guarantees the engine always knows which frame to resume: the one directly beneath. When ${fnName} finishes, this frame will be popped and ${fv(result)} delivered to the caller's frame.`;
}

/**
 * Brain text when a function returns (phase: fn-return) under trackCalls.
 * @param {*} val — the return value
 * @param {string} fnName — name of the returning function (if known)
 */
export function buildFnCallReturnBrain(val, fnName) {
  const name = fnName || 'the function';
  return `The engine pops ${name}'s stack frame — its local variables are destroyed and the return address directs execution back to the caller's frame. LIFO ordering made this predictable: the top frame is always the one that returns next. The value ${fv(val)} is placed into the caller's accumulator, confirming the frame beneath has resumed.`;
}

/**
 * Brain text for the done step when trackCalls is active.
 * @param {Record<string,*>} vars
 * @param {object} state
 */
export function buildFnCallDoneBrain(vars, state) {
  const calls = state.extra.calls || 0;
  const maxDepth = state.extra.maxDepth || 1;
  const varCount = Object.keys(vars).length;
  const total = totalBytes(vars);
  return `The call stack is empty — every frame that was pushed has been popped in LIFO order, leaving ${varCount} binding${varCount !== 1 ? 's' : ''} across ~${total} bytes. ${calls} function call${calls !== 1 ? 's' : ''} reached a maximum stack depth of ${maxDepth}. Each call pushed a frame with a return address; each return destroyed that frame and jumped back to the caller. This is the full lifecycle of stack-based control flow: push, execute, return, pop.`;
}

// ── ForLoop-specific brain text (three-layer: what / why / connects) ──

/**
 * Brain text for the start step when trackLoops is active.
 */
export function buildLoopStartBrain() {
  return 'The engine creates the Global frame and begins scanning for loop structures. Loops are the primary target of the TurboFan optimising compiler because repeated execution with consistent types allows aggressive machine-code generation via on-stack replacement. The first statement ahead sets up the variables that the loop will mutate on each iteration.';
}

/**
 * Brain text for a for-loop test step (phase: loop-test).
 * @param {boolean} testVal — whether the condition passed
 * @param {number} iterNum — current iteration number
 * @param {string|null} counterName — loop counter variable name (e.g. "i")
 * @param {*} counterVal — current counter value
 * @param {*} prevCounterVal — previous counter value (null on first iter)
 */
export function buildLoopTestBrain(testVal, iterNum, counterName, counterVal, prevCounterVal) {
  const isHot = iterNum >= 3;
  const counterStr = counterName
    ? (prevCounterVal != null
      ? ` — the counter "${counterName}" mutates from ${fv(prevCounterVal)} to ${fv(counterVal)} on the stack, staying type-consistent as a ${typeof counterVal === 'number' && Number.isInteger(counterVal) ? 'SMI' : typeof counterVal}`
      : ` — the counter "${counterName}" starts at ${fv(counterVal)} on the stack`)
    : '';
  if (!testVal) {
    return `The engine evaluates the condition as FALSE and exits after ${iterNum} iteration${iterNum !== 1 ? 's' : ''}${counterStr}. ${isHot ? 'TurboFan compiled this loop into optimised machine code after detecting consistent types across iterations — the compiled code is now discarded as the loop ends.' : 'Ignition interpreted every iteration as bytecode; the loop never became hot enough for TurboFan to compile.'} The counter\'s final value connects back to the initial value set in iteration one.`;
  }
  if (isHot) {
    return `The engine evaluates the condition as TRUE and enters iteration ${iterNum}${counterStr}. Because the type has not changed across iterations, TurboFan marks this loop as hot and compiles it into optimised machine code via on-stack replacement. Note: let/const inside this loop block shares the outer scope in this visualiser — the real engine creates a fresh lexical environment per iteration.`;
  }
  return `The engine evaluates the condition as TRUE and enters iteration ${iterNum}${counterStr}. Ignition is still interpreting as bytecode and collecting type feedback into the FeedbackVector — after enough consistent iterations TurboFan will compile this hot path into optimised machine code. Note: let/const inside this loop block shares the outer scope in this visualiser — the real engine creates a fresh lexical environment per iteration.`;
}

/**
 * Brain text for a while-loop test step.
 * @param {boolean} testVal
 * @param {number} iterNum
 */
export function buildWhileTestBrain(testVal, iterNum) {
  const isHot = iterNum >= 3;
  if (!testVal) {
    return `The engine evaluates the while-condition as FALSE and exits after ${iterNum} iteration${iterNum !== 1 ? 's' : ''}. ${isHot ? 'TurboFan had compiled this loop into optimised machine code after detecting type-consistent iterations — that compiled code is now discarded.' : 'The loop never reached the hot threshold for TurboFan compilation; Ignition interpreted every iteration as bytecode.'} Execution resumes at the statement following the loop, connecting back to the state before iteration one.`;
  }
  if (isHot) {
    return `The engine evaluates the while-condition as TRUE and enters iteration ${iterNum}. Consistent types across iterations caused TurboFan to mark this loop as hot and compile it into optimised machine code via on-stack replacement — the bytecode is swapped out mid-execution. Note: let/const inside this block shares the outer scope in this visualiser; the real engine creates a fresh lexical environment per iteration.`;
  }
  return `The engine evaluates the while-condition as TRUE and enters iteration ${iterNum}. Ignition is interpreting as bytecode and collecting type feedback — TurboFan will compile this loop into optimised machine code once the types stay consistent across enough iterations. Note: let/const inside this block shares the outer scope in this visualiser; the real engine creates a fresh lexical environment per iteration.`;
}

/**
 * Brain text for a do...while test step.
 * @param {boolean} testVal
 * @param {number} iterNum
 */
export function buildDoWhileTestBrain(testVal, iterNum) {
  const isHot = iterNum >= 3;
  if (!testVal) {
    return `The engine evaluates the do-while condition as FALSE and exits after ${iterNum} iteration${iterNum !== 1 ? 's' : ''}. The body always executed at least once before this check — that is the key difference from a standard while loop. ${isHot ? 'TurboFan had compiled the hot path; that machine code is now discarded.' : 'Ignition interpreted every iteration as bytecode.'} The final state connects back to the values set during the first unconditional pass.`;
  }
  if (isHot) {
    return `The engine evaluates the do-while condition as TRUE and repeats the body — iteration ${iterNum}. The body executed before this check, which is the defining trait of do-while. TurboFan has compiled this loop into optimised machine code via on-stack replacement after detecting consistent types. Note: let/const inside this block shares the outer scope in this visualiser; the real engine creates a fresh lexical environment per iteration.`;
  }
  return `The engine evaluates the do-while condition as TRUE and repeats the body — iteration ${iterNum}. The body executed before this check, which is the defining trait of do-while. Ignition is collecting type feedback; TurboFan will compile once the types stay consistent across enough iterations. Note: let/const inside this block shares the outer scope in this visualiser; the real engine creates a fresh lexical environment per iteration.`;
}

/**
 * Brain text for a for...of / for...in init step.
 * @param {boolean} isForIn
 * @param {*} iterable
 */
export function buildForOfInitBrain(isForIn, iterable) {
  if (isForIn) {
    return `The engine begins a for-in loop over ${fv(iterable)}, collecting enumerable keys from the object. The iterator walks property keys as strings — the engine bets on type consistency (all strings) and will trigger TurboFan if the loop becomes hot. Note: let/const inside this block shares the outer scope in this visualiser; the real engine creates a fresh lexical environment per iteration.`;
  }
  return `The engine begins a for-of loop over ${fv(iterable)}, calling [Symbol.iterator]() to obtain an iterator. Each iteration calls .next() and extracts the value — the engine bets on type consistency across values and will trigger TurboFan if the loop becomes hot. Note: let/const inside this block shares the outer scope in this visualiser; the real engine creates a fresh lexical environment per iteration.`;
}

/**
 * Brain text for a for...of / for...in iteration step.
 * @param {boolean} isForIn
 * @param {string} varName
 * @param {*} item
 * @param {number} iterNum
 */
export function buildForOfIterBrain(isForIn, varName, item, iterNum) {
  const isHot = iterNum >= 3;
  const kind = isForIn ? 'for-in' : 'for-of';
  return `The engine assigns ${varName} = ${fv(item)} on iteration ${iterNum} of the ${kind} loop. ${isHot ? `TurboFan has compiled this loop into optimised machine code after detecting consistent types across iterations — each assignment is now a single machine instruction.` : `Ignition is collecting type feedback; TurboFan will compile once the types stay consistent across enough iterations.`} The counter mutates on the stack, connecting back to the iterator created at loop entry.`;
}

/**
 * Brain text for the done step when trackLoops is active.
 * @param {Record<string,*>} vars
 * @param {object} state
 */
export function buildLoopDoneBrain(vars, state) {
  const iters = state.extra.loopIters || 0;
  const varCount = Object.keys(vars).length;
  const total = totalBytes(vars);
  return `The program ends with ${varCount} binding${varCount !== 1 ? 's' : ''} across ~${total} bytes after ${iters} loop iteration${iters !== 1 ? 's' : ''}. ${iters >= 3 ? 'TurboFan compiled the hot loop into optimised machine code — that code is now discarded and the compiled artifacts are eligible for garbage collection.' : 'The loop never became hot enough for TurboFan; Ignition interpreted every iteration as bytecode.'} This is the full lifecycle: bytecode interpretation, type-feedback collection, optional compilation, and teardown.`;
}

// ── ArrayFlow-specific brain text (three-layer: what / why / connects) ──

/**
 * Detect the V8 Elements Kind for an array.
 * @param {Array} arr
 * @returns {string}
 */
function detectElementsKind(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 'PACKED_SMI_ELEMENTS';
  const hasHole = arr.some((_, i) => !(i in arr));
  const allSmi = arr.every(v => typeof v === 'number' && Number.isInteger(v) && v >= -2147483648 && v <= 2147483647);
  const allDouble = arr.every(v => typeof v === 'number');
  if (hasHole) {
    if (allSmi) return 'HOLEY_SMI_ELEMENTS';
    if (allDouble) return 'HOLEY_DOUBLE_ELEMENTS';
    return 'HOLEY_ELEMENTS';
  }
  if (allSmi) return 'PACKED_SMI_ELEMENTS';
  if (allDouble) return 'PACKED_DOUBLE_ELEMENTS';
  return 'PACKED_ELEMENTS';
}

/**
 * Whether a transition from oldKind to newKind is a downgrade.
 */
const KIND_RANK = {
  'PACKED_SMI_ELEMENTS': 0,
  'PACKED_DOUBLE_ELEMENTS': 1,
  'PACKED_ELEMENTS': 2,
  'HOLEY_SMI_ELEMENTS': 3,
  'HOLEY_DOUBLE_ELEMENTS': 4,
  'HOLEY_ELEMENTS': 5,
};

function kindDescription(kind) {
  const desc = {
    'PACKED_SMI_ELEMENTS': 'fastest — direct unboxed integer access',
    'PACKED_DOUBLE_ELEMENTS': 'moderate — unboxed double access',
    'PACKED_ELEMENTS': 'slower — tagged pointer access for mixed types',
    'HOLEY_SMI_ELEMENTS': 'degraded — hole checks on every integer access',
    'HOLEY_DOUBLE_ELEMENTS': 'degraded — hole checks on every double access',
    'HOLEY_ELEMENTS': 'slowest — hole checks plus prototype chain lookups on every access',
  };
  return desc[kind] || kind;
}

/**
 * Brain text for the start step when trackArrays is active.
 */
export function buildArrayStartBrain() {
  return 'The engine creates the Global frame and prepares to track array operations. V8 assigns every array an Elements Kind — PACKED_SMI_ELEMENTS for integers is fastest, PACKED_DOUBLE_ELEMENTS for floats is moderate, PACKED_ELEMENTS for mixed types is slower, and any HOLEY variant is slowest. These transitions are largely one-directional: once downgraded, the kind rarely recovers.';
}

/**
 * Brain text when an array literal is declared under trackArrays.
 * @param {string} name — variable name
 * @param {Array} arr — the array value
 */
export function buildArrayDeclareBrain(name, arr) {
  const kind = detectElementsKind(arr);
  return `The engine allocates "${name}" as an array of ${arr.length} element${arr.length !== 1 ? 's' : ''} with a backing store and assigns Elements Kind ${kind} — ${kindDescription(kind)}. This kind governs every future read and write on this array; the engine bets on type consistency and will optimise aggressively while the kind stays stable.`;
}

/**
 * Brain text for push under trackArrays.
 * @param {string} objName
 * @param {Array} oldArr — array before push
 * @param {Array} newArr — array after push
 * @param {*} value — pushed value
 */
export function buildArrayPushBrain(objName, oldArr, newArr, value) {
  const oldKind = detectElementsKind(oldArr);
  const newKind = detectElementsKind(newArr);
  const transitioned = KIND_RANK[newKind] > KIND_RANK[oldKind];
  const idx = newArr.length - 1;
  return `The engine appends ${fv(value)} to ${objName} at index ${idx} — O(1) amortised into the backing store. The array's Elements Kind ${transitioned ? `transitions from ${oldKind} to ${newKind}, a permanent one-directional downgrade that forces ${kindDescription(newKind)}` : `remains ${newKind}, keeping ${kindDescription(newKind)}`}. After push, the backing store holds ${newArr.length} element${newArr.length !== 1 ? 's' : ''} and the kind established here governs every subsequent operation.`;
}

/**
 * Brain text for pop under trackArrays.
 * @param {string} objName
 * @param {Array} oldArr
 * @param {Array} newArr
 * @param {*} removed
 */
export function buildArrayPopBrain(objName, oldArr, newArr, removed) {
  const kind = detectElementsKind(newArr.length > 0 ? newArr : oldArr);
  return `The engine removes the last element (${fv(removed)}) from ${objName} — O(1). V8 sets the vacated slot to "the_hole" internally and decrements the length; the backing store is not shrunk. The Elements Kind remains ${kind} because pop does not change the type of remaining elements — the kind established at creation still governs access speed.`;
}

/**
 * Brain text for shift under trackArrays.
 * @param {string} objName
 * @param {Array} oldArr
 * @param {Array} newArr
 * @param {*} removed
 */
export function buildArrayShiftBrain(objName, oldArr, newArr, removed) {
  const kind = detectElementsKind(newArr);
  return `The engine removes the first element (${fv(removed)}) from ${objName} and copies every remaining element one position left — O(n) with ${newArr.length} element${newArr.length !== 1 ? 's' : ''} moved. The Elements Kind remains ${kind}, but shift is expensive regardless of kind because it rewrites the entire backing store. This cost connects back to the initial allocation: a deque or linked list avoids it.`;
}

/**
 * Brain text for sort under trackArrays.
 * @param {string} objName
 * @param {Array} oldArr
 * @param {Array} newArr
 */
export function buildArraySortBrain(objName, oldArr, newArr) {
  const oldKind = detectElementsKind(oldArr);
  const newKind = detectElementsKind(newArr);
  const transitioned = KIND_RANK[newKind] > KIND_RANK[oldKind];
  const comps = Math.ceil(newArr.length * Math.log2(newArr.length || 1));
  return `The engine sorts ${objName} in-place using TimSort — O(n log n) with ~${comps} comparisons estimated. ${transitioned ? `The Elements Kind transitions from ${oldKind} to ${newKind} because the sort comparator may coerce types, permanently downgrading access speed.` : `The Elements Kind remains ${newKind} — type consistency is preserved across the sort, keeping the fast path.`} The sorted order connects back to the original allocation; TimSort exploits any pre-existing runs.`;
}

/**
 * Brain text for arr-set (index assignment) under trackArrays.
 * @param {string} objName
 * @param {*} prop — index
 * @param {Array} oldArr — before set
 * @param {Array} newArr — after set
 */
export function buildArraySetBrain(objName, prop, oldArr, newArr) {
  const oldKind = detectElementsKind(oldArr);
  const newKind = detectElementsKind(newArr);
  const transitioned = KIND_RANK[newKind] > KIND_RANK[oldKind];
  const idx = Number(prop);
  const createsHole = !isNaN(idx) && idx > oldArr.length;
  return `The engine writes ${fv(newArr[prop])} to ${objName}[${fv(prop)}] — O(1) hash map operation. ${createsHole ? `Index ${idx} exceeds the current length, creating holes and forcing a transition to ${newKind} — ${kindDescription(newKind)}. This downgrade is permanent.` : transitioned ? `The Elements Kind transitions from ${oldKind} to ${newKind} — a permanent downgrade to ${kindDescription(newKind)}.` : `The Elements Kind remains ${newKind}, preserving ${kindDescription(newKind)}.`} The kind set on this array traces back to the original allocation and every mutation since.`;
}

/**
 * Brain text for the done step when trackArrays is active.
 * @param {Record<string,*>} vars
 * @param {object} state
 */
export function buildArrayDoneBrain(vars, state) {
  const arrOps = state.extra.arrOps || 0;
  const varCount = Object.keys(vars).length;
  const total = totalBytes(vars);
  const arrays = Object.entries(vars).filter(([, v]) => Array.isArray(v));
  const kindSummary = arrays.map(([n, a]) => `${n}: ${detectElementsKind(a)}`).join(', ');
  return `The program ends with ${varCount} binding${varCount !== 1 ? 's' : ''} across ~${total} bytes after ${arrOps} array operation${arrOps !== 1 ? 's' : ''}. Final Elements Kinds: ${kindSummary || 'none'}. Each kind traces back to the original allocation and every mutation that followed — any downgrade was permanent, and the engine optimised (or failed to optimise) based on that kind throughout execution.`;
}

// ── ObjExplorer-specific brain text (three-layer: what / why / connects) ──

/**
 * Brain text for the start step when trackObjects is active.
 */
export function buildObjStartBrain() {
  return 'The engine creates the Global frame and prepares to track object operations. V8 assigns every object a Hidden Class (internally called a Map) — adding properties in the same order lets objects share Maps, enabling Inline Caching where each property read is a single pointer dereference at a fixed memory offset. Adding properties in a different order or deleting properties forces Dictionary Mode, which is significantly slower.';
}

/**
 * Brain text when an object literal is declared under trackObjects.
 * @param {string} name — variable name
 * @param {object} obj — the object value
 */
export function buildObjDeclareBrain(name, obj) {
  const keys = Object.keys(obj);
  const propCount = keys.length;
  return `The engine allocates "${name}" as an object with ${propCount} propert${propCount !== 1 ? 'ies' : 'y'} and assigns Hidden Class HC${propCount} — the engine transitioned through HC0${propCount > 0 ? ` → ${keys.map((_, i) => `HC${i + 1}`).join(' → ')}` : ''} as each property was added in order. Inline Caching is now active: every future read of ${keys.length > 0 ? `"${keys[0]}"` : 'any property'} is a fixed-offset memory access. The HC chain established here governs all subsequent property operations.`;
}

/**
 * Brain text for obj-set (property assignment) under trackObjects.
 * @param {string} objName
 * @param {string} prop — property name
 * @param {object} oldObj — before set
 * @param {object} newObj — after set
 */
export function buildObjSetBrain(objName, prop, oldObj, newObj) {
  const oldKeys = Object.keys(oldObj || {});
  const newKeys = Object.keys(newObj || {});
  const isNew = !oldKeys.includes(String(prop));
  const prevCount = oldKeys.length;
  const newCount = newKeys.length;
  if (isNew) {
    return `The engine adds property "${prop}" to ${objName}, transitioning from HC${prevCount} to HC${newCount} — each new property creates a new Hidden Class in the transition tree. This enables Inline Caching: the memory offset of "${prop}" is now fixed at this class, making future reads a single pointer dereference. The full chain traces back to HC0 when ${objName} was first allocated.`;
  }
  return `The engine overwrites property "${prop}" on ${objName} — no Hidden Class transition because the property already exists at HC${newCount}. The Inline Cache for "${prop}" remains monomorphic: a single type check followed by a fixed-offset read. The Hidden Class chain remains stable, connecting back to the original allocation at HC0.`;
}

/**
 * Brain text for obj-destruct (destructuring) under trackObjects.
 * @param {string[]} names — destructured variable names
 * @param {object} srcObj — source object
 */
export function buildObjDestructBrain(names, srcObj) {
  const srcKeys = Object.keys(srcObj || {});
  const hc = srcKeys.length;
  return `The engine destructures ${names.length} propert${names.length !== 1 ? 'ies' : 'y'} from an object at HC${hc}. Each destructured key is an Inline-Cached read at a fixed memory offset — the engine resolved every offset when the Hidden Class was established. Because all reads target the same Hidden Class, the Inline Cache stays monomorphic (fastest). The offsets trace back to the order properties were originally added.`;
}

/**
 * Brain text for Object.keys/values/entries under trackObjects.
 * @param {string} method — e.g. 'keys', 'values', 'entries'
 */
export function buildObjMethodBrain(method) {
  return `The engine calls Object.${method}(), iterating all enumerable properties in insertion order. The iteration follows the Hidden Class transition chain — property order matches the order they were added, which is the order the engine recorded in each HC transition. If the object has not been mutated into Dictionary Mode, this iteration is fast because offsets are pre-computed in the Map.`;
}

/**
 * Brain text for the done step when trackObjects is active.
 * @param {Record<string,*>} vars
 * @param {object} state
 */
export function buildObjDoneBrain(vars, state) {
  const objOps = state.extra.objOps || 0;
  const varCount = Object.keys(vars).length;
  const total = totalBytes(vars);
  const objects = Object.entries(vars).filter(([, v]) => typeof v === 'object' && v !== null && !Array.isArray(v));
  const hcSummary = objects.map(([n, o]) => `${n}: HC${Object.keys(o).length}`).join(', ');
  return `The program ends with ${varCount} binding${varCount !== 1 ? 's' : ''} across ~${total} bytes after ${objOps} object operation${objOps !== 1 ? 's' : ''}. Final Hidden Classes: ${hcSummary || 'none'}. Each class traces back through its full transition chain to HC0 — any property added in a consistent order kept the Inline Cache monomorphic, and any inconsistency or deletion would have forced Dictionary Mode permanently.`;
}

// ── DataStruct-specific brain text (three-layer: what / why / connects) ──

/**
 * Brain text for the start step when trackDS is active.
 */
export function buildDSStartBrain() {
  return 'The engine creates the Global frame and prepares to track data-structure operations. V8 backs Map and Set with a Deterministic Hash Table — a hash-based bucket array for O(1) indexing paired with a contiguous DataTable that stores entries in insertion order. Arrays used as stacks or queues rely on a FixedArray backing store with amortised O(1) push and O(n) shift.';
}

/**
 * Brain text when a data structure (array/object used as DS) is declared under trackDS.
 * @param {string} name
 * @param {*} val
 */
export function buildDSDeclareBrain(name, val) {
  if (Array.isArray(val)) {
    return `The engine allocates "${name}" as an array of ${val.length} element${val.length !== 1 ? 's' : ''} backed by a FixedArray. This contiguous block preserves insertion order — each push appends to the next sequential slot and each pop removes from the end. The backing store established here governs every subsequent stack or queue operation on this structure.`;
  }
  const keys = Object.keys(val || {});
  return `The engine allocates "${name}" as a hash-backed structure with ${keys.length} entr${keys.length !== 1 ? 'ies' : 'y'}. Each key is hashed into a bucket array that points to a slot in the contiguous DataTable — entries sit in insertion order. The hash-to-slot mapping established here governs O(1) lookup speed for every future access.`;
}

/**
 * Brain text for ds-push (stack push / queue enqueue) under trackDS.
 * @param {string} objName
 * @param {*} value
 * @param {number} index — new index
 * @param {number} length — new length
 */
export function buildDSPushBrain(objName, value, index, length) {
  return `The engine appends ${fv(value)} to ${objName} at index ${index} — O(1) amortised into the contiguous DataTable. The backing store preserves insertion order because entries occupy sequential slots, which is why iteration returns elements in the order they were added. This entry's position connects back to the hash computed at insertion and governs the order of every future iteration.`;
}

/**
 * Brain text for ds-pop (stack pop) under trackDS.
 * @param {string} objName
 * @param {*} removed
 * @param {number} remaining
 */
export function buildDSPopBrain(objName, removed, remaining) {
  return `The engine removes the last entry (${fv(removed)}) from ${objName} — O(1). The vacated slot becomes a hole in the DataTable; the engine does not immediately shrink the backing store. If holes accumulate from repeated pop-push cycles, the engine may trigger a rehash to compact the table. The remaining ${remaining} entr${remaining !== 1 ? 'ies' : 'y'} still occupy contiguous slots tracing back to insertion order.`;
}

/**
 * Brain text for ds-dequeue (queue shift) under trackDS.
 * @param {string} objName
 * @param {*} removed
 * @param {number} remaining
 */
export function buildDSDequeueBrain(objName, removed, remaining) {
  return `The engine removes the first entry (${fv(removed)}) from ${objName} and shifts every remaining element one position left — O(n) with ${remaining} element${remaining !== 1 ? 's' : ''} moved. This is expensive because the contiguous DataTable must be rewritten to maintain insertion-order iteration. A linked list or circular buffer avoids this cost by leaving the DataTable intact.`;
}

/**
 * Brain text for ds-sort under trackDS.
 * @param {string} objName
 * @param {number} length
 */
export function buildDSSortBrain(objName, length) {
  const comps = Math.ceil(length * Math.log2(length || 1));
  return `The engine sorts ${objName} in-place using TimSort — O(n log n) with ~${comps} comparisons estimated. Sorting rewrites the contiguous DataTable, breaking the original insertion order. After this operation, iteration order reflects the sorted order, not the order entries were added. The new slot positions trace back to the comparator's decisions during the merge phase.`;
}

/**
 * Brain text for the done step when trackDS is active.
 * @param {Record<string,*>} vars
 * @param {object} state
 */
export function buildDSDoneBrain(vars, state) {
  const dsOps = state.extra.dsOps || 0;
  const varCount = Object.keys(vars).length;
  const total = totalBytes(vars);
  return `The program ends with ${varCount} binding${varCount !== 1 ? 's' : ''} across ~${total} bytes after ${dsOps} data-structure operation${dsOps !== 1 ? 's' : ''}. Each structure's DataTable preserved insertion order unless a sort or deletion disrupted it — any holes left by deletions remain until the engine triggers a rehash to compact the table. This is the full lifecycle: hash, insert into contiguous slots, and iterate in order.`;
}

// ── IfGate-specific brain text (three-layer: what / why / connects) ──

/**
 * Brain text for the start step when trackIf is active.
 */
export function buildIfStartBrain() {
  return 'The engine creates the Global frame and prepares to track conditional evaluations. The JIT compiler uses type speculation on conditionals — when a boolean check runs repeatedly with the same type, TurboFan optimises by bypassing generic type-checking logic. If the type changes, the engine deoptimises and falls back to the slower interpreted path, a deoptimisation cliff.';
}

/**
 * Brain text for the condition evaluation under trackIf.
 * @param {boolean} result — the evaluated boolean result
 * @param {*} condVal — the raw condition value
 * @param {string|null} prevType — the type of the previous condition evaluation
 * @param {number} evalCount — how many if-evaluations so far
 */
export function buildIfConditionBrain(result, condVal, prevType, evalCount) {
  const condType = typeof condVal;
  const typeChanged = prevType !== null && prevType !== condType;
  return `The engine evaluates the condition as ${result ? 'TRUE' : 'FALSE'} (type: ${condType}). ${evalCount <= 1 ? `This is the first conditional evaluation — Ignition records the type "${condType}" as feedback for future speculation by TurboFan.` : typeChanged ? `The previous evaluation used type "${prevType}" but this one is "${condType}" — the engine hits a deoptimisation cliff, discarding optimised code and falling back to the interpreter.` : `The previous evaluation was also type "${prevType}", so the JIT speculation holds and the optimised branch path stays active.`} ${result ? 'The TRUE path is taken' : 'The FALSE path is taken'}; the type recorded here governs speculation for every subsequent conditional.`;
}

/**
 * Brain text for skipping a branch under trackIf.
 * @param {boolean} condResult — true if condition was true (skipping else), false if skipping if-block
 */
export function buildIfSkipBrain(condResult) {
  if (condResult) {
    return 'The TRUE path was taken — the engine skips the else block entirely. The skipped bytecodes are never fetched or decoded, costing zero execution time. The branch predictor records this outcome; if the same branch resolves TRUE consistently, TurboFan will speculate TRUE on future evaluations and generate optimised machine code for this path only.';
  }
  return 'The condition was FALSE — the engine skips the if-block entirely. The skipped bytecodes are never fetched or decoded, costing zero execution time. The branch predictor records this outcome; if the same branch resolves FALSE consistently, TurboFan will speculate FALSE on future evaluations and optimise for the else path only.';
}

/**
 * Brain text for entering the else block under trackIf.
 */
export function buildIfElseEnterBrain() {
  return 'The condition was FALSE — the engine enters the else block. The branch predictor has recorded this path as taken; if the condition continues to resolve FALSE, TurboFan will specialise the compiled code for this branch. A future TRUE result would trigger a deoptimisation cliff, discarding the specialised code and falling back to the interpreter.';
}

/**
 * Brain text for the done step when trackIf is active.
 * @param {Record<string,*>} vars
 * @param {object} state
 */
export function buildIfDoneBrain(vars, state) {
  const ifEvals = state.extra.ifEvals || 0;
  const varCount = Object.keys(vars).length;
  const total = totalBytes(vars);
  return `The program ends with ${varCount} binding${varCount !== 1 ? 's' : ''} across ~${total} bytes after ${ifEvals} conditional evaluation${ifEvals !== 1 ? 's' : ''}. The type feedback collected from each condition governs future JIT speculation — consistent types keep the optimised path active, while any type change would have triggered a deoptimisation cliff and a fallback to interpreted bytecode.`;
}

// ── VarStore-specific brain text (three-layer: what / why / connects) ──

/**
 * Brain text for the start step when trackVar is active.
 */
export function buildVarStartBrain() {
  return 'The engine creates the Global frame and begins the two-phase execution model. During parsing it scans every let and const declaration, allocating space in the Lexical Environment but leaving each slot explicitly uninitialised — the Temporal Dead Zone. Any access before the declaration line would throw a ReferenceError, unlike var which silently returns undefined. The Script scope established here holds every top-level binding.';
}

/**
 * Brain text when a variable is declared under trackVar.
 * @param {string} name
 * @param {*} val
 * @param {string} kind — let, const, or var
 * @param {number} declCount — how many declarations so far
 */
export function buildVarDeclareBrain(name, val, kind, declCount) {
  const tp = typeof val;
  const isConst = kind === 'const';
  return `The engine initialises "${name}" with value ${fv(val)} (${kind}) — this completes the transition out of the Temporal Dead Zone. During parsing the engine allocated space for "${name}" in the Lexical Environment but left it explicitly uninitialised; any access before this line would have thrown a ReferenceError. ${isConst ? 'As a const binding the engine marks the slot as immutable, enabling optimised reads since the value cannot change.' : 'As a let binding the slot is now mutable — the engine must track future reassignments.'} This binding connects back to the Script scope created at startup${declCount > 1 ? `, joining ${declCount - 1} prior binding${declCount - 1 !== 1 ? 's' : ''}` : ''}.`;
}

/**
 * Brain text when a variable is reassigned under trackVar.
 * @param {string} name
 * @param {*} oldVal
 * @param {*} newVal
 */
export function buildVarAssignBrain(name, oldVal, newVal) {
  const typeChanged = typeof oldVal !== typeof newVal;
  return `The engine overwrites "${name}" from ${fv(oldVal)} to ${fv(newVal)} in the same Lexical Environment slot. ${typeChanged ? `The type changed from ${typeof oldVal} to ${typeof newVal} — this forces V8 to transition the Inline Cache from monomorphic to polymorphic, slowing future reads of this binding.` : `The type remains ${typeof newVal}, so the Inline Cache stays monomorphic and future reads resolve in a single pointer dereference.`} This reassignment is only possible because "${name}" was declared with let, not const — a const binding would have thrown a TypeError at this point.`;
}

/**
 * Brain text when a variable is updated (i++/i--) under trackVar.
 * @param {string} name
 * @param {*} oldVal
 * @param {*} newVal
 * @param {string} operator — ++ or --
 */
export function buildVarUpdateBrain(name, oldVal, newVal, operator) {
  const isSmi = typeof newVal === 'number' && Number.isInteger(newVal) && newVal >= -1073741824 && newVal <= 1073741823;
  return `The engine applies ${operator} to "${name}", updating it from ${fv(oldVal)} to ${fv(newVal)} in the Lexical Environment slot. ${isSmi ? 'The result fits in a 31-bit SMI — V8 handles this entirely in the pointer tag with no heap allocation, the fastest numeric path.' : 'The result overflows the SMI range — V8 allocates a HeapNumber on the heap, a slower path than unboxed integers.'} This mutation connects back to the original TDZ allocation for "${name}" at the Script scope.`;
}

/**
 * Brain text for the done step when trackVar is active.
 * @param {Record<string,*>} vars
 * @param {object} state
 */
export function buildVarDoneBrain(vars, state) {
  const varDecls = state.extra.varDecls || 0;
  const varCount = Object.keys(vars).length;
  const total = totalBytes(vars);
  return `The program ends with ${varCount} binding${varCount !== 1 ? 's' : ''} across ~${total} bytes after ${varDecls} declaration${varDecls !== 1 ? 's' : ''}. Each binding transitioned out of the Temporal Dead Zone at its declaration line — the two-phase model ensured that no access occurred before initialisation. Every slot in the Lexical Environment traces back to the Script scope created at startup.`;
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
