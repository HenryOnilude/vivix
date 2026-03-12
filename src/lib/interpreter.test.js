/**
 * Basic tests for the AST interpreter against each module's example code.
 * Run: npm test
 */
import { describe, it, expect } from 'vitest';
import { interpret, parseCode } from './interpreter.js';

// ── Helper: get the final step's vars and output ──
function run(code, opts = {}) {
  const result = interpret(code, opts);
  expect(result.error).toBeNull();
  expect(result.steps.length).toBeGreaterThan(1);
  const last = result.steps[result.steps.length - 1];
  expect(last.done).toBe(true);
  return { vars: last.vars, output: last.output, steps: result.steps };
}

// ═══════════════════════════════════════
// Variables module examples
// ═══════════════════════════════════════
describe('Variables', () => {
  it('Numbers: declares 3 numeric variables', () => {
    const { vars } = run('let age = 25;\nlet price = 9.99;\nlet year = 2024;');
    expect(vars.age).toBe(25);
    expect(vars.price).toBe(9.99);
    expect(vars.year).toBe(2024);
  });

  it('Strings: concatenation works', () => {
    const { vars } = run('let name = "Alice";\nlet greeting = "Hello, " + name + "!";\nlet empty = "";');
    expect(vars.name).toBe('Alice');
    expect(vars.greeting).toBe('Hello, Alice!');
    expect(vars.empty).toBe('');
  });

  it('Booleans: assigns true/false', () => {
    const { vars } = run('let isLoggedIn = true;\nlet hasPermission = false;\nlet isActive = true;');
    expect(vars.isLoggedIn).toBe(true);
    expect(vars.hasPermission).toBe(false);
    expect(vars.isActive).toBe(true);
  });

  it('Reassignment: updates value in place', () => {
    const { vars } = run('let score = 0;\nscore = 10;\nscore = score + 5;\nscore = score * 2;');
    expect(vars.score).toBe(30);
  });

  it('const vs let: both work', () => {
    const { vars } = run('const PI = 3.14159;\nconst APP_NAME = "VisualJS";\nlet counter = 0;\ncounter = counter + 1;\ncounter = counter + 1;');
    expect(vars.PI).toBeCloseTo(3.14159);
    expect(vars.APP_NAME).toBe('VisualJS');
    expect(vars.counter).toBe(2);
  });
});

// ═══════════════════════════════════════
// IfGate module examples
// ═══════════════════════════════════════
describe('IfGate', () => {
  it('Age check: sets canDrink to true', () => {
    const { vars } = run('let age = 22;\nlet canDrink = false;\n\nif (age >= 21) {\n  canDrink = true;\n}');
    expect(vars.canDrink).toBe(true);
  });

  it('Login gate: grants access', () => {
    const { vars } = run('let isLoggedIn = true;\nlet role = "admin";\nlet access = "denied";\n\nif (isLoggedIn && role === "admin") {\n  access = "granted";\n}');
    expect(vars.access).toBe('granted');
  });

  it('if/else: takes else branch', () => {
    const { vars } = run('let score = 45;\nlet result = "";\n\nif (score >= 50) {\n  result = "pass";\n} else {\n  result = "fail";\n}');
    expect(vars.result).toBe('fail');
  });

  it('Discount: applies member discount', () => {
    const { vars } = run('let price = 100;\nlet isMember = true;\nlet discount = 0;\n\nif (isMember) {\n  discount = price * 0.2;\n  price = price - discount;\n}');
    expect(vars.discount).toBe(20);
    expect(vars.price).toBe(80);
  });
});

// ═══════════════════════════════════════
// ForLoop module examples
// ═══════════════════════════════════════
describe('ForLoop', () => {
  it('Count to 5: sums 1..5', () => {
    const { vars } = run('let sum = 0;\n\nfor (let i = 1; i <= 5; i++) {\n  sum = sum + i;\n}', { trackLoops: true });
    expect(vars.sum).toBe(15);
  });

  it('Array search: finds cherry', () => {
    const { vars } = run('let fruits = ["apple", "banana", "cherry"];\nlet found = false;\n\nfor (let i = 0; i < fruits.length; i++) {\n  if (fruits[i] === "cherry") {\n    found = true;\n  }\n}', { trackLoops: true });
    expect(vars.found).toBe(true);
  });

  it('Accumulator: totals loop increments', () => {
    const { vars } = run('let total = 0;\nlet count = 0;\n\nfor (let i = 0; i < 4; i++) {\n  total = total + (i * 10);\n  count = count + 1;\n}', { trackLoops: true });
    expect(vars.total).toBe(60); // 0+10+20+30
    expect(vars.count).toBe(4);
  });

  it('Countdown: ends with "go!"', () => {
    const { vars } = run('let msg = "ready";\n\nfor (let i = 3; i > 0; i--) {\n  msg = i + "...";\n}\n\nmsg = "go!";', { trackLoops: true });
    expect(vars.msg).toBe('go!');
  });

  it('Nested: 3x3 grid count', () => {
    const { vars } = run('let grid = 0;\n\nfor (let r = 0; r < 3; r++) {\n  for (let c = 0; c < 3; c++) {\n    grid = grid + 1;\n  }\n}', { trackLoops: true });
    expect(vars.grid).toBe(9);
  });
});

// ═══════════════════════════════════════
// FnCall module examples
// ═══════════════════════════════════════
describe('FnCall', () => {
  it('Simple function: double(21) = 42', () => {
    const { vars } = run('function double(x) {\n  let result = x * 2;\n  return result;\n}\n\nlet answer = double(21);', { trackCalls: true });
    expect(vars.answer).toBe(42);
  });

  it('Two functions: add and multiply', () => {
    const { vars } = run('function add(a, b) {\n  return a + b;\n}\n\nfunction multiply(a, b) {\n  return a * b;\n}\n\nlet sum = add(3, 4);\nlet product = multiply(5, 6);', { trackCalls: true });
    expect(vars.sum).toBe(7);
    expect(vars.product).toBe(30);
  });

  it('Nested calls: sumOfSquares(3,4) = 25', () => {
    const { vars } = run('function square(n) {\n  return n * n;\n}\n\nfunction sumOfSquares(a, b) {\n  let s1 = square(a);\n  let s2 = square(b);\n  return s1 + s2;\n}\n\nlet result = sumOfSquares(3, 4);', { trackCalls: true });
    expect(vars.result).toBe(25);
  });

  it('With condition: checkAge returns "adult"', () => {
    const { vars } = run('function checkAge(age) {\n  if (age >= 18) {\n    return "adult";\n  }\n  return "minor";\n}\n\nlet status = checkAge(25);', { trackCalls: true });
    expect(vars.status).toBe('adult');
  });
});

// ═══════════════════════════════════════
// ArrayFlow module examples
// ═══════════════════════════════════════
describe('ArrayFlow', () => {
  it('push & pop: removes last element', () => {
    const { vars } = run('let fruits = ["apple", "banana"];\n\nfruits.push("cherry");\nfruits.push("date");\nlet removed = fruits.pop();', { trackArrays: true });
    expect(vars.removed).toBe('date');
    expect(vars.fruits).toEqual(['apple', 'banana', 'cherry']);
  });

  it('shift & unshift: removes first element', () => {
    const { vars } = run('let queue = ["a", "b", "c"];\n\nlet first = queue.shift();\nqueue.push("d");', { trackArrays: true });
    expect(vars.first).toBe('a');
    expect(vars.queue).toEqual(['b', 'c', 'd']);
  });
});

// ═══════════════════════════════════════
// ObjExplorer module examples
// ═══════════════════════════════════════
describe('ObjExplorer', () => {
  it('Object literal: creates user with properties', () => {
    const { vars } = run('let user = { name: "Alice", age: 25 };\nconsole.log(user.name);\nconsole.log(user.age);', { trackObjects: true });
    expect(vars.user).toEqual({ name: 'Alice', age: 25 });
  });

  it('Dynamic keys: bracket notation sets values', () => {
    const { vars, output } = run('let scores = {};\nscores["math"] = 95;\nscores["science"] = 87;\nscores["english"] = 91;\nconsole.log(scores["math"]);', { trackObjects: true });
    expect(vars.scores.math).toBe(95);
    expect(vars.scores.science).toBe(87);
    expect(output).toContain('95');
  });
});

// ═══════════════════════════════════════
// DataStructures module examples
// ═══════════════════════════════════════
describe('DataStructures', () => {
  it('Stack (LIFO): push 3, pop gets last', () => {
    const { vars, output } = run('let stack = [];\nstack.push(10);\nstack.push(20);\nstack.push(30);\nlet top = stack.pop();\nconsole.log(top);\nconsole.log(stack);', { trackDS: true });
    expect(vars.top).toBe(30);
    expect(vars.stack).toEqual([10, 20]);
    expect(output[0]).toBe('30');
  });

  it('Queue (FIFO): push 3, shift gets first', () => {
    const { vars, output } = run('let queue = [];\nqueue.push("A");\nqueue.push("B");\nqueue.push("C");\nlet first = queue.shift();\nconsole.log(first);\nconsole.log(queue);', { trackDS: true });
    expect(vars.first).toBe('A');
    expect(vars.queue).toEqual(['B', 'C']);
    expect(output[0]).toBe('A');
  });

  it('Map (key-value): bracket access', () => {
    const { vars } = run('let map = {};\nmap["alice"] = 100;\nmap["bob"] = 85;\nmap["carol"] = 92;\nlet score = map["alice"];', { trackDS: true });
    expect(vars.score).toBe(100);
    expect(vars.map).toEqual({ alice: 100, bob: 85, carol: 92 });
  });
});

// ═══════════════════════════════════════
// Error handling
// ═══════════════════════════════════════
describe('Error handling', () => {
  it('returns parse error for invalid syntax', () => {
    const result = interpret('let x = ;');
    expect(result.error).toBeTruthy();
    expect(result.error).toContain('Syntax error');
  });

  it('parseCode returns error details', () => {
    const { ast, error } = parseCode('if (');
    expect(ast).toBeNull();
    expect(error).toContain('Syntax error');
  });

  it('empty code produces start + done steps', () => {
    const result = interpret('');
    expect(result.error).toBeNull();
    expect(result.steps.length).toBe(2);
    expect(result.steps[0].phase).toBe('start');
    expect(result.steps[1].phase).toBe('done');
  });
});

// ═══════════════════════════════════════
// Step structure checks
// ═══════════════════════════════════════
describe('Step structure', () => {
  it('every step has required fields', () => {
    const result = interpret('let x = 1;\nlet y = 2;');
    for (const step of result.steps) {
      expect(step).toHaveProperty('lineIndex');
      expect(step).toHaveProperty('nextLineIndex');
      expect(step).toHaveProperty('vars');
      expect(step).toHaveProperty('output');
      expect(step).toHaveProperty('highlight');
      expect(step).toHaveProperty('phase');
      expect(step).toHaveProperty('brain');
      expect(step).toHaveProperty('memLabel');
      expect(step).toHaveProperty('memOps');
      expect(step).toHaveProperty('comps');
    }
  });

  it('first step is "start", last is "done"', () => {
    const result = interpret('let a = 10;');
    expect(result.steps[0].phase).toBe('start');
    expect(result.steps[result.steps.length - 1].phase).toBe('done');
    expect(result.steps[result.steps.length - 1].done).toBe(true);
  });

  it('trackCalls adds stack and frames', () => {
    const result = interpret('function f() { return 1; }\nlet x = f();', { trackCalls: true });
    const hasStack = result.steps.some(s => s.stack && s.stack.length > 0);
    expect(hasStack).toBe(true);
  });

  it('trackLoops adds loopIters', () => {
    const result = interpret('for (let i = 0; i < 2; i++) {}', { trackLoops: true });
    const hasIters = result.steps.some(s => s.loopIters !== undefined && s.loopIters > 0);
    expect(hasIters).toBe(true);
  });

  it('console.log produces output', () => {
    const { output } = run('let x = 42;\nconsole.log(x);');
    expect(output).toContain('42');
  });
});
