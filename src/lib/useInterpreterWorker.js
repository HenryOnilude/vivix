/**
 * Wrapper around the interpreter Web Worker.
 * Provides an async `run(code, options)` function that returns the same
 * shape as `interpret()` but executes off the main thread.
 *
 * Falls back to the synchronous interpreter if Workers are unavailable.
 *
 * Usage:
 *   import { createInterpreterWorker } from './useInterpreterWorker.js';
 *   const worker = createInterpreterWorker();
 *   const { steps, error, friendly } = await worker.run(code, opts);
 *   worker.terminate(); // when done
 */
import { interpret } from './interpreter.js';

/**
 * @returns {{ run: (code: string, options?: object) => Promise<{steps: any[], error: string|null, friendly: any}>, terminate: () => void }}
 */
export function createInterpreterWorker() {
  let worker = null;
  let supported = true;

  try {
    worker = new Worker(
      new URL('./interpreter.worker.js', import.meta.url),
      { type: 'module' }
    );
  } catch {
    supported = false;
  }

  /**
   * Run the interpreter. Returns a promise that resolves with { steps, error, friendly }.
   * If the worker is unavailable, falls back to synchronous execution.
   */
  function run(code, options = {}) {
    if (!supported || !worker) {
      // Fallback: synchronous on main thread
      return Promise.resolve(interpret(code, options));
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Interpreter worker timed out (30s)'));
      }, 30000);

      worker.onmessage = (e) => {
        clearTimeout(timeout);
        resolve(e.data);
      };

      worker.onerror = (e) => {
        clearTimeout(timeout);
        // Fall back to synchronous
        try {
          resolve(interpret(code, options));
        } catch (err) {
          reject(err);
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
