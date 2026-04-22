/**
 * llm-worker.js — Web Worker entry for WebLLM inference.
 *
 * Runs the entire Phi-3.5-mini model off the main thread so the UI
 * (execution timeline, CPU dashboard, animations) stays responsive.
 * WebLLM handles IndexedDB weight caching automatically — after first
 * download, subsequent loads resolve from cache in 1–10 seconds.
 */

import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg) => {
  handler.onmessage(msg);
};
