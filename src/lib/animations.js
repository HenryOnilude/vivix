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
// Animate a call-stack frame sliding in (FnCall module).
export function animateFrame(node, p) {
  if (p.isNew) {
    gsap.from(node, { scaleY: 0, opacity: 0, duration: 0.6, ease: 'back.out(1.7)', transformOrigin: 'top center' });
  }
  return { update(np) {
    if (np.isNew) gsap.from(node, { scaleY: 0, opacity: 0, duration: 0.6, ease: 'back.out(1.7)', transformOrigin: 'top center' });
  }};
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
// Slide-in for a new array element (ArrayFlow module).
export function animateElement(node, p) {
  if (p.isNew) gsap.from(node, { x: 30, opacity: 0, duration: 0.5, ease: 'power2.out' });
  return { update(np) {
    if (np.isNew) gsap.from(node, { x: 30, opacity: 0, duration: 0.5, ease: 'power2.out' });
  }};
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
// Animate a return value flowing back from function to caller.
export function animateReturnValue(node, p) {
  function run(active, color) {
    if (!active) return;
    gsap.fromTo(node,
      { scale: 0, opacity: 0, transformOrigin: 'center center' },
      { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(2)', overwrite: true }
    );
    if (color) {
      gsap.fromTo(node, { borderColor: '#fff' }, { borderColor: color, duration: 0.8, delay: 0.3, overwrite: false });
    }
  }
  run(p.active, p.color);
  return { update(np) { run(np.active, np.color); } };
}
