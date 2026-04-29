<script>
  import { onDestroy } from 'svelte';
  import * as acorn from 'acorn';
  import { marked } from 'marked';
  import ModuleShell from './ModuleShell.svelte';
  import { posthog, scrubUrl } from './posthog.js';
  import { detectPatterns, walkAST } from './pattern-registry.js';
  import { totalBytes, fv } from './utils.js';
  import { createNarrator } from './llm-narrator.js';

  const ACCENT = '#00FFD1';

  // Configure marked for minimal, safe rendering — we feed only the LLM output.
  marked.setOptions({ breaks: true, gfm: true });

  // Free-form mode is a blank canvas — no pre-filled code, no example
  // suggestions. The editor loads empty on every visit; the developer
  // brings their own JavaScript.
  const examples = [];

  // ── Pattern lookup cache (line → match) ──────────────────────────────────
  let _patternCache = null;
  let _patternCode  = '';
  function buildPatternLookup(code) {
    if (code === _patternCode && _patternCache) return _patternCache;
    const { patterns } = detectPatterns(code);
    const lookup = {};
    for (const p of patterns) {
      if (p.loc && p.loc.start) {
        const line = p.loc.start.line - 1;
        if (!(line in lookup)) lookup[line] = p;
      }
    }
    _patternCache = lookup;
    _patternCode  = code;
    return lookup;
  }

  // ── Node-type lookup (line → outermost AST node type) ────────────────────
  let _nodeCache = null;
  let _nodeCode  = '';
  function buildNodeLookup(code) {
    if (code === _nodeCode && _nodeCache) return _nodeCache;
    const lookup = {};
    try {
      const ast = acorn.parse(code, { ecmaVersion: 2020, sourceType: 'script', locations: true });
      walkAST(ast, (n) => {
        if (!n.loc || n.type === 'Program') return;
        const line = n.loc.start.line - 1;
        if (!(line in lookup)) lookup[line] = n.type;
      });
    } catch (_) { /* ignore parse errors — LLM prompt just gets 'Unknown' */ }
    _nodeCache = lookup;
    _nodeCode  = code;
    return lookup;
  }

  function summarizeHeap(vars) {
    if (!vars) return '{} (empty)';
    const entries = Object.entries(vars);
    if (entries.length === 0) return '{} (empty)';
    const head = entries.slice(0, 6).map(([k, v]) => `${k}: ${fv(v)}`).join(', ');
    return `{ ${head}${entries.length > 6 ? ', …' : ''} }`;
  }

  function formatThreeLayer(pattern) {
    return `${pattern.what}\n\n${pattern.why}\n\n${pattern.connects}`;
  }

  function formatFallback(step) {
    const phase = step.phase || 'exec';
    const line  = step.lineIndex >= 0 ? `line ${step.lineIndex + 1}` : 'program start';
    const hl    = step.highlight ? ` involving "${step.highlight}"` : '';
    return `The engine executes a ${phase} step at ${line}${hl}. ${step.memLabel || ''}`.trim() +
           '\n\nDeeper pattern-level explanation is not cached for this step. Enable AI narration to generate one on demand.';
  }

  // ── LLM state (Svelte 5 runes) ───────────────────────────────────────────
  const narrator = createNarrator();
  let llmStatus     = $state('idle');   // 'idle' | 'loading' | 'ready' | 'error'
  let llmProgress   = $state(0);        // 0..100
  let llmProgressMsg= $state('');
  let llmError      = $state('');
  /** stepIndex → { text: string, done: boolean } */
  let llmBrains     = $state({});
  /** Most recent steps array handed back by ModuleShell */
  let stepsRef      = $state([]);
  /** Index currently being narrated (so we can cancel) */
  let narratingIdx  = -1;
  /** A revision counter that bumps on every code re-run to invalidate llmBrains */
  let runRevision   = $state(0);

  async function enableLlm() {
    if (llmStatus === 'loading' || llmStatus === 'ready') return;
    llmStatus = 'loading';
    llmError = '';
    llmProgress = 0;
    llmProgressMsg = 'Contacting model host…';
    try {
      await narrator.init(({ progress, text }) => {
        llmProgress    = Math.round(progress * 100);
        llmProgressMsg = text || llmProgressMsg;
      });
      llmStatus = 'ready';
      llmProgress = 100;
      llmProgressMsg = 'Model cached in IndexedDB — ready.';
      // Kick off narration for the current step if it already needs one
      scheduleNarration();
    } catch (e) {
      llmStatus = 'error';
      llmError = e?.message || String(e);
    }
  }

  /**
   * Kick off a sequential background narration queue. Every unmatched
   * step gets narrated in order, one at a time — Phi-3.5-mini typically
   * produces 40-60 words in 2-4 seconds, so a 10-step program finishes
   * in well under a minute. Re-running cancels and restarts.
   */
  let _queueRunning = false;
  async function scheduleNarration() {
    if (llmStatus !== 'ready') return;
    if (_queueRunning) return;
    if (!stepsRef || stepsRef.length === 0) return;
    _queueRunning = true;
    const myRevision = runRevision;

    try {
      for (let idx = 0; idx < stepsRef.length; idx++) {
        if (myRevision !== runRevision) return;
        const s = stepsRef[idx];
        if (!s || s._patternId) continue;
        if (s.phase === 'start' || s.phase === 'done') continue;
        if (llmBrains[idx]?.done) continue;
        await narrateStep(idx, myRevision);
      }
    } finally {
      _queueRunning = false;
    }
  }

  async function narrateStep(idx, myRevision) {
    narratingIdx = idx;
    const s    = stepsRef[idx];
    const prev = idx > 0 ? stepsRef[idx - 1] : null;
    const ctx = {
      nodeType:   s._nodeType || s.phase || 'Unknown',
      heapBefore: summarizeHeap(prev?.vars),
      heapAfter:  summarizeHeap(s.vars),
      stack:      s._stackLabel || '[Global]',
    };

    // Seed empty entry so the CpuDash shows the blinking caret immediately.
    llmBrains[idx] = { text: '', done: false };

    try {
      await narrator.narrate(ctx, (_delta, full) => {
        if (myRevision !== runRevision) return;
        llmBrains[idx] = { text: full, done: false };
      });
      if (myRevision === runRevision) {
        llmBrains[idx] = { text: llmBrains[idx]?.text || '', done: true };
      }
    } catch (e) {
      if (myRevision === runRevision) {
        llmBrains[idx] = {
          text: `*AI narration failed: ${e?.message || e}*`,
          done: true,
        };
      }
    } finally {
      if (narratingIdx === idx) narratingIdx = -1;
    }
  }

  // ── mapStep: each step carries a live-reactive `brain`/`_brainHtml` getter ─
  function mapStep(s, codeLines, idx) {
    const code         = codeLines.join('\n');
    const patternLk    = buildPatternLookup(code);
    const nodeLk       = buildNodeLookup(code);
    const bytes        = totalBytes(s.vars || {});
    const pattern      = patternLk[s.lineIndex];
    const nodeType     = nodeLk[s.lineIndex] || s.phase || 'Unknown';

    let patternBrain = null;
    let _patternId   = null;
    if (pattern) {
      patternBrain = formatThreeLayer(pattern);
      _patternId   = pattern.id;
    } else if (s.brain) {
      patternBrain = s.brain;
    } else {
      patternBrain = formatFallback(s);
    }

    const result = {
      ...s,
      bytes,
      _patternId,
      _nodeType: nodeType,
      _fallback: patternBrain,
    };

    // Live reactive getters — re-evaluated every time the CPU dash reads
    // `sd.brain` or `sd._brainHtml`, picking up streamed LLM tokens.
    Object.defineProperty(result, 'brain', {
      enumerable: true,
      get() {
        const llm = llmBrains[idx];
        if (llm && llm.text) return llm.text;
        return patternBrain;
      },
    });
    Object.defineProperty(result, '_brainHtml', {
      enumerable: true,
      get() {
        const llm = llmBrains[idx];
        if (!llm || !llm.text) return null;
        return marked.parse(llm.text);
      },
    });
    Object.defineProperty(result, '_brainStreaming', {
      enumerable: true,
      get() {
        const llm = llmBrains[idx];
        return !!(llm && !llm.done);
      },
    });
    return result;
  }

  function onSteps(newSteps) {
    stepsRef    = newSteps;
    runRevision++;
    llmBrains   = {};
    narratingIdx = -1;
    narrator.cancel();
    // Analytics: user clicked Visualize and we received a fresh steps array.
    // Explicitly override $current_url with a scrubbed value so the `code`
    // hash param (which holds the user's source) can never reach PostHog,
    // even if the global sanitize_properties hook is ever removed.
    try {
      posthog.capture('freeform_submitted', {
        $current_url: scrubUrl(window.location.href),
      });
    } catch (_) {}
    // Kick off background narration for every unmatched step sequentially.
    scheduleNarration();
  }

  onDestroy(() => {
    narrator.dispose();
  });

  const MODEL_LABEL = 'Phi-3.5-mini (Q4)';

  // WebGPU capability gate. WebLLM cannot run without it, so advertising
  // the feature to users whose browser lacks it just produces a failed
  // Enable click. Checked once at module evaluation — the API is stable
  // (navigator.gpu either exists or it doesn't, no async detection needed).
  const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
</script>

<svelte:head>
  <title>Custom JavaScript Execution Tracer & Visualizer | Vivix</title>
  <meta name="description" content="Paste any JavaScript and watch the engine execute it step by step. Trace your own code through the call stack, heap memory, and event loop." />
</svelte:head>

<div class="ff-wrap">

  <!-- ── LLM banner ──────────────────────────────────────────────────
       Banner copy follows the Notion-AI / Copilot-Chat convention: the
       primary line tells the user what problem the feature solves,
       the secondary line names the cost (~2 GB, one-time), and the
       smallest text carries the tech specs (model, Web Worker,
       IndexedDB) for developers who care.

       The idle state is hidden when WebGPU isn't available — WebLLM
       physically cannot run, so advertising it would only produce
       failed Enable clicks on mobile Safari, Firefox default, etc.
       The Pattern Registry still narrates every recognised step
       regardless. -->
  {#if llmStatus === 'idle' && hasWebGPU}
    <div class="llm-banner llm-idle">
      <div class="llm-left">
        <span class="llm-chip">AI</span>
        <div class="llm-text">
          <strong>Smarter explanations for unusual code</strong>
          <span>When a step doesn't match a hand-written pattern, a small AI can generate a custom narration — running fully in your browser. Private, offline after first use.</span>
          <small class="llm-specs">{MODEL_LABEL} · ~2&nbsp;GB one-time download, then cached for next time</small>
        </div>
      </div>
      <button class="llm-btn llm-btn-primary" onclick={enableLlm}>Enable</button>
    </div>
  {:else if llmStatus === 'loading'}
    <div class="llm-banner llm-loading">
      <div class="llm-left">
        <span class="llm-spinner" aria-hidden="true"></span>
        <div class="llm-text">
          <strong>Setting up local AI — {llmProgress}%</strong>
          <span>{llmProgressMsg || `First-time setup. Downloading ${MODEL_LABEL} to your browser; it'll be cached after this.`}</span>
        </div>
      </div>
      <div class="llm-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={llmProgress} aria-label="Model download progress">
        <div class="llm-progress-fill" style="width:{llmProgress}%"></div>
      </div>
    </div>
  {:else if llmStatus === 'ready'}
    <div class="llm-banner llm-ready">
      <div class="llm-left">
        <span class="llm-chip llm-chip-ready">✓</span>
        <div class="llm-text">
          <strong>Local AI narration ready</strong>
          <span>Steps without a hand-written match will be narrated automatically — all inference happens on this device.</span>
        </div>
      </div>
    </div>
  {:else if llmStatus === 'error'}
    <div class="llm-banner llm-error">
      <div class="llm-left">
        <span class="llm-chip llm-chip-error">!</span>
        <div class="llm-text">
          <strong>Couldn't load local AI</strong>
          <span>{llmError}</span>
        </div>
      </div>
      <button class="llm-btn" onclick={enableLlm}>Retry</button>
    </div>
  {/if}

  <ModuleShell
    {examples}
    accent={ACCENT}
    routeKey="free-form"
    titlePrefix="free"
    titleAccent="Form"
    subtitle="— Paste Any JavaScript"
    desc="Pattern Registry + local AI narration for steps that have no pre-written explanation."
    {mapStep}
    {onSteps}
    dataFlow
    interpreterOptions={{}}
    hideExamples
    runHint=""
    editorPlaceholder="Paste your JavaScript here"
    moduleCaption="pattern-detection meter — the Pattern Registry scans your code for canonical shapes (loops, closures, async, etc.); when a pattern is found, the meter lights up and a hand-written explanation appears"
  >
    <!-- Pattern-detection meter: confidence bar + detected/unknown split -->
    {#snippet cpuModuleVisual(sd)}
      {@const patternId = sd._patternId || ''}
      {@const hasBrain = !!sd._brainHtml}
      {@const isLLM = hasBrain && !patternId}
      {@const status = patternId ? 'matched' : isLLM ? 'ai-narrated' : 'scanning'}
      {@const W = 520}
      {@const H = 110}
      {@const statusColor = patternId ? ACCENT : isLLM ? '#a78bfa' : '#64748b'}

      <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <!-- Header -->
        <text x="12" y="14" fill="#e2e8f0" font-size="7.5" font-weight="700"
          font-family="'Geist Mono', monospace" letter-spacing="1">PATTERN REGISTRY</text>
        <text x="510" y="14" text-anchor="end" fill="#94a3b8" font-size="6.5"
          font-family="'Geist Mono', monospace">registry scan → AI fallback</text>

        <!-- Confidence meter -->
        <text x="12" y="34" fill="#94a3b8" font-size="6.5" font-weight="600"
          font-family="'Geist Mono', monospace" letter-spacing="0.8">CONFIDENCE</text>

        <rect x="12" y="38" width="400" height="16" rx="3"
          fill="#0b0b14" stroke="#1a1a2e" stroke-width="1"/>
        <rect x="13" y="39" width={patternId ? 398 : isLLM ? 240 : 20} height="14" rx="2"
          fill={statusColor} opacity={patternId ? 0.55 : isLLM ? 0.35 : 0.25}/>

        <!-- Tick marks on meter -->
        {#each [0, 25, 50, 75, 100] as pct}
          <line x1={13 + (pct / 100) * 398} y1="54" x2={13 + (pct / 100) * 398} y2="58"
            stroke="#334155" stroke-width="0.5"/>
          <text x={13 + (pct / 100) * 398} y="64" text-anchor="middle"
            fill="#64748b" font-size="5.5"
            font-family="'Geist Mono', monospace">{pct}</text>
        {/each}

        <!-- Status chip on the right -->
        <rect x="420" y="32" width="92" height="28" rx="4"
          fill={`${statusColor}1f`} stroke={statusColor} stroke-width="1.2"/>
        <text x="466" y="43" text-anchor="middle"
          fill={statusColor} font-size="7" font-weight="800"
          font-family="'Geist Mono', monospace" letter-spacing="0.6">
          {status.toUpperCase()}
        </text>
        <text x="466" y="54" text-anchor="middle"
          fill={statusColor} font-size="6.5" font-weight="600"
          font-family="'Geist Mono', monospace">
          {patternId ? (patternId.length > 12 ? patternId.slice(0, 11) + '…' : patternId) : isLLM ? 'local-ai' : 'no pattern'}
        </text>

        <!-- Pipeline legend -->
        <text x="12" y="80" fill="#94a3b8" font-size="6" font-weight="600"
          font-family="'Geist Mono', monospace" letter-spacing="0.5">PIPELINE</text>

        {#each [
          { label: 'AST', active: true },
          { label: 'walk', active: true },
          { label: 'match', active: !!patternId },
          { label: 'explain', active: !!patternId },
          { label: 'ai fallback', active: isLLM },
        ] as stage, i}
          {@const sx = 60 + i * 86}
          <rect x={sx} y="72" width="78" height="14" rx="2"
            fill={stage.active ? `${statusColor}22` : '#0b0b14'}
            stroke={stage.active ? statusColor : '#1a1a2e'} stroke-width="1"/>
          <text x={sx + 39} y="82" text-anchor="middle"
            fill={stage.active ? statusColor : '#64748b'}
            font-size="6.5" font-weight="700"
            font-family="'Geist Mono', monospace">{stage.label}</text>
          {#if i < 4}
            <line x1={sx + 78} y1="79" x2={sx + 86} y2="79"
              stroke="#334155" stroke-width="0.8"/>
          {/if}
        {/each}

        <!-- Footer caption -->
        <text x={W/2} y={H - 2} text-anchor="middle"
          fill={statusColor} font-size="7.5" font-weight="600"
          font-family="'Geist Mono', monospace">
          {patternId ? `pattern "${patternId}" matched — using hand-written explanation`
            : isLLM ? 'no registry match — local AI narrating this step'
            : 'scanning AST · awaiting pattern match'}
        </text>
      </svg>
    {/snippet}

    {#snippet cpuRegisters(sd)}
      <rect x="210" y="12" width="140" height="26" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
      <text x="216" y="22" fill="#e0e0e0" font-size="8.5" font-weight="600" font-family="'Geist Mono', monospace" letter-spacing="0.5">PATTERN</text>
      <text x="344" y="32" text-anchor="end" fill={sd._patternId ? ACCENT : sd._brainHtml ? '#a78bfa' : '#444'} font-size="12" font-weight="800" font-family="'Geist Mono', monospace">
        {sd._patternId || (sd._brainHtml ? 'llm' : 'general')}
      </text>

      <rect x="210" y="42" width="140" height="26" rx="4" fill="#08080e" stroke="#1a1a2e" stroke-width="1"/>
      <text x="216" y="52" fill="#e0e0e0" font-size="8.5" font-weight="600" font-family="'Geist Mono', monospace" letter-spacing="0.5">HEAP</text>
      <text x="344" y="62" text-anchor="end" fill={ACCENT} font-size="13" font-weight="800" font-family="'Geist Mono', monospace">~{sd.bytes ?? 0}B</text>
    {/snippet}

    {#snippet cpuGauge(sd)}
      <rect x="210" y="72" width="140" height="16" rx="3" fill="#08080e" stroke="#1a1a2e" stroke-width="0.5"/>
      <rect x="211" y="73" width={Math.min(138, (sd.memOps || 0) * 7)} height="14" rx="2" fill={ACCENT} opacity="0.25"/>
      <text x="280" y="83" text-anchor="middle" fill={ACCENT} font-size="9" font-weight="700" font-family="'Geist Mono', monospace" letter-spacing="0.5">{sd.memOps || 0} OPS</text>
    {/snippet}

    {#snippet placeholder()}
      <!-- Blank canvas: the visualisation panel is intentionally empty
           until the user pastes code and clicks Visualize. -->
      <div class="ff-blank" aria-hidden="true"></div>
    {/snippet}
  </ModuleShell>
</div>

<style>
  .ff-wrap {
    display:flex; flex-direction:column;
    width:100%; height:100%; overflow:hidden;
  }

  /* ── LLM banner ─────────────────────────────────────────────────────── */
  .llm-banner {
    display:flex; align-items:center; gap:16px;
    padding:10px 18px; border-bottom:1px solid rgba(255,255,255,0.06);
    font-family: var(--font-ui);
    flex-shrink:0;
  }
  .llm-left { display:flex; align-items:center; gap:12px; flex:1; min-width:0; }
  .llm-idle    { background:linear-gradient(90deg, rgba(0,255,209,0.06), transparent); }
  .llm-loading { background:linear-gradient(90deg, rgba(167,139,250,0.10), rgba(167,139,250,0.02)); }
  .llm-ready   { background:linear-gradient(90deg, rgba(0,255,209,0.08), rgba(0,255,209,0.01)); }
  .llm-error   { background:linear-gradient(90deg, rgba(239,68,68,0.10), transparent); }

  .llm-text { display:flex; flex-direction:column; gap:3px; min-width:0; }
  .llm-text strong { font-size:0.82rem; color:rgba(255,255,255,0.94); font-weight:600; letter-spacing:-0.1px; }
  .llm-text span   { font-size:0.72rem; color:rgba(255,255,255,0.62); line-height:1.45; }
  .llm-text code   { font-family: var(--font-code); font-size:0.7rem; background:rgba(255,255,255,0.06); padding:1px 5px; border-radius:3px; color:#a7f3d0; }
  /* Tertiary line: tech specs (model name, download size, caching).
     Smaller + dimmer + monospace so it reads as metadata for devs
     who care without crowding the primary value proposition. */
  .llm-specs {
    font-family: var(--font-code);
    font-size:0.62rem;
    color:rgba(255,255,255,0.38);
    margin-top:2px;
    line-height:1.4;
    letter-spacing:0.1px;
  }

  .llm-chip {
    width:28px; height:28px; flex-shrink:0;
    border-radius:6px;
    display:inline-flex; align-items:center; justify-content:center;
    font-family: var(--font-code); font-size:0.7rem; font-weight:800;
    background:rgba(0,255,209,0.14); color:#00FFD1; border:1px solid rgba(0,255,209,0.4);
  }
  .llm-chip-ready { background:rgba(0,255,209,0.18); color:#00FFD1; border-color:rgba(0,255,209,0.5); }
  .llm-chip-error { background:rgba(239,68,68,0.18); color:#ef4444; border-color:rgba(239,68,68,0.5); }

  .llm-spinner {
    width:22px; height:22px; flex-shrink:0; border-radius:50%;
    border:2.5px solid rgba(0,255,209,0.22);
    border-top-color:#00FFD1;
    animation: llm-spin 0.8s linear infinite;
  }
  @keyframes llm-spin { to { transform:rotate(360deg); } }

  .llm-btn {
    flex-shrink:0;
    padding:7px 14px; border-radius:6px;
    font-family:inherit; font-size:0.74rem; font-weight:600;
    background:rgba(255,255,255,0.06);
    border:1px solid rgba(255,255,255,0.12);
    color:rgba(255,255,255,0.85);
    cursor:pointer; transition:all 0.15s;
  }
  .llm-btn:hover { background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.22); }
  .llm-btn-primary {
    background:#00FFD1; color:#06130c; border-color:transparent; font-weight:700;
  }
  .llm-btn-primary:hover { background:#00FFD1; filter:brightness(1.1); }

  .llm-progress {
    flex:1; max-width:240px;
    height:6px; border-radius:3px;
    background:rgba(167,139,250,0.14);
    overflow:hidden;
  }
  .llm-progress-fill {
    height:100%; background:#a78bfa;
    transition: width 0.25s ease;
  }

  /* ── Blank-canvas placeholder ──────────────────────────────────────────
     Free-form mode shows an empty visualisation panel until the user
     pastes code and runs Visualize. The div is purely spatial — it just
     fills the panel so the surrounding glass frame still renders. */
  .ff-blank { flex:1; min-height:0; }

  @media (max-width: 640px) {
    .llm-banner { padding:8px 12px; gap:10px; flex-wrap:wrap; }
    .llm-text strong { font-size:0.72rem; }
    .llm-text span   { font-size:0.62rem; }
    .llm-btn { width:100%; }
    .llm-progress { max-width:none; flex-basis:100%; }
  }
</style>
