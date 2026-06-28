/**
 * Vivix — JavaScript Visualizer
 *
 * @author     Henry Onilude
 * @copyright  2026 Henry Onilude
 * @license    MIT
 * @link       https://github.com/HenryOnilude/vivix
 */

// Regression tests for the interpreter worker watchdog (issue 1).
// A frozen worker must be force-terminated and produce a graceful error
// instead of a multi-second hang, and the session must self-heal by
// respawning a fresh worker for the next run.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createInterpreterWorker } from './useInterpreterWorker.js';

// Mock Worker: by default never responds (simulating a hung worker).
class MockWorker {
  constructor() {
    this.onmessage = null;
    this.onerror = null;
    this.terminated = false;
    MockWorker.instances.push(this);
  }
  postMessage() { /* intentionally silent — simulates a hang */ }
  terminate() { this.terminated = true; }
}
MockWorker.instances = [];

describe('useInterpreterWorker — watchdog', () => {
  let originalWorker;

  beforeEach(() => {
    originalWorker = globalThis.Worker;
    globalThis.Worker = /** @type {any} */ (MockWorker);
    MockWorker.instances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.Worker = originalWorker;
    vi.useRealTimers();
  });

  it('terminates a hung worker and resolves with a graceful error after timeout', async () => {
    const w = createInterpreterWorker();
    const p = w.run('let x = 1;', {});

    // Advance past the 10s watchdog without the worker ever responding.
    await vi.advanceTimersByTimeAsync(10000);
    const result = await p;

    // Graceful structured result — NOT a thrown/rejected 30s hang.
    expect(result.steps).toEqual([]);
    expect(result.error).toBe('Execution stopped');
    expect(result.friendly.friendly).toMatch(/Execution stopped/i);

    // The hung worker must have been force-terminated.
    expect(MockWorker.instances[0].terminated).toBe(true);
    // A fresh worker must have been respawned so the session self-heals.
    expect(MockWorker.instances.length).toBe(2);
    expect(MockWorker.instances[1].terminated).toBe(false);
  });

  it('resolves with worker data on a normal message and clears the watchdog', async () => {
    const w = createInterpreterWorker();
    const p = w.run('let x = 1;', {});

    const inst = MockWorker.instances[0];
    inst.onmessage({ data: { steps: [{ phase: 'done' }], error: null, friendly: null } });

    const result = await p;
    expect(result.steps.length).toBe(1);
    expect(result.error).toBeNull();

    // Watchdog must not fire after a successful response (no extra worker,
    // original not terminated).
    await vi.advanceTimersByTimeAsync(10000);
    expect(inst.terminated).toBe(false);
    expect(MockWorker.instances.length).toBe(1);
  });

  it('does not double-resolve when a message arrives after timeout', async () => {
    const w = createInterpreterWorker();
    const p = w.run('let x = 1;', {});
    const inst = MockWorker.instances[0];

    await vi.advanceTimersByTimeAsync(10000); // watchdog fires first

    // A late message from the (now terminated) worker must be ignored.
    inst.onmessage?.({ data: { steps: [{ phase: 'done' }], error: null, friendly: null } });

    const result = await p;
    expect(result.error).toBe('Execution stopped');
  });
});
