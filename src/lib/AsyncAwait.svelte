<script>
  import ModuleShell from './ModuleShell.svelte';
  import { dc } from './utils.js';

  const ACCENT = '#cc88ff';

  const examples = [
    {
      label: 'Sequential awaits',
      code: 'async function fetchData() {\n  let user = await getUser();\n  let posts = await getPosts(user.id);\n  let comments = await getComments(posts[0]);\n  return comments;\n}',
      complexity: { time: 'O(n) sequential', space: 'O(1)', timeWhy: 'Each await blocks until the previous completes. Total time = sum of all delays. Three requests run one after another: T = t1 + t2 + t3.', spaceWhy: 'Only one response held in memory at a time (previous results stored in variables). No parallel buffers.' }
    },
    {
      label: 'Promise.all (parallel)',
      code: 'async function fetchAll() {\n  let results = await Promise.all([\n    getUser(),\n    getPosts(1),\n    getComments(1)\n  ]);\n  return results;\n}',
      complexity: { time: 'O(1) parallel — max(t1,t2,t3)', space: 'O(n)', timeWhy: 'All three requests fire simultaneously. Total time = the SLOWEST one. This is the key advantage of Promise.all.', spaceWhy: 'All responses are buffered in memory at once until all resolve. n promises = n results in the array.' }
    },
    {
      label: 'Promise.race',
      code: 'async function fastest() {\n  let winner = await Promise.race([\n    slowAPI(),\n    fastAPI(),\n    mediumAPI()\n  ]);\n  return winner;\n}',
      complexity: { time: 'O(1) — min(t1,t2,t3)', space: 'O(n)', timeWhy: 'Returns as soon as the FIRST promise settles. The others are still running but their results are ignored.', spaceWhy: 'All promises are created and running in parallel. Memory for all n is allocated even though only 1 result is used.' }
    },
    {
      label: 'try/catch error handling',
      code: 'async function safeFetch() {\n  let data = null;\n  try {\n    data = await riskyAPI();\n  } catch (err) {\n    data = "fallback";\n  }\n  return data;\n}',
      complexity: { time: 'O(1)', space: 'O(1)', timeWhy: 'One async call. If it rejects, the catch block runs synchronously — no extra time cost.', spaceWhy: 'Either the resolved value or the fallback — only one is stored.' }
    },
    {
      label: 'Sequential vs Parallel',
      code: 'async function compare() {\n  // Sequential: slow\n  let a = await taskA();\n  let b = await taskB();\n\n  // Parallel: fast\n  let [c, d] = await Promise.all([\n    taskA(),\n    taskB()\n  ]);\n}',
      complexity: { time: 'Seq: O(t1+t2) vs Par: O(max(t1,t2))', space: 'O(1) vs O(n)', timeWhy: 'Sequential: each await blocks. Total = 500ms + 500ms = 1000ms.\nParallel: both fire at once. Total = max(500, 500) = 500ms.\nParallel is 2× faster here!', spaceWhy: 'Sequential holds one result at a time. Parallel buffers all results until all complete.' }
    }
  ];

  // ── Custom executor (does not use the shared interpreter) ──────────────────
  function executeCode(code) {
    const lines = code.split('\n');
    const steps = [];
    const vars = {};
    const output = [];
    const eventLoop = [];
    const microTasks = [];
    let memOps = 0, awaits = 0, promises = 0;
    let callStack = ['Global'];

    // Timeline tracks ops for visualization
    let timeline = []; // { label, type:'seq'|'par', done:boolean }

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

          // let x = await expr;
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
            // Mark this operation done
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

          // await Promise.all([...]) or Promise.race([...])
          const promiseAllMatch = bodyLn.match(/^(let|const)\s+(\w+)\s*=\s*await\s+Promise\.(all|race)\(\[\s*$/);
          if (promiseAllMatch) {
            const vn = promiseAllMatch[2], method = promiseAllMatch[3];
            awaits++;
            const allEnd = _findBlockEnd(lines, bi);
            const pExprs = [];
            for (let pi = bi + 1; pi < allEnd; pi++) {
              const pl = lines[pi].trim().replace(/,\s*$/, '');
              if (pl && pl !== ']' && pl !== ']);' && !pl.startsWith('//')) { pExprs.push(pl); promises++; }
            }
            // Add parallel group to timeline
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
            // Mark all group ops done
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
            const allEnd = _findBlockEnd(lines, bi);
            const pExprs = [];
            for (let pi = bi + 1; pi < allEnd; pi++) {
              const pl = lines[pi].trim().replace(/,\s*$/, '');
              if (pl && pl !== ']' && pl !== ']);' && !pl.startsWith('//')) { pExprs.push(pl); promises++; }
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

  function _mockResult(expr) {
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

  function _fv(val) {
    if (val === undefined) return 'undefined'; if (val === null) return 'null';
    if (typeof val === 'string') return `"${val}"`; if (typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return `[${val.length} items]`;
    if (typeof val === 'object') return JSON.stringify(val); return String(val);
  }

  function _tc(val) {
    if (typeof val === 'number') return '#ffcc66'; if (typeof val === 'string') return '#ff8866';
    if (typeof val === 'boolean') return val ? '#00ff88' : '#ff4466';
    if (Array.isArray(val)) return '#88aaff'; if (typeof val === 'object') return '#cc88ff'; return '#aaa';
  }

  function _tb(val) {
    if (Array.isArray(val)) return 'arr'; if (typeof val === 'number') return 'num';
    if (typeof val === 'string') return 'str'; if (typeof val === 'boolean') return 'bool';
    if (typeof val === 'object') return 'obj'; return '?';
  }
</script>

<!-- ── AsyncAwait module ──────────────────────────────────────────────────── -->
<ModuleShell
  {examples}
  accent={ACCENT}
  titlePrefix="async"
  titleAccent="Await"
  subtitle="— Asynchronous"
  desc="See how the event loop, call stack, and microtask queue work together for async code"
  {executeCode}
  showHeap={false}
>

  {#snippet topPanel(sd)}
    <!-- Brain / engine explanation -->
    <div class="brain-panel">
      <div class="brain-hdr">
        <span class="brain-title">Inside the Engine</span>
        {#if sd.phase === 'suspended'}
          <span class="async-badge suspended">⏸ suspended</span>
        {:else if sd.phase?.startsWith('await')}
          <span class="async-badge awaiting">⏳ await</span>
        {:else if sd.phase?.startsWith('promise')}
          <span class="async-badge parallel">⚡ parallel</span>
        {:else if sd.phase?.startsWith('async')}
          <span class="async-badge asyncbadge">async</span>
        {/if}
      </div>
      <div class="brain-box"
        class:brain-done   ={sd.done}
        class:brain-await  ={sd.phase === 'await-start' || sd.phase === 'suspended'}
        class:brain-resume ={sd.phase === 'await-resume'}
        class:brain-async  ={sd.phase?.startsWith('async-') || sd.phase?.startsWith('promise-')}
      >
        <pre class="brain-text">{sd.brain}</pre>
      </div>
      {#if sd.memLabel}<div class="mem-label">{sd.memLabel}</div>{/if}
    </div>

    <!-- Call Stack + Event Loop -->
    <div class="runtime-row">
      <div class="runtime-panel">
        <div class="runtime-hdr">Call Stack</div>
        <div class="stack-box">
          {#each [...(sd.callStack || [])].reverse() as frame, i}
            <div class="stack-frame" class:stack-top={i === 0}>
              <span class="stack-name">{frame}</span>
              {#if i === 0}<span class="stack-arrow">← running</span>{/if}
            </div>
          {/each}
          {#if !sd.callStack || sd.callStack.length === 0}
            <div class="stack-empty">empty (idle)</div>
          {/if}
        </div>
      </div>

      <div class="runtime-panel">
        <div class="runtime-hdr">Event Loop</div>
        <div class="event-box">
          {#if sd.eventLoop && sd.eventLoop.length > 0}
            {#each sd.eventLoop as evt}
              <div class="event-item">{evt}</div>
            {/each}
          {:else}
            <div class="event-empty">idle</div>
          {/if}
          {#if sd.microTasks && sd.microTasks.length > 0}
            <div class="micro-label">Microtasks:</div>
            {#each sd.microTasks as mt}
              <div class="micro-item">{mt}</div>
            {/each}
          {/if}
        </div>
      </div>
    </div>

    <!-- Variables in current frame -->
    <div class="frames-panel">
      <div class="runtime-hdr">Frames</div>
      <div class="frame-box">
        {#if sd.vars && Object.keys(sd.vars).length > 0}
          {#each Object.entries(sd.vars) as [key, val]}
            <div class="var-row" class:var-flash={sd.highlight === key}>
              <div class="var-left">
                <span class="var-name">{key}</span>
                <span class="var-type" style="color:{_tc(val)}">{_tb(val)}</span>
              </div>
              <span class="var-value" style="color:{_tc(val)}">{_fv(val)}</span>
            </div>
          {/each}
        {:else}
          <div class="var-empty">No variables yet</div>
        {/if}
      </div>
    </div>

    <!-- Timeline visualization — shows sequential vs parallel layout -->
    {#if sd.timeline && sd.timeline.length > 0}
      {#key sd.timeline.length}
        {@const tl        = sd.timeline}
        {@const seqOps    = tl.filter(t => t.type === 'seq')}
        {@const parGroups = [...new Set(tl.filter(t => t.type === 'par').map(t => t.groupId))]}
        {@const hasSeq    = seqOps.length > 0}
        {@const hasPar    = parGroups.length > 0}
        <div class="timeline-panel">
          <div class="timeline-hdr">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <line x1="1" y1="6" x2="11" y2="6" stroke={ACCENT} stroke-width="1" opacity="0.5"/>
              <circle cx="1" cy="6" r="1.5" fill={ACCENT} opacity="0.8"/>
              <circle cx="11" cy="6" r="1.5" fill={ACCENT} opacity="0.4"/>
            </svg>
            <span class="timeline-title">EXECUTION TIMELINE</span>
          </div>
          <div class="timeline-body">

            <!-- Sequential operations -->
            {#if hasSeq}
              <div class="tl-row">
                <span class="tl-row-label">sequential</span>
                <div class="tl-bars">
                  {#each seqOps as op, i}
                    <div class="tl-bar tl-seq" class:tl-done={op.done}>
                      <span class="tl-bar-label">{op.label.split('(')[0]}</span>
                    </div>
                    {#if i < seqOps.length - 1}
                      <div class="tl-sep">→</div>
                    {/if}
                  {/each}
                </div>
                <span class="tl-cost tl-cost-slow">T = t₁+t₂+…</span>
              </div>
            {/if}

            <!-- Parallel groups -->
            {#each parGroups as gid}
              {@const groupOps = tl.filter(t => t.groupId === gid)}
              <div class="tl-row">
                <span class="tl-row-label">parallel</span>
                <div class="tl-bars tl-bars-par">
                  {#each groupOps as op}
                    <div class="tl-bar tl-par" class:tl-done={op.done}>
                      <span class="tl-bar-label">{op.label.split('(')[0]}</span>
                    </div>
                  {/each}
                </div>
                <span class="tl-cost tl-cost-fast">T = max(t₁,t₂,…)</span>
              </div>
            {/each}

          </div>
          {#if hasSeq && hasPar}
            <div class="tl-insight">
              Parallel fires all at once — time = slowest, not the sum. That's the win.
            </div>
          {/if}
        </div>
      {/key}
    {/if}
  {/snippet}

  <!-- Complexity live stats -->
  {#snippet liveStats(sd)}
    <span class="cx-s">
      <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill={ACCENT}/></svg>
      {sd.awaits || 0} await{sd.awaits !== 1 ? 's' : ''}
    </span>
    <span class="cx-s">
      <svg width="8" height="8"><circle cx="4" cy="4" r="3" fill="#a78bfa"/></svg>
      {sd.promises || 0} promise{sd.promises !== 1 ? 's' : ''}
    </span>
    <span class="cx-s">
      <svg width="8" height="8"><rect x="1" y="1" width="6" height="6" rx="1" fill="#f59e0b"/></svg>
      {sd.memOps || 0} writes
    </span>
  {/snippet}

  <!-- Placeholder -->
  {#snippet placeholder()}
    <div class="vis-placeholder">
      <svg viewBox="0 0 220 170" class="ph-svg">
        <!-- Sequential stack -->
        <text x="14" y="22" fill="rgba(255,255,255,0.50)" font-size="11" font-family="monospace">sequential:</text>
        <rect x="14" y="28" width="44" height="14" rx="2" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2.3"/>
        <text x="36" y="39" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-size="9.5" font-family="monospace">task 1</text>
        <rect x="62" y="28" width="44" height="14" rx="2" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2.3"/>
        <text x="84" y="39" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-size="9.5" font-family="monospace">task 2</text>
        <rect x="110" y="28" width="44" height="14" rx="2" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2.3"/>
        <text x="132" y="39" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-size="9.5" font-family="monospace">task 3</text>
        <text x="162" y="38" fill="rgba(255,255,255,0.40)" font-size="10.5" font-family="monospace">T=t₁+t₂+t₃</text>
        <!-- Parallel layout -->
        <text x="14" y="60" fill="rgba(255,255,255,0.50)" font-size="11" font-family="monospace">parallel:</text>
        <rect x="14" y="66" width="44" height="14" rx="2" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2.3"/>
        <text x="36" y="77" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-size="9.5" font-family="monospace">task 1</text>
        <rect x="14" y="82" width="44" height="14" rx="2" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2.3"/>
        <text x="36" y="93" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-size="9.5" font-family="monospace">task 2</text>
        <rect x="14" y="98" width="44" height="14" rx="2" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2.3"/>
        <text x="36" y="109" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-size="9.5" font-family="monospace">task 3</text>
        <text x="66" y="93" fill="rgba(255,255,255,0.40)" font-size="10.5" font-family="monospace">T=max(t₁,t₂,t₃)</text>
        <!-- Call Stack visual -->
        <rect x="14" y="130" width="192" height="30" rx="3" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>
        <text x="30" y="144" fill="rgba(255,255,255,0.42)" font-size="11" font-family="monospace">call stack → event loop → microtasks</text>
      </svg>
      <p class="ph-text">Write code and click <strong style="color:{ACCENT}">▶ Visualize</strong> to trace async execution</p>
    </div>
  {/snippet}

</ModuleShell>

<style>
  /* Brain panel */
  .brain-panel  { background:var(--a11y-surface1); border:1px solid var(--a11y-border); border-radius:8px; overflow:hidden; flex-shrink:0; }
  .brain-hdr    { display:flex; align-items:center; justify-content:space-between; padding:5px 10px; background:var(--a11y-surface2); border-bottom:1px solid var(--a11y-border); }
  .brain-title  { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .async-badge  { font-size:0.55rem; padding:1px 6px; border-radius:3px; }
  .suspended    { color:#ffcc66; background:#ffcc6615; }
  .awaiting     { color:#cc88ff; background:#cc88ff15; }
  .parallel     { color:#4ade80; background:#4ade8015; }
  .asyncbadge   { color:#cc88ff; background:#cc88ff15; }
  .brain-box    { background:#0a0a12; padding:10px 12px; transition:all 0.3s; }
  .brain-done   { border-color:#88aaff33; background:#88aaff08; }
  .brain-await  { border-color:#ffcc6633; background:#ffcc6608; }
  .brain-resume { border-color:#00ff8833; background:#00ff8808; }
  .brain-async  { border-color:#cc88ff33; background:#cc88ff08; }
  .brain-text   { font-size:0.75rem; line-height:1.6; color:#bbb; white-space:pre-wrap; word-wrap:break-word; font-family:'Inter',system-ui,sans-serif; margin:0; }
  .brain-done .brain-text   { color:#aabbff; }
  .brain-await .brain-text  { color:#ffe099; }
  .brain-resume .brain-text { color:#88ffbb; }
  .brain-async .brain-text  { color:#ddaaff; }
  .mem-label    { background:#08080e; border-top:1px solid #1a1a2e; padding:5px 10px; font-size:0.6rem; color:#555; font-family:'SF Mono',monospace; letter-spacing:0.3px; }

  /* Call Stack + Event Loop */
  .runtime-row   { display:flex; gap:6px; }
  .runtime-panel { flex:1; min-width:0; background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .frames-panel  { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .runtime-hdr   { padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .stack-box     { padding:6px 8px; display:flex; flex-direction:column; gap:3px; min-height:40px; }
  .stack-frame   { display:flex; justify-content:space-between; align-items:center; padding:3px 6px; border-radius:3px; border:1px solid #1a1a2e; font-size:0.65rem; transition:all 0.3s; }
  .stack-top     { border-color:#cc88ff44; background:#cc88ff10; }
  .stack-name    { color:#ccc; font-weight:600; font-family:'SF Mono',monospace; font-size:0.65rem; }
  .stack-arrow   { font-size:0.5rem; color:#cc88ff; }
  .stack-empty   { font-size:0.6rem; color:#2a2a3e; padding:4px; }
  .event-box     { padding:6px 8px; min-height:40px; }
  .event-item    { font-size:0.6rem; color:#ffcc66; padding:2px 6px; background:#ffcc6610; border-radius:3px; margin-bottom:2px; font-family:'SF Mono',monospace; }
  .event-empty   { font-size:0.6rem; color:#2a2a3e; padding:4px; }
  .micro-label   { font-size:0.5rem; color:#444; text-transform:uppercase; letter-spacing:1px; margin-top:4px; }
  .micro-item    { font-size:0.6rem; color:#cc88ff; padding:2px 6px; background:#cc88ff10; border-radius:3px; margin-bottom:2px; font-family:'SF Mono',monospace; }

  /* Variable frame */
  .frame-box   { padding:8px 10px; }
  .var-row     { display:flex; justify-content:space-between; align-items:center; padding:4px 8px; border-radius:4px; transition:all 0.35s; margin-bottom:2px; }
  .var-flash   { background:#cc88ff18; box-shadow:inset 3px 0 0 #cc88ff; }
  .var-left    { display:flex; align-items:center; gap:6px; }
  .var-name    { font-size:0.8rem; color:#88aaff; font-weight:600; font-family:'SF Mono',monospace; }
  .var-type    { font-size:0.55rem; padding:1px 5px; border-radius:3px; background:#ffffff08; }
  .var-value   { font-size:0.8rem; font-weight:600; font-family:'SF Mono',monospace; }
  .var-empty   { font-size:0.72rem; color:#2a2a3e; padding:10px 4px; }

  /* Timeline */
  .timeline-panel  { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .timeline-hdr    { display:flex; align-items:center; gap:6px; padding:5px 10px; background:#0d0d16; border-bottom:1px solid #1a1a2e; }
  .timeline-title  { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .timeline-body   { padding:8px; display:flex; flex-direction:column; gap:6px; }

  .tl-row        { display:flex; align-items:center; gap:8px; }
  .tl-row-label  { font-size:0.45rem; color:#444; font-family:monospace; min-width:52px; text-align:right; }
  .tl-bars       { display:flex; gap:2px; align-items:center; flex:1; }
  .tl-bars-par   { flex-direction:column; gap:2px; }
  .tl-bar        { padding:3px 8px; border-radius:3px; min-width:50px; transition:all 0.3s; border:1px solid transparent; }
  .tl-seq        { background:#cc88ff18; border-color:#cc88ff33; }
  .tl-par        { background:#4ade8018; border-color:#4ade8033; width:100%; }
  .tl-done.tl-seq { background:#cc88ff30; border-color:#cc88ff66; }
  .tl-done.tl-par { background:#4ade8030; border-color:#4ade8066; }
  .tl-bar-label  { font-size:0.5rem; color:#888; font-family:monospace; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; }
  .tl-done .tl-bar-label { color:#ccc; }
  .tl-sep        { font-size:0.6rem; color:#333; }
  .tl-cost       { font-size:0.45rem; font-family:monospace; white-space:nowrap; }
  .tl-cost-slow  { color:#f87171; }
  .tl-cost-fast  { color:#4ade80; }
  .tl-insight    { padding:4px 10px 6px; background:#4ade8008; border-top:1px solid #4ade8018; font-size:0.48rem; color:#4ade8077; font-family:monospace; }

  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg  { width:220px; height:auto; opacity:0.5; }
  .ph-text { font-size:0.75rem; color:#333; text-align:center; }

  .cx-s { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family:monospace; }
</style>
