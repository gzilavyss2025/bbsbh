#!/usr/bin/env node
// Guards the CLAUDE.md LEANNESS RULE (see the "Maintaining these docs" section
// of the root CLAUDE.md).
//
// The root CLAUDE.md is loaded into context on EVERY Claude Code session and
// persists the whole session, so its size is a fixed per-session token tax.
// Subsystem detail belongs in the nested CLAUDE.md files (src/, src/api/,
// scripts/) that Claude loads only when it navigates into that directory, and
// in docs/*. This check keeps the always-loaded root file lean by failing the
// build if it grows past MAX_LINES — mirroring check-caps.mjs (zero deps, run
// by `npm run lint`, so it gates every push and every CI run).
//
// If this fails, DON'T just raise the cap: move detail into the relevant nested
// CLAUDE.md or a docs/* file and leave a one-line pointer in root.

import { readFileSync } from 'node:fs';

const MAX_LINES = 200;

const file = new URL('../CLAUDE.md', import.meta.url);

// Count lines the same way `wc -l` does not matter here — we care about the
// editor-visible line count, so split on newlines and drop a single trailing
// empty element from a final newline.
const raw = readFileSync(file, 'utf8');
const parts = raw.split('\n');
if (parts.length && parts[parts.length - 1] === '') parts.pop();
const lines = parts.length;

if (lines > MAX_LINES) {
  console.error(
    `\n✗ CLAUDE.md LEANNESS RULE violated — root CLAUDE.md is ${lines} lines ` +
      `(max ${MAX_LINES}).\n` +
      '  Move subsystem detail into a nested CLAUDE.md (src/, src/api/, scripts/)\n' +
      '  or a docs/* file and leave a pointer in root — do not raise the cap.\n'
  );
  process.exit(1);
}

console.log(
  `✓ CLAUDE.md LEANNESS RULE holds — root CLAUDE.md is ${lines}/${MAX_LINES} lines.`
);
