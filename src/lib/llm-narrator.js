/**
 * llm-narrator.js — Main-thread API wrapping the WebLLM engine running in
 * a dedicated Web Worker. Used by Free-Form mode to narrate execution
 * steps that the Pattern Registry cannot classify.
 *
 * Model: Phi-3.5-mini-instruct (q4f16_1) — chosen for the best quality-
 * to-memory ratio for browser-based inference. Weights (~2GB) are cached
 * in IndexedDB after the first download so subsequent loads take 1–10
 * seconds instead of several minutes.
 *
 * Usage:
 *   const narrator = createNarrator();
 *   await narrator.init(({ progress, text }) => { ... });
 *   await narrator.narrate(ctx, (delta, full) => { ... });
 */

const MODEL_ID = 'Phi-3.5-mini-instruct-q4f16_1-MLC';

// Lazy-loaded WebLLM entry — keeps the main bundle small.
let _CreateWebWorkerMLCEngine = null;
async function loadWebLLM() {
  if (_CreateWebWorkerMLCEngine) return _CreateWebWorkerMLCEngine;
  const mod = await import('@mlc-ai/web-llm');
  _CreateWebWorkerMLCEngine = mod.CreateWebWorkerMLCEngine;
  return _CreateWebWorkerMLCEngine;
}

/**
 * Build the exact prompt specified in the product requirements.
 * Must remain verbatim — templates are tuned for this phrasing.
 */
export function buildPrompt({ nodeType, heapBefore, heapAfter, stack }) {
  return `You are explaining a JavaScript execution step to an intermediate developer. The current AST node is ${nodeType}. The heap state before this step was ${heapBefore}. The heap state after is ${heapAfter}. The call stack is ${stack}. Explain this step in three layers: what happened mechanically, why the V8 engine works this way, and how this connects to the next step. Total response must be 40-60 words. Active voice. No second person. Refer to the engine not the developer.`;
}

/**
 * Create a narrator instance. Only `init()` is expensive — keep one
 * instance per page and reuse it across all steps / programs.
 */
export function createNarrator() {
  let engine = null;
  let worker = null;
  let ready = false;
  let loading = false;
  let initPromise = null;
  let activeAbort = null;

  async function init(onProgress) {
    if (ready) return;
    if (initPromise) return initPromise;

    loading = true;
    initPromise = (async () => {
      const CreateWebWorkerMLCEngine = await loadWebLLM();
      // Vite resolves this worker URL at build time.
      worker = new Worker(
        new URL('./llm-worker.js', import.meta.url),
        { type: 'module' }
      );
      engine = await CreateWebWorkerMLCEngine(worker, MODEL_ID, {
        initProgressCallback: (report) => {
          if (typeof onProgress === 'function') {
            onProgress({
              progress: report.progress ?? 0,
              text: report.text ?? '',
              timeElapsed: report.timeElapsed ?? 0,
            });
          }
        },
      });
      ready = true;
      loading = false;
    })();

    try {
      await initPromise;
    } catch (e) {
      loading = false;
      initPromise = null;
      throw e;
    }
  }

  /**
   * Stream a narration for a single step. Calls `onToken(delta, full)`
   * for every new token chunk. Resolves with the full text.
   *
   * Cancelling an in-flight narration (e.g. when the user jumps to a
   * different step) is best-effort — WebLLM does not yet expose a hard
   * abort so we drop tokens after abort instead.
   */
  async function narrate(ctx, onToken) {
    if (!ready || !engine) throw new Error('Narrator not initialised');

    // Cancel the previous narration (soft — drop later chunks).
    if (activeAbort) activeAbort.cancelled = true;
    const abort = { cancelled: false };
    activeAbort = abort;

    const prompt = buildPrompt(ctx);
    const stream = await engine.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a precise technical writer. Respond in 40-60 words. Use three short paragraphs separated by a blank line: the first describes what happened mechanically, the second explains why the V8 engine works this way, the third connects to the next step. Active voice. No second person. Refer to "the engine", never "you".',
        },
        { role: 'user', content: prompt },
      ],
      stream: true,
      temperature: 0.3,
      max_tokens: 220,
    });

    let full = '';
    for await (const chunk of stream) {
      if (abort.cancelled) break;
      const delta = chunk.choices?.[0]?.delta?.content ?? '';
      if (delta) {
        full += delta;
        if (typeof onToken === 'function') onToken(delta, full);
      }
    }
    if (activeAbort === abort) activeAbort = null;
    return full;
  }

  function cancel() {
    if (activeAbort) activeAbort.cancelled = true;
  }

  async function dispose() {
    cancel();
    try {
      if (engine && typeof engine.unload === 'function') {
        await engine.unload();
      }
    } catch (_) { /* ignore */ }
    if (worker) {
      worker.terminate();
      worker = null;
    }
    engine = null;
    ready = false;
    loading = false;
    initPromise = null;
  }

  function isReady()   { return ready; }
  function isLoading() { return loading; }

  return { init, narrate, cancel, dispose, isReady, isLoading };
}
