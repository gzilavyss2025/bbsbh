#!/usr/bin/env node
// Guards the ALL-CAPS INVARIANT (see the block comment in src/index.css).
//
// Every page must render uppercase, including live API values. `#root *` in
// index.css forces that globally; this check makes sure nothing sneaks a
// caps-defeating `text-transform` back into the CSS — the exact bug where a
// value is uppercase and then "something steps in front of it and undoes it".
//
// Run by `npm run lint` (so it gates every push). Zero deps, walks src/.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');

// text-transform values that would defeat the global uppercase.
const BANNED = /text-transform\s*:\s*(none|lowercase|capitalize)\b/gi;

// A line may opt out ONLY with an explicit, greppable marker comment. Today the
// sole sanctioned exception is `.buzz__text` (Bluesky posts keep their authors'
// original casing) — see the ALL-CAPS INVARIANT block in src/index.css.
const EXEMPT = /caps-exempt\b/i;

function cssFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...cssFiles(full));
    else if (entry.endsWith('.css')) out.push(full);
  }
  return out;
}

// Blank out /* ... */ comments (even multi-line) while preserving newlines, so
// line numbers stay accurate and prose mentioning these values isn't flagged.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

const violations = [];
for (const file of cssFiles(SRC)) {
  const raw = readFileSync(file, 'utf8').split('\n');
  // Scan comment-stripped lines so prose mentioning these values isn't flagged,
  // but read the exemption marker off the raw line (stripComments blanks it).
  const lines = stripComments(raw.join('\n')).split('\n');
  lines.forEach((line, i) => {
    if (BANNED.test(line)) {
      BANNED.lastIndex = 0; // reset stateful global regex
      if (EXEMPT.test(raw[i])) return; // deliberate, marked opt-out
      violations.push({ file, line: i + 1, text: line.trim() });
    }
  });
}

if (violations.length) {
  console.error(
    '\n✗ ALL-CAPS INVARIANT violated — every page must render uppercase.\n' +
      '  Remove these caps-defeating declarations (see src/index.css):\n'
  );
  for (const v of violations) {
    const rel = v.file.slice(v.file.indexOf('src'));
    console.error(`  ${rel}:${v.line}  ${v.text}`);
  }
  console.error('');
  process.exit(1);
}

console.log('✓ ALL-CAPS INVARIANT holds — no caps-defeating text-transform in CSS.');
