/**
 * api-calls-executor.js
 *
 * Simulates fetch() / await / res.json() API call lifecycle instruction by
 * instruction, tracking each network phase on the heap and call stack.
 *
 * Returns step objects consumed by ModuleShell + ApiCalls.svelte.
 */

import { dc } from './utils.js';

export function executeApiCallsCode(code) {
  const lines = code.split('\n');
  const steps = [];
  let memOps = 0, awaits = 0, fetchCount = 0;
  const output = [];
  const vars = {};
  let requests = [];  // [{id, method, url, state, status, data}]
  let callStack = ['Global'];
  let microTasks = [];

  function snap(li, ni, phase, brain, memLabel) {
    steps.push({
      lineIndex: li, nextLineIndex: ni,
      vars: dc(vars), output: [...output],
      phase, brain, memLabel,
      memOps, awaits, fetchCount,
      requests: requests.map(r => ({ ...r })),
      callStack: [...callStack],
      microTasks: [...microTasks],
    });
  }

  snap(-1, 0, 'start',
    'API call execution begins.\n\nKey concepts:\n  • fetch() returns a Promise — it does NOT block the thread\n  • await suspends the current function, freeing the event loop\n  • Two awaits needed: fetch() for the Response, res.json() for the body\n  • Network errors throw at the fetch() level\n  • HTTP errors (4xx/5xx) do NOT throw — check res.ok\n\nEngine ready. Call stack: [Global]',
    'Ready · stack: [Global]'
  );

  let li = 0;
  while (li < lines.length) {
    const raw = lines[li];
    const ln  = raw.trim();

    if (!ln || ln.startsWith('//') || ln === '{' || ln === '}') { li++; continue; }

    // Collect multi-line chains
    let chainStr = ln;
    let chainEnd = li;
    while (chainEnd + 1 < lines.length) {
      const next = lines[chainEnd + 1].trim();
      const cur  = lines[chainEnd].trimEnd();
      if (next.startsWith('.') || cur.endsWith('+') || cur.endsWith(',')) {
        chainStr += ' ' + next;
        chainEnd++;
      } else break;
    }

    // ── async function declaration ─────────────────────────────────────────
    const asyncFnM = ln.match(/^async\s+function\s+(\w+)\s*\(([^)]*)\)/);
    if (asyncFnM) {
      const [, fnName, params] = asyncFnM;
      // Find end of function block
      let depth = 0, fnEnd = li;
      for (let i = li; i < lines.length; i++) {
        for (const c of lines[i]) { if (c === '{') depth++; if (c === '}') depth--; }
        if (depth === 0 && i > li) { fnEnd = i; break; }
      }

      snap(li, li + 1, 'async-declare',
        `async function ${fnName}(${params})\n\nDeclares an async function.\n\n"async" means:\n  1. Always returns a Promise (even if you return a plain value)\n  2. Inside, you can use "await" to pause execution\n  3. When paused, the event loop can process other tasks\n\nThe function is registered — NOT called yet.`,
        `REGISTER: async ${fnName}()`
      );
      li++; continue;
    }

    // ── function call (invoke an async fn) ────────────────────────────────
    const fnCallM = ln.match(/^(\w+)\s*\(([^)]*)\)\s*;?$/);
    if (fnCallM && !ln.includes('console') && !ln.includes('fetch') && !ln.includes('await') && !ln.includes('return')) {
      const [, fnName, args] = fnCallM;
      callStack.push(fnName);
      snap(li, li + 1, 'async-call',
        `${fnName}(${args})\n\nCalls the async function "${fnName}".\n\nA new stack frame is pushed: "${fnName}".\nExecution enters the function body synchronously until the first "await" is encountered.`,
        `CALL: ${fnName}() | Stack: [${callStack.join(' → ')}]`
      );
      li++; continue;
    }

    // ── const res = await fetch(url, options?) ─────────────────────────────
    const fetchM = chainStr.match(/(?:const|let|var)\s+(\w+)\s*=\s*await\s+fetch\(['"`]([^'"`]+)['"`](?:,\s*(\{[\s\S]+?\}))?\)/);
    if (fetchM) {
      const [, resVar, url, optStr] = fetchM;
      const method = optStr?.match(/method\s*:\s*['"`](\w+)['"`]/)?.[1]?.toUpperCase() || 'GET';
      const hasBody = !!optStr?.match(/body\s*:/);

      fetchCount++;
      awaits++;
      memOps++;

      const reqId = requests.length;
      requests.push({ id: reqId, method, url, state: 'sending', status: null, data: null });

      snap(li, chainEnd + 1, 'fetch-call',
        `fetch('${url}'${method !== 'GET' ? ", { method: '" + method + "'" + (hasBody ? ', body: ...' : '') + ' }' : ''})\n\nSends a ${method} HTTP request to: ${url}\n\nfetch() returns a Promise — the function SUSPENDS at "await".\nThe call stack frame is preserved but paused.\nThe event loop can now handle other tasks while waiting for the network.\n\nRequest is in-flight. Heap write #${memOps}: fetch Promise allocated.`,
        `FETCH: ${method} ${url} | Suspended — waiting for response`
      );

      // Response received
      requests[reqId].state = 'received';
      const statusCode = url.includes('error') || url.includes('fail') ? 404 : 200;
      const statusOk   = statusCode < 400;
      requests[reqId].status = statusCode;
      memOps++;
      vars[resVar] = `Response { ok: ${statusOk}, status: ${statusCode} }`;

      snap(li, chainEnd + 1, 'fetch-response',
        `Response received: ${statusCode} ${statusOk ? 'OK' : 'Not Found'}\n\nThe network returned a Response object. Function RESUMES.\n\nResponse object written to heap:\n  ${resVar}.ok = ${statusOk}\n  ${resVar}.status = ${statusCode}\n  ${resVar}.headers = { Content-Type: 'application/json' }\n\n⚠ Important: fetch() does NOT throw on HTTP errors (4xx/5xx).\nAlways check res.ok before calling res.json().\n\nHeap write #${memOps}: Response object allocated.`,
        `RESPONSE: ${statusCode} | ${resVar}.ok = ${statusOk} | Write #${memOps}`
      );

      li = chainEnd + 1; continue;
    }

    // ── const data = await res.json() ────────────────────────────────────
    const jsonM = chainStr.match(/(?:const|let|var)\s+(\w+)\s*=\s*await\s+(\w+)\.json\(\)/);
    if (jsonM) {
      const [, dataVar, resVar] = jsonM;
      awaits++;
      memOps++;

      // Find the associated request
      const req = requests[requests.length - 1];
      if (req) req.state = 'parsing';

      snap(li, chainEnd + 1, 'json-parse',
        `await ${resVar}.json()\n\nParses the HTTP response body as JSON.\n\nThis is ANOTHER await — the function suspends again.\nParsing the body stream is async because the body may arrive in chunks.\n\nInternally:\n  1. Reads the response body stream\n  2. Decodes bytes → string (UTF-8)\n  3. JSON.parse() → JavaScript object\n  4. Returns the parsed value\n\nHeap write #${memOps}: parsed response object allocated.`,
        `PARSE: ${resVar}.json() | Awaiting body stream…`
      );

      // Body parsed
      if (req) req.state = 'parsed';
      const mockData = req?.url.includes('user')
        ? '{ name: "Alex", id: 1 }'
        : req?.url.includes('post')
          ? '{ id: 1, title: "Hello" }'
          : '{ ok: true }';
      if (req) req.data = mockData;
      memOps++;
      vars[dataVar] = mockData;

      snap(li, chainEnd + 1, 'json-done',
        `${dataVar} = ${mockData}\n\nJSON parsed. Function RESUMES.\n\n${dataVar} now holds the parsed JavaScript object on the heap.\n\nHeap write #${memOps}: ${dataVar} allocated as object.\n\nNow you can access properties: ${dataVar}.name, ${dataVar}.id, etc.`,
        `JSON: ${dataVar} = ${mockData} | Write #${memOps}`
      );

      li = chainEnd + 1; continue;
    }

    // ── await res.text() ──────────────────────────────────────────────────
    const textM = chainStr.match(/(?:const|let|var)\s+(\w+)\s*=\s*await\s+(\w+)\.text\(\)/);
    if (textM) {
      const [, dataVar, resVar] = textM;
      awaits++;
      memOps++;
      vars[dataVar] = '"response body string"';
      snap(li, chainEnd + 1, 'text-parse',
        `await ${resVar}.text()\n\nReads the response body as plain text (not JSON).\n\nUseful when the server returns HTML, CSV, or plain text.\nLike .json(), this is async — it awaits the full body stream.\n\nHeap write #${memOps}: string allocated.`,
        `TEXT: ${dataVar} = (body string) | Write #${memOps}`
      );
      li = chainEnd + 1; continue;
    }

    // ── if (!res.ok) / res.ok check ──────────────────────────────────────
    const resOkM = ln.match(/if\s*\(\s*!?\s*(\w+)\.ok\s*\)/);
    if (resOkM) {
      const resVar = resOkM[1];
      const req = requests.find(r => vars[resVar]?.includes('ok: true') || vars[resVar]?.includes('ok: false'));
      const isOk = vars[resVar]?.includes('ok: true');
      snap(li, li + 1, 'check-ok',
        `if (!${resVar}.ok)\n\nChecks the HTTP status code.\n\n${resVar}.ok = ${isOk}\n  → ok is true when status is 200–299\n  → ok is false for 4xx/5xx errors\n\nBest practice: always check res.ok before parsing.\nfetch() only rejects on network failure — not on 4xx/5xx.\n\nBranch taken: ${isOk ? 'condition is false → skip error handling' : 'condition is true → throw error'}`,
        `CHECK: ${resVar}.ok = ${isOk} | ${isOk ? 'Response valid' : 'HTTP error!'}`
      );
      li++; continue;
    }

    // ── try { ─────────────────────────────────────────────────────────────
    if (ln === 'try {' || ln.match(/^try\s*\{/)) {
      snap(li, li + 1, 'try-start',
        `try {\n\nEnters a try block.\n\nAny errors thrown inside (including rejected fetch Promises) will be caught.\n\nFor API calls, a try/catch handles:\n  • Network failures (no internet, DNS error) → TypeError\n  • Explicit throws (e.g. throw new Error for bad status)\n  • JSON parse errors (malformed response body)`,
        `TRY: error boundary open`
      );
      li++; continue;
    }

    // ── } catch (e) { ─────────────────────────────────────────────────────
    const catchM = ln.match(/^\}\s*catch\s*\((\w+)\)\s*\{/);
    if (catchM) {
      snap(li, li + 1, 'catch-start',
        `} catch (${catchM[1]}) {\n\nCatch block — handles errors from the try block.\n\nCommon errors in API calls:\n  • TypeError: Failed to fetch — network error\n  • SyntaxError — malformed JSON in response body\n  • Custom errors from !res.ok check\n\n${catchM[1]}.message contains the error description.`,
        `CATCH: error boundary active`
      );
      li++; continue;
    }

    // ── throw new Error ────────────────────────────────────────────────────
    const throwM = ln.match(/throw\s+new\s+Error\(['"`](.+?)['"`]\)/);
    if (throwM) {
      snap(li, li + 1, 'throw',
        `throw new Error('${throwM[1]}')\n\nThrows an Error explicitly.\n\nThis is common after an !res.ok check:\n  if (!res.ok) throw new Error('HTTP ' + res.status)\n\nThe error propagates up the call stack until caught.\nIf not caught: unhandled promise rejection.`,
        `THROW: "${throwM[1]}"`
      );
      li++; continue;
    }

    // ── return ─────────────────────────────────────────────────────────────
    const retM = ln.match(/^return\s+(.+);?$/);
    if (retM) {
      const retVal = retM[1].trim();
      const resolved = vars[retVal] || retVal;
      if (callStack.length > 1) callStack.pop();
      snap(li, li + 1, 'return',
        `return ${retVal}\n\nReturns ${resolved} from the async function.\n\nThe function's outer Promise resolves with this value.\nThe call stack frame is popped.\n\nThe caller (if awaiting) resumes with the returned value.`,
        `RETURN: ${resolved} | Stack: [${callStack.join(' → ')}]`
      );
      li++; continue;
    }

    // ── console.log ────────────────────────────────────────────────────────
    const logM = ln.match(/console\.log\((.+?)\)/);
    if (logM) {
      const arg    = logM[1].trim();
      const dotM   = arg.match(/(\w+)\.(\w+)/);
      let outVal;
      if (dotM && vars[dotM[1]]) {
        const propMatch = vars[dotM[1]].match(new RegExp(`${dotM[2]}:\\s*['"]?([^,'"}]+)['"]?`));
        outVal = propMatch ? propMatch[1] : `${vars[dotM[1]]}.${dotM[2]}`;
      } else {
        outVal = vars[arg] !== undefined ? vars[arg] : arg.replace(/^['"`]|['"`]$/g, '');
      }
      output.push(String(outVal));
      snap(li, li + 1, 'log',
        `console.log(${arg})\n\n→ "${outVal}"`,
        `OUTPUT: "${outVal}"`
      );
      li++; continue;
    }

    li++;
  }

  snap(lines.length - 1, -1, 'done',
    `API call sequence complete.\n\n${fetchCount} fetch() request${fetchCount !== 1 ? 's' : ''} made\n${awaits} await${awaits !== 1 ? 's' : ''} resolved\n${memOps} memory writes\n${output.length > 0 ? 'Output: ' + output.map(o => '"' + o + '"').join(', ') : 'No console output'}\n\nCall stack: [Global]\nAll Promises settled. Event loop: idle.`,
    `DONE | ${fetchCount} fetches | ${awaits} awaits | ${memOps} writes`
  );

  return steps;
}
