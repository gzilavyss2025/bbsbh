#!/usr/bin/env node
// Guards the LF invariant: nothing enters the index with CRLF line endings.
//
// This is the reporting half of a two-part rule. `.gitattributes` is the other
// half and does the actual preventing (`* text=auto eol=lf`, which normalizes on
// the way into the index); read its header for why the rule exists at all. This
// script exists because configuration that silently fixes things is also
// configuration nobody notices has stopped working — an `-text` attribute added
// by hand, a file added with `--no-normalize`, or a merge that carried CRLF in
// from an old branch would all pass unremarked otherwise.
//
// WHY IT COST SOMETHING. A CRLF file differs from its LF counterpart on every
// line, so git cannot see a small edit inside one; it reports a whole-file
// rewrite. Three files in PR #740 did exactly that, turning a two-line change to
// `api/_lib/cards.js` into a 684-line merge conflict (resolved in #742). The
// reviewer's problem is not the endings, it is that the real diff is no longer
// visible anywhere.
//
// IT READS THE INDEX, NOT THE WORKING TREE, and that distinction is the whole
// design. This repo's only development machine is Windows, where a CRLF working
// tree is normal and correct — `core.autocrlf` puts it there on checkout. A
// guard that walked the files on disk would fail on a perfectly healthy
// checkout, so it would be turned off within a day. `git ls-files --eol` reports
// both, and only the `i/` (index) column says what is actually COMMITTED.
//
// Run by `npm run lint` (so it gates every push). Zero deps.

import { execFileSync } from 'node:child_process'

// --eol prints one row per tracked file:
//   i/lf    w/crlf  attr/text=auto      	src/api/select.js
// i/ is the index, w/ the working tree, attr/ the resolved .gitattributes value.
// -z would be the safe separator for paths, but --eol does not honour it, so
// paths are read as the remainder of the line after the single tab.
let rows
try {
  rows = execFileSync('git', ['ls-files', '--eol'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\n')
    .filter(Boolean)
} catch (error) {
  console.error(
    '\n✗ Line-ending guard could not read the index: ' +
      (error?.message ?? error) +
      '\n  It runs `git ls-files --eol`, so it needs to run inside the repo.\n',
  )
  process.exit(1)
}

// Same vacuous-pass hazard the sibling guards call out: if this ever reads an
// empty or tiny file list, it must fail rather than print ✓ over nothing. The
// repo tracks a few thousand files; 500 is a floor no healthy checkout is under.
if (rows.length < 500) {
  console.error(
    `\n✗ Line-ending guard has nothing to check — \`git ls-files --eol\` returned ${rows.length} row(s).\n` +
      '  A checkout this small means the command is being run from the wrong place, or\n' +
      '  its output format changed. Fix the script; do not delete this assertion, because\n' +
      '  a vacuous pass still prints ✓.\n',
  )
  process.exit(1)
}

const offenders = []
for (const row of rows) {
  // `i/crlf` is wholly CRLF; `i/mixed` has both, which is worse — a file that
  // changes convention part-way makes every later line look edited.
  const eol = row.match(/^i\/(\S*)/)?.[1]
  if (eol !== 'crlf' && eol !== 'mixed') continue
  const path = row.slice(row.indexOf('\t') + 1)
  offenders.push({ path, eol })
}

if (offenders.length) {
  console.error(
    '\n✗ LF invariant violated — these files are committed with Windows line endings.\n' +
      '  Git sees a CRLF file as rewritten on every line, so the next small edit to one\n' +
      '  arrives as a whole-file merge conflict with the real change buried in it.\n',
  )
  for (const { path, eol } of offenders) console.error(`  ${path} (${eol})`)
  console.error(
    '\n  Fix, from the repo root:\n' +
      '    git add --renormalize .\n' +
      '    git commit -m "Normalise line endings to LF"\n' +
      '\n  Your WORKING TREE is allowed to be CRLF on Windows — this reads the index,\n' +
      '  so `--renormalize` is all that is needed and no file on disk has to change.\n',
  )
  process.exit(1)
}

console.log(`✓ LF invariant holds — ${rows.length} tracked files, none committed with CRLF.`)
