#!/usr/bin/env node
// Guards the house word list — the terms this app always says the same way.
//
// Today it holds one rule: baseball's October is the POSTSEASON, never the
// "playoffs". That is a voice decision, not a preference. The app speaks a
// scorebook's language, and MLB's own language, on every surface: page copy,
// callout text, doc prose, comments, and the identifiers that carry the value
// (`postseasonPct`, `madePostseason`). A codebase that says "playoffs" in the
// data layer and "Postseason" in the UI teaches the next reader that the two
// are different things.
//
// Run by `npm run lint` (so it gates every push). Zero deps.
//
// SCOPE — the app's own voice and its own names:
//   src/  api/  scripts/  docs/  .claude/  root *.md  CONTEXT.md
// Deliberately NOT scanned:
//   *.json data files, which carry values captured from somebody else's
//   system. `.scratch/prospect-traits/awards.json` holds real MiLB award
//   names ("MiLB.com Double-A Best Playoff Performer"); renaming those would
//   both break the join against statsapi and misname an actual award. The
//   same logic covers any future captured field or third-party label.
//
// A line may opt out ONLY with an explicit, greppable marker comment, for the
// case this scope rule cannot see: a PROPER NOUN owned by someone else that
// happens to contain the word. FanGraphs ships a product called "Playoff
// Odds"; naming it "Postseason Odds" would make it unfindable. Use
//   word-choice-exempt
// on the same line, and only for a name you do not control.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const RULES = [{ banned: /playoffs?/gi, use: 'postseason' }];

const EXEMPT = /word-choice-exempt\b/i;

// Directories scanned whole, plus the loose root files worth covering.
const DIRS = ['src', 'api', 'scripts', 'docs', '.claude'];
const ROOT_FILES = ['CLAUDE.md', 'CONTEXT.md', 'README.md'];

// Text this app authors. JSON is excluded on purpose (see SCOPE above).
const EXTENSIONS = ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.css', '.md', '.html'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', 'test-results']);

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // an optional directory (e.g. .claude/) may not exist
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) out.push(full);
  }
  return out;
}

const files = [
  ...DIRS.flatMap((d) => walk(join(ROOT, d))),
  ...ROOT_FILES.map((f) => join(ROOT, f)).filter((f) => {
    try {
      return statSync(f).isFile();
    } catch {
      return false;
    }
  }),
];

// A guard that stops guarding is worse than none: the ✓ still prints and reads
// as coverage. If the tree moved out from under this scope, fail loudly.
if (files.length < 100) {
  console.error(
    `\n✗ Word-choice guard has almost nothing to check — found ${files.length} file(s).\n` +
      '  If the source tree moved, repoint DIRS in this script IN THE SAME COMMIT\n' +
      '  as the move. Do not delete this assertion.\n'
  );
  process.exit(1);
}

const violations = [];

for (const file of files) {
  // This script states the banned words to ban them, so it cannot scan itself.
  if (file === fileURLToPath(import.meta.url)) continue;
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (EXEMPT.test(line)) return;
    for (const rule of RULES) {
      rule.banned.lastIndex = 0;
      const found = line.match(rule.banned);
      if (found) {
        violations.push(
          `${relative(ROOT, file).replace(/\\/g, '/')}:${i + 1}: "${found[0]}" — say "${rule.use}"`
        );
      }
    }
  });
}

if (violations.length) {
  console.error('\n✗ Word-choice guard failed — the house word list is not optional:\n');
  for (const v of violations) console.error(`  ${v}`);
  console.error(
    '\n  Baseball\'s October is the POSTSEASON here, in copy, prose, comments and\n' +
      '  identifier names alike. If the word is part of a proper noun you do not\n' +
      '  own (a third-party product or a real award title), mark that line\n' +
      '  `word-choice-exempt` and say why.\n'
  );
  process.exit(1);
}

console.log(`Word-choice guard passed (${files.length} files)`);
