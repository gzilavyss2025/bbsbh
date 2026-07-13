#!/usr/bin/env node
// Guards the JS half of the ALL-CAPS INVARIANT (see the block comment in
// src/index.css). The CSS half (check-caps.mjs) makes sure nothing UNDOES the
// global uppercase; this makes sure nothing RE-DOES it redundantly in JS —
// a component calling `.toUpperCase()` on a name/label the CSS invariant
// already uppercases. Redundant, and can silently drift from the CSS path on
// a real name (JS toUpperCase() and CSS text-transform disagree on some
// Unicode casing, e.g. Turkish "i", German "ß") — see ADR-0017.
//
// Run by `npm run lint` (so it gates every push). Zero deps, walks src/**/*.jsx.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');

const BANNED = /\.(toUpperCase|toLowerCase)\(\)/g;

// A line may opt out ONLY with an explicit, greppable marker comment — for
// the handful of legitimate JS casing calls that aren't "re-uppercase a
// display name" (a single-letter monogram fallback, capitalizing the first
// letter of a word for a sentence). See ADR-0017.
const EXEMPT = /caps-js-exempt\b/i;

function jsxFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...jsxFiles(full));
    else if (entry.endsWith('.jsx')) out.push(full);
  }
  return out;
}

// Blank out // line comments and /* ... */ block comments while preserving
// newlines, so line numbers stay accurate and prose mentioning these calls
// isn't flagged.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, (m) => ' '.repeat(m.length));
}

const violations = [];
for (const file of jsxFiles(SRC)) {
  const raw = readFileSync(file, 'utf8').split('\n');
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
    '\n✗ ALL-CAPS INVARIANT (JS half) violated — a component re-uppercases a\n' +
      '  name/label the global CSS invariant already handles. Drop the call and\n' +
      '  let #root * in src/index.css do it (see ADR-0017), or mark a genuinely\n' +
      '  different use (a monogram, a sentence capitalization) with a\n' +
      '  `caps-js-exempt` comment on the same line:\n'
  );
  for (const v of violations) {
    const rel = v.file.slice(v.file.indexOf('src'));
    console.error(`  ${rel}:${v.line}  ${v.text}`);
  }
  console.error('');
  process.exit(1);
}

console.log('✓ ALL-CAPS INVARIANT (JS half) holds — no redundant .toUpperCase()/.toLowerCase() in src/**/*.jsx.');
