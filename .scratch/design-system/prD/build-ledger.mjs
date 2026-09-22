// Renders ledger.md from ledger.json (the mechanical extraction) + decisions.mjs
// (the classification). Run from the repo root:
//   node .scratch/design-system/prD/build-ledger.mjs
import fs from 'node:fs'
import { DECISIONS } from './decisions.mjs'

const DIR = '.scratch/design-system/prD'
const rows = JSON.parse(fs.readFileSync(`${DIR}/ledger.json`, 'utf8'))

const LABEL = {
  stays: 'STAYS',
  marker: '--marker',
  struct: 'structural',
}

const tally = { stays: 0, marker: 0, struct: 0 }
for (const r of rows) tally[DECISIONS[`${r.file}:${r.line}`][0]] += 1

const partials = [...new Set(rows.map((r) => r.file))]
const staysFiles = [...new Set(rows.filter((r) => DECISIONS[`${r.file}:${r.line}`][0] === 'stays').map((r) => r.file))]

const out = []
out.push('# Slice D ledger — every `var(--seal*)` read in `src/styles/`, classified')
out.push('')
out.push('Issue #1138, slice D of #1128. Generated, not hand-typed:')
out.push('`ledger.raw` is `grep -rn \'var(--seal\' src/styles/`; `ledger.json` adds the')
out.push('enclosing selector; `decisions.mjs` carries the classification; this file is')
out.push('rendered from the three by `build-ledger.mjs`.')
out.push('')
out.push('## Measured on `main` f12208170 (2026-09-22)')
out.push('')
out.push('| | |')
out.push('| --- | --- |')
out.push(`| partials reading \`var(--seal*)\` | **${partials.length}** |`)
out.push(`| grep hits | **296** — 295 declarations + 1 prose mention in a comment (\`52-highlight-clip-card.css:70\`) |`)
out.push('| border family | 114 (`border-color` 33, `border` 30, `border-bottom` 19, `border-left` 13, `border-top` 7, `border-bottom-color` 7, `border-top-color` 3, `border-right` 2) |')
out.push('| `background` | 78 |')
out.push('| `color` | 75 |')
out.push('| `color-mix()` | 27 — these overlap the three above, so the property counts do not sum to 295 |')
out.push('| the rest | 13 — `stroke` 8, `box-shadow` 4, `fill` 2 (+1 on a one-line rule), `outline` 1 |')
out.push('| indirections | 1 — `26b-player-contract.css:301` sets `--seg-dot`, a custom property, not a paint property |')
out.push('')
out.push('## The three destinations')
out.push('')
out.push('| destination | reads | what it means |')
out.push('| --- | --- | --- |')
out.push(`| **STAYS** | **${tally.stays}** | a reveal is possible on that surface — or finding 9's must-survive list names it |`)
out.push(`| **\`--marker\`** | **${tally.marker}** | rank, flag, "you are here", "this one stands out" |`)
out.push(`| **structural** | **${tally.struct}** | a rule, a neutral, an action colour, a club accent — mostly borders on controls |`)
out.push('')
out.push(`The STAYS rows sit in **${staysFiles.length} partials**. That is the number`)
out.push('`scripts/check-seal-scope.mjs` allowlists, and the guard asserts it.')
out.push('')
out.push('### Three house recipes carry `--marker`')
out.push('')
out.push('`--marker` (#E9C33F) is a bright highlighter yellow. It is a FILL colour: it')
out.push('cannot be body text on paper, and as a hairline it all but disappears. Each of')
out.push('these three already existed in the repo before this sweep:')
out.push('')
out.push('| role | recipe | precedent |')
out.push('| --- | --- | --- |')
out.push('| fill | `var(--marker)` with `var(--text-heading)` on it | the Close Game pill, `contrastPairings.js:92` |')
out.push('| wash | `color-mix(in srgb, var(--marker) 16%, var(--paper-2))` | `12-sealbox.css:561`, `14-strike-zone.css:126`, and three more |')
out.push('| rule | `color-mix(in srgb, var(--marker) 70%, var(--text-heading))` | `11-pregame-scoreboard.css:193` |')
out.push('')
out.push('Where emphasis had to be expressed as TEXT rather than a fill — a lead rank, a')
out.push("today mark, a callout's star — the read goes structural (heading ink or")
out.push('pencil), never to marker. Yellow text on cream is 1.9:1.')
out.push('')
out.push('### One new token pair')
out.push('')
out.push('`--marker-deep` + `--hold-texture` (`src/tokens/`). The status-tape family is')
out.push('three weaves of one hatch: `--il-texture` (clay, injured list), `--win-texture`')
out.push('(field green, a win stamp) and, until now, `--seal-texture` (kraft) for a game')
out.push('or a player put ON HOLD. Kraft tape on a rehab banner is the sharpest form of')
out.push('the dilution this slice is about: it is the cover\'s own material, on something')
out.push('no tap will ever lift. Moving that one member to the flag colour keeps the')
out.push('family intact and frees the material. Both stripes are asserted in')
out.push('`contrastPairings.js`.')
out.push('')
out.push('## The rows')
out.push('')

for (const file of partials) {
  const mine = rows.filter((r) => r.file === file)
  out.push(`### \`${file}\``)
  out.push('')
  out.push('| line | selector | destination | reason |')
  out.push('| --- | --- | --- | --- |')
  for (const r of mine) {
    const [dest, why, , to] = DECISIONS[`${r.file}:${r.line}`]
    const dst = dest === 'stays' ? '**STAYS**' : `\`${to}\``
    out.push(`| ${r.line} | \`${r.selector.replace(/\|/g, '\\|')}\` | ${LABEL[dest]} → ${dst.replace(/\|/g, '\\|')} | ${why} |`)
  }
  out.push('')
}

fs.writeFileSync(`${DIR}/ledger.md`, `${out.join('\n')}\n`)
console.log(`ledger.md written — ${rows.length} rows, ${partials.length} partials, ${staysFiles.length} STAYS partials`)
console.log('STAYS partials:', staysFiles.join(' '))
