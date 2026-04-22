/**
 * Glossary — plain-English definitions for technical terms used in Vivix.
 *
 * The key is the canonical term as it appears in UI and brain text.
 * Lookups are performed case-insensitively. Aliases can be added by
 * mapping them to the same definition string.
 *
 * Keep every definition to a single sentence and avoid jargon that would
 * itself need its own tooltip.
 */

export const GLOSSARY = {
  'Heap Memory':         'Where JavaScript stores objects and variables while the program runs.',
  'Call Stack':          'A list of functions currently being executed, newest on top.',
  'LIFO':                'Last In First Out — the last function called is always the first to finish.',
  'TDZ':                 'Temporal Dead Zone — the period where a let or const variable exists but cannot be accessed yet.',
  'Temporal Dead Zone':  'The period where a let or const variable exists but cannot be accessed yet.',
  'Microtask Queue':     'A waiting area for Promises that runs before the next event loop task.',
  'Macrotask Queue':     'A waiting area for timers and callbacks that runs after microtasks.',
  'OP_DECLARE':          'An operation where the engine allocates memory for a new variable.',
  'Heap Mutation':       'A change to a value already stored in memory.',
  'Closure':             'A function that remembers variables from the scope where it was created.',
  'Lexical Environment': 'The record of all variables available in a particular scope.',
  'Instruction Pointer': 'Tracks which operation the engine is currently executing.',
  'Scope Chain':         'The path the engine follows to find a variable, from local to global.',
  'Hoisting':            'When the engine moves variable and function declarations to the top of their scope before executing.',
  'Garbage Collection':  'The engine automatically freeing memory that is no longer referenced.',
  'Event Loop':          'The mechanism that lets JavaScript handle async operations despite being single-threaded.',
};

// Build a case-insensitive lookup keyed by lower-cased term.
const LOWER = new Map(
  Object.entries(GLOSSARY).map(([term, def]) => [term.toLowerCase(), def])
);

/**
 * Look up a term's definition. Case-insensitive; returns null when the
 * term is not in the glossary.
 * @param {string} term
 * @returns {string|null}
 */
export function defineTerm(term) {
  if (!term) return null;
  return LOWER.get(term.toLowerCase()) ?? null;
}

// Terms ordered longest-first so e.g. "Temporal Dead Zone" matches before
// "TDZ" / "Zone" when auto-wrapping prose. Mutations are avoided by
// freezing the array.
export const TERMS_LONGEST_FIRST = Object.freeze(
  Object.keys(GLOSSARY).sort((a, b) => b.length - a.length)
);

/**
 * Split a string into an array of { text, term } tokens. Each `term`
 * token corresponds to a glossary entry; each `text` token is plain
 * prose. Preserves original casing and word boundaries.
 *
 * Used by the <GlossaryText> helper to auto-wrap matches without the
 * caller having to know which words are glossary terms.
 *
 * @param {string} text
 * @returns {Array<{ text: string, term?: string }>}
 */
export function tokenize(text) {
  if (!text) return [];
  // Build one regex per call to remain robust if TERMS_LONGEST_FIRST is
  // extended at runtime. Word-boundaries prevent sub-word matches.
  const escaped = TERMS_LONGEST_FIRST
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
  const out = [];
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], term: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
