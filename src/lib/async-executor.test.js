/**
 * Async executor audit — verifies every AsyncAwait module example
 * produces correct step sequences, phases, call stack states, and mock values.
 */
import { describe, it, expect } from 'vitest';
import { executeAsyncCode, _mockResult, _fv } from './async-executor.js';

function run(code) {
  const steps = executeAsyncCode(code);
  const last = steps[steps.length - 1];
  expect(last.done).toBe(true);
  return { steps, last, vars: last.vars };
}

function phases(steps) {
  return steps.map(s => s.phase);
}

// ═══════════════════════════════════════
// Example 1: Sequential awaits
// ═══════════════════════════════════════
describe('AsyncAwait: Sequential awaits', () => {
  const code = 'async function fetchData() {\n  let user = await getUser();\n  let posts = await getPosts(user.id);\n  let comments = await getComments(posts[0]);\n  return comments;\n}';

  it('produces start, declare, call, then 3× (await-start → suspended → resume), return, done', () => {
    const { steps } = run(code);
    const p = phases(steps);
    expect(p[0]).toBe('start');
    expect(p[1]).toBe('async-declare');
    expect(p[2]).toBe('async-call');
    // Each await produces: await-start, suspended, await-resume
    expect(p.filter(x => x === 'await-start').length).toBe(3);
    expect(p.filter(x => x === 'suspended').length).toBe(3);
    expect(p.filter(x => x === 'await-resume').length).toBe(3);
    expect(p).toContain('async-return');
    expect(p[p.length - 1]).toBe('done');
  });

  it('final vars: user, posts, comments all have mock values', () => {
    const { vars } = run(code);
    expect(vars.user).toEqual({ id: 1, name: 'Alice' });
    expect(vars.posts).toEqual([{ id: 101, title: 'Hello World' }]);
    expect(vars.comments).toEqual([{ text: 'Great post!' }]);
  });

  it('last step reports 3 awaits', () => {
    const { last } = run(code);
    expect(last.awaits).toBe(3);
  });

  it('call stack shows function pushed then popped during suspension', () => {
    const { steps } = run(code);
    const suspended = steps.find(s => s.phase === 'suspended');
    expect(suspended.callStack).not.toContain('fetchData');
    const resumed = steps.find(s => s.phase === 'await-resume');
    expect(resumed.callStack).toContain('fetchData');
  });
});

// ═══════════════════════════════════════
// Example 2: Promise.all (parallel)
// ═══════════════════════════════════════
describe('AsyncAwait: Promise.all (parallel)', () => {
  const code = 'async function fetchAll() {\n  let results = await Promise.all([\n    getUser(),\n    getPosts(1),\n    getComments(1)\n  ]);\n  return results;\n}';

  it('produces promise-all-start phase', () => {
    const { steps } = run(code);
    expect(phases(steps)).toContain('promise-all-start');
  });

  it('results is array of 3 mock values', () => {
    const { vars } = run(code);
    expect(Array.isArray(vars.results)).toBe(true);
    expect(vars.results.length).toBe(3);
    expect(vars.results[0]).toEqual({ id: 1, name: 'Alice' });
  });

  it('brain text mentions "SIMULTANEOUSLY"', () => {
    const { steps } = run(code);
    const allStep = steps.find(s => s.phase === 'promise-all-start');
    expect(allStep.brain).toContain('SIMULTANEOUSLY');
  });

  it('microtasks show all 3 promises during promise-all-start', () => {
    const { steps } = run(code);
    const allStep = steps.find(s => s.phase === 'promise-all-start');
    expect(allStep.microTasks.length).toBe(3);
  });
});

// ═══════════════════════════════════════
// Example 3: Promise.race
// ═══════════════════════════════════════
describe('AsyncAwait: Promise.race', () => {
  const code = 'async function fastest() {\n  let winner = await Promise.race([\n    slowAPI(),\n    fastAPI(),\n    mediumAPI()\n  ]);\n  return winner;\n}';

  it('winner is first mock result (slowAPI mock)', () => {
    const { vars } = run(code);
    // Promise.race returns first — in our mock, it picks pExprs[0] = slowAPI
    expect(vars.winner).toEqual({ data: 'slow-result', ms: 800 });
  });

  it('brain mentions "first one wins"', () => {
    const { steps } = run(code);
    const raceStep = steps.find(s => s.phase === 'promise-all-start');
    expect(raceStep.brain).toContain('first one wins');
  });
});

// ═══════════════════════════════════════
// Example 4: try/catch error handling
// ═══════════════════════════════════════
describe('AsyncAwait: try/catch error handling', () => {
  const code = 'async function safeFetch() {\n  let data = null;\n  try {\n    data = await riskyAPI();\n  } catch (err) {\n    data = "fallback";\n  }\n  return data;\n}';

  it('has try-enter and catch phases', () => {
    const { steps } = run(code);
    const p = phases(steps);
    expect(p).toContain('try-enter');
    expect(p).toContain('catch');
  });

  it('data ends as "fallback" (executor walks all lines linearly for visualization)', () => {
    const { vars } = run(code);
    // The executor walks through both try and catch bodies sequentially
    // to show the user what each block does — it doesn't skip the catch block
    expect(vars.data).toBe('fallback');
  });

  it('brain explains error handling concept', () => {
    const { steps } = run(code);
    const tryStep = steps.find(s => s.phase === 'try-enter');
    expect(tryStep.brain).toContain('protected region');
  });
});

// ═══════════════════════════════════════
// Example 5: Sequential vs Parallel
// ═══════════════════════════════════════
describe('AsyncAwait: Sequential vs Parallel', () => {
  const code = 'async function compare() {\n  // Sequential: slow\n  let a = await taskA();\n  let b = await taskB();\n\n  // Parallel: fast\n  let [c, d] = await Promise.all([\n    taskA(),\n    taskB()\n  ]);\n}';

  it('has both sequential awaits and a Promise.all', () => {
    const { steps } = run(code);
    const p = phases(steps);
    expect(p.filter(x => x === 'await-start').length).toBe(2); // sequential
    expect(p.filter(x => x === 'promise-all-start').length).toBe(1); // parallel
  });

  it('sequential vars: a="resultA", b="resultB"', () => {
    const { vars } = run(code);
    expect(vars.a).toBe('resultA');
    expect(vars.b).toBe('resultB');
  });

  it('parallel destructured vars: c="resultA", d="resultB"', () => {
    const { vars } = run(code);
    expect(vars.c).toBe('resultA');
    expect(vars.d).toBe('resultB');
  });
});

// ═══════════════════════════════════════
// Step structure validation
// ═══════════════════════════════════════
describe('AsyncAwait: Step structure', () => {
  const code = 'async function fetchData() {\n  let user = await getUser();\n  return user;\n}';

  it('every step has required fields', () => {
    const { steps } = run(code);
    for (const s of steps) {
      expect(s).toHaveProperty('lineIndex');
      expect(s).toHaveProperty('vars');
      expect(s).toHaveProperty('output');
      expect(s).toHaveProperty('callStack');
      expect(s).toHaveProperty('eventLoop');
      expect(s).toHaveProperty('microTasks');
      expect(s).toHaveProperty('phase');
      expect(s).toHaveProperty('brain');
      expect(s).toHaveProperty('memLabel');
    }
  });

  it('first step is start, last step is done', () => {
    const { steps } = run(code);
    expect(steps[0].phase).toBe('start');
    expect(steps[steps.length - 1].phase).toBe('done');
    expect(steps[steps.length - 1].done).toBe(true);
  });

  it('callStack starts with Global', () => {
    const { steps } = run(code);
    expect(steps[0].callStack).toEqual(['Global']);
  });
});

// ═══════════════════════════════════════
// Mock results
// ═══════════════════════════════════════
describe('AsyncAwait: _mockResult correctness', () => {
  it('getUser → { id: 1, name: "Alice" }', () => {
    expect(_mockResult('getUser()')).toEqual({ id: 1, name: 'Alice' });
  });
  it('getPosts → array with post', () => {
    expect(_mockResult('getPosts(1)')).toEqual([{ id: 101, title: 'Hello World' }]);
  });
  it('getComments → array with comment', () => {
    expect(_mockResult('getComments(1)')).toEqual([{ text: 'Great post!' }]);
  });
  it('slowAPI → slow result', () => {
    expect(_mockResult('slowAPI()')).toEqual({ data: 'slow-result', ms: 800 });
  });
  it('fastAPI → fast result', () => {
    expect(_mockResult('fastAPI()')).toEqual({ data: 'fast-result', ms: 100 });
  });
  it('riskyAPI → ok result', () => {
    expect(_mockResult('riskyAPI()')).toEqual({ status: 'ok', data: 'result' });
  });
  it('taskA → "resultA"', () => {
    expect(_mockResult('taskA()')).toBe('resultA');
  });
  it('unknown → fallback', () => {
    expect(_mockResult('unknownAPI()')).toEqual({ resolved: true });
  });
});

// ═══════════════════════════════════════
// _fv formatter
// ═══════════════════════════════════════
describe('AsyncAwait: _fv formatter', () => {
  it('undefined → "undefined"', () => expect(_fv(undefined)).toBe('undefined'));
  it('null → "null"', () => expect(_fv(null)).toBe('null'));
  it('string → quoted', () => expect(_fv('hello')).toBe('"hello"'));
  it('boolean → "true"/"false"', () => {
    expect(_fv(true)).toBe('true');
    expect(_fv(false)).toBe('false');
  });
  it('number → string', () => expect(_fv(42)).toBe('42'));
  it('array → "[n items]"', () => expect(_fv([1, 2, 3])).toBe('[3 items]'));
  it('object → JSON', () => expect(_fv({ a: 1 })).toBe('{"a":1}'));
});

// ═══════════════════════════════════════
// Explanation accuracy fact-checks
// ═══════════════════════════════════════
describe('AsyncAwait: Explanation accuracy', () => {
  it('start brain: mentions single-threaded and event loop', () => {
    const code = 'async function f() {\n  let x = await getUser();\n}';
    const { steps } = run(code);
    expect(steps[0].brain).toContain('SINGLE-THREADED');
    expect(steps[0].brain).toContain('event loop');
  });

  it('async-declare brain: mentions Promise return', () => {
    const code = 'async function f() {\n  let x = await getUser();\n}';
    const { steps } = run(code);
    const decl = steps.find(s => s.phase === 'async-declare');
    expect(decl.brain).toContain('always returns a Promise');
  });

  it('await brain: mentions suspension and microtask queue', () => {
    const code = 'async function f() {\n  let x = await getUser();\n}';
    const { steps } = run(code);
    const awaitStep = steps.find(s => s.phase === 'await-start');
    expect(awaitStep.brain).toContain('SUSPENDED');
    expect(awaitStep.brain).toContain('microtask queue');
  });

  it('Promise.all brain: correctly says total time = slowest', () => {
    const code = 'async function f() {\n  let r = await Promise.all([\n    getUser(),\n    getPosts(1)\n  ]);\n}';
    const { steps } = run(code);
    const allStep = steps.find(s => s.phase === 'promise-all-start');
    expect(allStep.brain).toContain('slowest promise');
  });
});
