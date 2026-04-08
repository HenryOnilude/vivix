// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encodeCode, decodeCode, parseHashState, buildShareUrl } from './url-state.js';

describe('encodeCode / decodeCode', () => {
  it('round-trips simple ASCII code', () => {
    const code = 'let x = 42;\nconsole.log(x);';
    expect(decodeCode(encodeCode(code))).toBe(code);
  });

  it('round-trips unicode / emoji code', () => {
    const code = 'let name = "André 🚀";';
    expect(decodeCode(encodeCode(code))).toBe(code);
  });

  it('returns empty string for invalid base64', () => {
    expect(decodeCode('!!!not-valid!!!')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(encodeCode('')).toBe('');
    expect(decodeCode('')).toBe('');
  });
});

describe('parseHashState', () => {
  const originalHash = window.location.hash;
  afterEach(() => { window.location.hash = originalHash; });

  it('returns home route for empty hash', () => {
    window.location.hash = '';
    const result = parseHashState();
    expect(result.route).toBe('home');
    expect(result.ex).toBeNull();
    expect(result.step).toBeNull();
    expect(result.code).toBeNull();
  });

  it('parses route without params', () => {
    window.location.hash = '#/variables';
    const result = parseHashState();
    expect(result.route).toBe('variables');
    expect(result.ex).toBeNull();
  });

  it('parses route with ex param', () => {
    window.location.hash = '#/closures?ex=3';
    const result = parseHashState();
    expect(result.route).toBe('closures');
    expect(result.ex).toBe(3);
  });

  it('parses route with ex and step params', () => {
    window.location.hash = '#/if-gate?ex=1&step=5';
    const result = parseHashState();
    expect(result.route).toBe('if-gate');
    expect(result.ex).toBe(1);
    expect(result.step).toBe(5);
  });

  it('parses route with code param', () => {
    const code = 'let a = 1;';
    const encoded = encodeCode(code);
    window.location.hash = `#/variables?code=${encoded}`;
    const result = parseHashState();
    expect(result.route).toBe('variables');
    expect(result.code).toBe(code);
  });

  it('parses route with all params', () => {
    const code = 'let x = 10;\nx = x + 5;';
    const encoded = encodeCode(code);
    window.location.hash = `#/for-loop?ex=2&step=7&code=${encoded}`;
    const result = parseHashState();
    expect(result.route).toBe('for-loop');
    expect(result.ex).toBe(2);
    expect(result.step).toBe(7);
    expect(result.code).toBe(code);
  });

  it('ignores invalid ex values', () => {
    window.location.hash = '#/variables?ex=abc';
    expect(parseHashState().ex).toBeNull();

    window.location.hash = '#/variables?ex=-1';
    expect(parseHashState().ex).toBeNull();
  });

  it('ignores invalid step values', () => {
    window.location.hash = '#/variables?step=xyz';
    expect(parseHashState().step).toBeNull();
  });

  it('allows step=-1', () => {
    window.location.hash = '#/variables?step=-1';
    expect(parseHashState().step).toBe(-1);
  });
});

describe('buildShareUrl', () => {
  it('builds basic URL with just route', () => {
    const url = buildShareUrl({ route: 'variables', ex: 0, step: -1, code: '', exampleCode: '' });
    expect(url).toContain('#/variables');
    expect(url).not.toContain('?');
  });

  it('includes ex param when > 0', () => {
    const url = buildShareUrl({ route: 'closures', ex: 2, step: -1, code: '', exampleCode: '' });
    expect(url).toContain('ex=2');
  });

  it('does not include ex=0', () => {
    const url = buildShareUrl({ route: 'closures', ex: 0, step: -1, code: '', exampleCode: '' });
    expect(url).not.toContain('ex=');
  });

  it('includes step when >= 0', () => {
    const url = buildShareUrl({ route: 'variables', ex: 0, step: 5, code: '', exampleCode: '' });
    expect(url).toContain('step=5');
  });

  it('does not include step when -1', () => {
    const url = buildShareUrl({ route: 'variables', ex: 0, step: -1, code: '', exampleCode: '' });
    expect(url).not.toContain('step=');
  });

  it('includes code only when different from example', () => {
    const exCode = 'let x = 1;';
    const customCode = 'let y = 2;';
    const url = buildShareUrl({ route: 'variables', ex: 0, step: 0, code: customCode, exampleCode: exCode });
    expect(url).toContain('code=');

    // When code matches example, no code param
    const url2 = buildShareUrl({ route: 'variables', ex: 0, step: 0, code: exCode, exampleCode: exCode });
    expect(url2).not.toContain('code=');
  });

  it('round-trips custom code through URL', () => {
    const customCode = 'for (let i = 0; i < 10; i++) {\n  console.log(i);\n}';
    const url = buildShareUrl({ route: 'for-loop', ex: 0, step: 3, code: customCode, exampleCode: 'different' });

    // Extract the code param and decode it
    const hashPart = url.split('#/')[1];
    const queryPart = hashPart.split('?')[1];
    const params = new URLSearchParams(queryPart);
    const decoded = decodeCode(params.get('code'));
    expect(decoded).toBe(customCode);
  });
});
