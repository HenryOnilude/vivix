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
      gsap.fromTo(node, { attr: { cx: 150, cy: 30 } }, { attr: { cx: 60, cy: 145 }, duration: 1.2, ease: 'power2.inOut' });
    } else {
      gsap.fromTo(node, { attr: { cx: 150, cy: 30 } }, { attr: { cx: 240, cy: 145 }, duration: 1.2, ease: 'power2.inOut' });
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

// ── gsapSlideIn ──
// Slide-in reveal for the predict panel (ModuleShell).
export function gsapSlideIn(node) {
  gsap.from(node, {
    height: 0,
    opacity: 0,
    duration: 0.3,
    ease: 'power2.out',
    overflow: 'hidden'
  });
  return {};
}
