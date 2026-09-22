import { execSync } from 'node:child_process'

const sh = (c) => execSync(c, { encoding: 'utf8', maxBuffer: 1 << 26 })
const PRE = '9a578dcb7'
const FILES = [
  '10-lineup', '20-charts', '21-box-score', '23-box-score-detail', '29-team-transactions',
  '33-awards-history', '42-first-scorebook', '72-club-transactions', '46-consent-modal',
  '31-wild-card', '37-all-star-rosters', '75-run-value', '26g-command-received',
  '26-player-page', 'boxlines/boxlines', 'boxlines/listdoor', 'system/door',
]

const read = (rev, f) => {
  try { return sh(`git show ${rev}:src/styles/${f}.css`) } catch { return '' }
}

// Strip /* ... */ without regex escapes.
function strip(s) {
  let out = '', i = 0
  while (i < s.length) {
    const a = s.indexOf('/*', i)
    if (a === -1) { out += s.slice(i); break }
    out += s.slice(i, a)
    const b = s.indexOf('*/', a + 2)
    if (b === -1) break
    i = b + 2
  }
  return out
}

// Every declaration PROPERTY in the base rule for `sel` (exact selector, no pseudo).
function decls(css, sel) {
  const src = strip(css)
  let i = 0
  while (true) {
    const a = src.indexOf(sel, i)
    if (a === -1) return null
    i = a + sel.length
    const before = a === 0 ? '\n' : src[a - 1]
    if (!'\n;}{,'.includes(before) && before.trim() !== '') continue
    let j = i
    while (j < src.length && (src[j] === ' ' || src[j] === '\n')) j++
    if (src[j] !== '{') continue // pseudo, compound or longer name
    const end = src.indexOf('}', j)
    return src.slice(j + 1, end).split(';')
      .map((d) => d.trim()).filter(Boolean)
      .map((d) => d.slice(0, d.indexOf(':')).trim())
      .filter(Boolean).sort()
  }
}

const preAll = FILES.map((f) => read(PRE, f)).join('\n')
const postAll = FILES.map((f) => read('HEAD', f)).join('\n')
const doorCss = read('HEAD', 'system/door')
const base = {
  block: [...(decls(doorCss, '.door') || []), ...(decls(doorCss, '.door--block') || [])],
  inline: [...(decls(doorCss, '.door') || []), ...(decls(doorCss, '.door--inline') || [])],
}

const PAIRS = [
  ['.teammates__more', null, 'block'], ['.marginnotes__more', null, 'block'],
  ['.bs__noteMore', null, 'block'], ['.gamesgrid__more', null, 'block'],
  ['.pshistory__more', null, 'block'],
  ['.txcard__more', '.txcard__door', 'block'], ['.txpage__more', '.txpage__door', 'block'],
  ['.chevron-link', null, 'inline'],
]

let lostTotal = 0
for (const [old, now, kind] of PAIRS) {
  const before = decls(preAll, old)
  if (!before) { console.log(`${old}: NOT FOUND pre-merge`); continue }
  const residual = now ? (decls(postAll, now) || []) : []
  const covered = new Set([...base[kind], ...residual])
  const lost = before.filter((d) => !covered.has(d))
  lostTotal += lost.length
  console.log(`\n${old}  ->  ${now ?? `.door .door--${kind}`}`)
  console.log(`  pre-merge: ${before.length} decls`)
  console.log(`  residual : ${residual.length ? residual.join(', ') : '(none)'}`)
  console.log(`  ${lost.length ? '*** LOST: ' + lost.join(', ') : 'all covered'}`)
}
console.log(`\n${lostTotal === 0 ? 'No declaration lost.' : lostTotal + ' declaration(s) lost.'}`)
