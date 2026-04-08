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

// ═══════════════════════════════════════
// Switch statement
// ═══════════════════════════════════════
describe('Switch', () => {
  it('matches correct case', () => {
    const { vars } = run('let day = "mon";\nlet result = "";\nswitch (day) {\n  case "sun": result = "weekend"; break;\n  case "mon": result = "weekday"; break;\n  default: result = "unknown";\n}');
    expect(vars.result).toBe('weekday');
  });

  it('hits default when no case matches', () => {
    const { vars } = run('let x = 99;\nlet out = "";\nswitch (x) {\n  case 1: out = "one"; break;\n  case 2: out = "two"; break;\n  default: out = "other";\n}');
    expect(vars.out).toBe('other');
  });

  it('fall-through without break', () => {
    const { vars } = run('let x = 1;\nlet out = 0;\nswitch (x) {\n  case 1: out += 1;\n  case 2: out += 2;\n  case 3: out += 3; break;\n  default: out += 100;\n}');
    expect(vars.out).toBe(6);
  });

  it('generates switch-enter step', () => {
    const { steps } = run('let x = 1;\nswitch (x) {\n  case 1: break;\n}');
    expect(steps.some(s => s.phase === 'switch-enter')).toBe(true);
  });
});

// ═══════════════════════════════════════
// For...of loop
// ═══════════════════════════════════════
describe('For...of', () => {
  it('iterates over array values', () => {
    const { vars } = run('let arr = [10, 20, 30];\nlet sum = 0;\nfor (let val of arr) {\n  sum += val;\n}');
    expect(vars.sum).toBe(60);
  });

  it('iterates over string characters', () => {
    const { vars } = run('let str = "abc";\nlet out = "";\nfor (let ch of str) {\n  out += ch + "-";\n}');
    expect(vars.out).toBe('a-b-c-');
  });

  it('for...in iterates over object keys', () => {
    const { vars } = run('let obj = { a: 1, b: 2, c: 3 };\nlet keys = "";\nfor (let k in obj) {\n  keys += k;\n}');
    expect(vars.keys).toBe('abc');
  });
});

// ═══════════════════════════════════════
// Do...while loop
// ═══════════════════════════════════════
describe('Do...while', () => {
  it('executes body at least once', () => {
    const { vars } = run('let x = 0;\ndo {\n  x += 1;\n} while (x < 0);');
    expect(vars.x).toBe(1);
  });

  it('loops correctly', () => {
    const { vars } = run('let x = 0;\ndo {\n  x += 1;\n} while (x < 5);');
    expect(vars.x).toBe(5);
  });
});

// ═══════════════════════════════════════
// Arrow functions & closures
// ═══════════════════════════════════════
describe('Arrow functions & closures', () => {
  it('arrow function expression', () => {
    const { vars } = run('let double = (x) => x * 2;\nlet result = double(7);');
    expect(vars.result).toBe(14);
  });

  it('arrow function with block body', () => {
    const { vars } = run('let add = (a, b) => {\n  let sum = a + b;\n  return sum;\n};\nlet result = add(3, 4);');
    expect(vars.result).toBe(7);
  });

  it('closure captures outer variable', () => {
    const { vars } = run('let base = 10;\nfunction makeAdder(x) {\n  return base + x;\n}\nlet result = makeAdder(5);');
    expect(vars.result).toBe(15);
  });

  it('higher-order function', () => {
    const { vars } = run('function apply(fn, val) {\n  return fn(val);\n}\nlet triple = (x) => x * 3;\nlet result = apply(triple, 4);');
    expect(vars.result).toBe(12);
  });
});

// ═══════════════════════════════════════
// Classes
// ═══════════════════════════════════════
describe('Classes', () => {
  it('basic class with constructor', () => {
    const { vars } = run('class Dog {\n  constructor(name) {\n    this.name = name;\n  }\n}\nlet d = new Dog("Rex");\nlet n = d.name;');
    expect(vars.n).toBe('Rex');
  });

  it('class with method', () => {
    const { vars } = run('class Counter {\n  constructor(start) {\n    this.val = start;\n  }\n  inc() {\n    this.val = this.val + 1;\n    return this.val;\n  }\n}\nlet c = new Counter(0);\nlet r = c.inc();');
    expect(vars.r).toBe(1);
  });

  it('generates class-declare step', () => {
    const { steps } = run('class Foo {\n  constructor() {}\n}');
    expect(steps.some(s => s.phase === 'class-declare')).toBe(true);
  });
});

// ═══════════════════════════════════════
// Try/catch/finally
// ═══════════════════════════════════════
describe('Try/catch', () => {
  it('catch handles thrown error', () => {
    const { vars } = run('let msg = "";\ntry {\n  throw "oops";\n} catch (e) {\n  msg = e;\n}');
    expect(vars.msg).toBe('oops');
  });

  it('finally always runs', () => {
    const { vars } = run('let log = "";\ntry {\n  log += "try ";\n} finally {\n  log += "finally";\n}');
    expect(vars.log).toBe('try finally');
  });

  it('catch + finally with throw', () => {
    const { vars } = run('let log = "";\ntry {\n  log += "a";\n  throw "err";\n} catch (e) {\n  log += "b";\n} finally {\n  log += "c";\n}');
    expect(vars.log).toBe('abc');
  });

  it('try without throw runs normally', () => {
    const { vars } = run('let x = 0;\ntry {\n  x = 42;\n} catch (e) {\n  x = -1;\n}');
    expect(vars.x).toBe(42);
  });

  it('generates try-enter and throw steps', () => {
    const { steps } = run('let msg = "";\ntry {\n  throw "fail";\n} catch (e) {\n  msg = e;\n}');
    expect(steps.some(s => s.phase === 'try-enter')).toBe(true);
    expect(steps.some(s => s.phase === 'throw')).toBe(true);
    expect(steps.some(s => s.phase === 'catch-enter')).toBe(true);
  });
});

// ═══════════════════════════════════════
// Edge case & stress tests
// ═══════════════════════════════════════
describe('Edge cases — large programs', () => {
  it('handles 100 sequential variable declarations', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `let v${i} = ${i};`);
    const { vars } = run(lines.join('\n'));
    expect(vars.v0).toBe(0);
    expect(vars.v50).toBe(50);
    expect(vars.v99).toBe(99);
  });

  it('handles a loop with 200 iterations', () => {
    const { vars } = run('let sum = 0;\nfor (let i = 0; i < 200; i++) {\n  sum = sum + 1;\n}', { trackLoops: true });
    expect(vars.sum).toBe(200);
  });

  it('handles deeply nested if statements (10 levels)', () => {
    let code = 'let x = 0;\n';
    for (let i = 0; i < 10; i++) code += `${'  '.repeat(i)}if (true) {\n`;
    code += `${'  '.repeat(10)}x = 42;\n`;
    for (let i = 9; i >= 0; i--) code += `${'  '.repeat(i)}}\n`;
    const { vars } = run(code);
    expect(vars.x).toBe(42);
  });

  it('handles deeply nested for loops (5 levels)', () => {
    const code = `let count = 0;
for (let a = 0; a < 3; a++) {
  for (let b = 0; b < 3; b++) {
    for (let c = 0; c < 3; c++) {
      for (let d = 0; d < 3; d++) {
        for (let e = 0; e < 3; e++) {
          count = count + 1;
        }
      }
    }
  }
}`;
    const { vars } = run(code, { trackLoops: true, maxSteps: Infinity });
    expect(vars.count).toBe(243); // 3^5
  });

  it('handles many function calls in sequence', () => {
    let code = 'function inc(n) { return n + 1; }\nlet x = 0;\n';
    for (let i = 0; i < 50; i++) code += `x = inc(x);\n`;
    const { vars } = run(code, { trackCalls: true });
    expect(vars.x).toBe(50);
  });

  it('handles large array with many push operations', () => {
    let code = 'let arr = [];\n';
    for (let i = 0; i < 50; i++) code += `arr.push(${i});\n`;
    code += 'let len = arr.length;';
    const { vars } = run(code, { trackArrays: true });
    expect(vars.len).toBe(50);
    expect(vars.arr.length).toBe(50);
  });
});

describe('Edge cases — boundary values', () => {
  it('handles undefined variable value', () => {
    const { vars } = run('let x;');
    expect(vars.x).toBeUndefined();
  });

  it('handles null assignment', () => {
    const { vars } = run('let x = null;');
    expect(vars.x).toBeNull();
  });

  it('handles empty string', () => {
    const { vars } = run('let s = "";');
    expect(vars.s).toBe('');
  });

  it('handles zero and negative numbers', () => {
    const { vars } = run('let zero = 0;\nlet neg = -42;\nlet negFloat = -3.14;');
    expect(vars.zero).toBe(0);
    expect(vars.neg).toBe(-42);
    expect(vars.negFloat).toBeCloseTo(-3.14);
  });

  it('handles boolean coercion in conditions', () => {
    const { vars } = run('let a = "";\nlet b = 0;\nlet c = null;\nlet ra = "truthy";\nlet rb = "truthy";\nlet rc = "truthy";\nif (a) { ra = "yes"; }\nif (b) { rb = "yes"; }\nif (c) { rc = "yes"; }');
    expect(vars.ra).toBe('truthy');
    expect(vars.rb).toBe('truthy');
    expect(vars.rc).toBe('truthy');
  });

  it('handles empty array', () => {
    const { vars } = run('let arr = [];\nlet len = arr.length;');
    expect(vars.arr).toEqual([]);
    expect(vars.len).toBe(0);
  });

  it('handles empty object', () => {
    const { vars } = run('let obj = {};', { trackObjects: true });
    expect(vars.obj).toEqual({});
  });

  it('handles template literals', () => {
    const { vars } = run('let name = "World";\nlet msg = `Hello, ${name}!`;');
    expect(vars.msg).toBe('Hello, World!');
  });

  it('handles ternary operator', () => {
    const { vars } = run('let x = 5;\nlet result = x > 3 ? "big" : "small";');
    expect(vars.result).toBe('big');
  });

  it('handles compound assignment operators', () => {
    const { vars } = run('let x = 10;\nx += 5;\nx -= 3;\nx *= 2;\nx /= 4;\nx %= 3;');
    expect(vars.x).toBe(0);
  });

  it('handles while loop that never executes', () => {
    const { vars } = run('let x = 0;\nwhile (false) {\n  x = 999;\n}');
    expect(vars.x).toBe(0);
  });

  it('handles chained string concatenation', () => {
    const { vars } = run('let s = "a" + "b" + "c" + "d" + "e";');
    expect(vars.s).toBe('abcde');
  });
});

describe('Edge cases — error resilience', () => {
  it('returns partial steps on runtime error', () => {
    const code = 'let x = 1;\nlet y = x.nonExistent.deep;';
    const result = interpret(code);
    // Should have at least the start step and possibly partial steps
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.steps[0].phase).toBe('start');
  });

  it('handles syntax error gracefully', () => {
    const result = interpret('let x = {{{');
    expect(result.error).toBeTruthy();
  });

  it('handles empty input', () => {
    const result = interpret('');
    expect(result.error).toBeNull();
    expect(result.steps.length).toBe(2);
  });

  it('handles whitespace-only input', () => {
    const result = interpret('   \n\n   \n');
    expect(result.error).toBeNull();
    expect(result.steps.length).toBe(2);
  });

  it('handles comment-only input', () => {
    const result = interpret('// just a comment\n// another comment');
    expect(result.error).toBeNull();
    expect(result.steps.length).toBe(2);
  });
});

// ═══════════════════════════════════════
// Split module unit tests
// ═══════════════════════════════════════
import { parseCode as parseCodeDirect, friendlyError, checkSupported } from './parser.js';
import { evalNode, detectPhase, isConsoleLog } from './evaluator.js';
import { buildDeclBrain, buildDoneBrain } from './brain-text.js';

describe('parser.js — parseCode', () => {
  it('parses valid code and returns AST', () => {
    const { ast, error } = parseCodeDirect('let x = 1;');
    expect(error).toBeNull();
    expect(ast).toBeTruthy();
    expect(ast.body.length).toBe(1);
    expect(ast.body[0].type).toBe('VariableDeclaration');
  });

  it('returns error for invalid syntax', () => {
    const { ast, error } = parseCodeDirect('let x = ;');
    expect(ast).toBeNull();
    expect(error).toContain('Syntax error');
  });
});

describe('parser.js — friendlyError', () => {
  it('handles "Unexpected token" errors', () => {
    const fe = friendlyError('Unexpected token }', 'let x = }', 1);
    expect(fe.friendly).toContain('character or symbol');
    expect(fe.hint).toContain('bracket');
    expect(fe.raw).toBe('Unexpected token }');
  });

  it('handles "is not defined" errors', () => {
    const fe = friendlyError('foo is not defined', '', 1);
    expect(fe.friendly).toContain('foo');
    expect(fe.hint).toContain('let');
  });

  it('handles "is not a function" errors', () => {
    const fe = friendlyError('x is not a function', '', 1);
    expect(fe.friendly).toContain('function');
  });

  it('returns fallback for unknown errors', () => {
    const fe = friendlyError('some random weird error');
    expect(fe.friendly).toContain('Something went wrong');
    expect(fe.raw).toBe('some random weird error');
  });
});

describe('parser.js — checkSupported', () => {
  it('returns ok for supported syntax', () => {
    const { ast } = parseCodeDirect('let x = 1; if (x > 0) { x = 2; }');
    expect(checkSupported(ast)).toEqual({ ok: true });
  });

  it('rejects async functions', () => {
    const { ast } = parseCodeDirect('async function f() {}');
    const result = checkSupported(ast);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('async');
  });
});

describe('evaluator.js — detectPhase', () => {
  it('returns ds-create for arrays', () => {
    expect(detectPhase([1, 2], {})).toBe('ds-create');
  });

  it('returns obj-create for objects', () => {
    expect(detectPhase({ a: 1 }, {})).toBe('obj-create');
  });

  it('returns fn-declare for functions', () => {
    expect(detectPhase(() => {}, {})).toBe('fn-declare');
  });

  it('returns declare for primitives', () => {
    expect(detectPhase(42, {})).toBe('declare');
    expect(detectPhase('hello', {})).toBe('declare');
    expect(detectPhase(true, {})).toBe('declare');
  });
});

describe('brain-text.js — buildDeclBrain', () => {
  it('returns array brain text for arrays', () => {
    const text = buildDeclBrain('arr', [1, 2, 3], 'let', { arr: [1, 2, 3] });
    expect(text).toContain('ARRAY CREATED');
    expect(text).toContain('PACKED_SMI');
  });

  it('returns object brain text for objects', () => {
    const text = buildDeclBrain('obj', { x: 1 }, 'const', { obj: { x: 1 } });
    expect(text).toContain('OBJECT CREATED');
    expect(text).toContain('Hidden Class');
  });

  it('returns function brain text for functions', () => {
    const text = buildDeclBrain('fn', () => {}, 'const', { fn: () => {} });
    expect(text).toContain('FUNCTION DECLARATION');
  });

  it('returns SMI brain text for small integers', () => {
    const text = buildDeclBrain('x', 42, 'let', { x: 42 });
    expect(text).toContain('SMI');
  });

  it('returns string brain text for strings', () => {
    const text = buildDeclBrain('s', 'hello', 'let', { s: 'hello' });
    expect(text).toContain('String');
  });
});

describe('brain-text.js — buildDoneBrain', () => {
  it('returns completion summary', () => {
    const text = buildDoneBrain({ x: 1, y: 2 }, ['hello'], { memOps: 3, comps: 1, extra: {} });
    expect(text).toContain('PROGRAM COMPLETE');
    expect(text).toContain('2 variables');
    expect(text).toContain('3');
    expect(text).toContain('GARBAGE COLLECTION');
  });

  it('includes loop iterations when present', () => {
    const text = buildDoneBrain({}, [], { memOps: 0, comps: 5, extra: { loopIters: 10 } });
    expect(text).toContain('Loop iterations: 10');
  });
});

// ═══════════════════════════════════════
// Step limit
// ═══════════════════════════════════════
describe('Step limit', () => {
  it('truncates at MAX_STEPS by default and returns partial steps', () => {
    const code = 'let i = 0;\nwhile (true) { i = i + 1; }';
    const result = interpret(code, { trackLoops: true });
    expect(result.error).toBeNull();
    expect(result.truncated).toBe(true);
    expect(result.steps.length).toBeLessThanOrEqual(502); // ~500 + start + limit step
    const last = result.steps[result.steps.length - 1];
    expect(last.phase).toBe('limit');
    expect(last.done).toBe(true);
  });

  it('respects custom maxSteps option', () => {
    const code = 'let i = 0;\nwhile (true) { i = i + 1; }';
    const result = interpret(code, { trackLoops: true, maxSteps: 20 });
    expect(result.truncated).toBe(true);
    expect(result.steps.length).toBeLessThanOrEqual(22);
  });

  it('does not truncate short programs', () => {
    const result = interpret('let x = 1;\nlet y = 2;');
    expect(result.error).toBeNull();
    expect(result.truncated).toBeFalsy();
    const last = result.steps[result.steps.length - 1];
    expect(last.phase).toBe('done');
  });
});
