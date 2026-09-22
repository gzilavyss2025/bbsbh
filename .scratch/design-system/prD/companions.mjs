// The ink that rides ON a fill the sweep moved.
//
// `grep -rn 'var(--seal'` cannot see these: --text-on-seal and --seal-cover-ink
// are ALIASES of --seal-ink, so a rule painting text on a kraft chip reads a
// name with no "seal" prefix in the var() call. Each row below is a surface
// whose FILL left the seal in the sweep, so its ink has to leave with it.
// Surfaces still on kraft (.btn--seal, .sc-ab__sealtext, .sc-ab__fliptext)
// keep --text-on-seal and are absent here on purpose.
import fs from 'node:fs'

const EDITS = [
  // fill → --marker, so the ink is the dark heading ink the Close Game pill
  // already asserts against it (contrastPairings.js).
  ['10-lineup.css', 573, 'var(--text-on-seal)', 'var(--text-heading)'],
  ['17-identity-lab-workbench.css', 1183, 'var(--text-on-seal)', 'var(--text-heading)'],
  ['74-contract-workbench.css', 443, 'var(--text-on-seal)', 'var(--text-heading)'],
  // fill → --accent-primary / --accent-link, both dark enough for inverse text.
  ['29-team-transactions.css', 396, 'var(--text-on-seal)', 'var(--text-on-ink)'],
  ['29-team-transactions.css', 662, 'var(--text-on-seal)', 'var(--text-on-ink)'],
  ['40-game-modals.css', 208, 'var(--text-on-seal)', 'var(--text-on-ink)'],
  ['44-pre-game-cards.css', 158, 'var(--text-on-seal)', 'var(--text-on-ink)'],
  ['44-pre-game-cards.css', 338, 'var(--text-on-seal)', 'var(--text-on-ink)'],
  ['52-highlight-clip-card.css', 161, 'var(--text-on-seal)', 'var(--text-on-ink)'],
  ['52-highlight-clip-card.css', 267, 'var(--text-on-seal)', 'var(--text-on-ink)'],
  ['52-highlight-clip-card.css', 347, 'var(--text-on-seal)', 'var(--text-on-ink)'],
]

let n = 0
for (const [file, line, from, to] of EDITS) {
  const path = `src/styles/${file}`
  const lines = fs.readFileSync(path, 'utf8').split('\n')
  const i = line - 1
  if ((lines[i].split(from).length - 1) !== 1) {
    console.error(`${file}:${line} — expected exactly one "${from}", got "${lines[i].trim()}"`)
    process.exit(1)
  }
  lines[i] = lines[i].replace(from, to)
  fs.writeFileSync(path, lines.join('\n'))
  n += 1
}
console.log(`companion inks moved: ${n}`)
