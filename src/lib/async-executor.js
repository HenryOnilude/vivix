/**
 * Custom async/await step executor.
 * Parses async function code via regex (not the AST interpreter) and
 * produces step arrays that visualize event loop, call stack, and microtask queue.
 *
 * Extracted from AsyncAwait.svelte for testability.
 */

import { dc } from './utils.js';

export function executeAsyncCode(code) {
  const lines = code.split('\n');
  const steps = [];
  const vars = {};
  const output = [];
  const eventLoop = [];
  const microTasks = [];
  let memOps = 0, awaits = 0, promises = 0;
  let callStack = ['Global'];
  let timeline = [];

  steps.push({
    lineIndex: -1, nextLineIndex: 0,
    vars: dc(vars), output: [...output],
    callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks],
    highlight: null, phase: 'start',
    brain: 'The engine initialises the call stack with a single Global frame and sets the event loop to idle. A single-threaded runtime can execute only one frame at a time, so V8 relies on suspending and resuming frames rather than spawning threads — async/await is the syntax that controls this state machine. The async function declaration coming next registers the coroutine the engine will later suspend.',
    memLabel: 'Engine ready | Call Stack: [Global] | Event Loop: idle',
    memOps, awaits, promises, timeline: [...timeline],
  });

  let li = 0;
  while (li < lines.length) {
    const ln = lines[li].trim();
    if (ln === '' || ln.startsWith('//') || ln === '{' || ln === '}') { li++; continue; }

    const asyncFnMatch = ln.match(/^async\s+function\s+(\w+)\s*\(([^)]*)\)\s*\{?\s*$/);
    if (asyncFnMatch) {
      const fnName = asyncFnMatch[1];
      const bodyEnd = _findBlockEnd(lines, li);

      steps.push({
        lineIndex: li, nextLineIndex: li + 1,
        vars: dc(vars), output: [...output],
        callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks],
        highlight: fnName, phase: 'async-declare',
        brain: `The engine registers "${fnName}" as an async function, meaning any value it returns gets wrapped in a Promise automatically. The async keyword tells V8 to compile this function body as a coroutine — an object whose execution can suspend at each await and resume when the awaited Promise settles. Registration is complete, so the engine now proceeds to invoke it.`,
        memLabel: `REGISTER: async ${fnName}() | Returns Promise`,
        memOps, awaits, promises, timeline: [...timeline],
      });

      callStack.push(fnName);
      promises++;

      steps.push({
        lineIndex: li, nextLineIndex: li + 1,
        vars: dc(vars), output: [...output],
        callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks],
        highlight: fnName, phase: 'async-call',
        brain: `The engine pushes a "${fnName}" frame onto the call stack and begins executing the function body synchronously. V8 treats async functions identically to regular functions until an await expression appears — only then does the coroutine machinery activate. The first await ahead will trigger the suspension that frees this thread.`,
        memLabel: `CALL: ${fnName}() | Stack: [${callStack.join(' → ')}]`,
        memOps, awaits, promises, timeline: [...timeline],
      });

      let bi = li + 1;
      while (bi < bodyEnd) {
        const bodyLn = lines[bi].trim();
        if (bodyLn === '' || bodyLn === '{' || bodyLn === '}' || bodyLn.startsWith('//')) { bi++; continue; }

        // await Promise.all([...]) or Promise.race([...])
        // MUST be checked BEFORE simple awaitDeclMatch to avoid greedy capture
        const promiseAllMatch = bodyLn.match(/^(let|const)\s+(\w+)\s*=\s*await\s+Promise\.(all|race)\(\[\s*$/);
        if (promiseAllMatch) {
          const vn = promiseAllMatch[2], method = promiseAllMatch[3];
          awaits++;
          const allEnd = _findBracketEnd(lines, bi);
          const pExprs = [];
          for (let pi = bi + 1; pi < allEnd; pi++) {
            const pl = lines[pi].trim().replace(/,\s*$/, '');
            if (pl && !/^[\]\);\s]*$/.test(pl) && !pl.startsWith('//')) { pExprs.push(pl); promises++; }
          }
          const groupId = Date.now() + Math.random();
          pExprs.forEach(p => timeline.push({ label: p, type: 'par', groupId, done: false }));
          steps.push({
            lineIndex: bi, nextLineIndex: bi,
            vars: dc(vars), output: [...output],
            callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks, ...pExprs],
            highlight: null, phase: 'promise-all-start',
            brain: method === 'all'
              ? `The engine dispatches ${pExprs.length} promises simultaneously: ${pExprs.join(', ')}. Promise.all registers a single composite microtask that resolves only after every child promise settles — total wall-clock time equals the slowest operation, not the sum. All ${pExprs.length} operations now run concurrently while the function suspends.`
              : `The engine dispatches ${pExprs.length} promises simultaneously: ${pExprs.join(', ')}. Promise.race wraps them in a single settlement observer that resolves the instant any child promise completes, discarding the rest. The function now suspends, and whichever operation finishes first determines the result.`,
            memLabel: `${method.toUpperCase()}: ${pExprs.length} promises fired | All pending`,
            memOps, awaits, promises, timeline: [...timeline],
          });
          const suspStack = callStack.filter(f => f !== fnName);
          steps.push({
            lineIndex: bi, nextLineIndex: bi,
            vars: dc(vars), output: [...output],
            callStack: [...suspStack], eventLoop: [...eventLoop, ...pExprs.map(p => `pending: ${p}`)], microTasks: [...microTasks],
            highlight: null, phase: 'suspended',
            brain: `The engine pops "${fnName}" from the call stack, serialising its local state to the heap. ${pExprs.length} pending operations now appear in the event loop because the runtime delegates each to the host environment — network, timers, or I/O — outside the single JS thread. Once ${method === 'all' ? 'every promise settles' : 'the fastest promise settles'}, a resume job enters the microtask queue.`,
            memLabel: `WAITING: ${pExprs.length} pending | ${fnName} suspended`,
            memOps, awaits, promises, timeline: [...timeline],
          });
          const mockResults = method === 'all' ? pExprs.map(_mockResult) : [_mockResult(pExprs[0])];
          vars[vn] = method === 'all' ? mockResults : mockResults[0];
          memOps++;
          timeline = timeline.map(t => t.groupId === groupId ? { ...t, done: true } : t);
          steps.push({
            lineIndex: bi, nextLineIndex: _nextInBody(lines, allEnd + 1, bodyEnd),
            vars: dc(vars), output: [...output],
            callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks],
            highlight: vn, phase: 'await-resume',
            brain: method === 'all'
              ? `The microtask queue fires the resume job, restoring "${fnName}" to the call stack with its saved locals. V8 collects all ${mockResults.length} settled values into an array preserving the original dispatch order — not completion order. The result lands in ${vn}: [${mockResults.map(_fv).join(', ')}].`
              : `The microtask queue fires the resume job the instant the fastest promise settles, restoring "${fnName}" to the call stack. V8 discards the remaining pending promises and assigns the winner directly. The result lands in ${vn}: ${_fv(mockResults[0])}.`,
            memLabel: `RESOLVED: ${method} | ${vn} ← ${method === 'all' ? `[${mockResults.length} results]` : _fv(mockResults[0])}`,
            memOps, awaits, promises, timeline: [...timeline],
          });
          bi = allEnd + 1; continue;
        }

        // let [a, b] = await Promise.all([...])
        const destructAllMatch = bodyLn.match(/^(let|const)\s+\[([^\]]+)\]\s*=\s*await\s+Promise\.(all|race)\(\[\s*$/);
        if (destructAllMatch) {
          const varNames = destructAllMatch[2].split(',').map(v => v.trim());
          const method = destructAllMatch[3];
          awaits++;
          const allEnd = _findBracketEnd(lines, bi);
          const pExprs = [];
          for (let pi = bi + 1; pi < allEnd; pi++) {
            const pl = lines[pi].trim().replace(/,\s*$/, '');
            if (pl && !/^[\]\);\s]*$/.test(pl) && !pl.startsWith('//')) { pExprs.push(pl); promises++; }
          }
          const groupId2 = Date.now() + Math.random();
          pExprs.forEach(p => timeline.push({ label: p, type: 'par', groupId: groupId2, done: false }));
          steps.push({
            lineIndex: bi, nextLineIndex: bi,
            vars: dc(vars), output: [...output],
            callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks, ...pExprs],
            highlight: null, phase: 'promise-all-start',
            brain: `The engine dispatches ${pExprs.length} promises simultaneously and will destructure the results into [${varNames.join(', ')}]. V8 creates one composite microtask that tracks all ${pExprs.length} child settlements internally, mapping each resolved value to its positional variable at resume time. ${pExprs.map((p, i) => `${varNames[i] || '?'} ← ${p}`).join(', ')} — the function now suspends while these run concurrently.`,
            memLabel: `ALL: ${pExprs.length} parallel promises`,
            memOps, awaits, promises, timeline: [...timeline],
          });
          const suspStack2 = callStack.filter(f => f !== fnName);
          steps.push({
            lineIndex: bi, nextLineIndex: bi,
            vars: dc(vars), output: [...output],
            callStack: [...suspStack2], eventLoop: pExprs.map(p => `pending: ${p}`), microTasks: [...microTasks],
            highlight: null, phase: 'suspended',
            brain: `The engine pops "${fnName}" and saves its locals to the heap, leaving the call stack free. The host environment processes ${pExprs.length} operations concurrently outside the JS thread — V8 cannot resume until every child promise reports settlement. Once all ${pExprs.length} complete, a single resume job enters the microtask queue to restore execution.`,
            memLabel: `WAITING: ${pExprs.length} pending`,
            memOps, awaits, promises, timeline: [...timeline],
          });
          const mockResults2 = pExprs.map(_mockResult);
          varNames.forEach((vn, i) => { vars[vn] = mockResults2[i]; memOps++; });
          timeline = timeline.map(t => t.groupId === groupId2 ? { ...t, done: true } : t);
          steps.push({
            lineIndex: bi, nextLineIndex: _nextInBody(lines, allEnd + 1, bodyEnd),
            vars: dc(vars), output: [...output],
            callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks],
            highlight: varNames[0], phase: 'await-resume',
            brain: `The resume job fires, restoring "${fnName}" to the call stack. V8 destructures the settled array by position: ${varNames.map((vn, i) => `${vn} = ${_fv(mockResults2[i])}`).join(', ')}. Each variable now holds its resolved value directly, avoiding a manual index lookup — execution continues with all parallel results available as named locals.`,
            memLabel: `RESUME | ${varNames.length} vars assigned`,
            memOps, awaits, promises, timeline: [...timeline],
          });
          bi = allEnd + 1; continue;
        }

        // let x = await expr; (simple single await — checked AFTER Promise.all/race)
        const awaitDeclMatch = bodyLn.match(/^(let|const)\s+(\w+)\s*=\s*await\s+(.+?)\s*;?\s*$/);
        if (awaitDeclMatch) {
          const vn = awaitDeclMatch[2];
          const awaitExpr = awaitDeclMatch[3];
          awaits++;
          microTasks.push(awaitExpr);
          timeline.push({ label: awaitExpr, type: 'seq', done: false });
          steps.push({
            lineIndex: bi, nextLineIndex: bi,
            vars: dc(vars), output: [...output],
            callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks],
            highlight: null, phase: 'await-start',
            brain: `The engine hits await ${awaitExpr}, which triggers the async operation and returns a pending Promise. Internally, V8 serialises the instruction pointer and local variables into a heap-resident coroutine object, then pops the "${fnName}" frame — freeing the single thread that was executing synchronously until this point. The next step shows what the call stack looks like while ${awaitExpr} runs off-thread.`,
            memLabel: `AWAIT: ${awaitExpr} | ${fnName} suspended | Promise #${promises}`,
            memOps, awaits, promises, timeline: [...timeline],
          });

          const suspendedStack = callStack.filter(f => f !== fnName);
          eventLoop.push(`waiting: ${awaitExpr}`);
          steps.push({
            lineIndex: bi, nextLineIndex: bi,
            vars: dc(vars), output: [...output],
            callStack: [...suspendedStack], eventLoop: [...eventLoop], microTasks: [...microTasks],
            highlight: null, phase: 'suspended',
            brain: `The call stack no longer contains "${fnName}" — its saved state lives on the heap. The host environment (browser networking layer or libuv in Node) now processes ${awaitExpr} entirely outside the JS thread, which is free to drain other microtasks or handle user events. When ${awaitExpr} settles, the runtime schedules a PromiseResolveThenableJob in the microtask queue to restore this coroutine.`,
            memLabel: `SUSPENDED | Stack: [${suspendedStack.join(' → ')}] | Waiting: ${awaitExpr}`,
            memOps, awaits, promises, timeline: [...timeline],
          });

          const mockResult = _mockResult(awaitExpr);
          vars[vn] = mockResult;
          memOps++;
          eventLoop.pop();
          microTasks.pop();
          const tIdx = timeline.findLastIndex(t => t.label === awaitExpr && !t.done);
          if (tIdx >= 0) timeline[tIdx].done = true;
          steps.push({
            lineIndex: bi, nextLineIndex: _nextInBody(lines, bi + 1, bodyEnd),
            vars: dc(vars), output: [...output],
            callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks],
            highlight: vn, phase: 'await-resume',
            brain: `The microtask queue fires the PromiseResolveThenableJob, restoring "${fnName}" to the call stack from its heap-resident state. V8 reloads the saved instruction pointer so execution resumes at the exact bytecode offset where it suspended — the engine assigns ${vn} = ${_fv(mockResult)} and advances to the next line.`,
            memLabel: `RESUME: ${fnName} | ${vn} ← ${_fv(mockResult)} | Stack restored`,
            memOps, awaits, promises, timeline: [...timeline],
          });
          bi++; continue;
        }

        // try {
        if (bodyLn.match(/^try\s*\{?\s*$/)) {
          steps.push({
            lineIndex: bi, nextLineIndex: bi + 1,
            vars: dc(vars), output: [...output],
            callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks],
            highlight: null, phase: 'try-enter',
            brain: `The engine enters a try block, pushing an exception handler onto an internal handler stack. If any awaited promise rejects inside this region, V8 unwinds the coroutine to the nearest handler instead of propagating an unhandled rejection — this is the only way to catch async errors synchronously. The catch block ahead defines where control transfers on rejection.`,
            memLabel: 'ENTER: try block | Error handler registered',
            memOps, awaits, promises, timeline: [...timeline],
          });
          bi++; continue;
        }

        // } catch (err) {
        const catchMatch = bodyLn.match(/^\}\s*catch\s*\((\w+)\)\s*\{?\s*$/);
        if (catchMatch) {
          steps.push({
            lineIndex: bi, nextLineIndex: bi + 1,
            vars: dc(vars), output: [...output],
            callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks],
            highlight: null, phase: 'catch',
            brain: `The engine reaches the catch boundary, binding the rejection reason to "${catchMatch[1]}". V8 pops the exception handler from the handler stack and transfers control here only if a promise in the try block rejected — otherwise execution skips past this block entirely. Having handled the error, the coroutine can continue or return gracefully instead of crashing.`,
            memLabel: `CATCH: ${catchMatch[1]} handler`,
            memOps, awaits, promises, timeline: [...timeline],
          });
          bi++; continue;
        }

        // return
        const retMatch = bodyLn.match(/^return\s+(.+?)\s*;?\s*$/);
        if (retMatch) {
          const retExpr = retMatch[1];
          let retVal; try { retVal = _eval(retExpr, vars); } catch(e) { retVal = retExpr in vars ? vars[retExpr] : retExpr; }
          steps.push({
            lineIndex: bi, nextLineIndex: null,
            vars: dc(vars), output: [...output],
            callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks],
            highlight: null, phase: 'async-return',
            brain: `The engine executes return ${retExpr}, and the async wrapper resolves the function's implicit Promise with ${_fv(retVal)}. V8 pops the "${fnName}" frame, deallocates its heap-resident coroutine state, and schedules any downstream .then() or await continuations as microtasks. The call stack unwinds to the caller, completing this async operation.`,
            memLabel: `RETURN: Promise.resolve(${_fv(retVal)}) | ${fnName} done`,
            memOps, awaits, promises, timeline: [...timeline],
          });
          break;
        }

        // let/const without await
        const declMatch = bodyLn.match(/^(let|const)\s+(\w+)\s*=\s*(.+?)\s*;?\s*$/);
        if (declMatch) {
          const vn = declMatch[2], raw = declMatch[3];
          let val; try { val = _eval(raw, vars); } catch(e) { val = raw; }
          vars[vn] = val; memOps++;
          steps.push({
            lineIndex: bi, nextLineIndex: _nextInBody(lines, bi + 1, bodyEnd),
            vars: dc(vars), output: [...output],
            callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks],
            highlight: vn, phase: 'declare',
            brain: `The engine allocates ${vn} in the local scope and assigns ${_fv(val)} synchronously. No await appears on this line, so V8 keeps the coroutine running on the current stack frame without suspending — synchronous operations inside an async function execute at normal speed. The next line continues immediately.`,
            memLabel: `ALLOC: ${vn} ← ${_fv(val)}`,
            memOps, awaits, promises, timeline: [...timeline],
          });
          bi++; continue;
        }

        // assignment
        const assignMatch = bodyLn.replace(/;$/, '').match(/^(\w+)\s*=\s*(.+)$/);
        if (assignMatch) {
          const vn = assignMatch[1], raw = assignMatch[2];
          let val; try { val = _eval(raw, vars); } catch(e) { val = raw; }
          vars[vn] = val; memOps++;
          steps.push({
            lineIndex: bi, nextLineIndex: _nextInBody(lines, bi + 1, bodyEnd),
            vars: dc(vars), output: [...output],
            callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks],
            highlight: vn, phase: 'assign',
            brain: `The engine writes ${_fv(val)} into the existing ${vn} binding. This is a synchronous mutation — V8 updates the heap slot directly without involving the microtask queue or suspending the coroutine. Execution proceeds to the next statement in the same tick.`,
            memLabel: `WRITE: ${vn} ← ${_fv(val)}`,
            memOps, awaits, promises, timeline: [...timeline],
          });
          bi++; continue;
        }

        bi++;
      }

      callStack.pop();
      li = bodyEnd + 1; continue;
    }

    li++;
  }

  steps.push({
    lineIndex: -1, nextLineIndex: -1,
    vars: dc(vars), output: [...output],
    callStack: ['Global'], eventLoop: [], microTasks: [],
    highlight: null, phase: 'done', done: true,
    brain: `The engine has drained all microtasks and the call stack is empty — the event loop returns to idle. Across this execution V8 processed ${awaits} await suspension${awaits !== 1 ? 's' : ''} and ${promises} promise${promises !== 1 ? 's' : ''}, performing ${memOps} memory write${memOps !== 1 ? 's' : ''}. Every coroutine completed its lifecycle: creation, suspension, heap serialisation, microtask-driven resumption, and deallocation.`,
    memLabel: `DONE | ${awaits} awaits, ${promises} promises`,
    memOps, awaits, promises, timeline: [...timeline],
  });

  return steps;
}

export function _mockResult(expr) {
  if (expr.includes('getUser') || expr.includes('User')) return { id: 1, name: 'Alice' };
  if (expr.includes('getPosts') || expr.includes('Posts')) return [{ id: 101, title: 'Hello World' }];
  if (expr.includes('getComments') || expr.includes('Comments')) return [{ text: 'Great post!' }];
  if (expr.includes('slow')) return { data: 'slow-result', ms: 800 };
  if (expr.includes('fast')) return { data: 'fast-result', ms: 100 };
  if (expr.includes('medium')) return { data: 'medium-result', ms: 400 };
  if (expr.includes('risky')) return { status: 'ok', data: 'result' };
  if (expr.includes('taskA')) return 'resultA';
  if (expr.includes('taskB')) return 'resultB';
  return { resolved: true };
}

function _nextInBody(lines, from, bodyEnd) {
  for (let i = from; i < bodyEnd; i++) {
    const t = lines[i].trim();
    if (t !== '' && t !== '{' && t !== '}' && !t.startsWith('//')) return i;
  }
  return -1;
}

function _findBracketEnd(lines, start) {
  // Find the closing ]);  for a Promise.all/race([ block.
  // We only count brackets AFTER the opening "([" at the end of the start line.
  // Skip everything before the last "[" on the start line.
  let d = 0;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    // On the start line, only count from the trailing "[" (the Promise.all argument)
    const from = (i === start) ? line.lastIndexOf('[') : 0;
    for (let ci = from; ci < line.length; ci++) {
      const ch = line[ci];
      if (ch === '[') d++;
      if (ch === ']') { d--; if (d <= 0) return i; }
    }
  }
  return lines.length - 1;
}

function _findBlockEnd(lines, start) {
  let d = 0;
  for (let i = start; i < lines.length; i++) {
    for (const ch of lines[i]) { if (ch === '{') d++; if (ch === '}') { d--; if (d <= 0) return i; } }
  }
  return lines.length - 1;
}

function _eval(expr, vars) {
  const k = Object.keys(vars), v = Object.values(vars);
  return new Function(...k, `return (${expr});`)(...v);
}

export function _fv(val) {
  if (val === undefined) return 'undefined'; if (val === null) return 'null';
  if (typeof val === 'string') return `"${val}"`; if (typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return `[${val.length} items]`;
  if (typeof val === 'object') return JSON.stringify(val); return String(val);
}
