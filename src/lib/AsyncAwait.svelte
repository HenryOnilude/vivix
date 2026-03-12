<script>
  import { onMount } from 'svelte';

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

  let selectedExample = $state(0);
  let codeText = $state(examples[0].code);
  let currentStep = $state(-1);
  let totalSteps = $state(0);
  let executionSteps = $state([]);
  let isPlaying = $state(false);
  let autoTimer = $state(null);
  let hasRun = $state(false);
  let errorMsg = $state('');

  let codeLines = $derived(codeText.split('\n'));
  let stepData = $derived(
    currentStep >= 0 && currentStep < executionSteps.length ? executionSteps[currentStep] : null
  );
  let currentComplexity = $derived(examples[selectedExample].complexity);

  function executeCode(code) {
    const lines = code.split('\n');
    const steps = [];
    const vars = {};
    const output = [];
    const eventLoop = [];
    const microTasks = [];
    let memOps = 0, awaits = 0, promises = 0;
    let callStack = ['Global'];

    steps.push({ lineIndex: -1, nextLineIndex: 0, vars: dc(vars), output: [...output], callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks], highlight: null, phase: 'start', brain: 'The JavaScript engine starts. The call stack has one frame: Global.\n\nKey concept: JavaScript is SINGLE-THREADED. It can only do one thing at a time.\nBut async/await lets it pause and resume, giving the illusion of parallelism.\n\nThe event loop manages this: when we await, the function is suspended and other code can run.', memLabel: 'Engine ready | Call Stack: [Global] | Event Loop: idle', memOps, awaits, promises });

    let li = 0;
    while (li < lines.length) {
      const ln = lines[li].trim();
      if (ln === '' || ln.startsWith('//') || ln === '{' || ln === '}') { li++; continue; }

      // async function declaration
      const asyncFnMatch = ln.match(/^async\s+function\s+(\w+)\s*\(([^)]*)\)\s*\{?\s*$/);
      if (asyncFnMatch) {
        const fnName = asyncFnMatch[1];
        const params = asyncFnMatch[2];
        const bodyEnd = findBlockEnd(lines, li);

        steps.push({ lineIndex: li, nextLineIndex: li + 1, vars: dc(vars), output: [...output], callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks], highlight: fnName, phase: 'async-declare', brain: `ASYNC FUNCTION DECLARATION: "${fnName}"\n\nThe "async" keyword means:\n  1. This function always returns a Promise\n  2. Inside it, you can use "await" to pause execution\n  3. When it pauses, the event loop can run other code\n\nThe function is registered but NOT called yet.`, memLabel: `REGISTER: async ${fnName}() | Returns Promise`, memOps, awaits, promises });

        // Simulate calling the async function and stepping through its body
        callStack.push(fnName);
        promises++;

        steps.push({ lineIndex: li, nextLineIndex: li + 1, vars: dc(vars), output: [...output], callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks], highlight: fnName, phase: 'async-call', brain: `CALLING async ${fnName}()\n\nA new frame "${fnName}" is pushed onto the call stack.\nThe engine starts executing the function body synchronously...\nUntil it hits the first "await" — then everything changes.`, memLabel: `CALL: ${fnName}() | Stack: [${callStack.join(' → ')}]`, memOps, awaits, promises });

        // Walk through function body
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

            // Step 1: Hit the await
            microTasks.push(awaitExpr);
            steps.push({ lineIndex: bi, nextLineIndex: bi, vars: dc(vars), output: [...output], callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks], highlight: null, phase: 'await-start', brain: `AWAIT ENCOUNTERED: await ${awaitExpr}\n\nHere is where the magic happens:\n  1. The expression "${awaitExpr}" starts executing (fires the async operation)\n  2. The "${fnName}" function is SUSPENDED — removed from the call stack\n  3. Control returns to the event loop\n  4. Other code can run while we wait\n\nThe Promise is now "pending" in the microtask queue.`, memLabel: `AWAIT: ${awaitExpr} | ${fnName} suspended | Promise #${promises}`, memOps, awaits, promises });

            // Step 2: Suspended state
            const suspendedStack = callStack.filter(f => f !== fnName);
            eventLoop.push(`waiting: ${awaitExpr}`);
            steps.push({ lineIndex: bi, nextLineIndex: bi, vars: dc(vars), output: [...output], callStack: [...suspendedStack], eventLoop: [...eventLoop], microTasks: [...microTasks], highlight: null, phase: 'suspended', brain: `FUNCTION SUSPENDED: "${fnName}" is paused.\n\nThe call stack no longer contains "${fnName}".\nThe JavaScript engine is FREE to do other work.\n\nMeanwhile, the async operation (${awaitExpr}) is running\nin the background (handled by the browser/Node.js runtime,\nnot by JavaScript itself).\n\nWhen the Promise resolves, a microtask is queued.`, memLabel: `SUSPENDED | Stack: [${suspendedStack.join(' → ')}] | Waiting: ${awaitExpr}`, memOps, awaits, promises });

            // Step 3: Promise resolves, function resumes
            const mockResult = generateMockResult(awaitExpr);
            vars[vn] = mockResult;
            memOps++;
            eventLoop.pop();
            microTasks.pop();

            steps.push({ lineIndex: bi, nextLineIndex: findNextInBody(lines, bi + 1, bodyEnd), vars: dc(vars), output: [...output], callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks], highlight: vn, phase: 'await-resume', brain: `PROMISE RESOLVED: ${awaitExpr} → ${fv(mockResult)}\n\nThe microtask queue signals: "this promise is done!"\nThe event loop picks it up and RESUMES "${fnName}".\n\n"${fnName}" is pushed back onto the call stack.\nExecution continues from exactly where it paused.\n\n${vn} = ${fv(mockResult)}`, memLabel: `RESUME: ${fnName} | ${vn} ← ${fv(mockResult)} | Stack restored`, memOps, awaits, promises });
            bi++; continue;
          }

          // await Promise.all([...])
          const promiseAllMatch = bodyLn.match(/^(let|const)\s+(\w+)\s*=\s*await\s+Promise\.(all|race)\(\[\s*$/);
          if (promiseAllMatch) {
            const vn = promiseAllMatch[2];
            const method = promiseAllMatch[3];
            awaits++;
            const allEnd = findBlockEnd(lines, bi);
            
            // Collect promise expressions
            const promiseExprs = [];
            for (let pi = bi + 1; pi < allEnd; pi++) {
              const pl = lines[pi].trim().replace(/,\s*$/, '');
              if (pl && pl !== ']' && pl !== ']);' && !pl.startsWith('//')) {
                promiseExprs.push(pl);
                promises++;
              }
            }

            // Fire all promises
            steps.push({ lineIndex: bi, nextLineIndex: bi, vars: dc(vars), output: [...output], callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks, ...promiseExprs], highlight: null, phase: 'promise-all-start', brain: method === 'all' ? `PROMISE.ALL: Fire ${promiseExprs.length} promises SIMULTANEOUSLY\n\n${promiseExprs.map((p, i) => `  Promise ${i + 1}: ${p}`).join('\n')}\n\nAll ${promiseExprs.length} async operations start at the SAME TIME.\nPromise.all waits for ALL of them to complete.\nTotal time = slowest promise (not the sum!).\n\nIf ANY promise rejects, the entire Promise.all rejects.` : `PROMISE.RACE: Fire ${promiseExprs.length} promises — first one wins!\n\n${promiseExprs.map((p, i) => `  Promise ${i + 1}: ${p}`).join('\n')}\n\nAll start simultaneously, but only the FASTEST matters.\nAs soon as one resolves/rejects, race returns that result.\nThe others keep running but their results are discarded.`, memLabel: `${method.toUpperCase()}: ${promiseExprs.length} promises fired | All pending`, memOps, awaits, promises });

            // Suspended
            const suspStack = callStack.filter(f => f !== fnName);
            steps.push({ lineIndex: bi, nextLineIndex: bi, vars: dc(vars), output: [...output], callStack: [...suspStack], eventLoop: [...eventLoop, ...promiseExprs.map(p => `pending: ${p}`)], microTasks: [...microTasks], highlight: null, phase: 'suspended', brain: `SUSPENDED while ${method === 'all' ? 'all' : 'any'} promises resolve.\n\nThe event loop shows ${promiseExprs.length} pending operations.\nThe JS thread is free — it could handle UI events, timers, etc.\n\n${method === 'all' ? 'Waiting for the SLOWEST promise to finish...' : 'Waiting for the FASTEST promise to finish...'}`, memLabel: `WAITING: ${promiseExprs.length} pending | ${fnName} suspended`, memOps, awaits, promises });

            // Resolve
            const mockResults = method === 'all' 
              ? promiseExprs.map(p => generateMockResult(p))
              : [generateMockResult(promiseExprs[0])];
            vars[vn] = method === 'all' ? mockResults : mockResults[0];
            memOps++;

            steps.push({ lineIndex: bi, nextLineIndex: findNextInBody(lines, allEnd + 1, bodyEnd), vars: dc(vars), output: [...output], callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks], highlight: vn, phase: 'await-resume', brain: method === 'all' ? `ALL PROMISES RESOLVED!\n\nResults array:\n${mockResults.map((r, i) => `  [${i}] ${promiseExprs[i]} → ${fv(r)}`).join('\n')}\n\n${vn} = [${mockResults.map(fv).join(', ')}]\n\nThe function resumes. All results are available at once.` : `RACE WINNER: The fastest promise resolved first.\n\n${vn} = ${fv(mockResults[0])}\n\nOther promises may still be running in the background.`, memLabel: `RESOLVED: ${method} | ${vn} ← ${method === 'all' ? `[${mockResults.length} results]` : fv(mockResults[0])}`, memOps, awaits, promises });

            bi = allEnd + 1; continue;
          }

          // let [a, b] = await Promise.all([...])
          const destructAllMatch = bodyLn.match(/^(let|const)\s+\[([^\]]+)\]\s*=\s*await\s+Promise\.(all|race)\(\[\s*$/);
          if (destructAllMatch) {
            const varNames = destructAllMatch[2].split(',').map(v => v.trim());
            const method = destructAllMatch[3];
            awaits++;
            const allEnd = findBlockEnd(lines, bi);
            const promiseExprs = [];
            for (let pi = bi + 1; pi < allEnd; pi++) {
              const pl = lines[pi].trim().replace(/,\s*$/, '');
              if (pl && pl !== ']' && pl !== ']);' && !pl.startsWith('//')) { promiseExprs.push(pl); promises++; }
            }

            steps.push({ lineIndex: bi, nextLineIndex: bi, vars: dc(vars), output: [...output], callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks, ...promiseExprs], highlight: null, phase: 'promise-all-start', brain: `PROMISE.ALL with destructuring:\n  let [${varNames.join(', ')}] = await Promise.all([...])\n\n${promiseExprs.map((p, i) => `  ${varNames[i] || '?'} ← ${p}`).join('\n')}\n\nAll promises fire in parallel. Results are destructured into individual variables.`, memLabel: `ALL: ${promiseExprs.length} parallel promises`, memOps, awaits, promises });

            const suspStack2 = callStack.filter(f => f !== fnName);
            steps.push({ lineIndex: bi, nextLineIndex: bi, vars: dc(vars), output: [...output], callStack: [...suspStack2], eventLoop: promiseExprs.map(p => `pending: ${p}`), microTasks: [...microTasks], highlight: null, phase: 'suspended', brain: `Suspended. Waiting for all ${promiseExprs.length} promises...`, memLabel: `WAITING: ${promiseExprs.length} pending`, memOps, awaits, promises });

            const mockResults2 = promiseExprs.map(p => generateMockResult(p));
            varNames.forEach((vn, i) => { vars[vn] = mockResults2[i]; memOps++; });

            steps.push({ lineIndex: bi, nextLineIndex: findNextInBody(lines, allEnd + 1, bodyEnd), vars: dc(vars), output: [...output], callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks], highlight: varNames[0], phase: 'await-resume', brain: `ALL RESOLVED! Destructured:\n${varNames.map((vn, i) => `  ${vn} = ${fv(mockResults2[i])}`).join('\n')}`, memLabel: `RESUME | ${varNames.length} vars assigned`, memOps, awaits, promises });

            bi = allEnd + 1; continue;
          }

          // try {
          const tryMatch = bodyLn.match(/^try\s*\{?\s*$/);
          if (tryMatch) {
            steps.push({ lineIndex: bi, nextLineIndex: bi + 1, vars: dc(vars), output: [...output], callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks], highlight: null, phase: 'try-enter', brain: 'TRY BLOCK: The engine enters a protected region.\n\nIf any promise inside this block REJECTS (throws an error),\nexecution jumps to the catch block instead of crashing.\n\nThis is how you handle async errors gracefully.', memLabel: 'ENTER: try block | Error handler registered', memOps, awaits, promises });
            bi++; continue;
          }

          // catch (err) {
          const catchMatch = bodyLn.match(/^\}\s*catch\s*\((\w+)\)\s*\{?\s*$/);
          if (catchMatch) {
            steps.push({ lineIndex: bi, nextLineIndex: bi + 1, vars: dc(vars), output: [...output], callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks], highlight: null, phase: 'catch', brain: `CATCH BLOCK: This runs ONLY if the try-block threw an error.\n\nIn async code, a rejected promise triggers the catch.\nThe error object "${catchMatch[1]}" contains the rejection reason.\n\nIf no error occurred, this entire block is skipped.`, memLabel: `CATCH: ${catchMatch[1]} handler`, memOps, awaits, promises });
            bi++; continue;
          }

          // return statement
          const retMatch = bodyLn.match(/^return\s+(.+?)\s*;?\s*$/);
          if (retMatch) {
            const retExpr = retMatch[1];
            let retVal;
            try { retVal = evalE(retExpr, vars); } catch(e) { retVal = retExpr in vars ? vars[retExpr] : retExpr; }
            steps.push({ lineIndex: bi, nextLineIndex: null, vars: dc(vars), output: [...output], callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks], highlight: null, phase: 'async-return', brain: `ASYNC RETURN: return ${retExpr}\n\nThe async function wraps this value in a resolved Promise.\nThe caller (who awaited this function) will receive: ${fv(retVal)}\n\nThe "${fnName}" frame is popped from the call stack.\nThe returned Promise resolves, triggering any .then() or await.`, memLabel: `RETURN: Promise.resolve(${fv(retVal)}) | ${fnName} done`, memOps, awaits, promises });
            break;
          }

          // let/const with non-await expression
          const declMatch = bodyLn.match(/^(let|const)\s+(\w+)\s*=\s*(.+?)\s*;?\s*$/);
          if (declMatch) {
            const vn = declMatch[2], raw = declMatch[3];
            let val; try { val = evalE(raw, vars); } catch(e) { val = raw; }
            vars[vn] = val; memOps++;
            steps.push({ lineIndex: bi, nextLineIndex: findNextInBody(lines, bi + 1, bodyEnd), vars: dc(vars), output: [...output], callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks], highlight: vn, phase: 'declare', brain: `LOCAL: let ${vn} = ${fv(val)}\n\nThis is synchronous — no await, so no suspension.`, memLabel: `ALLOC: ${vn} ← ${fv(val)}`, memOps, awaits, promises });
            bi++; continue;
          }

          // assignment
          const assignMatch = bodyLn.replace(/;$/, '').match(/^(\w+)\s*=\s*(.+)$/);
          if (assignMatch) {
            const vn = assignMatch[1], raw = assignMatch[2];
            let val; try { val = evalE(raw, vars); } catch(e) { val = raw; }
            vars[vn] = val; memOps++;
            steps.push({ lineIndex: bi, nextLineIndex: findNextInBody(lines, bi + 1, bodyEnd), vars: dc(vars), output: [...output], callStack: [...callStack], eventLoop: [...eventLoop], microTasks: [...microTasks], highlight: vn, phase: 'assign', brain: `ASSIGN: ${vn} = ${fv(val)}`, memLabel: `WRITE: ${vn} ← ${fv(val)}`, memOps, awaits, promises });
            bi++; continue;
          }

          bi++;
        }

        // End of async function
        callStack.pop();
        li = bodyEnd + 1; continue;
      }

      li++;
    }

    steps.push({ lineIndex: -1, nextLineIndex: -1, vars: dc(vars), output: [...output], callStack: ['Global'], eventLoop: [], microTasks: [], highlight: null, phase: 'done', done: true, brain: `PROGRAM COMPLETE\n\nAsync execution summary:\n  Total awaits: ${awaits}\n  Promises created: ${promises}\n  Memory writes: ${memOps}\n\nThe event loop is idle. All promises have settled.\nThe call stack is empty.`, memLabel: `DONE | ${awaits} awaits, ${promises} promises`, memOps, awaits, promises });
    return steps;
  }

  function generateMockResult(expr) {
    if (expr.includes('getUser') || expr.includes('User')) return { id: 1, name: "Alice" };
    if (expr.includes('getPosts') || expr.includes('Posts')) return [{ id: 101, title: "Hello World" }];
    if (expr.includes('getComments') || expr.includes('Comments')) return [{ text: "Great post!" }];
    if (expr.includes('slow')) return { data: "slow-result", ms: 800 };
    if (expr.includes('fast')) return { data: "fast-result", ms: 100 };
    if (expr.includes('medium')) return { data: "medium-result", ms: 400 };
    if (expr.includes('risky')) return { status: "ok", data: "result" };
    if (expr.includes('taskA')) return "resultA";
    if (expr.includes('taskB')) return "resultB";
    return { resolved: true };
  }

  function findNextInBody(lines, from, bodyEnd) {
    for (let i = from; i < bodyEnd; i++) {
      const t = lines[i].trim();
      if (t !== '' && t !== '{' && t !== '}' && !t.startsWith('//')) return i;
    }
    return -1;
  }

  function findBlockEnd(lines, start) {
    let d = 0;
    for (let i = start; i < lines.length; i++) {
      for (const ch of lines[i]) { if (ch === '{') d++; if (ch === '}') { d--; if (d <= 0) return i; } }
    }
    return lines.length - 1;
  }

  function evalE(expr, vars) {
    const k = Object.keys(vars), v = Object.values(vars);
    return new Function(...k, `return (${expr});`)(...v);
  }

  function dc(o) { return JSON.parse(JSON.stringify(o)); }
  function fv(val) {
    if (val === undefined) return 'undefined'; if (val === null) return 'null';
    if (typeof val === 'string') return `"${val}"`; if (typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return `[${val.length} items]`;
    if (typeof val === 'object') return JSON.stringify(val); return String(val);
  }
  function tc(val) {
    if (typeof val === 'number') return '#ffcc66'; if (typeof val === 'string') return '#ff8866';
    if (typeof val === 'boolean') return val ? '#00ff88' : '#ff4466';
    if (Array.isArray(val)) return '#88aaff'; if (typeof val === 'object') return '#cc88ff'; return '#aaa';
  }
  function tb(val) {
    if (Array.isArray(val)) return 'arr'; if (typeof val === 'number') return 'num';
    if (typeof val === 'string') return 'str'; if (typeof val === 'boolean') return 'bool';
    if (typeof val === 'object') return 'obj'; return '?';
  }

  function runCode() {
    errorMsg = '';
    try { executionSteps = executeCode(codeText); totalSteps = executionSteps.length; currentStep = 0; hasRun = true; } catch (e) { errorMsg = e.message; }
  }
  function goFirst() { if (hasRun) currentStep = 0; }
  function goPrev() { if (hasRun && currentStep > 0) currentStep--; }
  function goNext() { if (hasRun && currentStep < totalSteps - 1) currentStep++; }
  function goLast() { if (hasRun) currentStep = totalSteps - 1; }
  function toggleAutoPlay() {
    if (isPlaying) { clearInterval(autoTimer); autoTimer = null; isPlaying = false; }
    else { if (currentStep >= totalSteps - 1) currentStep = 0; isPlaying = true; autoTimer = setInterval(() => { if (currentStep < totalSteps - 1) currentStep++; else { clearInterval(autoTimer); autoTimer = null; isPlaying = false; } }, 2000); }
  }
  function loadExample(idx) { selectedExample = idx; codeText = examples[idx].code; hasRun = false; currentStep = -1; executionSteps = []; errorMsg = ''; if (isPlaying) { clearInterval(autoTimer); autoTimer = null; isPlaying = false; } }
  function handleSlider(e) { currentStep = parseInt(e.target.value); }
  function editCode() { hasRun = false; currentStep = -1; executionSteps = []; errorMsg = ''; if (isPlaying) { clearInterval(autoTimer); autoTimer = null; isPlaying = false; } }
  onMount(() => () => { if (autoTimer) clearInterval(autoTimer); });
</script>

<div class="module">
  <div class="top-bar">
    <a href="#/" class="back-link">← modules</a>
    <div class="title-group">
      <h2>async<span class="accent">Await</span> <span class="subtitle">— Asynchronous</span></h2>
      <p class="desc">See how the event loop, call stack, and microtask queue work together for async code</p>
    </div>
  </div>

  <div class="examples-bar">
    <span class="examples-label">Examples:</span>
    {#each examples as ex, i}
      <button class="ex-btn" class:active={selectedExample === i} onclick={() => loadExample(i)}>{ex.label}</button>
    {/each}
  </div>

  <div class="main-layout">
    <div class="code-side">
      <div class="panel-head">
        <span class="panel-title">Source Code</span>
        <div class="panel-actions">
          {#if hasRun}<button class="edit-btn" onclick={editCode}>✎ Edit</button>{/if}
          <button class="run-btn" onclick={runCode}>▶ Visualize</button>
        </div>
      </div>
      {#if !hasRun}
        <textarea class="code-editor" bind:value={codeText} spellcheck="false"></textarea>
      {:else}
        <div class="code-display">
          {#each codeLines as line, i}
            <div class="code-line" class:line-executed={stepData && stepData.lineIndex === i} class:line-next={stepData && stepData.nextLineIndex === i} class:line-await={stepData && stepData.lineIndex === i && (stepData.phase === 'await-start' || stepData.phase === 'suspended')} class:line-resume={stepData && stepData.lineIndex === i && stepData.phase === 'await-resume'}>
              <span class="ln">{i + 1}</span>
              <span class="arrow-col">
                {#if stepData && stepData.lineIndex === i}<span class="arr-exec">▶</span>
                {:else if stepData && stepData.nextLineIndex === i}<span class="arr-next">▸</span>
                {:else}<span class="arr-none">&nbsp;</span>{/if}
              </span>
              <span class="line-text">{line || ' '}</span>
            </div>
          {/each}
        </div>
      {/if}
      {#if hasRun}
        <div class="legend-bar">
          <span class="leg"><span class="arr-exec">▶</span> executed</span>
          <span class="leg"><span class="arr-next">▸</span> next</span>
          {#if stepData && stepData.phase === 'suspended'}<span class="leg suspended-badge">⏸ suspended</span>{/if}
        </div>
        <div class="controls">
          <button class="cb" onclick={goFirst} disabled={currentStep <= 0}>⟪ First</button>
          <button class="cb" onclick={goPrev} disabled={currentStep <= 0}>‹ Prev</button>
          <button class="cb" onclick={goNext} disabled={currentStep >= totalSteps - 1}>Next ›</button>
          <button class="cb" onclick={goLast} disabled={currentStep >= totalSteps - 1}>Last ⟫</button>
          <button class="cb auto-btn" onclick={toggleAutoPlay}>{isPlaying ? '⏸ Pause' : '⏵ Auto'}</button>
        </div>
        <div class="slider-row">
          <input type="range" class="slider" min="0" max={totalSteps - 1} value={currentStep} oninput={handleSlider} />
          <span class="step-count">Step {currentStep + 1} of {totalSteps}</span>
        </div>
      {/if}
    </div>

    <div class="state-side">
      {#if stepData}
        <div class="panel brain-panel">
          <div class="panel-head brain-head">
            <span class="panel-title">🧠 Inside the Engine</span>
            {#if stepData.phase === 'suspended'}<span class="async-badge">⏸ suspended</span>
            {:else if stepData.phase.startsWith('await')}<span class="async-badge">⏳ await</span>
            {:else if stepData.phase.startsWith('async')}<span class="async-badge">async</span>{/if}
          </div>
          <div class="brain-box" class:brain-done={stepData.done} class:brain-await={stepData.phase === 'await-start' || stepData.phase === 'suspended'} class:brain-resume={stepData.phase === 'await-resume'} class:brain-async={stepData.phase.startsWith('async-') || stepData.phase.startsWith('promise-')}>
            <pre class="brain-text">{stepData.brain}</pre>
          </div>
          {#if stepData.memLabel}<div class="mem-label">{stepData.memLabel}</div>{/if}
        </div>

        <!-- Call Stack & Event Loop side by side -->
        <div class="runtime-row">
          <div class="panel runtime-panel">
            <div class="panel-head"><span class="panel-title">Call Stack</span></div>
            <div class="stack-box">
              {#each [...stepData.callStack].reverse() as frame, i}
                <div class="stack-frame" class:stack-top={i === 0}>
                  <span class="stack-name">{frame}</span>
                  {#if i === 0}<span class="stack-arrow">← running</span>{/if}
                </div>
              {/each}
              {#if stepData.callStack.length === 0}
                <div class="stack-empty">empty (idle)</div>
              {/if}
            </div>
          </div>

          <div class="panel runtime-panel">
            <div class="panel-head"><span class="panel-title">Event Loop</span></div>
            <div class="event-box">
              {#if stepData.eventLoop.length > 0}
                {#each stepData.eventLoop as evt}
                  <div class="event-item">{evt}</div>
                {/each}
              {:else}
                <div class="event-empty">idle</div>
              {/if}
              {#if stepData.microTasks.length > 0}
                <div class="micro-label">Microtasks:</div>
                {#each stepData.microTasks as mt}
                  <div class="micro-item">{mt}</div>
                {/each}
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <!-- Variables -->
      <div class="panel">
        <div class="panel-head"><span class="panel-title">Frames</span></div>
        <div class="frame-box">
          {#if stepData && Object.keys(stepData.vars).length > 0}
            {#each Object.entries(stepData.vars) as [key, val]}
              <div class="var-row" class:var-flash={stepData.highlight === key}>
                <div class="var-left">
                  <span class="var-name">{key}</span>
                  <span class="var-type" style="color: {tc(val)}">{tb(val)}</span>
                </div>
                <span class="var-value" style="color: {tc(val)}">{fv(val)}</span>
              </div>
            {/each}
          {:else}
            <div class="var-empty">{hasRun ? 'No variables yet' : 'Click Visualize to start'}</div>
          {/if}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><span class="panel-title">Complexity Analysis</span></div>
        <div class="complexity-box">
          <div class="cx-row"><div class="cx-label">Time</div><div class="cx-badge cx-time">{currentComplexity.time}</div></div>
          <div class="cx-why">{currentComplexity.timeWhy}</div>
          <div class="cx-row"><div class="cx-label">Space</div><div class="cx-badge cx-space">{currentComplexity.space}</div></div>
          <div class="cx-why">{currentComplexity.spaceWhy}</div>
          {#if stepData}
            <div class="cx-live">⏳ {stepData.awaits} await{stepData.awaits !== 1 ? 's' : ''} · {stepData.promises} promise{stepData.promises !== 1 ? 's' : ''} · {stepData.memOps} write{stepData.memOps !== 1 ? 's' : ''}</div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  {#if errorMsg}<div class="error-bar">{errorMsg}</div>{/if}
</div>

<style>
  .module { width: 100%; height: 100%; display: flex; flex-direction: column; padding: 14px 18px; gap: 10px; overflow: hidden; font-family: 'Inter', 'SF Pro', system-ui, sans-serif; }
  .top-bar { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
  .back-link { font-size: 0.75rem; color: #555; text-decoration: none; }
  .back-link:hover { color: #cc88ff; }
  .title-group { display: flex; flex-direction: column; }
  h2 { font-size: 1.3rem; font-weight: 700; color: #e0e0e0; margin: 0; }
  .accent { color: #cc88ff; }
  .subtitle { font-weight: 400; font-size: 0.85rem; color: #555; }
  .desc { font-size: 0.65rem; color: #444; margin: 2px 0 0 0; }
  .examples-bar { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; flex-shrink: 0; }
  .examples-label { font-size: 0.65rem; color: #444; margin-right: 4px; }
  .ex-btn { background: #0d0d14; border: 1px solid #1a1a2e; border-radius: 4px; color: #666; font-size: 0.7rem; padding: 3px 10px; cursor: pointer; font-family: inherit; transition: all 0.2s; }
  .ex-btn:hover { border-color: #cc88ff44; color: #aaa; }
  .ex-btn.active { border-color: #cc88ff66; color: #cc88ff; background: #cc88ff10; }
  .main-layout { flex: 1; display: flex; gap: 14px; min-height: 0; overflow: hidden; }
  .code-side { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .state-side { width: 340px; flex-shrink: 0; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
  .panel-head { display: flex; justify-content: space-between; align-items: center; padding: 5px 10px; background: #111118; border: 1px solid #1a1a2e; border-radius: 6px 6px 0 0; font-size: 0.65rem; color: #777; letter-spacing: 0.5px; text-transform: uppercase; }
  .panel-actions { display: flex; gap: 6px; }
  .run-btn { background: #cc88ff; color: #0a0a0f; border: none; border-radius: 4px; padding: 3px 12px; font-family: inherit; font-size: 0.65rem; font-weight: 700; cursor: pointer; transition: background 0.2s; }
  .run-btn:hover { background: #b070dd; }
  .edit-btn { background: transparent; color: #666; border: 1px solid #1a1a2e; border-radius: 4px; padding: 3px 10px; font-family: inherit; font-size: 0.65rem; cursor: pointer; }
  .edit-btn:hover { color: #aaa; border-color: #333; }
  .code-editor { flex: 1; background: #0a0a12; border: 1px solid #1a1a2e; border-top: none; border-radius: 0 0 6px 6px; color: #e0e0e0; font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; font-size: 0.85rem; line-height: 1.8; padding: 10px 14px; resize: none; outline: none; tab-size: 2; }
  .code-display { flex: 1; background: #0a0a12; border: 1px solid #1a1a2e; border-top: none; border-radius: 0 0 6px 6px; padding: 6px 0; overflow-y: auto; font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; font-size: 0.85rem; line-height: 1.8; }
  .code-line { display: flex; align-items: center; padding: 0 10px 0 0; transition: background 0.25s; min-height: 1.8em; }
  .line-executed { background: #cc88ff18; }
  .line-next { background: #ff446612; }
  .line-await { background: #ffcc6625; }
  .line-resume { background: #00ff8825; }
  .ln { width: 30px; text-align: right; color: #2a2a3e; font-size: 0.72rem; padding-right: 4px; flex-shrink: 0; user-select: none; }
  .arrow-col { width: 20px; text-align: center; flex-shrink: 0; }
  .arr-exec { color: #cc88ff; font-size: 0.7rem; }
  .arr-next { color: #ff4466; font-size: 0.7rem; }
  .arr-none { opacity: 0; }
  .line-text { white-space: pre; color: #ccc; }
  .legend-bar { display: flex; gap: 14px; padding: 2px 6px; flex-shrink: 0; align-items: center; }
  .leg { font-size: 0.6rem; color: #444; display: flex; align-items: center; gap: 4px; }
  .suspended-badge { color: #ffcc66; background: #ffcc6612; padding: 1px 8px; border-radius: 3px; border: 1px solid #ffcc6633; }
  .controls { display: flex; gap: 4px; flex-shrink: 0; }
  .cb { background: #0d0d14; border: 1px solid #1a1a2e; border-radius: 4px; color: #999; font-family: inherit; font-size: 0.7rem; padding: 5px 10px; cursor: pointer; transition: all 0.15s; }
  .cb:hover:not(:disabled) { border-color: #cc88ff44; color: #eee; }
  .cb:disabled { opacity: 0.25; cursor: default; }
  .auto-btn { color: #cc88ff; border-color: #cc88ff33; }
  .slider-row { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .slider { flex: 1; accent-color: #cc88ff; }
  .step-count { font-size: 0.7rem; color: #555; white-space: nowrap; }
  .panel { border-radius: 6px; overflow: hidden; }
  .brain-head { background: #12121f; }
  .async-badge { font-size: 0.55rem; color: #cc88ff; background: #cc88ff15; padding: 1px 6px; border-radius: 3px; }
  .brain-box { background: #0a0a12; border: 1px solid #1a1a2e; border-top: none; padding: 10px 12px; transition: all 0.3s; }
  .brain-text { font-size: 0.75rem; line-height: 1.6; color: #bbb; white-space: pre-wrap; word-wrap: break-word; font-family: 'Inter', system-ui, sans-serif; margin: 0; }
  .brain-done { border-color: #88aaff33; background: #88aaff08; }
  .brain-done .brain-text { color: #aabbff; }
  .brain-await { border-color: #ffcc6633; background: #ffcc6608; }
  .brain-await .brain-text { color: #ffe099; }
  .brain-resume { border-color: #00ff8833; background: #00ff8808; }
  .brain-resume .brain-text { color: #88ffbb; }
  .brain-async { border-color: #cc88ff33; background: #cc88ff08; }
  .brain-async .brain-text { color: #ddaaff; }
  .mem-label { background: #08080e; border: 1px solid #1a1a2e; border-top: none; padding: 5px 10px; font-size: 0.6rem; color: #555; font-family: 'SF Mono', monospace; letter-spacing: 0.3px; }
  .runtime-row { display: flex; gap: 6px; }
  .runtime-panel { flex: 1; min-width: 0; }
  .stack-box { background: #0a0a12; border: 1px solid #1a1a2e; border-top: none; padding: 6px 8px; display: flex; flex-direction: column; gap: 3px; min-height: 40px; }
  .stack-frame { display: flex; justify-content: space-between; align-items: center; padding: 3px 6px; border-radius: 3px; border: 1px solid #1a1a2e; font-size: 0.65rem; transition: all 0.3s; }
  .stack-top { border-color: #cc88ff44; background: #cc88ff10; }
  .stack-name { color: #ccc; font-weight: 600; font-family: 'SF Mono', monospace; font-size: 0.65rem; }
  .stack-arrow { font-size: 0.5rem; color: #cc88ff; }
  .stack-empty { font-size: 0.6rem; color: #2a2a3e; padding: 4px; }
  .event-box { background: #0a0a12; border: 1px solid #1a1a2e; border-top: none; padding: 6px 8px; min-height: 40px; }
  .event-item { font-size: 0.6rem; color: #ffcc66; padding: 2px 6px; background: #ffcc6610; border-radius: 3px; margin-bottom: 2px; font-family: 'SF Mono', monospace; }
  .event-empty { font-size: 0.6rem; color: #2a2a3e; padding: 4px; }
  .micro-label { font-size: 0.5rem; color: #444; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
  .micro-item { font-size: 0.6rem; color: #cc88ff; padding: 2px 6px; background: #cc88ff10; border-radius: 3px; margin-bottom: 2px; font-family: 'SF Mono', monospace; }
  .frame-box { background: #0a0a12; border: 1px solid #1a1a2e; border-top: none; padding: 8px 10px; }
  .var-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; border-radius: 4px; transition: all 0.35s; margin-bottom: 2px; }
  .var-flash { background: #cc88ff18; box-shadow: inset 3px 0 0 #cc88ff; }
  .var-left { display: flex; align-items: center; gap: 6px; }
  .var-name { font-size: 0.8rem; color: #88aaff; font-weight: 600; font-family: 'SF Mono', monospace; }
  .var-type { font-size: 0.55rem; padding: 1px 5px; border-radius: 3px; background: #ffffff08; }
  .var-value { font-size: 0.8rem; font-weight: 600; font-family: 'SF Mono', monospace; }
  .var-empty { font-size: 0.72rem; color: #2a2a3e; padding: 10px 4px; }
  .complexity-box { background: #0a0a12; border: 1px solid #1a1a2e; border-top: none; padding: 10px 12px; }
  .cx-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  .cx-label { font-size: 0.72rem; color: #888; }
  .cx-badge { font-size: 0.75rem; font-weight: 700; padding: 2px 10px; border-radius: 4px; font-family: 'SF Mono', monospace; }
  .cx-time { color: #ffcc66; background: #ffcc6612; border: 1px solid #ffcc6633; }
  .cx-space { color: #88aaff; background: #88aaff12; border: 1px solid #88aaff33; }
  .cx-why { font-size: 0.65rem; color: #555; margin-bottom: 10px; line-height: 1.5; }
  .cx-live { margin-top: 8px; padding-top: 8px; border-top: 1px solid #1a1a2e; font-size: 0.6rem; color: #cc88ff88; }
  .error-bar { background: #ff446612; border: 1px solid #ff446633; border-radius: 4px; color: #ff6644; font-size: 0.78rem; padding: 8px 12px; flex-shrink: 0; }
  @media (max-width: 800px) { .main-layout { flex-direction: column; overflow-y: auto; } .state-side { width: 100%; } .module { padding: 10px; } .runtime-row { flex-direction: column; } }
</style>
