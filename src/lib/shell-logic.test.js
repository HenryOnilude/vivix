/**
 * Unit tests for shell-logic.js — extracted ModuleShell pure logic.
 */
import { describe, it, expect } from 'vitest';
import { phColor, phIcon, computeVarDiff, markerPct, fillPct, complexityBadgeColor } from './shell-logic.js';

// ── phColor ─────────────────────────────────────────────────────────────────
describe('phColor', () => {
  it('returns #555 for null/undefined', () => {
    expect(phColor(null)).toBe('#555');
    expect(phColor(undefined)).toBe('#555');
  });

  it('returns green for declare', () => {
    expect(phColor('declare')).toBe('#4ade80');
  });

  it('returns amber for assign', () => {
    expect(phColor('assign')).toBe('#f59e0b');
  });

  it('returns purple for condition and else-enter', () => {
    expect(phColor('condition')).toBe('#a78bfa');
    expect(phColor('else-enter')).toBe('#a78bfa');
  });

  it('returns grey for skip', () => {
    expect(phColor('skip')).toBe('#6b7280');
  });

  it('returns blue for output', () => {
    expect(phColor('output')).toBe('#38bdf8');
  });

  it('returns green for done', () => {
    expect(phColor('done')).toBe('#4ade80');
  });

  it('returns accent for loop-* phases', () => {
    expect(phColor('loop-init', '#ff0000')).toBe('#ff0000');
    expect(phColor('loop-test', '#abcdef')).toBe('#abcdef');
  });

  it('returns accent for fn-* phases', () => {
    expect(phColor('fn-call', '#123456')).toBe('#123456');
    expect(phColor('fn-return', '#aabbcc')).toBe('#aabbcc');
  });

  it('returns default accent when no accent supplied for loop/fn', () => {
    expect(phColor('loop-body')).toBe('#38bdf8');
    expect(phColor('fn-enter')).toBe('#38bdf8');
  });

  it('returns #555 for unknown phases', () => {
    expect(phColor('something-else')).toBe('#555');
    expect(phColor('')).toBe('#555');
  });
});

// ── phIcon ──────────────────────────────────────────────────────────────────
describe('phIcon', () => {
  it('returns ▶ for null/undefined', () => {
    expect(phIcon(null)).toBe('▶');
    expect(phIcon(undefined)).toBe('▶');
  });

  it('returns ✓ for done', () => {
    expect(phIcon('done')).toBe('✓');
  });

  it('returns ? for condition, else-enter, skip', () => {
    expect(phIcon('condition')).toBe('?');
    expect(phIcon('else-enter')).toBe('?');
    expect(phIcon('skip')).toBe('?');
  });

  it('returns ↻ for loop phases', () => {
    expect(phIcon('loop-init')).toBe('↻');
    expect(phIcon('loop-body')).toBe('↻');
  });

  it('returns ƒ for function phases', () => {
    expect(phIcon('fn-call')).toBe('ƒ');
    expect(phIcon('fn-return')).toBe('ƒ');
  });

  it('returns ▶ for unknown phases', () => {
    expect(phIcon('declare')).toBe('▶');
    expect(phIcon('assign')).toBe('▶');
  });
});

// ── computeVarDiff ──────────────────────────────────────────────────────────
describe('computeVarDiff', () => {
  it('marks all vars as new when previous is empty', () => {
    const diff = computeVarDiff({ x: 1, y: 'hello' }, {});
    expect(diff).toEqual({ x: 'new', y: 'new' });
  });

  it('marks unchanged vars as same', () => {
    const diff = computeVarDiff({ x: 1 }, { x: 1 });
    expect(diff).toEqual({ x: 'same' });
  });

  it('marks modified vars as changed', () => {
    const diff = computeVarDiff({ x: 2 }, { x: 1 });
    expect(diff).toEqual({ x: 'changed' });
  });

  it('handles mixed new/changed/same', () => {
    const diff = computeVarDiff(
      { a: 1, b: 'new', c: [1, 2] },
      { a: 1, c: [1, 3] }
    );
    expect(diff).toEqual({ a: 'same', b: 'new', c: 'changed' });
  });

  it('returns empty for empty current', () => {
    expect(computeVarDiff({}, { x: 1 })).toEqual({});
  });

  it('detects changes in nested objects', () => {
    const diff = computeVarDiff(
      { obj: { a: 1, b: 2 } },
      { obj: { a: 1, b: 3 } }
    );
    expect(diff).toEqual({ obj: 'changed' });
  });
});

// ── markerPct ───────────────────────────────────────────────────────────────
describe('markerPct', () => {
  it('returns 0 for first step', () => {
    expect(markerPct(0, 10)).toBe(0);
  });

  it('returns 100 for last step', () => {
    expect(markerPct(9, 10)).toBe(100);
  });

  it('returns 50 for middle step', () => {
    expect(markerPct(5, 11)).toBeCloseTo(50, 5);
  });

  it('returns 0 when total is 1 (edge case)', () => {
    expect(markerPct(0, 1)).toBe(0);
  });

  it('returns 0 when total is 0', () => {
    expect(markerPct(0, 0)).toBe(0);
  });
});

// ── fillPct ─────────────────────────────────────────────────────────────────
describe('fillPct', () => {
  it('returns 0 for step 0', () => {
    expect(fillPct(0, 10)).toBe(0);
  });

  it('returns 100 for last step', () => {
    expect(fillPct(9, 10)).toBe(100);
  });

  it('returns 0 when total <= 1', () => {
    expect(fillPct(0, 1)).toBe(0);
    expect(fillPct(0, 0)).toBe(0);
  });
});

// ── complexityBadgeColor ────────────────────────────────────────────────────
describe('complexityBadgeColor', () => {
  it('returns correct colour for O(1)', () => {
    const c = complexityBadgeColor('O(1)');
    expect(c).toBeTruthy();
    expect(c).not.toBe('#555');
  });

  it('returns correct colour for O(n)', () => {
    const c = complexityBadgeColor('O(n)');
    expect(c).toBeTruthy();
  });

  it('returns fallback for unknown complexity', () => {
    expect(complexityBadgeColor('O(??)')).toBe('#4ade80');
  });

  it('returns fallback for empty string', () => {
    expect(complexityBadgeColor('')).toBe('#4ade80');
  });
});
