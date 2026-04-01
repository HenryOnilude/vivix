/**
 * Shared utilities for parsing and evaluating conditions.
 * Used by IfGate and potentially future modules (switch, ternary).
 */
import { fv } from './utils.js';

/**
 * Split a compound condition into sub-expressions.
 * e.g. "isLoggedIn && role === 'admin'" → ["isLoggedIn", "&&", "role === 'admin'"]
 */
export function splitCondition(raw) {
  const parts = [];
  const re = /\s*(&&|\|\|)\s*/g;
  let last = 0, m;
  while ((m = re.exec(raw)) !== null) {
    parts.push(raw.slice(last, m.index).trim());
    parts.push(m[1]);
    last = re.lastIndex;
  }
  parts.push(raw.slice(last).trim());
  return parts.filter(p => p.length > 0);
}

/**
 * Substitute variable names with their values in a sub-expression string.
 */
export function substituteVars(expr, vars) {
  let result = expr;
  for (const [k, v] of Object.entries(vars || {})) {
    result = result.replace(new RegExp(`\\b${k}\\b`, 'g'), fv(v));
  }
  return result;
}

/**
 * Extract the if-body and else-body code lines from source lines.
 */
export function extractBodies(codeLines) {
  let ifStart = -1, ifEnd = -1, elseStart = -1, elseEnd = -1;
  let hasElse = false;
  const ifBody = [];
  const elseBody = [];

  for (let i = 0; i < codeLines.length; i++) {
    const trimmed = codeLines[i].trim();
    if (trimmed.match(/^if\s*\(/) && ifStart < 0) { ifStart = i; continue; }
    if (trimmed === '} else {' || trimmed === '} else{') {
      ifEnd = i;
      elseStart = i;
      hasElse = true;
      continue;
    }
    if (trimmed === '}' && ifStart >= 0 && ifEnd < 0 && elseStart < 0) { ifEnd = i; continue; }
    if (trimmed === '}' && elseStart >= 0 && elseEnd < 0) { elseEnd = i; continue; }
  }

  for (let i = ifStart + 1; i < (hasElse ? elseStart : ifEnd); i++) {
    const t = codeLines[i].trim();
    if (t && t !== '{' && t !== '}') ifBody.push(t);
  }
  if (hasElse) {
    for (let i = elseStart + 1; i < (elseEnd >= 0 ? elseEnd : codeLines.length); i++) {
      const t = codeLines[i].trim();
      if (t && t !== '{' && t !== '}') elseBody.push(t);
    }
  }

  return { hasElse, ifBody, elseBody };
}

/**
 * Extract for-loop body lines from source.
 */
export function extractLoopBody(codeLines) {
  const body = [];
  let depth = 0, inside = false;
  for (let i = 0; i < codeLines.length; i++) {
    const t = codeLines[i].trim();
    if (t.match(/^for\s*\(/) && !inside) { inside = true; depth = 1; continue; }
    if (!inside) continue;
    for (const ch of t) { if (ch === '{') depth++; if (ch === '}') depth--; }
    if (depth <= 0) break;
    if (t && t !== '{' && t !== '}') body.push(t);
  }
  return body;
}
