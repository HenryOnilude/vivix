#!/usr/bin/env node
/**
 * Vivix — One-time header prepender
 * Prepends an authorship block to all .js, .jsx, .ts, .tsx, and .svelte files
 * under /src. Skips files that already have the header.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const JS_HEADER = `/**
 * Vivix — JavaScript Visualizer
 *
 * @author     Henry Onilude
 * @copyright  2026 Henry Onilude
 * @license    MIT
 * @link       https://github.com/HenryOnilude/vivix
 */

`;

const SVELTE_HEADER = `<!--
  Vivix — JavaScript Visualizer

  @author     Henry Onilude
  @copyright  2026 Henry Onilude
  @license    MIT
  @link       https://github.com/HenryOnilude/vivix
-->

`;

const SIGNATURE = '@author     Henry Onilude';
const SRC_DIR = join(import.meta.dirname, '..', 'src');
const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.svelte']);

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const st = statSync(path);
    if (st.isDirectory()) {
      results.push(...walk(path));
    } else if (st.isFile() && EXTENSIONS.has(extname(entry))) {
      results.push(path);
    }
  }
  return results;
}

let added = 0;
let skipped = 0;

for (const file of walk(SRC_DIR)) {
  const content = readFileSync(file, 'utf-8');
  if (content.includes(SIGNATURE)) {
    skipped++;
    continue;
  }
  const header = extname(file) === '.svelte' ? SVELTE_HEADER : JS_HEADER;
  writeFileSync(file, header + content, 'utf-8');
  added++;
}

console.log(`Done. Added: ${added}  |  Skipped (already has header): ${skipped}`);
