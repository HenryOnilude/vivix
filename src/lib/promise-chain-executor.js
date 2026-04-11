/**
 * promise-chain-executor.js
 *
 * Simulates .then() / .catch() / .finally() promise chains instruction by
 * instruction, tracking each step through the microtask queue.
 *
 * Returns an array of step objects consumed by ModuleShell + PromiseChain.svelte.
 */

import { dc } from './utils.js';

export function executePromiseChainCode(code) {
  const lines = code.split('\n');
  const steps = [];
  let memOps = 0, thenCount = 0, catchCount = 0;
  const output = [];
  const vars = {};
  let promises = [];   // [{id, label, state, value, method}]
  let microTasks = []; // strings describing queued callbacks
  let currentValue = undefined;
  let isRejected = false;

  function snap(li, ni, phase, brain, memLabel) {
    steps.push({
      lineIndex: li, nextLineIndex: ni,
      vars: dc(vars), output: [...output],
      phase, brain, memLabel,
      memOps, thenCount, catchCount,
      promises: promises.map(p => ({ ...p })),
      microTasks: [...microTasks],
      currentValue,
      isRejected,
    });
  }

  snap(-1, 0, 'start',
    'Promise chain execution begins.\n\nKey concepts:\n  • .then() registers a microtask callback\n  • Microtasks run after all synchronous code finishes\n  • Each .then() returns a NEW Promise — enabling chaining\n  • Values flow through the chain as return values\n  • .catch() handles any rejection in the chain above it\n\nEngine ready. Call stack: [Global]',
    'Ready | Microtask queue: empty'
  );

  let li = 0;
  while (li < lines.length) {
    const raw = lines[li];
    const ln = raw.trim();

    if (!ln || ln.startsWith('//') || ln === '{' || ln === '}') { li++; continue; }

    // Collect multi-line chain (lines that continue with . or trailing operator)
    let chainStr = ln;
    let chainEnd = li;
    while (chainEnd + 1 < lines.length) {
      const next = lines[chainEnd + 1].trim();
      const cur  = lines[chainEnd].trimEnd();
      if (next.startsWith('.') || cur.endsWith('+') || cur.endsWith(',') || cur.endsWith('(')) {
        chainStr += ' ' + next;
        chainEnd++;
      } else break;
    }

    // Variable declaration prefix
    const varDecl = chainStr.match(/^(let|const|var)\s+(\w+)\s*=\s*/);
    const varName  = varDecl ? varDecl[2] : null;
    const rhs      = varDecl ? chainStr.slice(varDecl[0].length) : chainStr;

    // ── Promise.resolve / Promise.reject ────────────────────────────────────
    const resolveM = rhs.match(/Promise\.resolve\((.+?)\)/);
    const rejectM  = rhs.match(/Promise\.reject\((.+?)\)/);

    if (resolveM || rejectM) {
      const isRej    = !!rejectM;
      const rawArg   = isRej ? rejectM[1] : resolveM[1];
      const cleanArg = rawArg.trim().replace(/^['"`]|['"`]$/g, '');
      memOps++;
      const pid = promises.length;
      promises.push({ id: pid, label: `P${pid + 1}`, state: isRej ? 'rejected' : 'resolved', value: cleanArg, method: isRej ? 'reject' : 'resolve' });
      currentValue = cleanArg;
      isRejected   = isRej;
      if (varName) vars[varName] = `Promise {${isRej ? 'rejected' : 'resolved'}: ${cleanArg}}`;

      snap(li, li + 1,
        isRej ? 'promise-reject' : 'promise-resolve',
        isRej
          ? `Promise.reject(${rawArg})\n\nCreates a Promise that is ALREADY REJECTED with reason: "${cleanArg}".\n\nAll .then() callbacks in the chain will be SKIPPED.\nExecution jumps to the nearest .catch() handler.\n\nKey: rejections propagate down the chain automatically — you don't need to explicitly re-throw.`
          : `Promise.resolve(${rawArg})\n\nCreates a Promise that is ALREADY RESOLVED with value: ${cleanArg}.\n\nNo async work — it settles synchronously.\nThe value ${cleanArg} will flow into the first .then() callback as its argument.\n\nMemory write #${memOps}: Promise object allocated on heap.`,
        isRej
          ? `REJECT: P${pid + 1} reason="${cleanArg}" | Searching for .catch()`
          : `RESOLVE: P${pid + 1} = ${cleanArg} | Write #${memOps}`
      );
    }

    // ── Generic function call returning a promise (e.g. fetchUser()) ─────────
    const fnCallM = !resolveM && !rejectM && rhs.match(/^(\w+)\s*\(([^)]*)\)\s*(?:;|$)/);
    if (fnCallM && fnCallM[1] !== 'console') {
      const fnName = fnCallM[1];
      const fnArgs = fnCallM[2];
      memOps++;
      const pid = promises.length;
      promises.push({ id: pid, label: `P${pid + 1}`, state: 'pending', value: '…', method: fnName });
      if (varName) vars[varName] = 'Promise {pending}';
      snap(li, li + 1, 'promise-call',
        `${fnName}(${fnArgs})\n\nThis function returns a Promise.\n\nThe Promise starts as PENDING — it hasn't resolved or rejected yet.\nThe engine continues executing synchronously while waiting.\n\nWhen the Promise settles, the .then() callback will be queued as a microtask.\nHeap write #${memOps}: Promise object allocated.`,
        `CALL: ${fnName}() → Promise {pending} | P${pid + 1}`
      );
    }

    // ── .then() handlers ────────────────────────────────────────────────────
    const thenRe = /\.then\(\s*(\w+)\s*=>\s*([^)]+(?:\([^)]*\))?[^)]*)\)/g;
    let thenM;
    while ((thenM = thenRe.exec(chainStr)) !== null) {
      const param = thenM[1];
      const body  = thenM[2].trim();

      if (isRejected) {
        snap(li, chainEnd + 1, 'then-skip',
          `.then(${param} => ${body})\n\nThis .then() is SKIPPED.\n\nThe chain is currently REJECTED — .then() callbacks are bypassed.\nThe rejection propagates forward until a .catch() handles it.\n\nThis is by design: you should never silently swallow errors.`,
          `SKIP .then() | Chain rejected — propagating to .catch()`
        );
        continue;
      }

      thenCount++;
      const mtLabel = `then#${thenCount}`;
      microTasks.push(`${mtLabel}: ${param} ⇒ ${body.length > 22 ? body.slice(0, 22) + '…' : body}`);

      snap(li, chainEnd + 1, 'then-queue',
        `.then(${param} => ${body})\n\nQueued as MICROTASK (then#${thenCount}).\n\nThis callback is NOT running yet — it sits in the microtask queue.\nIt runs when:\n  1. The current synchronous code finishes\n  2. The previous Promise has resolved\n  3. The JS engine drains the microtask queue\n\nReceives: ${currentValue !== undefined ? currentValue : '(pending value)'}`,
        `QUEUE: ${mtLabel} | Microtasks: [${microTasks.join(' | ')}]`
      );

      // Fire the microtask
      microTasks.shift();
      const prevValue = currentValue;

      // Evaluate expression
      let result;
      const isLog = body.includes('console.log');

      if (isLog) {
        const logArg = body.match(/console\.log\((.+?)\)/)?.[1] || param;
        const outVal = logArg.trim() === param ? prevValue : logArg.replace(/^['"`]|['"`]$/g, '');
        output.push(String(outVal));
        result = undefined;
        snap(li, chainEnd + 1, 'then-run',
          `MICROTASK FIRES: then#${thenCount}\n\n${param} = ${prevValue}\nconsole.log(${logArg}) → "${outVal}"\n\nThis callback returns undefined — it's a terminal handler.\nChain settles as resolved(undefined). No further .then() needed.`,
          `FIRE: ${mtLabel} | Output: "${outVal}" | Chain ends`
        );
      } else {
        // Arithmetic
        const arith = body.match(/(\w+)\s*([+\-*\/])\s*(.+)/);
        if (arith && arith[1] === param && !isNaN(Number(prevValue)) && !isNaN(Number(arith[3]))) {
          const [, , op, rh] = arith;
          const l = Number(prevValue), r = Number(rh);
          if (op === '+') result = l + r;
          else if (op === '-') result = l - r;
          else if (op === '*') result = l * r;
          else if (op === '/') result = l / r;
        }
        // String concat
        if (result === undefined) {
          const sc1 = body.match(/(['"`])(.+?)\1\s*\+\s*(\w+)/);
          const sc2 = body.match(/(\w+)\s*\+\s*(['"`])(.+?)['"`]/);
          if (sc1 && sc1[3] === param) result = sc1[2] + String(prevValue);
          else if (sc2 && sc2[1] === param) result = String(prevValue) + sc2[3];
        }
        // Property access / method
        if (result === undefined) {
          const prop = body.match(/(\w+)\.(\w+)(?:\(\))?/);
          if (prop && prop[1] === param) result = `${prevValue}.${prop[2]}`;
        }
        // Fallback: substitute param with value
        if (result === undefined) {
          result = body.replace(new RegExp(`\\b${param}\\b`, 'g'), String(prevValue));
        }

        memOps++;
        const pid = promises.length;
        promises.push({ id: pid, label: `P${pid + 1}`, state: 'resolved', value: String(result), method: 'then' });
        currentValue = String(result);

        snap(li, chainEnd + 1, 'then-run',
          `MICROTASK FIRES: then#${thenCount}\n\n${param} = ${prevValue} (from P${pid})\nExpression: ${body}\nResult: ${result}\n\nReturn value becomes the resolved value of a NEW Promise: P${pid + 1}.\nThe next .then() will receive: ${result}\n\nHeap write #${memOps}: P${pid + 1} allocated.`,
          `FIRE: ${mtLabel} | P${pid + 1} = ${result} | Write #${memOps}`
        );
      }
    }

    // ── .catch() handler ────────────────────────────────────────────────────
    const catchM = chainStr.match(/\.catch\(\s*(\w+)\s*=>\s*([^)]+(?:\([^)]*\))?[^)]*)\)/);
    if (catchM) {
      catchCount++;
      const param = catchM[1];
      const body  = catchM[2].trim();

      if (isRejected) {
        const reason = currentValue;
        let catchResult;
        if (body.includes('console.log')) {
          output.push(String(reason));
          catchResult = undefined;
        } else if (/^['"`]/.test(body)) {
          catchResult = body.replace(/^['"`]|['"`]$/g, '');
        } else {
          catchResult = body.replace(new RegExp(`\\b${param}\\b`, 'g'), String(reason));
        }

        isRejected   = false;
        currentValue = catchResult !== undefined ? String(catchResult) : undefined;
        memOps++;
        if (currentValue !== undefined) {
          const pid = promises.length;
          promises.push({ id: pid, label: `P${pid + 1}`, state: 'resolved', value: currentValue, method: 'catch' });
        }
        snap(li, chainEnd + 1, 'catch-run',
          `.catch(${param} => ${body})\n\nERROR CAUGHT!\n\n${param} = "${reason}" (the rejection reason)\nExpression: ${body}${catchResult !== undefined ? '\nResult: ' + catchResult : '\n→ output logged'}\n\n.catch() RECOVERS the chain — rejection is handled.\nThe chain continues as RESOLVED${catchResult !== undefined ? ' with: ' + catchResult : ' (undefined)'}.`,
          `CATCH: "${reason}" handled | Chain recovered`
        );
      } else {
        snap(li, chainEnd + 1, 'catch-skip',
          `.catch(${param} => ${body})\n\nThis .catch() is SKIPPED.\n\nThe chain is currently RESOLVED — no rejection to handle.\n.catch() only fires when a Promise rejects.\n\nThe chain continues past this handler unchanged.`,
          `SKIP .catch() | Chain is resolved — no error`
        );
      }
    }

    // ── .finally() ──────────────────────────────────────────────────────────
    const finallyM = chainStr.match(/\.finally\((\(\))?\s*=>\s*([^)]+)\)/);
    if (finallyM) {
      const body = finallyM[2].trim();
      snap(li, chainEnd + 1, 'finally-run',
        `.finally(() => ${body})\n\nFINALLY always runs — resolved or rejected.\n\nUsed for cleanup code that must execute regardless of success or failure.\nDoes NOT receive the value or rejection reason.\n\nThe chain continues with the SAME state (resolved/rejected) as before finally.`,
        `FINALLY: cleanup | State unchanged after`
      );
    }

    li = chainEnd + 1;
  }

  snap(lines.length - 1, -1, 'done',
    `Promise chain complete.\n\n${thenCount} .then() microtask${thenCount !== 1 ? 's' : ''} executed\n${catchCount} .catch() handler${catchCount !== 1 ? 's' : ''} ${isRejected ? 'skipped (rejection unhandled)' : 'processed'}\n${memOps} memory writes\n${output.length > 0 ? 'Output: ' + output.map(o => '"' + o + '"').join(', ') : 'No console output'}\n\nMicrotask queue: empty.\nEvent loop is free for the next task.`,
    `DONE | ${thenCount} thens | ${promises.length} Promises | Microtasks: empty`
  );

  return steps;
}
