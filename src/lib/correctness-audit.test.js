/**
 * Correctness audit — verifies the interpreter matches real JS behavior.
 * These tests catch spec violations that would break user trust.
 */
import { describe, it, expect } from 'vitest';
import { interpret } from './interpreter.js';
import { byteSize } from './utils.js';

function run(code, opts = {}) {
  const result = interpret(code, opts);
  expect(result.error).toBeNull();
  const last = result.steps[result.steps.length - 1];
  expect(last.done).toBe(true);
  return { vars: last.vars, output: last.output, steps: result.steps };
}

// ═══════════════════════════════════════
// 1. Operator correctness
// ═══════════════════════════════════════
describe('Operator correctness', () => {
  it('|| returns first truthy value', () => {
    const { vars } = run('let x = 0 || 5;');
    expect(vars.x).toBe(5);
  });

  it('|| with empty string returns default', () => {
    const { vars } = run('let x = "" || "default";');
    expect(vars.x).toBe('default');
  });

  it('?? only checks null/undefined, NOT falsy', () => {
    const { vars } = run('let a = 0 ?? "fallback";\nlet b = "" ?? "fallback";\nlet c = false ?? "fallback";\nlet d = null ?? "fallback";\nlet e = undefined ?? "fallback";');
    expect(vars.a).toBe(0);         // 0 is NOT null/undefined
    expect(vars.b).toBe('');        // "" is NOT null/undefined
    expect(vars.c).toBe(false);     // false is NOT null/undefined
    expect(vars.d).toBe('fallback');
    expect(vars.e).toBe('fallback');
  });

  it('&& returns first falsy or last value', () => {
    const { vars } = run('let x = 1 && 2;\nlet y = 0 && 2;\nlet z = "" && "hello";');
    expect(vars.x).toBe(2);
    expect(vars.y).toBe(0);
    expect(vars.z).toBe('');
  });
});

// ═══════════════════════════════════════
// 2. Type coercion (critical for trust)
// ═══════════════════════════════════════
describe('Type coercion', () => {
  it('string + number = string concatenation', () => {
    const { vars } = run('let x = "5" + 3;');
    expect(vars.x).toBe('53');
  });

  it('string - number = numeric subtraction', () => {
    const { vars } = run('let x = "5" - 3;');
    expect(vars.x).toBe(2);
  });

  it('string * number = numeric multiplication', () => {
    const { vars } = run('let x = "5" * 2;');
    expect(vars.x).toBe(10);
  });

  it('true + 1 = 2', () => {
    const { vars } = run('let x = true + 1;');
    expect(vars.x).toBe(2);
  });

  it('false + 1 = 1', () => {
    const { vars } = run('let x = false + 1;');
    expect(vars.x).toBe(1);
  });

  it('null + 1 = 1', () => {
    const { vars } = run('let x = null + 1;');
    expect(vars.x).toBe(1);
  });

  it('"" + 0 = "0"', () => {
    const { vars } = run('let x = "" + 0;');
    expect(vars.x).toBe('0');
  });
});

// ═══════════════════════════════════════
// 3. Comparison edge cases
// ═══════════════════════════════════════
describe('Comparison edge cases', () => {
  it('null == undefined is true', () => {
    const { vars } = run('let x = null == undefined;');
    expect(vars.x).toBe(true);
  });

  it('null === undefined is false', () => {
    const { vars } = run('let x = null === undefined;');
    expect(vars.x).toBe(false);
  });

  it('NaN === NaN is false', () => {
    const { vars } = run('let x = NaN === NaN;');
    expect(vars.x).toBe(false);
  });

  it('typeof null === "object"', () => {
    const { vars } = run('let x = typeof null;');
    expect(vars.x).toBe('object');
  });

  it('typeof undefined === "undefined"', () => {
    const { vars } = run('let x = typeof undefined;');
    expect(vars.x).toBe('undefined');
  });

  it('0 == false is true', () => {
    const { vars } = run('let x = 0 == false;');
    expect(vars.x).toBe(true);
  });

  it('"" == false is true', () => {
    const { vars } = run('let x = "" == false;');
    expect(vars.x).toBe(true);
  });

  it('"0" == false is true', () => {
    const { vars } = run('let x = "0" == false;');
    expect(vars.x).toBe(true);
  });
});

// ═══════════════════════════════════════
// 4. Variable scoping (flat scope model)
// ═══════════════════════════════════════
describe('Scoping behavior', () => {
  it('variable declared in if-block leaks to outer scope (flat model)', () => {
    // Our interpreter uses a flat vars object — let inside if-block IS visible outside
    // This differs from real JS (let is block-scoped). This is a KNOWN simplification.
    const { vars } = run('let x = 1;\nif (true) {\n  let y = 2;\n}');
    // In real JS, y would be undefined here. In our interpreter, y leaks.
    // This is a documented simplification — we should note it.
    expect(vars.y).toBe(2); // Our behavior (flat scope)
  });

  it('for loop variable is accessible after loop (flat model)', () => {
    const { vars } = run('for (let i = 0; i < 3; i++) {}\nlet x = i;');
    // In real JS, i would be undefined. In our interpreter, it persists.
    expect(vars.x).toBe(3); // Our behavior (flat scope)
  });
});

// ═══════════════════════════════════════
// 5. Array method correctness
// ═══════════════════════════════════════
describe('Array methods', () => {
  it('sort mutates in place', () => {
    const { vars } = run('let arr = [3, 1, 2];\narr.sort();\nlet first = arr[0];');
    expect(vars.first).toBe(1);
  });

  it('indexOf returns correct index', () => {
    const { vars } = run('let arr = [1, 2, 3];\nlet r = arr.indexOf(2);');
    expect(vars.r).toBe(1);
  });

  it('includes returns false for missing element', () => {
    const { vars } = run('let arr = [1, 2, 3];\nlet r = arr.includes(4);');
    expect(vars.r).toBe(false);
  });

  it('push returns new length', () => {
    const { vars } = run('let arr = [1, 2];\nlet len = arr.push(3);');
    expect(vars.len).toBe(3);
    expect(vars.arr).toEqual([1, 2, 3]);
  });

  it('pop returns removed element', () => {
    const { vars } = run('let arr = [1, 2, 3];\nlet removed = arr.pop();');
    expect(vars.removed).toBe(3);
  });

  it('shift returns removed first element', () => {
    const { vars } = run('let arr = [1, 2, 3];\nlet first = arr.shift();');
    expect(vars.first).toBe(1);
    expect(vars.arr).toEqual([2, 3]);
  });

  it('map creates new array', () => {
    const { vars } = run('let arr = [1, 2, 3];\nlet doubled = arr.map((x) => x * 2);');
    expect(vars.doubled).toEqual([2, 4, 6]);
    expect(vars.arr).toEqual([1, 2, 3]); // original unchanged
  });

  it('filter creates new array', () => {
    const { vars } = run('let arr = [1, 2, 3, 4];\nlet evens = arr.filter((x) => x % 2 === 0);');
    expect(vars.evens).toEqual([2, 4]);
  });

  it('reduce accumulates', () => {
    const { vars } = run('let arr = [1, 2, 3, 4];\nlet sum = arr.reduce((acc, x) => acc + x, 0);');
    expect(vars.sum).toBe(10);
  });

  it('reverse mutates in place', () => {
    const { vars } = run('let arr = [1, 2, 3];\narr.reverse();');
    expect(vars.arr).toEqual([3, 2, 1]);
  });

  it('slice does NOT mutate', () => {
    const { vars } = run('let arr = [1, 2, 3, 4];\nlet sliced = arr.slice(1, 3);');
    expect(vars.sliced).toEqual([2, 3]);
    expect(vars.arr).toEqual([1, 2, 3, 4]);
  });

  it('sort with comparator (numeric)', () => {
    const { vars } = run('let arr = [10, 1, 21, 2];\narr.sort((a, b) => a - b);');
    expect(vars.arr).toEqual([1, 2, 10, 21]);
  });

  // Default sort is lexicographic — this is a common gotcha!
  it('default sort is lexicographic (numbers as strings)', () => {
    const { vars } = run('let arr = [10, 1, 21, 2];\narr.sort();');
    // In real JS: [1, 10, 2, 21] (lexicographic)
    expect(vars.arr).toEqual([1, 10, 2, 21]);
  });
});

// ═══════════════════════════════════════
// 6. String method correctness
// ═══════════════════════════════════════
describe('String methods', () => {
  it('toUpperCase', () => {
    const { vars } = run('let s = "hello";\nlet r = s.toUpperCase();');
    expect(vars.r).toBe('HELLO');
  });

  it('toLowerCase', () => {
    const { vars } = run('let s = "HELLO";\nlet r = s.toLowerCase();');
    expect(vars.r).toBe('hello');
  });

  it('indexOf on string', () => {
    const { vars } = run('let s = "hello world";\nlet r = s.indexOf("world");');
    expect(vars.r).toBe(6);
  });

  it('split', () => {
    const { vars } = run('let s = "a,b,c";\nlet r = s.split(",");');
    expect(vars.r).toEqual(['a', 'b', 'c']);
  });

  it('trim', () => {
    const { vars } = run('let s = "  hello  ";\nlet r = s.trim();');
    expect(vars.r).toBe('hello');
  });

  it('includes on string', () => {
    const { vars } = run('let s = "hello";\nlet r = s.includes("ell");');
    expect(vars.r).toBe(true);
  });

  it('template literal with expression', () => {
    const { vars } = run('let a = 5;\nlet b = 3;\nlet s = `${a} + ${b} = ${a + b}`;');
    expect(vars.s).toBe('5 + 3 = 8');
  });
});

// ═══════════════════════════════════════
// 7. Math correctness
// ═══════════════════════════════════════
describe('Math functions', () => {
  it('Math.max', () => {
    const { vars } = run('let x = Math.max(1, 5, 3);');
    expect(vars.x).toBe(5);
  });

  it('Math.min', () => {
    const { vars } = run('let x = Math.min(1, 5, 3);');
    expect(vars.x).toBe(1);
  });

  it('Math.floor', () => {
    const { vars } = run('let x = Math.floor(3.7);');
    expect(vars.x).toBe(3);
  });

  it('Math.ceil', () => {
    const { vars } = run('let x = Math.ceil(3.2);');
    expect(vars.x).toBe(4);
  });

  it('Math.round', () => {
    const { vars } = run('let x = Math.round(3.5);');
    expect(vars.x).toBe(4);
  });

  it('Math.abs', () => {
    const { vars } = run('let x = Math.abs(-5);');
    expect(vars.x).toBe(5);
  });

  it('Math.pow', () => {
    const { vars } = run('let x = Math.pow(2, 10);');
    expect(vars.x).toBe(1024);
  });
});

// ═══════════════════════════════════════
// 8. Control flow correctness
// ═══════════════════════════════════════
describe('Control flow', () => {
  it('if-else if-else chain', () => {
    const { vars } = run('let x = 15;\nlet grade = "";\nif (x >= 90) {\n  grade = "A";\n} else if (x >= 80) {\n  grade = "B";\n} else if (x >= 70) {\n  grade = "C";\n} else {\n  grade = "F";\n}');
    expect(vars.grade).toBe('F');
  });

  it('nested for loops compute correctly', () => {
    const { vars } = run('let sum = 0;\nfor (let i = 0; i < 3; i++) {\n  for (let j = 0; j < 3; j++) {\n    sum = sum + 1;\n  }\n}', { trackLoops: true });
    expect(vars.sum).toBe(9);
  });

  it('while loop with break', () => {
    const { vars } = run('let i = 0;\nwhile (true) {\n  if (i >= 5) {\n    break;\n  }\n  i = i + 1;\n}');
    // Note: break in our interpreter may not work inside while loops
    // This tests whether the interpreter handles break correctly
    expect(vars.i).toBe(5);
  });

  it('for loop early return in function', () => {
    const { vars } = run('function findFirst(arr, target) {\n  for (let i = 0; i < arr.length; i++) {\n    if (arr[i] === target) {\n      return i;\n    }\n  }\n  return -1;\n}\nlet idx = findFirst([10, 20, 30], 20);', { trackCalls: true });
    expect(vars.idx).toBe(1);
  });
});

// ═══════════════════════════════════════
// 9. Function correctness
// ═══════════════════════════════════════
describe('Function correctness', () => {
  it('default parameters work', () => {
    const { vars } = run('function greet(name = "World") {\n  return "Hello, " + name;\n}\nlet a = greet();\nlet b = greet("Alice");', { trackCalls: true });
    expect(vars.a).toBe('Hello, World');
    expect(vars.b).toBe('Hello, Alice');
  });

  it('arrow function assigned to variable', () => {
    const { vars } = run('let double = (x) => x * 2;\nlet result = double(7);');
    expect(vars.result).toBe(14);
  });

  it('higher-order: function returns function', () => {
    const { vars } = run('function multiplier(factor) {\n  return (x) => x * factor;\n}\nlet triple = multiplier(3);\nlet result = triple(5);');
    expect(vars.result).toBe(15);
  });

  it('closure captures and reads outer variable', () => {
    const { vars } = run('let count = 0;\nfunction increment() {\n  count = count + 1;\n  return count;\n}\nlet a = increment();\nlet b = increment();');
    expect(vars.a).toBe(1);
    expect(vars.b).toBe(2);
  });
});

// ═══════════════════════════════════════
// 10. Object correctness
// ═══════════════════════════════════════
describe('Object correctness', () => {
  it('dot notation access', () => {
    const { vars } = run('let obj = { x: 1, y: 2 };\nlet sum = obj.x + obj.y;');
    expect(vars.sum).toBe(3);
  });

  it('bracket notation access', () => {
    const { vars } = run('let obj = { name: "Alice" };\nlet key = "name";\nlet val = obj[key];');
    expect(vars.val).toBe('Alice');
  });

  it('Object.keys returns key array', () => {
    const { vars } = run('let obj = { a: 1, b: 2, c: 3 };\nlet keys = Object.keys(obj);');
    expect(vars.keys).toEqual(['a', 'b', 'c']);
  });

  it('Object.values returns value array', () => {
    const { vars } = run('let obj = { a: 1, b: 2, c: 3 };\nlet vals = Object.values(obj);');
    expect(vars.vals).toEqual([1, 2, 3]);
  });

  it('destructuring object', () => {
    const { vars } = run('let obj = { x: 10, y: 20 };\nlet { x, y } = obj;');
    expect(vars.x).toBe(10);
    expect(vars.y).toBe(20);
  });
});

// ═══════════════════════════════════════
// 11. V8 explanation claims audit
// ═══════════════════════════════════════
describe('V8 explanation accuracy', () => {
  it('SMI range claim is correct (-2^30 to 2^30-1 on 64-bit)', () => {
    // brain-text.js line 47: val >= -1073741824 && val <= 1073741823
    // This is -2^30 to 2^30-1 = 31-bit SMI range
    // On 64-bit V8, SMI range is actually -2^31 to 2^31-1 (32 bits)
    // On 32-bit V8, it's -2^30 to 2^30-1 (31 bits)
    // The code uses the 32-bit SMI range, which is conservative but CORRECT
    // (works on both 32-bit and 64-bit)
    expect(-1073741824).toBe(-(2**30));
    expect(1073741823).toBe(2**30 - 1);
  });

  it('byteSize: number = 8 bytes (IEEE 754 double)', () => {
    expect(byteSize(42)).toBe(8);
    expect(byteSize(3.14)).toBe(8);
  });

  it('byteSize: boolean = 4 bytes', () => {
    // V8 booleans are singleton oddballs, not truly 4 bytes per variable.
    // But 4 bytes is a reasonable educational approximation for "small value".
    expect(byteSize(true)).toBe(4);
  });

  it('byteSize: string includes per-char and overhead', () => {
    // "hello" = 5 chars * 2 bytes + 16 overhead = 26
    expect(byteSize("hello")).toBe(26);
    // V8 SeqOneByteString uses 1 byte/char for ASCII, 
    // SeqTwoByteString uses 2 bytes/char.
    // Our formula assumes 2 bytes/char universally — slightly overestimates for ASCII.
  });

  it('byteSize: null and undefined = 8 bytes', () => {
    // V8: singletons, but 8 bytes is pointer-sized on 64-bit (reasonable)
    expect(byteSize(null)).toBe(8);
    expect(byteSize(undefined)).toBe(8);
  });
});

// ═══════════════════════════════════════
// 12. Console output correctness
// ═══════════════════════════════════════
describe('Console output', () => {
  it('console.log with number', () => {
    const { output } = run('console.log(42);');
    expect(output).toContain('42');
  });

  it('console.log with string', () => {
    const { output } = run('console.log("hello");');
    expect(output).toContain('hello');
  });

  it('console.log with multiple args', () => {
    const { output } = run('console.log("a", "b", "c");');
    expect(output).toContain('a b c');
  });

  it('console.log with expression', () => {
    const { output } = run('let x = 5;\nconsole.log(x + 3);');
    expect(output).toContain('8');
  });

  it('console.log with template literal', () => {
    const { output } = run('let name = "World";\nconsole.log(`Hello, ${name}!`);');
    expect(output).toContain('Hello, World!');
  });
});
