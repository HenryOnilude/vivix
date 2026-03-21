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

    steps.push({
      lineIndex: -1, nextLineIndex: 0,
      vars: dc(vars), output: [...output],
      callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks],
      highlight: null, phase: 'start',
      brain: 'The JavaScript engine starts. The call stack has one frame: Global.\n\nKey concept: JavaScript is SINGLE-THREADED. It can only do one thing at a time.\nBut async/await lets it pause and resume, giving the illusion of parallelism.\n\nThe event loop manages this: when we await, the function is suspended and other code can run.',
      memLabel: 'Engine ready | Call Stack: [Global] | Event Loop: idle',
      memOps, awaits, promises,
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
          memOps, awaits, promises,
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
          memOps, awaits, promises,
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
            steps.push({
              lineIndex: bi, nextLineIndex: bi,
              vars: dc(vars), output: [...output],
              callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks],
              highlight: null, phase: 'await-start',
              brain: `AWAIT ENCOUNTERED: await ${awaitExpr}\n\nHere is where the magic happens:\n  1. The expression "${awaitExpr}" starts executing (fires the async operation)\n  2. The "${fnName}" function is SUSPENDED — removed from the call stack\n  3. Control returns to the event loop\n  4. Other code can run while we wait\n\nThe Promise is now "pending" in the microtask queue.`,
              memLabel: `AWAIT: ${awaitExpr} | ${fnName} suspended | Promise #${promises}`,
              memOps, awaits, promises,
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
              memOps, awaits, promises,
            });

            const mockResult = _mockResult(awaitExpr);
            vars[vn] = mockResult;
            memOps++;
            eventLoop.pop();
            microTasks.pop();
            steps.push({
              lineIndex: bi, nextLineIndex: _nextInBody(lines, bi + 1, bodyEnd),
              vars: dc(vars), output: [...output],
              callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks],
              highlight: vn, phase: 'await-resume',
              brain: `PROMISE RESOLVED: ${awaitExpr} → ${_fv(mockResult)}\n\nThe microtask queue signals: "this promise is done!"\nThe event loop picks it up and RESUMES "${fnName}".\n\n"${fnName}" is pushed back onto the call stack.\nExecution continues from exactly where it paused.\n\n${vn} = ${_fv(mockResult)}`,
              memLabel: `RESUME: ${fnName} | ${vn} ← ${_fv(mockResult)} | Stack restored`,
              memOps, awaits, promises,
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
            steps.push({
              lineIndex: bi, nextLineIndex: bi,
              vars: dc(vars), output: [...output],
              callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks, ...pExprs],
              highlight: null, phase: 'promise-all-start',
              brain: method === 'all'
                ? `PROMISE.ALL: Fire ${pExprs.length} promises SIMULTANEOUSLY\n\n${pExprs.map((p, i) => `  Promise ${i + 1}: ${p}`).join('\n')}\n\nAll ${pExprs.length} async operations start at the SAME TIME.\nPromise.all waits for ALL of them to complete.\nTotal time = slowest promise (not the sum!).`
                : `PROMISE.RACE: Fire ${pExprs.length} promises — first one wins!\n\n${pExprs.map((p, i) => `  Promise ${i + 1}: ${p}`).join('\n')}\n\nAll start simultaneously, but only the FASTEST matters.`,
              memLabel: `${method.toUpperCase()}: ${pExprs.length} promises fired | All pending`,
              memOps, awaits, promises,
            });
            const suspStack = callStack.filter(f => f !== fnName);
            steps.push({
              lineIndex: bi, nextLineIndex: bi,
              vars: dc(vars), output: [...output],
              callStack: [...suspStack], eventLoop: [...eventLoop, ...pExprs.map(p => `pending: ${p}`)], microTasks: [...microTasks],
              highlight: null, phase: 'suspended',
              brain: `SUSPENDED while ${method === 'all' ? 'all' : 'any'} promises resolve.\n\nThe event loop shows ${pExprs.length} pending operations.\nThe JS thread is free.\n\n${method === 'all' ? 'Waiting for the SLOWEST promise...' : 'Waiting for the FASTEST promise...'}`,
              memLabel: `WAITING: ${pExprs.length} pending | ${fnName} suspended`,
              memOps, awaits, promises,
            });
            const mockResults = method === 'all' ? pExprs.map(_mockResult) : [_mockResult(pExprs[0])];
            vars[vn] = method === 'all' ? mockResults : mockResults[0];
            memOps++;
            steps.push({
              lineIndex: bi, nextLineIndex: _nextInBody(lines, allEnd + 1, bodyEnd),
              vars: dc(vars), output: [...output],
              callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks],
              highlight: vn, phase: 'await-resume',
              brain: method === 'all'
                ? `ALL PROMISES RESOLVED!\n\nResults array:\n${mockResults.map((r, i) => `  [${i}] ${pExprs[i]} → ${_fv(r)}`).join('\n')}\n\n${vn} = [${mockResults.map(_fv).join(', ')}]`
                : `RACE WINNER: The fastest promise resolved first.\n\n${vn} = ${_fv(mockResults[0])}`,
              memLabel: `RESOLVED: ${method} | ${vn} ← ${method === 'all' ? `[${mockResults.length} results]` : _fv(mockResults[0])}`,
              memOps, awaits, promises,
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
            steps.push({
              lineIndex: bi, nextLineIndex: bi,
              vars: dc(vars), output: [...output],
              callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks, ...pExprs],
              highlight: null, phase: 'promise-all-start',
              brain: `PROMISE.ALL with destructuring:\n  let [${varNames.join(', ')}] = await Promise.all([...])\n\n${pExprs.map((p, i) => `  ${varNames[i] || '?'} ← ${p}`).join('\n')}\n\nAll promises fire in parallel. Results are destructured into individual variables.`,
              memLabel: `ALL: ${pExprs.length} parallel promises`,
              memOps, awaits, promises,
            });
            const suspStack2 = callStack.filter(f => f !== fnName);
            steps.push({
              lineIndex: bi, nextLineIndex: bi,
              vars: dc(vars), output: [...output],
              callStack: [...suspStack2], eventLoop: pExprs.map(p => `pending: ${p}`), microTasks: [...microTasks],
              highlight: null, phase: 'suspended',
              brain: `Suspended. Waiting for all ${pExprs.length} promises...`,
              memLabel: `WAITING: ${pExprs.length} pending`,
              memOps, awaits, promises,
            });
            const mockResults2 = pExprs.map(_mockResult);
            varNames.forEach((vn, i) => { vars[vn] = mockResults2[i]; memOps++; });
            steps.push({
              lineIndex: bi, nextLineIndex: _nextInBody(lines, allEnd + 1, bodyEnd),
              vars: dc(vars), output: [...output],
              callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks],
              highlight: varNames[0], phase: 'await-resume',
              brain: `ALL RESOLVED! Destructured:\n${varNames.map((vn, i) => `  ${vn} = ${_fv(mockResults2[i])}`).join('\n')}`,
              memLabel: `RESUME | ${varNames.length} vars assigned`,
              memOps, awaits, promises,
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
              memOps, awaits, promises,
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
              memOps, awaits, promises,
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
              memOps, awaits, promises,
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
              memOps, awaits, promises,
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
              memOps, awaits, promises,
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
      memOps, awaits, promises,
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
<!--
  AsyncAwait uses the `executeCode` prop to bypass the standard interpreter,
  and renders its entire custom right-panel through the `topPanel` snippet.
  showHeap=false prevents the default heap from rendering (we manage state ourselves).
-->
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

  <!-- The entire async right panel: brain, call stack, event loop, frames, complexity -->
  {#snippet topPanel(sd)}
    <!-- Brain / engine explanation -->
    <div class="brain-panel">
      <div class="brain-hdr">
        <span class="brain-title">Inside the Engine</span>
        {#if sd.phase === 'suspended'}
          <span class="async-badge">⏸ suspended</span>
        {:else if sd.phase?.startsWith('await')}
          <span class="async-badge">⏳ await</span>
        {:else if sd.phase?.startsWith('async')}
          <span class="async-badge">async</span>
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
      <svg viewBox="0 0 200 160" class="ph-svg">
        <rect x="60" y="20" width="80" height="24" rx="4" fill="none" stroke="#1a1a2e" stroke-width="2"/>
        <text x="100" y="36" text-anchor="middle" fill="#1a1a2e" font-size="8" font-family="monospace">async function</text>
        <line x1="100" y1="44" x2="100" y2="60" stroke="#1a1a2e" stroke-width="1.5" stroke-dasharray="3 2"/>
        <rect x="60" y="60" width="80" height="24" rx="4" fill="none" stroke="#1a1a2e" stroke-width="2"/>
        <text x="100" y="76" text-anchor="middle" fill="#1a1a2e" font-size="8" font-family="monospace">await promise</text>
        <line x1="100" y1="84" x2="100" y2="100" stroke="#1a1a2e" stroke-width="1.5" stroke-dasharray="3 2"/>
        <rect x="60" y="100" width="80" height="24" rx="4" fill="none" stroke="#1a1a2e" stroke-width="2"/>
        <text x="100" y="116" text-anchor="middle" fill="#1a1a2e" font-size="8" font-family="monospace">resume & return</text>
        <text x="100" y="148" text-anchor="middle" fill="#222" font-size="8" font-family="monospace">event loop • microtasks</text>
      </svg>
      <p class="ph-text">Write code and click <strong style="color:{ACCENT}">▶ Visualize</strong> to trace async execution</p>
    </div>
  {/snippet}

</ModuleShell>

<style>
  /* Brain panel */
  .brain-panel  { background:#0a0a12; border:1px solid #1a1a2e; border-radius:8px; overflow:hidden; flex-shrink:0; }
  .brain-hdr    { display:flex; align-items:center; justify-content:space-between; padding:5px 10px; background:#12121f; border-bottom:1px solid #1a1a2e; }
  .brain-title  { font-size:0.55rem; color:#555; font-family:monospace; letter-spacing:1.5px; font-weight:700; }
  .async-badge  { font-size:0.55rem; color:#cc88ff; background:#cc88ff15; padding:1px 6px; border-radius:3px; }
  .brain-box    { background:#0a0a12; border-top:none; padding:10px 12px; transition:all 0.3s; }
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

  .vis-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
  .ph-svg  { width:200px; height:auto; opacity:0.5; }
  .ph-text { font-size:0.75rem; color:#333; text-align:center; }

  .cx-s { display:flex; align-items:center; gap:4px; font-size:0.55rem; color:#444; font-family:monospace; }
</style>
