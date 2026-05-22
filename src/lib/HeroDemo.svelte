<!--
  Vivix — JavaScript Visualizer

  @author     Henry Onilude
  @copyright  2026 Henry Onilude
  @license    MIT
  @link       https://github.com/HenryOnilude/vivix
-->

<script>
  /**
   * HeroDemo — live, auto-playing visualizer embed for the homepage hero.
   *
   * Drives the real interpreter (via the existing Web Worker) on a small
   * snippet, auto-starts 1.5s after the worker reports ready, and loops
   * continuously until the user takes manual control. On viewports under
   * 768px the right-hand viz panel collapses and only the call stack +
   * stdout + scrubber are shown.
   */
  import { onMount } from 'svelte';
  import { createInterpreterWorker } from './useInterpreterWorker.js';

  const DEFAULT_CODE = `let name = "Vivix";
let x = 10;
let y = 20;
let result = x + y;
console.log(result);`;

  let { code = DEFAULT_CODE, onLoopComplete = () => {} } = $props();

  // Pre-tokenised rendering for the default snippet so the code panel can
  // render with proper syntax colours without pulling in CodeMirror.
  const DEFAULT_TOKENS = [
    [{ k: 'kw', v: 'let ' }, { k: 'id', v: 'name' }, { k: 'op', v: ' = ' }, { k: 'str', v: '"Vivix"' }, { k: 'op', v: ';' }],
    [{ k: 'kw', v: 'let ' }, { k: 'id', v: 'x' }, { k: 'op', v: ' = ' }, { k: 'num', v: '10' }, { k: 'op', v: ';' }],
    [{ k: 'kw', v: 'let ' }, { k: 'id', v: 'y' }, { k: 'op', v: ' = ' }, { k: 'num', v: '20' }, { k: 'op', v: ';' }],
    [{ k: 'kw', v: 'let ' }, { k: 'id', v: 'result' }, { k: 'op', v: ' = ' }, { k: 'id', v: 'x' }, { k: 'op', v: ' + ' }, { k: 'id', v: 'y' }, { k: 'op', v: ';' }],
    [{ k: 'fn', v: 'console' }, { k: 'op', v: '.' }, { k: 'fn', v: 'log' }, { k: 'op', v: '(' }, { k: 'id', v: 'result' }, { k: 'op', v: ');' }],
  ];

  const useTokens = $derived(code.trim() === DEFAULT_CODE.trim());
  const codeLines = $derived(code.split('\n'));

  // Step-interval per the design brief — fast enough to feel alive, slow
  // enough to read each transition.
  const STEP_INTERVAL = 900;
  const PAUSE_AT_END = 1000;
  const FIRST_PLAY_DELAY = 1500;

  let steps    = $state([]);
  let total    = $state(0);
  let step     = $state(0);
  let playing  = $state(false);
  let ready    = $state(false);
  let loops    = $state(0);
  let isMobile = $state(false);
  let userTook = $state(false);

  /** @type {ReturnType<typeof setInterval>|null} */
  let timer = null;
  /** @type {ReturnType<typeof setTimeout>|null} */
  let endHold = null;
  let worker  = null;

  const sd = $derived(steps.length > 0 ? steps[Math.max(0, Math.min(step, steps.length - 1))] : null);
  const activeLine  = $derived(sd && typeof sd.lineIndex === 'number' ? sd.lineIndex : 0);
  const phaseLabel  = $derived(sd && sd.phase ? String(sd.phase).toUpperCase() : 'IDLE');
  const memOps      = $derived(sd && typeof sd.memOps === 'number' ? sd.memOps : 0);
  const varEntries  = $derived(sd ? Object.entries(sd.vars || {}) : []);
  const lastOutput  = $derived(sd && Array.isArray(sd.output) && sd.output.length > 0
    ? sd.output[sd.output.length - 1]
    : null);
  const fillPct     = $derived(total > 0 ? ((step + 1) / total) * 100 : 0);

  // ── Playback ────────────────────────────────────────────────────────────
  function clearTimer() {
    if (timer)   { clearInterval(timer); timer = null; }
    if (endHold) { clearTimeout(endHold); endHold = null; }
  }

  function tick() {
    // Pause-when-hidden: don't burn CPU on a backgrounded tab.
    if (typeof document !== 'undefined' && document.hidden) return;
    if (step < total - 1) {
      step = step + 1;
    } else {
      // End of run — record loop, fire callback once on the first lap, then
      // hold briefly before rewinding.
      const prev = loops;
      loops = prev + 1;
      if (prev === 0) { try { onLoopComplete(); } catch (_) { /* noop */ } }
      clearTimer();
      playing = false;
      endHold = setTimeout(() => {
        endHold = null;
        if (userTook) return;
        step = 0;
        play();
      }, PAUSE_AT_END);
    }
  }

  function play() {
    if (total === 0) return;
    clearTimer();
    playing = true;
    timer = setInterval(tick, STEP_INTERVAL);
  }

  function pause() {
    clearTimer();
    playing = false;
  }

  function togglePlay() { userTook = true; if (playing) pause(); else play(); }
  function goFirst()    { userTook = true; pause(); step = 0; }
  function goPrev()     { userTook = true; pause(); if (step > 0) step -= 1; }
  function goNext()     { userTook = true; pause(); if (step < total - 1) step += 1; }
  function goLast()     { userTook = true; pause(); step = Math.max(0, total - 1); }

  function onTrackClick(e) {
    if (total === 0) return;
    userTook = true;
    pause();
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    step = Math.round(pct * (total - 1));
  }

  function onTrackKey(e) {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); goPrev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
  }

  // ── Display helpers ────────────────────────────────────────────────────
  function valColor(v) {
    if (typeof v === 'string')  return '#4ade80';
    if (typeof v === 'number')  return '#38bdf8';
    if (typeof v === 'boolean') return '#fbbf24';
    if (v === null || v === undefined) return '#94a3b8';
    return '#c084fc';
  }
  function typeName(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
  }
  function fmt(v) {
    if (typeof v === 'string')  return `"${v}"`;
    if (v === undefined)        return 'undefined';
    if (v === null)             return 'null';
    return String(v);
  }
  function byteCount(v) {
    if (typeof v === 'string')  return Math.min(v.length, 12);
    if (typeof v === 'number')  return 8;
    if (typeof v === 'boolean') return 4;
    return 0;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────
  onMount(() => {
    let cancelled = false;

    // Track viewport for the mobile collapse.
    const mq = window.matchMedia('(max-width: 768px)');
    isMobile = mq.matches;
    const onMq = (e) => { isMobile = e.matches; };
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else mq.addListener(onMq);

    // Pause when the tab becomes hidden, resume when it comes back (only if
    // the user hadn't taken manual control).
    const onVis = () => {
      if (document.hidden) {
        if (playing && timer) { clearInterval(timer); timer = null; }
      } else if (playing && !timer) {
        timer = setInterval(tick, STEP_INTERVAL);
      }
    };
    document.addEventListener('visibilitychange', onVis);

    // Defer worker init so the rest of the page paints first.
    const ric = (typeof window.requestIdleCallback === 'function')
      ? window.requestIdleCallback
      : (cb) => setTimeout(cb, 0);

    ric(async () => {
      if (cancelled) return;
      try {
        worker = createInterpreterWorker();
        const result = await worker.run(code, { trackVar: true });
        if (cancelled) return;
        const list = (result && Array.isArray(result.steps)) ? result.steps : [];
        if (list.length === 0) return;
        steps = list;
        total = list.length;
        step  = 0;
        ready = true;
        // Start playback after a short hold so the user has a moment to
        // register the page.
        setTimeout(() => {
          if (cancelled || userTook) return;
          play();
        }, FIRST_PLAY_DELAY);
      } catch (_) {
        // Leave the skeleton up; failure is silent.
      }
    });

    return () => {
      cancelled = true;
      clearTimer();
      if (worker) { try { worker.terminate(); } catch (_) {} worker = null; }
      document.removeEventListener('visibilitychange', onVis);
      if (mq.removeEventListener) mq.removeEventListener('change', onMq);
      else mq.removeListener(onMq);
    };
  });
</script>

<div class="hd-shell" class:hd-mobile={isMobile} aria-label="Live JavaScript visualizer">
  <!-- Window chrome -->
  <div class="demo-bar">
    <span class="demo-dot" style="background:#ff5f57"></span>
    <span class="demo-dot" style="background:#febc2e"></span>
    <span class="demo-dot" style="background:#28c840"></span>
    <span class="demo-title">vivix.js</span>
    <span class="demo-concept-tag">Live</span>
    <span class="demo-badge">● {ready ? 'RUNNING' : 'LOADING'}</span>
  </div>

  <div class="demo-body">
    <!-- Code panel -->
    <div class="demo-code">
      {#if useTokens}
        {#each DEFAULT_TOKENS as tokens, i}
          <div class="demo-line" class:demo-line-active={activeLine === i}>
            <span class="demo-ln">{i + 1}</span>
            <span class="demo-arrow">{activeLine === i ? '▶' : ' '}</span>
            <span class="demo-tokens">{#each tokens as tok}<span class="tok-{tok.k}">{tok.v}</span>{/each}</span>
          </div>
        {/each}
      {:else}
        {#each codeLines as line, i}
          <div class="demo-line" class:demo-line-active={activeLine === i}>
            <span class="demo-ln">{i + 1}</span>
            <span class="demo-arrow">{activeLine === i ? '▶' : ' '}</span>
            <span class="demo-tokens">{line || ' '}</span>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Right-hand viz panel — desktop only -->
    {#if !isMobile}
      <div class="demo-viz">
        <!-- CPU registers row -->
        <div class="demo-cpu">
          <div class="demo-gauge">
            <svg viewBox="0 0 52 52" width="52" height="52" aria-hidden="true">
              <circle cx="26" cy="26" r="22" fill="none" stroke="#1a1a2e" stroke-width="4"/>
              <circle cx="26" cy="26" r="22" fill="none" stroke="#4ade80" stroke-width="3.5"
                stroke-dasharray="{(fillPct / 100) * 138} 138"
                stroke-linecap="round"
                transform="rotate(-90 26 26)"
                style="transition: stroke-dasharray 0.4s ease"/>
              <text x="26" y="24" text-anchor="middle" fill="#fff" font-size="11" font-weight="800" font-family="'Geist Mono', monospace">{Math.max(1, step + 1)}</text>
              <text x="26" y="34" text-anchor="middle" fill="rgba(255,255,255,0.35)" font-size="6.5" font-family="'Geist Mono', monospace">/{Math.max(1, total)}</text>
            </svg>
          </div>
          <div class="demo-chip" class:demo-chip-active={ready && step < total - 1}>
            <svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">
              <rect x="8" y="8" width="20" height="20" rx="3" fill="#0d0d1a" stroke="#4ade80" stroke-width="1.5"/>
              <rect x="12" y="12" width="12" height="12" rx="2" fill="#4ade8015" stroke="#4ade80" stroke-width="1"/>
              {#if ready && step < total - 1}
                <circle cx="18" cy="18" r="2.5" fill="#4ade80" opacity="0.9"/>
              {:else}
                <path d="M14 18 l3 3 l6-6" fill="none" stroke="#4ade80" stroke-width="1.5" stroke-linecap="round"/>
              {/if}
            </svg>
          </div>
          <div class="demo-registers">
            <div class="demo-reg">
              <span class="demo-reg-label">PC</span>
              <span class="demo-reg-val">LINE {activeLine + 1}</span>
            </div>
            <div class="demo-reg">
              <span class="demo-reg-label">OP</span>
              <span class="demo-reg-val demo-reg-op">{phaseLabel}</span>
            </div>
            <div class="demo-reg">
              <span class="demo-reg-label">WRITES</span>
              <span class="demo-reg-val" style="color:#fbbf24">{memOps}</span>
            </div>
          </div>
        </div>

        <!-- Call stack -->
        <div class="demo-stack-row">
          <span class="demo-stack-label">STACK</span>
          <span class="demo-stack-frame">Global</span>
        </div>

        <!-- Heap -->
        <div class="demo-heap">
          <div class="demo-heap-hdr">HEAP MEMORY</div>
          <div class="demo-heap-vars">
            {#each varEntries as [vname, value] (vname)}
              <div class="demo-heap-var" style="--vc: {valColor(value)}">
                <div class="demo-heap-top">
                  <span class="demo-heap-name">{vname}</span>
                  <span class="demo-heap-type">{typeName(value)}</span>
                </div>
                <span class="demo-heap-val" style="color:{valColor(value)}">{fmt(value)}</span>
                {#if byteCount(value) > 0}
                  <div class="demo-heap-bytes">
                    {#each Array(Math.min(byteCount(value), 8)) as _}
                      <span class="demo-byte" style="background:{valColor(value)}"></span>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
            {#if varEntries.length === 0}
              <span class="demo-heap-empty">no variables yet…</span>
            {/if}
          </div>
          {#if lastOutput !== null}
            <div class="demo-stdout">
              <span class="demo-stdout-label">› console.log</span>
              <span class="demo-stdout-val">{lastOutput}</span>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Mobile-only call-stack + stdout strip -->
  {#if isMobile}
    <div class="hd-mobile-stack">
      <span class="demo-stack-label">STACK</span>
      <span class="demo-stack-frame">Global</span>
      {#if lastOutput !== null}
        <span class="hd-mobile-out">› {lastOutput}</span>
      {/if}
    </div>
  {/if}

  <!-- Manual controls -->
  <div class="hd-controls">
    <button class="hd-btn" onclick={goFirst} aria-label="Jump to first step" type="button">⟪</button>
    <button class="hd-btn" onclick={goPrev}  aria-label="Previous step"      type="button">◁</button>
    <button class="hd-btn hd-btn-primary" onclick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} type="button">
      {playing ? '⏸' : '▶'}
    </button>
    <button class="hd-btn" onclick={goNext}  aria-label="Next step"          type="button">▷</button>
    <button class="hd-btn" onclick={goLast}  aria-label="Jump to last step"  type="button">⟫</button>
  </div>

  <!-- Scrubber + step counter -->
  <div class="demo-footer">
    <div
      class="demo-progress-track"
      role="slider"
      tabindex="0"
      onclick={onTrackClick}
      onkeydown={onTrackKey}
      aria-label="Scrub timeline"
      aria-valuemin="1"
      aria-valuemax={Math.max(1, total)}
      aria-valuenow={Math.max(1, step + 1)}>
      <div class="demo-progress-fill" style="width:{fillPct}%"></div>
    </div>
    <span class="demo-step-counter">step {Math.max(1, step + 1)} / {Math.max(1, total)}</span>
  </div>
</div>

<style>
  /* Hero embed shell — visual identity matches the (now-removed) static
     mockup, but every panel is driven by real interpreter output. */
  .hd-shell {
    width: 100%;
    max-width: 860px;
    margin: 32px auto 0;
    border-radius: 12px;
    background: linear-gradient(180deg, #0a0a14 0%, #06060c 100%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    overflow: hidden;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(74, 222, 128, 0.04);
    animation: hd-fade-in 0.6s ease both;
  }

  @keyframes hd-fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Window chrome ─────────────────────────────────────────────────── */
  .demo-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 9px 14px;
    background: #111120;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }
  .demo-dot { width: 11px; height: 11px; border-radius: 50%; opacity: 0.85; }
  .demo-title {
    font-family: var(--font-code);
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.35);
    margin-left: 8px;
  }
  .demo-concept-tag {
    font-family: var(--font-code);
    font-size: 0.6rem;
    color: rgba(74, 222, 128, 0.7);
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid rgba(74, 222, 128, 0.3);
    background: rgba(74, 222, 128, 0.08);
    letter-spacing: 0.3px;
    margin-left: 6px;
  }
  .demo-badge {
    font-family: var(--font-code);
    font-size: 0.58rem;
    color: #4ade80;
    letter-spacing: 0.5px;
    margin-left: auto;
    animation: hd-badge-pulse 1.4s ease-in-out infinite;
  }
  @keyframes hd-badge-pulse {
    0%, 100% { opacity: 0.55; }
    50%      { opacity: 1; }
  }

  /* ── Body ──────────────────────────────────────────────────────────── */
  .demo-body { display: flex; min-height: 220px; }

  .demo-code {
    flex: 1;
    padding: 14px 0;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    min-width: 0;
  }
  .demo-line {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 3px 14px 3px 0;
    transition: background 0.3s ease;
    border-left: 2px solid transparent;
  }
  .demo-line-active {
    background: rgba(74, 222, 128, 0.07);
    border-left-color: #4ade80;
  }
  .demo-ln {
    width: 32px;
    text-align: right;
    font-family: var(--font-code);
    font-size: 0.65rem;
    color: rgba(255, 255, 255, 0.22);
    padding-right: 10px;
    flex-shrink: 0;
    user-select: none;
  }
  .demo-arrow {
    width: 16px;
    font-size: 0.6rem;
    color: #4ade80;
    flex-shrink: 0;
    transition: opacity 0.2s;
  }
  .demo-tokens {
    font-family: var(--font-code);
    font-size: 0.78rem;
    white-space: pre;
    min-width: 0;
  }

  /* Token colours */
  .tok-kw  { color: #c084fc; }
  .tok-id  { color: #e2e8f0; }
  .tok-str { color: #4ade80; }
  .tok-num { color: #38bdf8; }
  .tok-op  { color: rgba(255, 255, 255, 0.35); }
  .tok-fn  { color: #fbbf24; }

  /* ── Right-hand viz panel ──────────────────────────────────────────── */
  .demo-viz {
    width: 240px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: #0a0a14;
    border-left: 1px solid rgba(255, 255, 255, 0.05);
  }

  .demo-cpu {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: #09090f;
  }
  .demo-gauge { flex-shrink: 0; }
  .demo-chip { flex-shrink: 0; opacity: 0.6; transition: opacity 0.3s; }
  .demo-chip-active { opacity: 1; }
  .demo-registers {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .demo-reg { display: flex; align-items: center; gap: 5px; }
  .demo-reg-label {
    font-family: var(--font-code);
    font-size: 0.45rem;
    color: rgba(255, 255, 255, 0.28);
    letter-spacing: 1px;
    text-transform: uppercase;
    min-width: 36px;
    flex-shrink: 0;
  }
  .demo-reg-val {
    font-family: var(--font-code);
    font-size: 0.65rem;
    font-weight: 800;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .demo-reg-op { color: #38bdf8; }

  .demo-stack-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    background: #08080e;
  }
  .demo-stack-label {
    font-family: var(--font-code);
    font-size: 0.45rem;
    color: rgba(255, 255, 255, 0.28);
    letter-spacing: 1px;
  }
  .demo-stack-frame {
    font-family: var(--font-code);
    font-size: 0.62rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.78);
  }

  .demo-heap {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .demo-heap-hdr {
    font-family: var(--font-code);
    font-size: 0.45rem;
    color: rgba(255, 255, 255, 0.28);
    letter-spacing: 1px;
    padding: 6px 10px 4px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .demo-heap-vars {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 6px 8px;
    overflow: hidden;
  }
  .demo-heap-empty {
    font-family: var(--font-code);
    font-size: 0.58rem;
    color: rgba(255, 255, 255, 0.15);
    font-style: italic;
    padding: 4px 2px;
  }
  .demo-heap-var {
    background: color-mix(in srgb, var(--vc) 8%, #0c0c18);
    border: 1px solid color-mix(in srgb, var(--vc) 22%, rgba(255, 255, 255, 0.05));
    border-radius: 6px;
    padding: 5px 7px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    animation: hd-var-appear 0.25s ease;
  }
  @keyframes hd-var-appear {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .demo-heap-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .demo-heap-name {
    font-family: var(--font-code);
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.88);
    font-weight: 700;
  }
  .demo-heap-type {
    font-family: var(--font-code);
    font-size: 0.42rem;
    color: rgba(255, 255, 255, 0.30);
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }
  .demo-heap-val {
    font-family: var(--font-code);
    font-size: 0.82rem;
    font-weight: 800;
    word-break: break-all;
  }
  .demo-heap-bytes { display: flex; gap: 1.5px; margin-top: 2px; }
  .demo-byte {
    width: 7px;
    height: 7px;
    border-radius: 1.5px;
    opacity: 0.5;
  }

  .demo-stdout {
    border-top: 1px solid rgba(74, 222, 128, 0.15);
    padding: 6px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: rgba(74, 222, 128, 0.06);
  }
  .demo-stdout-label {
    font-family: var(--font-code);
    font-size: 0.42rem;
    color: rgba(74, 222, 128, 0.6);
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }
  .demo-stdout-val {
    font-family: var(--font-code);
    font-size: 0.68rem;
    color: #4ade80;
    font-weight: 700;
  }

  /* ── Mobile-only stack strip ──────────────────────────────────────── */
  .hd-mobile-stack {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    background: #08080e;
    flex-wrap: wrap;
  }
  .hd-mobile-out {
    font-family: var(--font-code);
    font-size: 0.7rem;
    color: #4ade80;
    margin-left: auto;
  }

  /* ── Manual controls ──────────────────────────────────────────────── */
  .hd-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    background: #09090f;
  }
  .hd-btn {
    font-family: var(--font-code);
    font-size: 0.78rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.78);
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
    line-height: 1;
    min-width: 36px;
  }
  .hd-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.18);
    color: rgba(255, 255, 255, 0.95);
  }
  .hd-btn:active { transform: scale(0.96); }
  .hd-btn-primary {
    background: rgba(74, 222, 128, 0.12);
    border-color: rgba(74, 222, 128, 0.4);
    color: #4ade80;
  }
  .hd-btn-primary:hover {
    background: rgba(74, 222, 128, 0.18);
    border-color: rgba(74, 222, 128, 0.6);
    color: #4ade80;
  }

  /* ── Footer / scrubber ────────────────────────────────────────────── */
  .demo-footer {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }
  .demo-progress-track {
    flex: 1;
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    overflow: hidden;
    border: 0;
    padding: 0;
    cursor: pointer;
    appearance: none;
  }
  .demo-progress-track:hover { background: rgba(255, 255, 255, 0.12); }
  .demo-progress-track:focus-visible {
    outline: 2px solid rgba(74, 222, 128, 0.5);
    outline-offset: 2px;
  }
  .demo-progress-fill {
    height: 100%;
    background: #4ade80;
    border-radius: 3px;
    transition: width 0.4s ease;
  }
  .demo-step-counter {
    font-family: var(--font-code);
    font-size: 0.58rem;
    color: rgba(255, 255, 255, 0.28);
    white-space: nowrap;
    letter-spacing: 0.3px;
  }

  /* ── Mobile overrides ─────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .hd-shell { margin-top: 24px; max-width: 100%; }
    .demo-body { min-height: 160px; }
    .demo-tokens { font-size: 0.72rem; }
    .demo-ln     { font-size: 0.6rem; }
  }
</style>
