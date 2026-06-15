/**
 * Vivix — JavaScript Visualizer
 *
 * @author     Henry Onilude
 * @copyright  2026 Henry Onilude
 * @license    MIT
 * @link       https://github.com/HenryOnilude/vivix
 */

// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encodeCode, decodeCode, parseUrlState, buildShareUrl } from './url-state.js';

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

describe('parseUrlState', () => {
  it('returns home route for empty / root path', () => {
    const result = parseUrlState('/', '');
    expect(result.route).toBe('home');
    expect(result.ex).toBeNull();
    expect(result.step).toBeNull();
    expect(result.code).toBeNull();
  });

  it('parses route without params', () => {
    const result = parseUrlState('/variables', '');
    expect(result.route).toBe('variables');
    expect(result.ex).toBeNull();
  });

  it('parses route with ex param', () => {
    const result = parseUrlState('/closures', '?ex=3');
    expect(result.route).toBe('closures');
    expect(result.ex).toBe(3);
  });

  it('parses route with ex and step params', () => {
    const result = parseUrlState('/if-gate', '?ex=1&step=5');
    expect(result.route).toBe('if-gate');
    expect(result.ex).toBe(1);
    expect(result.step).toBe(5);
  });

  it('parses route with code param', () => {
    const code = 'let a = 1;';
    const encoded = encodeCode(code);
    const result = parseUrlState('/variables', `?code=${encoded}`);
    expect(result.route).toBe('variables');
    expect(result.code).toBe(code);
  });

  it('parses route with all params', () => {
    const code = 'let x = 10;\nx = x + 5;';
    const encoded = encodeCode(code);
    const result = parseUrlState('/for-loop', `?ex=2&step=7&code=${encoded}`);
    expect(result.route).toBe('for-loop');
    expect(result.ex).toBe(2);
    expect(result.step).toBe(7);
    expect(result.code).toBe(code);
  });

  it('ignores invalid ex values', () => {
    expect(parseUrlState('/variables', '?ex=abc').ex).toBeNull();
    expect(parseUrlState('/variables', '?ex=-1').ex).toBeNull();
  });

  it('ignores invalid step values', () => {
    expect(parseUrlState('/variables', '?step=xyz').step).toBeNull();
  });

  it('allows step=-1', () => {
    expect(parseUrlState('/variables', '?step=-1').step).toBe(-1);
  });
});

describe('buildShareUrl', () => {
  it('builds basic URL with just route', () => {
    const url = buildShareUrl({ route: 'variables', ex: 0, step: -1, code: '', exampleCode: '' });
    expect(url).toContain('/variables');
    expect(url).toContain('utm_source=share');
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

    // Extract the code param and decode it from the path-based URL
    const u = new URL(url);
    const params = new URLSearchParams(u.search);
    const decoded = decodeCode(params.get('code'));
    expect(decoded).toBe(customCode);
  });
});
