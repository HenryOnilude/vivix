/**
 * Vivix — JavaScript Visualizer
 *
 * @author     Henry Onilude
 * @copyright  2026 Henry Onilude
 * @license    MIT
 * @link       https://github.com/HenryOnilude/vivix
 */

// Wrapper around the interpreter Web Worker.
// Falls back to synchronous execution if Workers aren't available.
import { interpret } from './interpreter.js';

// Watchdog timeout. Long enough for a legitimate 500-step heavy program
// (plus worker sanitization), short enough that a frozen worker produces a
// clean error instead of a multi-second hang.
const WORKER_TIMEOUT_MS = 10000;

/**
 * @returns {{ run: (code: string, options?: object) => Promise<{steps: any[], error: string|null, friendly: any}>, terminate: () => void }}
 */
export function createInterpreterWorker() {
  let worker = null;
  let supported = true;

  function spawn() {
    try {
      worker = new Worker(
        new URL('./interpreter.worker.js', import.meta.url),
        { type: 'module' }
      );
    } catch {
      supported = false;
    }
  }
  spawn();

  /**
   * Run the interpreter. Returns a promise that resolves with { steps, error, friendly }.
   * If the worker is unavailable, falls back to synchronous execution.
   */
  function run(code, options = {}) {
    if (!supported || !worker) {
      // Fallback: synchronous on main thread
      return Promise.resolve(interpret(code, options));
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (val) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(val);
      };

      // Watchdog: if the worker doesn't return in time it's hung (e.g. a
      // synchronous operation that never increments steps). Force-terminate
      // it, respawn a fresh worker so the session self-heals, and surface a
      // graceful message instead of leaving a dead worker cached.
      const timeout = setTimeout(() => {
        try { worker.terminate(); } catch { /* already dead */ }
        worker = null;
        spawn();
        finish({
          steps: [],
          error: 'Execution stopped',
          friendly: {
            friendly: 'Execution stopped — this code may run too long or contain an unsupported pattern.',
            hint: 'Try simplifying the code, reducing loop sizes, or removing complex regular expressions.',
          },
        });
      }, WORKER_TIMEOUT_MS);

      worker.onmessage = (e) => finish(e.data);

      worker.onerror = () => {
        // Worker crashed (script/load error, not a hang). Fall back to
        // synchronous execution, which is bounded by the 500-step cap.
        try {
          finish(interpret(code, options));
        } catch (err) {
          finish({ steps: [], error: err.message, friendly: null });
        }
      };

      worker.postMessage({ code, options });
    });
  }

  function terminate() {
    if (worker) {
      worker.terminate();
      worker = null;
    }
  }

  return { run, terminate };
}
