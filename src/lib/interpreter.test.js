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
    const { vars } = run('const PI = 3.14159;\nconst APP_NAME = "Vivix";\nlet counter = 0;\ncounter = counter + 1;\ncounter = counter + 1;');
    expect(vars.PI).toBeCloseTo(3.14159);
    expect(vars.APP_NAME).toBe('Vivix');
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
import { buildDeclBrain, buildDoneBrain, buildClosureStartBrain, buildClosureFnDeclareBrain, buildClosureCreateBrain, buildClosureCallBrain, buildClosureDoneBrain, buildFnCallStartBrain, buildFnCallFnDeclareBrain, buildFnCallCallBrain, buildFnCallReturnBrain, buildFnCallDoneBrain, buildLoopStartBrain, buildLoopTestBrain, buildWhileTestBrain, buildDoWhileTestBrain, buildForOfInitBrain, buildForOfIterBrain, buildLoopDoneBrain, buildArrayStartBrain, buildArrayDeclareBrain, buildArrayPushBrain, buildArrayPopBrain, buildArrayShiftBrain, buildArraySortBrain, buildArraySetBrain, buildArrayDoneBrain, buildObjStartBrain, buildObjDeclareBrain, buildObjSetBrain, buildObjDestructBrain, buildObjMethodBrain, buildObjDoneBrain, buildDSStartBrain, buildDSDeclareBrain, buildDSPushBrain, buildDSPopBrain, buildDSDequeueBrain, buildDSSortBrain, buildDSDoneBrain, buildIfStartBrain, buildIfConditionBrain, buildIfSkipBrain, buildIfElseEnterBrain, buildIfDoneBrain, buildVarStartBrain, buildVarDeclareBrain, buildVarAssignBrain, buildVarUpdateBrain, buildVarDoneBrain } from './brain-text.js';

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
// Closure brain text (three-layer)
// ═══════════════════════════════════════
describe('brain-text.js — closure brain text', () => {
  it('buildClosureStartBrain mentions heap-resident record and back-link', () => {
    const text = buildClosureStartBrain();
    expect(text).toContain('heap-resident record');
    expect(text).toContain('back-link');
  });

  it('buildClosureFnDeclareBrain mentions back-link, lexical environment persistence, and captured vars', () => {
    const text = buildClosureFnDeclareBrain('inner', 'x', ['count']);
    expect(text).toContain('back-link');
    expect(text).toContain('lexical environment persistence');
    expect(text).toContain('count');
  });

  it('buildClosureCreateBrain (function) mentions back-link and heap record', () => {
    const fn = function() {};
    const text = buildClosureCreateBrain('counter', ['count'], fn);
    expect(text).toContain('back-link');
    expect(text).toContain('heap record');
    expect(text).toContain('counter');
    expect(text).toContain('count');
  });

  it('buildClosureCreateBrain (object with methods) mentions methods and back-link', () => {
    const obj = { deposit: function(){}, getBalance: function(){} };
    const text = buildClosureCreateBrain('wallet', ['balance'], obj);
    expect(text).toContain('back-link');
    expect(text).toContain('deposit');
    expect(text).toContain('getBalance');
    expect(text).toContain('lexical environment persistence');
  });

  it('buildClosureCallBrain mentions back-link, heap record, and result', () => {
    const text = buildClosureCallBrain('a', 'counter', ['count'], 1);
    expect(text).toContain('back-link');
    expect(text).toContain('heap record');
    expect(text).toContain('counter()');
    expect(text).toContain('count');
  });

  it('buildClosureDoneBrain mentions lifecycle and lexical environment persistence', () => {
    const text = buildClosureDoneBrain({ a: 1, b: 2 }, { extra: { closureRegistry: { counter: {} } } });
    expect(text).toContain('lexical environment persistence');
    expect(text).toContain('back-link');
    expect(text).toContain('1 closure');
  });
});

describe('Closure brain text integration', () => {
  it('start step uses closure brain when trackClosures is on', () => {
    const code = 'function makeCounter() {\n  let count = 0;\n  return function() {\n    count = count + 1;\n    return count;\n  };\n}\n\nlet counter = makeCounter();\nlet a = counter();';
    const { steps } = run(code, { trackCalls: true, trackClosures: true });
    expect(steps[0].brain).toContain('heap-resident record');
    expect(steps[0].brain).toContain('back-link');
  });

  it('closure-create step mentions back-link and heap record', () => {
    const code = 'function makeCounter() {\n  let count = 0;\n  return function() {\n    count = count + 1;\n    return count;\n  };\n}\n\nlet counter = makeCounter();';
    const { steps } = run(code, { trackCalls: true, trackClosures: true });
    const createStep = steps.find(s => s.phase === 'closure-create');
    expect(createStep).toBeTruthy();
    expect(createStep.brain).toContain('back-link');
    expect(createStep.brain).toContain('heap record');
  });

  it('closure-call step mentions back-link and heap record', () => {
    const code = 'function makeCounter() {\n  let count = 0;\n  return function() {\n    count = count + 1;\n    return count;\n  };\n}\n\nlet counter = makeCounter();\nlet a = counter();';
    const { steps } = run(code, { trackCalls: true, trackClosures: true });
    const callStep = steps.find(s => s.phase === 'closure-call');
    expect(callStep).toBeTruthy();
    expect(callStep.brain).toContain('back-link');
    expect(callStep.brain).toContain('heap record');
  });

  it('done step uses closure brain when trackClosures is on', () => {
    const code = 'function makeCounter() {\n  let count = 0;\n  return function() {\n    count = count + 1;\n    return count;\n  };\n}\n\nlet counter = makeCounter();\nlet a = counter();';
    const { steps } = run(code, { trackCalls: true, trackClosures: true });
    const doneStep = steps[steps.length - 1];
    expect(doneStep.brain).toContain('lexical environment persistence');
    expect(doneStep.brain).toContain('back-link');
  });

  it('non-closure modules still use generic brain text', () => {
    const { steps } = run('let x = 42;');
    expect(steps[0].brain).toContain('V8 ENGINE STARTUP');
  });
});

// ═══════════════════════════════════════
// FnCall brain text (three-layer)
// ═══════════════════════════════════════
describe('brain-text.js — fnCall brain text', () => {
  it('buildFnCallStartBrain mentions Global frame, LIFO, and return', () => {
    const text = buildFnCallStartBrain();
    expect(text).toContain('Global frame');
    expect(text).toContain('LIFO');
  });

  it('buildFnCallFnDeclareBrain mentions LIFO, return address, and frame', () => {
    const text = buildFnCallFnDeclareBrain('double', 'x');
    expect(text).toContain('LIFO');
    expect(text).toContain('return address');
    expect(text).toContain('double');
  });

  it('buildFnCallCallBrain mentions stack frame, LIFO, return address, and depth', () => {
    const text = buildFnCallCallBrain('double', 1, 42, 2);
    expect(text).toContain('stack frame');
    expect(text).toContain('LIFO');
    expect(text).toContain('return address');
    expect(text).toContain('double()');
    expect(text).toContain('depth is now 2');
  });

  it('buildFnCallReturnBrain mentions frame pop, LIFO, and return address', () => {
    const text = buildFnCallReturnBrain(42, 'double');
    expect(text).toContain('pops');
    expect(text).toContain('LIFO');
    expect(text).toContain('return address');
    expect(text).toContain('42');
  });

  it('buildFnCallDoneBrain mentions LIFO, stack depth, and lifecycle', () => {
    const text = buildFnCallDoneBrain({ answer: 42 }, { extra: { calls: 1, maxDepth: 2 } });
    expect(text).toContain('LIFO');
    expect(text).toContain('return address');
    expect(text).toContain('1 function call');
    expect(text).toContain('stack depth of 2');
  });
});

describe('FnCall brain text integration', () => {
  it('start step uses fnCall brain when trackCalls is on', () => {
    const code = 'function double(x) {\n  return x * 2;\n}\n\nlet answer = double(21);';
    const { steps } = run(code, { trackCalls: true });
    expect(steps[0].brain).toContain('Global frame');
    expect(steps[0].brain).toContain('LIFO');
  });

  it('fn-declare step mentions LIFO and return address', () => {
    const code = 'function double(x) {\n  return x * 2;\n}\n\nlet answer = double(21);';
    const { steps } = run(code, { trackCalls: true });
    const declStep = steps.find(s => s.phase === 'fn-declare');
    expect(declStep).toBeTruthy();
    expect(declStep.brain).toContain('LIFO');
    expect(declStep.brain).toContain('return address');
  });

  it('fn-call step mentions stack frame and LIFO', () => {
    // Bare-expression call (not a VariableDeclaration init) so the call
    // routes through walkExpressionStatement → walkCallExpression and
    // emits the fn-call phase step.
    const code = 'function double(x) {\n  return x * 2;\n}\n\ndouble(21);';
    const { steps } = run(code, { trackCalls: true });
    const callStep = steps.find(s => s.phase === 'fn-call');
    expect(callStep).toBeTruthy();
    expect(callStep.brain).toContain('stack frame');
    expect(callStep.brain).toContain('LIFO');
  });

  it('done step uses fnCall brain when trackCalls is on', () => {
    const code = 'function double(x) {\n  return x * 2;\n}\n\nlet answer = double(21);';
    const { steps } = run(code, { trackCalls: true });
    const doneStep = steps[steps.length - 1];
    expect(doneStep.brain).toContain('LIFO');
    expect(doneStep.brain).toContain('return address');
  });
});

// ═══════════════════════════════════════
// ForLoop brain text (three-layer)
// ═══════════════════════════════════════
describe('brain-text.js — forLoop brain text', () => {
  it('buildLoopStartBrain mentions TurboFan and on-stack replacement', () => {
    const text = buildLoopStartBrain();
    expect(text).toContain('TurboFan');
    expect(text).toContain('on-stack replacement');
  });

  it('buildLoopTestBrain (hot, TRUE) mentions TurboFan, counter mutation, and flat-scope note', () => {
    const text = buildLoopTestBrain(true, 4, 'i', 4, 3);
    expect(text).toContain('TurboFan');
    expect(text).toContain('mutates from');
    expect(text).toContain('outer scope in this visualiser');
  });

  it('buildLoopTestBrain (cold, TRUE) mentions Ignition and FeedbackVector', () => {
    const text = buildLoopTestBrain(true, 1, 'i', 0, null);
    expect(text).toContain('Ignition');
    expect(text).toContain('FeedbackVector');
  });

  it('buildLoopTestBrain (FALSE exit) mentions exit and connects back to iteration one', () => {
    const text = buildLoopTestBrain(false, 5, 'i', 5, 4);
    expect(text).toContain('FALSE');
    expect(text).toContain('iteration one');
  });

  it('buildWhileTestBrain (hot) mentions TurboFan and flat-scope note', () => {
    const text = buildWhileTestBrain(true, 4);
    expect(text).toContain('TurboFan');
    expect(text).toContain('outer scope in this visualiser');
  });

  it('buildDoWhileTestBrain mentions body-first execution trait', () => {
    const text = buildDoWhileTestBrain(true, 2);
    expect(text).toContain('body executed before this check');
  });

  it('buildForOfInitBrain (for-of) mentions Symbol.iterator and TurboFan', () => {
    const text = buildForOfInitBrain(false, [1, 2, 3]);
    expect(text).toContain('Symbol.iterator');
    expect(text).toContain('TurboFan');
  });

  it('buildForOfInitBrain (for-in) mentions enumerable keys and TurboFan', () => {
    const text = buildForOfInitBrain(true, { a: 1 });
    expect(text).toContain('enumerable keys');
    expect(text).toContain('TurboFan');
  });

  it('buildForOfIterBrain mentions iteration number and type feedback', () => {
    const text = buildForOfIterBrain(false, 'val', 10, 1);
    expect(text).toContain('iteration 1');
    expect(text).toContain('val = 10');
  });

  it('buildLoopDoneBrain mentions iteration count and lifecycle', () => {
    const text = buildLoopDoneBrain({ sum: 15 }, { extra: { loopIters: 5 } });
    expect(text).toContain('5 loop iterations');
    expect(text).toContain('lifecycle');
  });
});

describe('ForLoop brain text integration', () => {
  it('start step uses loop brain when trackLoops is on', () => {
    const code = 'let sum = 0;\nfor (let i = 1; i <= 3; i++) {\n  sum = sum + i;\n}';
    const { steps } = run(code, { trackLoops: true });
    expect(steps[0].brain).toContain('TurboFan');
    expect(steps[0].brain).toContain('on-stack replacement');
  });

  it('loop-test step mentions TurboFan or Ignition', () => {
    const code = 'let sum = 0;\nfor (let i = 1; i <= 5; i++) {\n  sum = sum + i;\n}';
    const { steps } = run(code, { trackLoops: true });
    const loopSteps = steps.filter(s => s.phase === 'loop-test');
    expect(loopSteps.length).toBeGreaterThan(0);
    // Early iterations mention Ignition, later ones mention TurboFan
    expect(loopSteps[0].brain).toContain('Ignition');
    const hotStep = loopSteps.find(s => s.brain.includes('TurboFan'));
    expect(hotStep).toBeTruthy();
  });

  it('loop-test step includes flat-scope disclaimer', () => {
    const code = 'let sum = 0;\nfor (let i = 1; i <= 3; i++) {\n  sum = sum + i;\n}';
    const { steps } = run(code, { trackLoops: true });
    const loopStep = steps.find(s => s.phase === 'loop-test' && s.brain.includes('TRUE'));
    expect(loopStep).toBeTruthy();
    expect(loopStep.brain).toContain('outer scope in this visualiser');
  });

  it('loop-test tracks counter mutation', () => {
    const code = 'let sum = 0;\nfor (let i = 0; i < 3; i++) {\n  sum = sum + i;\n}';
    const { steps } = run(code, { trackLoops: true });
    const loopSteps = steps.filter(s => s.phase === 'loop-test');
    // After first iteration, should mention mutation
    const mutStep = loopSteps.find(s => s.brain.includes('mutates from'));
    expect(mutStep).toBeTruthy();
  });

  it('done step uses loop brain when trackLoops is on', () => {
    const code = 'let sum = 0;\nfor (let i = 1; i <= 3; i++) {\n  sum = sum + i;\n}';
    const { steps } = run(code, { trackLoops: true });
    const doneStep = steps[steps.length - 1];
    expect(doneStep.brain).toContain('loop iteration');
    expect(doneStep.brain).toContain('lifecycle');
  });
});

// ═══════════════════════════════════════
// ArrayFlow brain text (three-layer)
// ═══════════════════════════════════════
describe('brain-text.js — arrayFlow brain text', () => {
  it('buildArrayStartBrain mentions Elements Kind and one-directional', () => {
    const text = buildArrayStartBrain();
    expect(text).toContain('Elements Kind');
    expect(text).toContain('PACKED_SMI_ELEMENTS');
    expect(text).toContain('one-directional');
  });

  it('buildArrayDeclareBrain identifies PACKED_SMI_ELEMENTS for integer array', () => {
    const text = buildArrayDeclareBrain('nums', [1, 2, 3]);
    expect(text).toContain('PACKED_SMI_ELEMENTS');
    expect(text).toContain('Elements Kind');
    expect(text).toContain('type consistency');
  });

  it('buildArrayDeclareBrain identifies PACKED_ELEMENTS for mixed array', () => {
    const text = buildArrayDeclareBrain('mix', [1, 'two', 3]);
    expect(text).toContain('PACKED_ELEMENTS');
  });

  it('buildArrayPushBrain detects kind transition on type change', () => {
    const oldArr = [1, 2, 3];
    const newArr = [1, 2, 3, 'four'];
    const text = buildArrayPushBrain('nums', oldArr, newArr, 'four');
    expect(text).toContain('transitions from');
    expect(text).toContain('permanent');
    expect(text).toContain('PACKED_ELEMENTS');
  });

  it('buildArrayPushBrain reports stable kind when type consistent', () => {
    const oldArr = [1, 2, 3];
    const newArr = [1, 2, 3, 4];
    const text = buildArrayPushBrain('nums', oldArr, newArr, 4);
    expect(text).toContain('remains PACKED_SMI_ELEMENTS');
  });

  it('buildArrayPopBrain mentions the_hole and Elements Kind', () => {
    const text = buildArrayPopBrain('nums', [1, 2, 3], [1, 2], 3);
    expect(text).toContain('the_hole');
    expect(text).toContain('Elements Kind');
  });

  it('buildArrayShiftBrain mentions O(n) and backing store', () => {
    const text = buildArrayShiftBrain('nums', [1, 2, 3], [2, 3], 1);
    expect(text).toContain('O(n)');
    expect(text).toContain('backing store');
  });

  it('buildArraySortBrain mentions TimSort and Elements Kind', () => {
    const text = buildArraySortBrain('nums', [3, 1, 2], [1, 2, 3]);
    expect(text).toContain('TimSort');
    expect(text).toContain('Elements Kind');
  });

  it('buildArraySetBrain detects kind transition', () => {
    const text = buildArraySetBrain('nums', 0, [1, 2, 3], ['a', 2, 3]);
    expect(text).toContain('transitions from');
    expect(text).toContain('permanent');
  });

  it('buildArrayDoneBrain mentions array operations and Elements Kinds', () => {
    const text = buildArrayDoneBrain({ nums: [1, 2, 3] }, { extra: { arrOps: 3 } });
    expect(text).toContain('3 array operations');
    expect(text).toContain('Elements Kinds');
    expect(text).toContain('PACKED_SMI_ELEMENTS');
  });
});

describe('ArrayFlow brain text integration', () => {
  it('start step uses array brain when trackArrays is on', () => {
    const code = 'let nums = [1, 2, 3];\nnums.push(4);';
    const { steps } = run(code, { trackArrays: true });
    expect(steps[0].brain).toContain('Elements Kind');
    expect(steps[0].brain).toContain('one-directional');
  });

  it('array declaration step mentions Elements Kind', () => {
    const code = 'let nums = [1, 2, 3];';
    const { steps } = run(code, { trackArrays: true });
    const declStep = steps.find(s => s.phase === 'ds-create');
    expect(declStep).toBeTruthy();
    expect(declStep.brain).toContain('Elements Kind');
    expect(declStep.brain).toContain('PACKED_SMI_ELEMENTS');
  });

  it('push step mentions Elements Kind and backing store', () => {
    const code = 'let nums = [1, 2, 3];\nnums.push(4);';
    const { steps } = run(code, { trackArrays: true });
    const pushStep = steps.find(s => s.phase === 'ds-push');
    expect(pushStep).toBeTruthy();
    expect(pushStep.brain).toContain('Elements Kind');
    expect(pushStep.brain).toContain('backing store');
  });

  it('done step uses array brain when trackArrays is on', () => {
    const code = 'let nums = [1, 2, 3];\nnums.push(4);';
    const { steps } = run(code, { trackArrays: true });
    const doneStep = steps[steps.length - 1];
    expect(doneStep.brain).toContain('Elements Kinds');
    expect(doneStep.brain).toContain('array operation');
  });
});

// ═══════════════════════════════════════
// ObjExplorer brain text (three-layer)
// ═══════════════════════════════════════
describe('brain-text.js — objExplorer brain text', () => {
  it('buildObjStartBrain mentions Hidden Class and Inline Caching', () => {
    const text = buildObjStartBrain();
    expect(text).toContain('Hidden Class');
    expect(text).toContain('Inline Caching');
    expect(text).toContain('Dictionary Mode');
  });

  it('buildObjDeclareBrain traces HC chain for a 2-property object', () => {
    const text = buildObjDeclareBrain('user', { name: 'Alice', age: 30 });
    expect(text).toContain('HC2');
    expect(text).toContain('HC0');
    expect(text).toContain('HC1 → HC2');
    expect(text).toContain('Inline Caching');
  });

  it('buildObjSetBrain detects new property HC transition', () => {
    const text = buildObjSetBrain('user', 'email', { name: 'Alice' }, { name: 'Alice', email: 'a@b.c' });
    expect(text).toContain('HC1 to HC2');
    expect(text).toContain('Inline Caching');
    expect(text).toContain('HC0');
  });

  it('buildObjSetBrain detects overwrite (no transition)', () => {
    const text = buildObjSetBrain('user', 'name', { name: 'Alice' }, { name: 'Bob' });
    expect(text).toContain('no Hidden Class transition');
    expect(text).toContain('monomorphic');
  });

  it('buildObjDestructBrain mentions Inline-Cached reads and HC', () => {
    const text = buildObjDestructBrain(['name', 'age'], { name: 'Alice', age: 30 });
    expect(text).toContain('HC2');
    expect(text).toContain('Inline-Cached');
    expect(text).toContain('monomorphic');
  });

  it('buildObjMethodBrain mentions Hidden Class transition chain', () => {
    const text = buildObjMethodBrain('keys');
    expect(text).toContain('Object.keys()');
    expect(text).toContain('Hidden Class transition chain');
  });

  it('buildObjDoneBrain mentions object operations and Hidden Classes', () => {
    const text = buildObjDoneBrain({ user: { name: 'Alice', age: 30 } }, { extra: { objOps: 3 } });
    expect(text).toContain('3 object operations');
    expect(text).toContain('Hidden Classes');
    expect(text).toContain('HC2');
  });
});

describe('ObjExplorer brain text integration', () => {
  it('start step uses obj brain when trackObjects is on', () => {
    const code = 'let user = { name: "Alice" };\nuser.age = 30;';
    const { steps } = run(code, { trackObjects: true });
    expect(steps[0].brain).toContain('Hidden Class');
    expect(steps[0].brain).toContain('Inline Caching');
  });

  it('object declaration step mentions HC chain', () => {
    const code = 'let user = { name: "Alice", age: 30 };';
    const { steps } = run(code, { trackObjects: true });
    const declStep = steps.find(s => s.phase === 'obj-create');
    expect(declStep).toBeTruthy();
    expect(declStep.brain).toContain('Hidden Class');
    expect(declStep.brain).toContain('HC2');
  });

  it('obj-set step mentions HC transition', () => {
    const code = 'let user = { name: "Alice" };\nuser.age = 30;';
    const { steps } = run(code, { trackObjects: true });
    const setStep = steps.find(s => s.phase === 'obj-set');
    expect(setStep).toBeTruthy();
    expect(setStep.brain).toContain('Hidden Class');
    expect(setStep.brain).toContain('HC0');
  });

  it('done step uses obj brain when trackObjects is on', () => {
    const code = 'let user = { name: "Alice" };\nuser.age = 30;';
    const { steps } = run(code, { trackObjects: true });
    const doneStep = steps[steps.length - 1];
    expect(doneStep.brain).toContain('Hidden Classes');
    expect(doneStep.brain).toContain('object operation');
  });
});

// ═══════════════════════════════════════
// DataStruct brain text (three-layer)
// ═══════════════════════════════════════
describe('brain-text.js — dataStruct brain text', () => {
  it('buildDSStartBrain mentions Deterministic Hash Table and DataTable', () => {
    const text = buildDSStartBrain();
    expect(text).toContain('Deterministic Hash Table');
    expect(text).toContain('DataTable');
    expect(text).toContain('insertion order');
  });

  it('buildDSDeclareBrain for array mentions FixedArray and backing store', () => {
    const text = buildDSDeclareBrain('stack', [1, 2, 3]);
    expect(text).toContain('FixedArray');
    expect(text).toContain('insertion order');
  });

  it('buildDSDeclareBrain for object mentions hash-backed and DataTable', () => {
    const text = buildDSDeclareBrain('map', { alice: 100 });
    expect(text).toContain('hash-backed');
    expect(text).toContain('DataTable');
  });

  it('buildDSPushBrain mentions DataTable and insertion order', () => {
    const text = buildDSPushBrain('stack', 10, 3, 4);
    expect(text).toContain('DataTable');
    expect(text).toContain('insertion order');
    expect(text).toContain('O(1)');
  });

  it('buildDSPopBrain mentions hole and rehash', () => {
    const text = buildDSPopBrain('stack', 30, 2);
    expect(text).toContain('hole');
    expect(text).toContain('rehash');
    expect(text).toContain('O(1)');
  });

  it('buildDSDequeueBrain mentions O(n) and DataTable rewrite', () => {
    const text = buildDSDequeueBrain('queue', 'A', 2);
    expect(text).toContain('O(n)');
    expect(text).toContain('DataTable');
    expect(text).toContain('insertion-order');
  });

  it('buildDSSortBrain mentions TimSort and DataTable', () => {
    const text = buildDSSortBrain('pq', 3);
    expect(text).toContain('TimSort');
    expect(text).toContain('DataTable');
  });

  it('buildDSDoneBrain mentions data-structure operations and DataTable', () => {
    const text = buildDSDoneBrain({ stack: [1, 2] }, { extra: { dsOps: 5 } });
    expect(text).toContain('5 data-structure operations');
    expect(text).toContain('DataTable');
    expect(text).toContain('rehash');
  });
});

describe('DataStruct brain text integration', () => {
  it('start step uses DS brain when trackDS is on', () => {
    const code = 'let stack = [];\nstack.push(10);';
    const { steps } = run(code, { trackDS: true });
    expect(steps[0].brain).toContain('Deterministic Hash Table');
    expect(steps[0].brain).toContain('DataTable');
  });

  it('ds-create step mentions FixedArray for array DS', () => {
    const code = 'let stack = [];';
    const { steps } = run(code, { trackDS: true });
    const declStep = steps.find(s => s.phase === 'ds-create');
    expect(declStep).toBeTruthy();
    expect(declStep.brain).toContain('FixedArray');
  });

  it('ds-push step mentions DataTable', () => {
    const code = 'let stack = [];\nstack.push(10);';
    const { steps } = run(code, { trackDS: true });
    const pushStep = steps.find(s => s.phase === 'ds-push');
    expect(pushStep).toBeTruthy();
    expect(pushStep.brain).toContain('DataTable');
  });

  it('done step uses DS brain when trackDS is on', () => {
    const code = 'let stack = [];\nstack.push(10);';
    const { steps } = run(code, { trackDS: true });
    const doneStep = steps[steps.length - 1];
    expect(doneStep.brain).toContain('data-structure operation');
    expect(doneStep.brain).toContain('DataTable');
  });
});

// ═══════════════════════════════════════
// IfGate brain text (three-layer)
// ═══════════════════════════════════════
describe('brain-text.js — ifGate brain text', () => {
  it('buildIfStartBrain mentions type speculation and deoptimisation cliff', () => {
    const text = buildIfStartBrain();
    expect(text).toContain('type speculation');
    expect(text).toContain('deoptimisation cliff');
    expect(text).toContain('TurboFan');
  });

  it('buildIfConditionBrain first eval records type feedback', () => {
    const text = buildIfConditionBrain(true, true, null, 1);
    expect(text).toContain('TRUE');
    expect(text).toContain('first conditional evaluation');
    expect(text).toContain('boolean');
    expect(text).toContain('Ignition records');
  });

  it('buildIfConditionBrain same type keeps speculation active', () => {
    const text = buildIfConditionBrain(false, false, 'boolean', 2);
    expect(text).toContain('FALSE');
    expect(text).toContain('speculation holds');
  });

  it('buildIfConditionBrain type change triggers deopt cliff', () => {
    const text = buildIfConditionBrain(true, 1, 'boolean', 2);
    expect(text).toContain('deoptimisation cliff');
    expect(text).toContain('number');
    expect(text).toContain('boolean');
  });

  it('buildIfSkipBrain true path skips else', () => {
    const text = buildIfSkipBrain(true);
    expect(text).toContain('TRUE path was taken');
    expect(text).toContain('skips the else block');
    expect(text).toContain('branch predictor');
  });

  it('buildIfSkipBrain false path skips if-block', () => {
    const text = buildIfSkipBrain(false);
    expect(text).toContain('FALSE');
    expect(text).toContain('skips the if-block');
    expect(text).toContain('branch predictor');
  });

  it('buildIfElseEnterBrain mentions deoptimisation cliff', () => {
    const text = buildIfElseEnterBrain();
    expect(text).toContain('else block');
    expect(text).toContain('deoptimisation cliff');
    expect(text).toContain('TurboFan');
  });

  it('buildIfDoneBrain mentions conditional evaluations and type feedback', () => {
    const text = buildIfDoneBrain({ age: 22, canDrink: true }, { extra: { ifEvals: 1 } });
    expect(text).toContain('1 conditional evaluation');
    expect(text).toContain('type feedback');
    expect(text).toContain('deoptimisation cliff');
  });
});

describe('IfGate brain text integration', () => {
  it('start step uses if brain when trackIf is on', () => {
    const code = 'let x = 5;\nif (x > 3) { x = 10; }';
    const { steps } = run(code, { trackIf: true });
    expect(steps[0].brain).toContain('type speculation');
    expect(steps[0].brain).toContain('TurboFan');
  });

  it('condition step mentions type and speculation', () => {
    const code = 'let x = 5;\nif (x > 3) { x = 10; }';
    const { steps } = run(code, { trackIf: true });
    const condStep = steps.find(s => s.phase === 'condition');
    expect(condStep).toBeTruthy();
    expect(condStep.brain).toContain('TRUE');
    expect(condStep.brain).toContain('first conditional evaluation');
  });

  it('skip step mentions branch predictor when trackIf is on', () => {
    const code = 'let x = 1;\nif (x > 3) { x = 10; }';
    const { steps } = run(code, { trackIf: true });
    const skipStep = steps.find(s => s.phase === 'skip');
    expect(skipStep).toBeTruthy();
    expect(skipStep.brain).toContain('branch predictor');
  });

  it('else-enter step mentions deoptimisation cliff when trackIf is on', () => {
    const code = 'let x = 1;\nif (x > 3) {\n  x = 10;\n} else {\n  x = 0;\n}';
    const { steps } = run(code, { trackIf: true });
    const elseStep = steps.find(s => s.phase === 'else-enter');
    expect(elseStep).toBeTruthy();
    expect(elseStep.brain).toContain('deoptimisation cliff');
  });

  it('done step uses if brain when trackIf is on', () => {
    const code = 'let x = 5;\nif (x > 3) { x = 10; }';
    const { steps } = run(code, { trackIf: true });
    const doneStep = steps[steps.length - 1];
    expect(doneStep.brain).toContain('conditional evaluation');
    expect(doneStep.brain).toContain('type feedback');
  });
});

// ═══════════════════════════════════════
// VarStore brain text (three-layer)
// ═══════════════════════════════════════
describe('brain-text.js — varStore brain text', () => {
  it('buildVarStartBrain mentions TDZ and two-phase model', () => {
    const text = buildVarStartBrain();
    expect(text).toContain('Temporal Dead Zone');
    expect(text).toContain('two-phase');
    expect(text).toContain('Lexical Environment');
    expect(text).toContain('Script scope');
  });

  it('buildVarDeclareBrain mentions TDZ transition for let', () => {
    const text = buildVarDeclareBrain('age', 25, 'let', 1);
    expect(text).toContain('Temporal Dead Zone');
    expect(text).toContain('age');
    expect(text).toContain('let');
    expect(text).toContain('ReferenceError');
    expect(text).toContain('mutable');
  });

  it('buildVarDeclareBrain mentions immutable for const', () => {
    const text = buildVarDeclareBrain('PI', 3.14, 'const', 1);
    expect(text).toContain('const');
    expect(text).toContain('immutable');
    expect(text).toContain('Temporal Dead Zone');
  });

  it('buildVarDeclareBrain connects to prior bindings', () => {
    const text = buildVarDeclareBrain('y', 10, 'let', 3);
    expect(text).toContain('joining 2 prior bindings');
    expect(text).toContain('Script scope');
  });

  it('buildVarAssignBrain mentions Lexical Environment and IC for same type', () => {
    const text = buildVarAssignBrain('score', 0, 10);
    expect(text).toContain('Lexical Environment');
    expect(text).toContain('Inline Cache');
    expect(text).toContain('monomorphic');
    expect(text).toContain('let');
  });

  it('buildVarAssignBrain signals type change and polymorphic IC', () => {
    const text = buildVarAssignBrain('x', 42, 'hello');
    expect(text).toContain('polymorphic');
    expect(text).toContain('number');
    expect(text).toContain('string');
  });

  it('buildVarUpdateBrain mentions SMI for small integers', () => {
    const text = buildVarUpdateBrain('i', 0, 1, '++');
    expect(text).toContain('SMI');
    expect(text).toContain('++');
    expect(text).toContain('Lexical Environment');
    expect(text).toContain('TDZ');
  });

  it('buildVarDoneBrain mentions TDZ and two-phase model', () => {
    const text = buildVarDoneBrain({ x: 1, y: 2 }, { extra: { varDecls: 2 } });
    expect(text).toContain('2 declarations');
    expect(text).toContain('Temporal Dead Zone');
    expect(text).toContain('two-phase');
    expect(text).toContain('Script scope');
  });
});

describe('VarStore brain text integration', () => {
  it('start step uses var brain when trackVar is on', () => {
    const code = 'let x = 5;';
    const { steps } = run(code, { trackVar: true });
    expect(steps[0].brain).toContain('Temporal Dead Zone');
    expect(steps[0].brain).toContain('two-phase');
  });

  it('declare step mentions TDZ transition when trackVar is on', () => {
    const code = 'let age = 25;';
    const { steps } = run(code, { trackVar: true });
    const declStep = steps.find(s => s.phase === 'declare');
    expect(declStep).toBeTruthy();
    expect(declStep.brain).toContain('Temporal Dead Zone');
    expect(declStep.brain).toContain('age');
  });

  it('assign step mentions Lexical Environment when trackVar is on', () => {
    const code = 'let score = 0;\nscore = 10;';
    const { steps } = run(code, { trackVar: true });
    const assignStep = steps.find(s => s.phase === 'assign');
    expect(assignStep).toBeTruthy();
    expect(assignStep.brain).toContain('Lexical Environment');
  });

  it('done step uses var brain when trackVar is on', () => {
    const code = 'let x = 5;\nlet y = 10;';
    const { steps } = run(code, { trackVar: true });
    const doneStep = steps[steps.length - 1];
    expect(doneStep.brain).toContain('Temporal Dead Zone');
    expect(doneStep.brain).toContain('two-phase');
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
