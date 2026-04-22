/**
 * Shared GSAP Svelte actions used across all visual learning modules.
 *
 * Each function is a Svelte "use:action" — it receives (node, params) on mount
 * and returns { update(newParams) } for reactive updates.
 *
 * Usage in a .svelte file:
 *   import { makeAnimateBox, makeAnimateVal, animateBar } from './animations.js';
 *   const animateBox = makeAnimateBox('#f59e0b');   // accent color
 *   const animateVal = makeAnimateVal();
 */
import { gsap } from 'gsap';

/* ═══════════════════════════════════════════
   EASING STANDARDS (project-wide)
     Micro-interactions:         100–200ms  power2.out
     Standard state transitions: 300–400ms  power2.inOut
     Significant layout shifts:  500–800ms  back.out
     Data landing (elastic):                back.out(1.4)
   Linear easing is not used anywhere — data does not move linearly in
   the real world. All ambient / spinner rotations use CSS keyframes.
   ═══════════════════════════════════════════ */

const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Three-stage causal data-flow animation.
 *   Stage 1 — Instruction pulse  (100ms) on source line
 *   Stage 2 — Particle travel    (300ms) source → target, power2.inOut
 *   Stage 3 — Mutation landing   (200ms) scale 1 → 1.04 back.out(1.4)
 *             Residual glow      (600ms) fades out
 *
 * Works with any two DOM elements. Used by makeAnimateBoxFlow below.
 */
export function dataFlow(sourceEl, targetEl, accent = '#f59e0b') {
  if (!targetEl) return;

  // Reduced-motion fallback: skip travel, do a gentle landing flash only.
  if (REDUCED_MOTION) {
    gsap.fromTo(targetEl,
      { boxShadow: `0 0 0 2px ${accent}, 0 2px 8px rgba(0,0,0,0.4)` },
      { boxShadow: '0 2px 8px rgba(0,0,0,0.4)', duration: 0.4, ease: 'power2.out' }
    );
    return;
  }

  // ── Stage 1: Instruction pulse on the source code line (100ms) ──────
  if (sourceEl) {
    gsap.fromTo(sourceEl,
      { filter: 'brightness(1.75)' },
      { filter: 'brightness(1)', duration: 0.1, ease: 'power2.out', overwrite: 'auto' }
    );
  }

  const srcRect = sourceEl?.getBoundingClientRect();
  const tgtRect = targetEl.getBoundingClientRect();
  if (!tgtRect.width) return; // target not laid out yet

  // ── Stage 3 landing function (called by particle onComplete, or
  //     immediately if there's no source to travel from) ───────────────
  const land = () => {
    const tl = gsap.timeline();
    tl.to(targetEl, { scale: 1.04, duration: 0.2, ease: 'back.out(1.4)' })
      .to(targetEl, { scale: 1, duration: 0.3, ease: 'power2.out' });

    // Residual glow: snaps on, then fades over 600ms
    gsap.fromTo(targetEl,
      { boxShadow: `0 0 24px ${accent}cc, 0 2px 8px rgba(0,0,0,0.4)` },
      { boxShadow: '0 2px 8px rgba(0,0,0,0.4)', duration: 0.6, delay: 0.2, ease: 'power2.out', overwrite: 'auto' }
    );
  };

  if (!srcRect) { land(); return; }

  // ── Stage 2: Traveling particle (fixed-positioned, transform-only) ──
  const startX = srcRect.right - 6;
  const startY = srcRect.top + srcRect.height / 2 - 4;
  const endX   = tgtRect.left + tgtRect.width / 2;
  const endY   = tgtRect.top  + tgtRect.height / 2;

  const particle = document.createElement('div');
  particle.setAttribute('aria-hidden', 'true');
  particle.style.cssText = `
    position: fixed;
    left: ${startX}px;
    top:  ${startY}px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${accent};
    box-shadow: 0 0 14px ${accent}, 0 0 4px ${accent};
    pointer-events: none;
    z-index: 9999;
    will-change: transform, opacity;
  `;
  document.body.appendChild(particle);

  gsap.to(particle, {
    x: endX - startX,
    y: endY - startY,
    duration: 0.3,
    delay: 0.05,
    ease: 'power2.inOut',
    onComplete: () => {
      // Quick pop on arrival, then fade out particle
      gsap.to(particle, {
        scale: 1.8, opacity: 0,
        duration: 0.15, ease: 'power2.out',
        onComplete: () => particle.remove(),
      });
      land();
    },
  });
}

// ── animateBoxFlow ──
// Drop-in replacement for animateBox that runs the full causal data-flow
// sequence on 'changed'. New boxes still animate in with a clean back.out.
export function makeAnimateBoxFlow(accentColor = '#f59e0b') {
  return function animateBoxFlow(node, p) {
    function run(status) {
      if (status === 'new') {
        gsap.from(node, { scaleY: 0, opacity: 0, duration: 0.5, ease: 'back.out(1.7)', transformOrigin: 'bottom center' });
      } else if (status === 'changed') {
        const source = document.querySelector('.cl-exec');
        dataFlow(source, node, accentColor);
      }
    }
    run(p.status);
    return { update(np) { run(np.status); } };
  };
}

// ── animateBox ──
// Animate a variable/heap box: scale-in on 'new', border flash on 'changed'.
// `accentColor` controls the flash color (module accent).
export function makeAnimateBox(accentColor = '#f59e0b') {
  return function animateBox(node, p) {
    function run(s) {
      if (s === 'new') {
        gsap.from(node, { scaleY: 0, opacity: 0, duration: 0.7, ease: 'back.out(1.7)', transformOrigin: 'bottom center' });
      } else if (s === 'changed') {
        gsap.fromTo(node, { borderColor: accentColor }, { borderColor: '#1a1a2e', duration: 1.2 });
      }
    }
    run(p.status);
    return { update(np) { run(np.status); } };
  };
}

// ── animateVal ──
// Animate a value label: pop-in on 'new', color flash on 'changed'.
export function makeAnimateVal() {
  return function animateVal(node, p) {
    function run(s, col) {
      if (s === 'new') {
        gsap.from(node, { scale: 0, opacity: 0, duration: 0.65, delay: 0.3, ease: 'back.out(2)' });
      } else if (s === 'changed') {
        gsap.fromTo(node, { color: '#fff', scale: 1.3 }, { color: col, scale: 1, duration: 0.8, ease: 'power2.out' });
      }
    }
    run(p.status, p.color);
    return { update(np) { run(np.status, np.color); } };
  };
}

// ── animateBar ──
// Animate a complexity-chart bar: height + opacity based on active state.
export function animateBar(node, p) {
  function apply(params) {
    gsap.to(node, {
      height: params.active ? params.h + '%' : (params.h * 0.3) + '%',
      opacity: params.active ? 1 : 0.2,
      duration: 0.6,
      ease: 'power2.out',
      overwrite: true
    });
  }
  apply(p);
  return { update(np) { apply(np); } };
}

// ── animateFrame ──
// Animate a call-stack frame sliding in (FnCall / Closures).
// When a new frame is pushed we also emit a causal particle from the
// active code line to the frame — this makes the "a call creates a
// stack frame" relationship spatially obvious.
export function animateFrame(node, p) {
  function run(isNew, accent) {
    if (!isNew) return;
    gsap.from(node, { scaleY: 0, opacity: 0, duration: 0.6, ease: 'back.out(1.7)', transformOrigin: 'top center' });
    const src = typeof document !== 'undefined' ? document.querySelector('.cl-exec') : null;
    if (src) dataFlow(src, node, accent || '#c084fc');
  }
  run(p.isNew, p.accent);
  return { update(np) { run(np.isNew, np.accent); } };
}

// ── animateVar ──
// Flash a variable value in a stack frame (FnCall module).
export function animateVar(node, p) {
  function run(flash, col) {
    if (flash) gsap.fromTo(node, { color: '#fff', scale: 1.3 }, { color: col || '#e0e0e0', scale: 1, duration: 0.8, ease: 'power2.out' });
  }
  run(p.flash, p.color);
  return { update(np) { run(np.flash, np.color); }};
}

// ── animateElement ──
// Slide-in for a new array element (ArrayFlow module), plus a causal
// particle from the active code line to the newly-arriving element.
export function animateElement(node, p) {
  function run(isNew, accent) {
    if (!isNew) return;
    gsap.from(node, { x: 30, opacity: 0, duration: 0.5, ease: 'power2.out' });
    const src = typeof document !== 'undefined' ? document.querySelector('.cl-exec') : null;
    if (src) dataFlow(src, node, accent || '#818cf8');
  }
  run(p.isNew, p.accent);
  return { update(np) { run(np.isNew, np.accent); } };
}

// ── animatePath ──
// SVG path draw effect (IfGate module).
export function animatePath(node, _p) {
  const len = node.getTotalLength();
  gsap.fromTo(node,
    { strokeDasharray: len, strokeDashoffset: len },
    { strokeDashoffset: 0, duration: 0.5, ease: 'power1.inOut', overwrite: true }
  );
  return { update() {
    const l = node.getTotalLength();
    gsap.fromTo(node,
      { strokeDasharray: l, strokeDashoffset: l },
      { strokeDashoffset: 0, duration: 0.5, ease: 'power1.inOut', overwrite: true }
    );
  }};
}

// ── animateBall ──
// Animate a ball along the true/false branch path (IfGate module).
export function animateBall(node, p) {
  function run(taken) {
    if (taken) {
      gsap.fromTo(node, { attr: { cx: 150, cy: 30 } }, { attr: { cx: 57, cy: 157 }, duration: 1.2, ease: 'power2.inOut' });
    } else {
      gsap.fromTo(node, { attr: { cx: 150, cy: 30 } }, { attr: { cx: 243, cy: 157 }, duration: 1.2, ease: 'power2.inOut' });
    }
  }
  run(p.taken);
  return { update(np) { run(np.taken); } };
}

// ── animateArrow ──
// Fade-in arrow for value changes (IfGate module).
export function animateArrow(node, _p) {
  gsap.from(node, { opacity: 0, x: -10, duration: 0.5, ease: 'power2.out' });
  return { update() { gsap.from(node, { opacity: 0, x: -10, duration: 0.5, ease: 'power2.out' }); } };
}

// ── animateDiamondFlash ──
// Flash the diamond border + a glow effect when condition is evaluated.
// Sequenced: plays immediately, takes 0.5s, so path can start at +0.3s.
export function animateDiamondFlash(node, p) {
  function run(active, color) {
    if (!active) return;
    gsap.fromTo(node,
      { attr: { 'stroke-width': 5, stroke: '#fff' }, filter: `drop-shadow(0 0 10px ${color})` },
      { attr: { 'stroke-width': 2.5, stroke: color }, filter: `drop-shadow(0 0 0px ${color})`, duration: 0.6, ease: 'power2.out', overwrite: true }
    );
  }
  run(p.active, p.color);
  return { update(np) { run(np.active, np.color); } };
}

// ── animatePathSequenced ──
// Like animatePath but with a configurable delay for sequencing.
export function animatePathSequenced(node, p) {
  function run(delay) {
    const len = node.getTotalLength();
    gsap.fromTo(node,
      { strokeDasharray: len, strokeDashoffset: len },
      { strokeDashoffset: 0, duration: 0.5, delay: delay || 0, ease: 'power1.inOut', overwrite: true }
    );
  }
  run(p.delay);
  return { update(np) { run(np.delay); } };
}

// ── animateBlockReveal ──
// Scale-in + glow the taken block, or fade-shrink the skipped block.
// Sequenced: delay parameter controls when in the timeline this fires.
export function animateBlockReveal(node, p) {
  function run(taken, delay) {
    if (taken) {
      gsap.fromTo(node,
        { scaleY: 0.85, scaleX: 0.9, opacity: 0.3, transformOrigin: 'center top' },
        { scaleY: 1, scaleX: 1, opacity: 1, duration: 0.5, delay: delay || 0, ease: 'back.out(1.4)', overwrite: true }
      );
    } else {
      gsap.to(node, { opacity: 0.25, scale: 0.95, duration: 0.4, delay: delay || 0, ease: 'power2.out', overwrite: true });
    }
  }
  run(p.taken, p.delay);
  return { update(np) { run(np.taken, np.delay); } };
}

// ── animateSubExpr ──
// Highlight a sub-expression chip: scale pop + color flash.
export function animateSubExpr(node, p) {
  function run(active, delay) {
    if (!active) return;
    gsap.fromTo(node,
      { scale: 0.7, opacity: 0, y: 4 },
      { scale: 1, opacity: 1, y: 0, duration: 0.4, delay: delay || 0, ease: 'back.out(2)', overwrite: true }
    );
  }
  run(p.active, p.delay);
  return { update(np) { run(np.active, np.delay); } };
}

// ── animateLoopPulse ──
// Pulse a loop counter or iteration indicator (ForLoop module).
export function animateLoopPulse(node, p) {
  function run(active, color) {
    if (!active) return;
    gsap.fromTo(node,
      { scale: 1.3, opacity: 0.4, transformOrigin: 'center center' },
      { scale: 1, opacity: 1, duration: 0.5, ease: 'power2.out', overwrite: true }
    );
  }
  run(p.active, p.color);
  return { update(np) { run(np.active, np.color); } };
}

// ── animateStackPush ──
// Animate a stack frame or scope pushing onto a visual stack (FnCall/Closures).
export function animateStackPush(node, p) {
  function run(action) {
    if (action === 'push') {
      gsap.fromTo(node,
        { y: -20, opacity: 0, scaleY: 0.7, transformOrigin: 'top center' },
        { y: 0, opacity: 1, scaleY: 1, duration: 0.5, ease: 'back.out(1.6)', overwrite: true }
      );
    } else if (action === 'pop') {
      gsap.to(node, { y: -20, opacity: 0, scaleY: 0.7, duration: 0.4, ease: 'power2.in', overwrite: true });
    }
  }
  run(p.action);
  return { update(np) { run(np.action); } };
}

// ── animateValueFlow ──
// Animate a value flowing from argument to parameter (FnCall module).
export function animateValueFlow(node, p) {
  function run(active) {
    if (!active) return;
    gsap.fromTo(node,
      { x: -15, opacity: 0, scale: 0.8 },
      { x: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out', overwrite: true }
    );
  }
  run(p.active);
  return { update(np) { run(np.active); } };
}

// ── animateReturnValue ──
// Animate a return value flowing back from function to caller, plus a
// causal particle from the active code line (the `return` statement) to
// the caller slot receiving the value.
export function animateReturnValue(node, p) {
  function run(active, color) {
    if (!active) return;
    gsap.fromTo(node,
      { scale: 0, opacity: 0, transformOrigin: 'center center' },
      { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(2)', overwrite: true }
    );
    if (color) {
      gsap.fromTo(node, { borderColor: '#fff' }, { borderColor: color, duration: 0.8, delay: 0.3, ease: 'power2.out', overwrite: false });
    }
    const src = typeof document !== 'undefined' ? document.querySelector('.cl-exec') : null;
    if (src) dataFlow(src, node, color || '#fb923c');
  }
  run(p.active, p.color);
  return { update(np) { run(np.active, np.color); } };
}
