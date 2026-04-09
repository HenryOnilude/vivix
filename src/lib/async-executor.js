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
    brain: 'The JavaScript engine starts. The call stack has one frame: Global.\n\nKey concept: JavaScript is SINGLE-THREADED. It can only do one thing at a time.\nBut async/await lets it pause and resume, giving the illusion of parallelism.\n\nThe event loop manages this: when we await, the function is suspended and other code can run.',
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
        brain: `ASYNC FUNCTION DECLARATION: "${fnName}"\n\nThe "async" keyword means:\n  1. This function always returns a Promise\n  2. Inside it, you can use "await" to pause execution\n  3. When it pauses, the event loop can run other code\n\nThe function is registered but NOT called yet.`,
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
        brain: `CALLING async ${fnName}()\n\nA new frame "${fnName}" is pushed onto the call stack.\nThe engine starts executing the function body synchronously...\nUntil it hits the first "await" — then everything changes.`,
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
              ? `PROMISE.ALL: Fire ${pExprs.length} promises SIMULTANEOUSLY\n\n${pExprs.map((p, i) => `  Promise ${i + 1}: ${p}`).join('\n')}\n\nAll ${pExprs.length} async operations start at the SAME TIME.\nPromise.all waits for ALL of them to complete.\nTotal time = slowest promise (not the sum!).`
              : `PROMISE.RACE: Fire ${pExprs.length} promises — first one wins!\n\n${pExprs.map((p, i) => `  Promise ${i + 1}: ${p}`).join('\n')}\n\nAll start simultaneously, but only the FASTEST matters.`,
            memLabel: `${method.toUpperCase()}: ${pExprs.length} promises fired | All pending`,
            memOps, awaits, promises, timeline: [...timeline],
          });
          const suspStack = callStack.filter(f => f !== fnName);
          steps.push({
            lineIndex: bi, nextLineIndex: bi,
            vars: dc(vars), output: [...output],
            callStack: [...suspStack], eventLoop: [...eventLoop, ...pExprs.map(p => `pending: ${p}`)], microTasks: [...microTasks],
            highlight: null, phase: 'suspended',
            brain: `SUSPENDED while ${method === 'all' ? 'all' : 'any'} promises resolve.\n\nThe event loop shows ${pExprs.length} pending operations.\nThe JS thread is free.\n\n${method === 'all' ? 'Waiting for the SLOWEST promise...' : 'Waiting for the FASTEST promise...'}`,
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
              ? `ALL PROMISES RESOLVED!\n\nResults array:\n${mockResults.map((r, i) => `  [${i}] ${pExprs[i]} → ${_fv(r)}`).join('\n')}\n\n${vn} = [${mockResults.map(_fv).join(', ')}]`
              : `RACE WINNER: The fastest promise resolved first.\n\n${vn} = ${_fv(mockResults[0])}`,
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
            brain: `PROMISE.ALL with destructuring:\n  let [${varNames.join(', ')}] = await Promise.all([...])\n\n${pExprs.map((p, i) => `  ${varNames[i] || '?'} ← ${p}`).join('\n')}\n\nAll promises fire in parallel. Results are destructured into individual variables.`,
            memLabel: `ALL: ${pExprs.length} parallel promises`,
            memOps, awaits, promises, timeline: [...timeline],
          });
          const suspStack2 = callStack.filter(f => f !== fnName);
          steps.push({
            lineIndex: bi, nextLineIndex: bi,
            vars: dc(vars), output: [...output],
            callStack: [...suspStack2], eventLoop: pExprs.map(p => `pending: ${p}`), microTasks: [...microTasks],
            highlight: null, phase: 'suspended',
            brain: `Suspended. Waiting for all ${pExprs.length} promises...`,
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
            brain: `ALL RESOLVED! Destructured:\n${varNames.map((vn, i) => `  ${vn} = ${_fv(mockResults2[i])}`).join('\n')}`,
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
            brain: `AWAIT ENCOUNTERED: await ${awaitExpr}\n\nHere is where the magic happens:\n  1. The expression "${awaitExpr}" starts executing (fires the async operation)\n  2. The "${fnName}" function is SUSPENDED — removed from the call stack\n  3. Control returns to the event loop\n  4. Other code can run while we wait\n\nThe Promise is now "pending" in the microtask queue.`,
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
            brain: `FUNCTION SUSPENDED: "${fnName}" is paused.\n\nThe call stack no longer contains "${fnName}".\nThe JavaScript engine is FREE to do other work.\n\nMeanwhile, the async operation (${awaitExpr}) is running\nin the background (handled by the browser/Node.js runtime,\nnot by JavaScript itself).\n\nWhen the Promise resolves, a microtask is queued.`,
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
            brain: `PROMISE RESOLVED: ${awaitExpr} → ${_fv(mockResult)}\n\nThe microtask queue signals: "this promise is done!"\nThe event loop picks it up and RESUMES "${fnName}".\n\n"${fnName}" is pushed back onto the call stack.\nExecution continues from exactly where it paused.\n\n${vn} = ${_fv(mockResult)}`,
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
            brain: 'TRY BLOCK: The engine enters a protected region.\n\nIf any promise inside this block REJECTS (throws an error),\nexecution jumps to the catch block instead of crashing.\n\nThis is how you handle async errors gracefully.',
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
            brain: `CATCH BLOCK: This runs ONLY if the try-block threw an error.\n\nIn async code, a rejected promise triggers the catch.\nThe error object "${catchMatch[1]}" contains the rejection reason.\n\nIf no error occurred, this entire block is skipped.`,
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
            brain: `ASYNC RETURN: return ${retExpr}\n\nThe async function wraps this value in a resolved Promise.\nThe caller (who awaited this function) will receive: ${_fv(retVal)}\n\nThe "${fnName}" frame is popped from the call stack.\nThe returned Promise resolves, triggering any .then() or await.`,
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
            brain: `LOCAL: let ${vn} = ${_fv(val)}\n\nThis is synchronous — no await, so no suspension.`,
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
            brain: `ASSIGN: ${vn} = ${_fv(val)}`,
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
    brain: `PROGRAM COMPLETE\n\nAsync execution summary:\n  Total awaits: ${awaits}\n  Promises created: ${promises}\n  Memory writes: ${memOps}\n\nThe event loop is idle. All promises have settled.\nThe call stack is empty.`,
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
