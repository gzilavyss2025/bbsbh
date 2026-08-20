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

// The blanket uppercase rules an exemption has to out-rank. `#root *`
// (01-base.css) covers the app; `.focusrail__sheet *` (focus/reference.css)
// re-states the invariant for the one sheet ModalPortal renders into <body>,
// outside #root. A marked exemption that cannot beat its blanket is a silent
// no-op — the marker reads as "deliberate" while the cascade says otherwise,
// which is how five shouted paragraphs shipped (issue #769).
const BLANKET = /^(.*?)\s*\*$/;
const UPPERCASE = /text-transform\s*:\s*uppercase\b/i;

// CSS specificity as [ids, classes, elements]. Good enough for this codebase:
// `:not(...)` contributes its argument (per spec) and nothing of its own, so
// unwrap it before counting; everything else here is ids, classes and tags.
function specificity(selector) {
  const sel = selector.replace(/:not\(/gi, '(').replace(/::[\w-]+/g, ' ');
  const ids = (sel.match(/#[\w-]+/g) || []).length;
  const classes = (sel.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+/g) || []).length;
  const elements = (
    sel.replace(/[#.][\w-]+|\[[^\]]*\]|:[\w-]+/g, ' ').match(/\b[a-z][\w-]*/gi) || []
  ).length;
  return [ids, classes, elements];
}

function beats(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false; // a tie loses: the blanket is declared first, so it would win
}

// Selector text for the rule containing `index`, read off comment-stripped
// lines: walk back to the `{` that opens the rule, then keep taking lines
// until the previous rule's `}` or a blank line.
function ruleSelector(lines, index) {
  let open = index;
  while (open >= 0 && !lines[open].includes('{')) open--;
  if (open < 0) return '';
  const parts = [];
  for (let i = open; i >= 0; i--) {
    if (i < open && (lines[i].includes('}') || lines[i].trim() === '')) break;
    parts.unshift(lines[i]);
  }
  return parts.join(' ').split('{')[0].trim().replace(/\s+/g, ' ');
}

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

// Read every file once: comment-stripped lines for the cascade, raw lines for
// the marker (stripComments blanks it).
const files = cssFiles(SRC).map((file) => {
  const raw = readFileSync(file, 'utf8').split('\n');
  return { file, raw, lines: stripComments(raw.join('\n')).split('\n') };
});

// Pass 1 — the blanket uppercase rules, so pass 2 knows what each exemption
// has to beat. A blanket's scope is its selector minus the trailing `*`.
const blankets = [];
for (const { file, lines } of files) {
  lines.forEach((line, i) => {
    if (!UPPERCASE.test(line)) return;
    const selector = ruleSelector(lines, i);
    const scope = BLANKET.exec(selector);
    if (!scope) return;
    blankets.push({ file, scope: scope[1].trim(), spec: specificity(selector) });
  });
}

// The blanket an exemption sits under: the one whose scope its selector starts
// with (`.focusrail__sheet .marginnotes__text` is inside `.focusrail__sheet *`),
// falling back to the widest blanket — `#root *`, which covers the whole app —
// for a selector that names no scope at all. That fallback is the point: a bare
// class selector still has to beat `#root *`, and five of them did not.
const widest = blankets.reduce((a, b) => (beats(b.spec, a.spec) ? b : a));
function blanketFor(selector) {
  const scoped = blankets.find(
    (b) => b.scope && (selector === b.scope || selector.startsWith(`${b.scope} `))
  );
  return scoped || widest;
}

const violations = [];
const noops = [];
for (const { file, raw, lines } of files) {
  lines.forEach((line, i) => {
    if (!BANNED.test(line)) return;
    BANNED.lastIndex = 0; // reset stateful global regex
    const text = line.trim();
    if (!EXEMPT.test(raw[i])) {
      violations.push({ file, line: i + 1, text });
      return;
    }
    // Marked opt-out — but a marker only counts if the rule can actually win.
    const selector = ruleSelector(lines, i);
    const blanket = blanketFor(selector);
    if (!beats(specificity(selector), blanket.spec)) {
      noops.push({ file, line: i + 1, selector, blanket });
    }
  });
}

if (violations.length) {
  console.error(
    '\n✗ ALL-CAPS INVARIANT violated — every page must render uppercase.\n' +
      '  Remove these caps-defeating declarations (see src/styles/01-base.css):\n'
  );
  for (const v of violations) {
    const rel = v.file.slice(v.file.indexOf('src'));
    console.error(`  ${rel}:${v.line}  ${v.text}`);
  }
  console.error('');
}

if (noops.length) {
  console.error(
    '\n✗ caps-exempt marker that cannot win the cascade — the rule is a silent\n' +
      '  no-op, so the text still renders shouted. Raise its specificity (prefix\n' +
      '  the selector with `#root`, as `#root .winprob__ledger-desc` does):\n'
  );
  for (const n of noops) {
    const rel = n.file.slice(n.file.indexOf('src'));
    console.error(`  ${rel}:${n.line}  ${n.selector}  loses to  ${n.blanket.scope} *`);
  }
  console.error('');
}

if (violations.length || noops.length) process.exit(1);

console.log('✓ ALL-CAPS INVARIANT holds — no caps-defeating text-transform in CSS.');
