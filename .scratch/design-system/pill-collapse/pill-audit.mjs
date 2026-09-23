// Declaration-set audit for a Pill slice (#1131), adapted from
// ../door-collapse/door-audit.mjs. For every old rule it lists each PROPERTY
// the rule declared at the merge base, and checks it is still declared by the
// pill it became (.pill, plus its role/fill modifier) or by the residual rule
// the slice kept. Anything left over is a LOSS unless the slice drops it on
// purpose — and then it goes in DROPPED below with the reason, so a reader
// sees every one.
//
// A pill custom property counts as covering the paint property it feeds:
// --pill-fill covers background, --pill-edge covers border-color, --pill-ink
// covers color. That is the whole point of the skin model.
//
//   node pill-audit.mjs            (slice 1: merge base ef2eb7ba7 vs the working tree)
//   SLICE=2 node pill-audit.mjs    (slice 2: merge base 0aaa46737 vs the working tree)
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const SLICE = process.env.SLICE || '1'
const BASE = process.env.BASE || (SLICE === '1' ? 'ef2eb7ba7' : '0aaa46737')
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 })
const atBase = (f) => { try { return sh(`git show ${BASE}:src/styles/${f}`) } catch { return '' } }
const now = (f) => { try { return readFileSync(join(ROOT, 'src/styles', f), 'utf8') } catch { return '' } }

// Properties of the rule written exactly as `sel`, top level only unless
// `media` names the at-rule params it sits in.
function props(css, sel, media = null) {
  if (!css) return null
  let found = null
  postcss.parse(css).walkRules((r) => {
    if (found) return
    const inMedia = r.parent?.type === 'atrule' ? r.parent.params : null
    if (inMedia !== media) return
    if (r.selectors.map((s) => s.trim()).includes(sel)) {
      found = r.nodes.filter((n) => n.type === 'decl').map((d) => d.prop)
    }
  })
  return found
}

const COVERS = {
  '--pill-fill': ['background', 'background-color'],
  '--pill-edge': ['border-color'],
  '--pill-ink': ['color', 'border-color'],
  'border-style': ['border'],
}
const expand = (list) => new Set(list.flatMap((p) => [p, ...(COVERS[p] || [])]))

const pillCss = now('system/pill.css')
const pill = (mods = []) => [
  ...(props(pillCss, '.pill') || []),
  ...mods.flatMap((m) => props(pillCss, m) || []),
  // The component writes --pill-ink inline when a consumer passes `ink`.
  '--pill-ink',
]

// old selector @ file  →  what it became. `residual` is [file, selector] of
// the rule the slice kept; `mods` the pill modifiers the consumer wears.
const PAIRS_1 = [
  { old: '.milestonepill', file: '31-wild-card.css' },
  { old: '.rookiepill', file: '31-wild-card.css' },
  { old: '.rookiepill__short', file: '31-wild-card.css', residual: ['31-wild-card.css', '.rookie__short'] },
  { old: '.prospectpill', file: '31-wild-card.css' },
  { old: '.prospectpill__logo', file: '31-wild-card.css', residual: ['31-wild-card.css', '.prospect__logo'] },
  { old: '.tlead__row .prospectpill', file: '23-box-score-detail.css', residual: ['23-box-score-detail.css', '.tlead__row .prospect__tag'] },
  { old: '.tradecard__playerinfo .prospectpill', file: '47-trade-deadline.css', residual: ['47-trade-deadline.css', '.tradecard__playerinfo .prospect__tag'] },
  { old: '.lineupcard__names .rookiepill__full', file: '12-sealbox.css', residual: ['12-sealbox.css', '.lineupcard__names .rookie__full'] },
  { old: '.lineupcard__names .rookiepill__short', file: '12-sealbox.css', residual: ['12-sealbox.css', '.lineupcard__names .rookie__short'] },
  { old: '.rankchip', file: '31-wild-card.css', residual: ['31-wild-card.css', '.rank__tag'] },
  { old: '.rankchip--good', file: '31-wild-card.css', residual: ['31-wild-card.css', '.rank__tag--good'] },
  { old: '.rankchip--bad', file: '31-wild-card.css', residual: ['31-wild-card.css', '.rank__tag--bad'] },
  { old: '.tierpill', file: '09-team-info.css' },
  { old: '.tierpill--elite', file: '09-team-info.css', residual: ['09-team-info.css', '.tier__tag--elite'] },
  { old: '.tierpill--good', file: '09-team-info.css', residual: ['09-team-info.css', '.tier__tag--good'] },
  { old: '.tierpill--average', file: '09-team-info.css', residual: ['09-team-info.css', '.tier__tag--average'] },
  { old: '.tierpill--below', file: '09-team-info.css', residual: ['09-team-info.css', '.tier__tag--below'] },
  { old: '.pbp__placed', file: '13-play-by-play.css', residual: ['13-play-by-play.css', '.pbp__placed'] },
  { old: '.umpmodal__glevel', file: '14-strike-zone.css' },
  { old: '.cthist__fuzzy', file: '26e-contract-history.css', residual: ['26e-contract-history.css', '.cthist__fuzzy'] },
  { old: '.leaguerank__chip', file: '27-player-position-innings.css', residual: ['27-player-position-innings.css', '.leaguerank__tag'], mods: ['.pill--paper'] },
  { old: '.awardord__tier', file: '45-admin-copy-editor.css', residual: ['45-admin-copy-editor.css', '.awardord__tier'] },
  { old: '.simlike__term', file: '51-similar-players.css', residual: ['51-similar-players.css', '.simlike__term'] },
  { old: '.simlike__term--muted', file: '51-similar-players.css', residual: ['51-similar-players.css', '.simlike__term--muted'] },
  { old: '.simlike__term', file: '51-similar-players.css', media: '(min-width: 740px)' },
  { old: '.awards__chip', file: '67-awards-ledger.css', mods: ['.pill--paper'] },
  { old: '.cwb__badge', file: '74-contract-workbench.css' },
  { old: '.cwb__badge--fuzzy', file: '74-contract-workbench.css', residual: ['74-contract-workbench.css', '.cwb__badge--fuzzy'] },
  { old: '.cwb__badge--target', file: '74-contract-workbench.css', residual: ['74-contract-workbench.css', '.cwb__badge--target'] },
  { old: '.dlab__verdict', file: 'designlab/lab.css', residual: ['designlab/lab.css', '.dlab__verdict'] },
  { old: '.dlab__verdict--canon', file: 'designlab/lab.css', residual: ['designlab/lab.css', '.dlab__verdict--canon'] },
  { old: '.dlab__verdict--merge', file: 'designlab/lab.css', residual: ['designlab/lab.css', '.dlab__verdict--merge'] },
  { old: '.dlab__verdict--bespoke', file: 'designlab/lab.css', residual: ['designlab/lab.css', '.dlab__verdict--bespoke'] },
  { old: '.dlab__verdict--delete', file: 'designlab/lab.css', residual: ['designlab/lab.css', '.dlab__verdict--delete'] },
]

// Dropped on purpose. Key: `old selector|property`. Every entry says why.
const DROPPED_1 = {
  '.tierpill|line-height': 'the tag line is --lh-compact for every tag (tier grows 18 → 20.4px)',
  '.umpmodal__glevel|line-height': 'the tag line is --lh-compact for every tag (15 → 20.4px)',
  '.simlike__term|line-height': 'the tag line is --lh-compact for every tag (18 → 20.4px)',
  '.simlike__term|border': 'the edge is --pill-edge, which reads the ink the residual sets',
  '.simlike__term@(min-width: 740px)|padding': 'one tag size at every width: the desktop bump to 3px 10px is dropped',
  '.simlike__term@(min-width: 740px)|font-size': 'one tag size at every width: the desktop bump to 13px is dropped',
  '.leaguerank__chip|font-weight': 'the display face ships one weight; a weight is a no-op',
  '.awards__chip|align-items': 'one line of one size: baseline and centre draw the same',
  '.awards__chip|font-weight': 'the display face ships one weight; a weight is a no-op',
  '.cthist__fuzzy|font-weight': 'the display face ships one weight; a weight is a no-op',
  '.tlead__row .prospectpill|font-size': 'it restated --fs-label, which is the pill tag size already',
}

// Slice 2: the paper tags and the tints. Every host keeps its old class, so a
// residual is the same selector re-read in the working tree.
const own = (file, sel, extra = {}) => ({ old: sel, file, residual: [file, sel], ...extra })
const PAIRS_2 = [
  { old: '.wiredock__count', file: '04a-wire-dock.css', residual: ['04a-wire-dock.css', '.pill.wiredock__count'], mods: ['.pill--paper'] },
  own('12-sealbox.css', '.wcall__pill'),
  own('12-sealbox.css', '.wcall__pill--wrong'),
  own('12-sealbox.css', '.wcall__pill--right'),
  own('12-sealbox.css', '.favormeter__tierpill'),
  own('12-sealbox.css', '.favormeter__tierpill--routine'),
  own('12-sealbox.css', '.favormeter__tierpill--standout'),
  own('12-sealbox.css', '.favormeter__tierpill--outlier'),
  own('20-charts.css', '.winprob__ledger-chip', { mods: ['.pill--ink'] }),
  { old: '.flipback__pill', file: '22-box-score-tables.css' },
  { old: '.flipback__pill--tag', file: '22-box-score-tables.css' },
  own('22-box-score-tables.css', '.flipback__pill--crown', { mods: ['.pill--ink'] }),
  own('22-box-score-tables.css', '.flipback__pill--scenario', { mods: ['.pill--ink'] }),
  own('23-box-score-detail.css', '.tlead__level', { mods: ['.pill--paper'] }),
  { old: '.moundcard__avail', file: '26c-mound-card.css' },
  own('26c-mound-card.css', '.moundcard__avail--fresh'),
  own('26c-mound-card.css', '.moundcard__avail--limited'),
  own('26c-mound-card.css', '.moundcard__avail--down'),
  own('28a-team-hub-hero.css', '.team-hub__level'),
  own('31-wild-card.css', '.cbk__badge'),
  own('31-wild-card.css', '.thub-affiliate__level', { mods: ['.pill--paper'] }),
  own('31-wild-card.css', '.prospecttable__top'),
  own('43-foul-tracker.css', '.scorebug__result'),
  own('43-foul-tracker.css', '.scorebug__result.is-positive'),
  own('43-foul-tracker.css', '.scorebug__result.is-negative'),
  own('72-player-hover-card.css', '.phcard__tag', { mods: ['.pill--paper'] }),
  { old: '.phcard__tag--level', file: '72-player-hover-card.css', mods: ['.pill--paper'] },
  own('72-player-hover-card.css', '.phcard__tag--rehab'),
  own('74-contract-workbench.css', '.cwb__chip', { mods: ['.pill--paper'] }),
  own('74-contract-workbench.css', '.cwb__chip--none'),
  own('74-contract-workbench.css', '.cwb__chip--share'),
]
const DROPPED_2 = {}

const PAIRS = SLICE === '1' ? PAIRS_1 : PAIRS_2
const DROPPED = SLICE === '1' ? DROPPED_1 : DROPPED_2

let lost = 0
let dropped = 0
for (const p of PAIRS) {
  const before = props(atBase(p.file), p.old, p.media ?? null)
  const tag = p.media ? `${p.old}@${p.media}` : p.old
  if (!before) { console.log(`${tag}: NOT FOUND at ${BASE}`); lost += 1; continue }
  const residual = p.residual ? props(now(p.residual[0]), p.residual[1]) : []
  if (p.residual && residual === null) { console.log(`${tag}: residual ${p.residual[1]} NOT FOUND`); lost += 1; continue }
  // A context rule, an element, or a media copy restates the base on purpose,
  // so the pill's base cannot be what covers it: only a residual can.
  const isContext = p.old.includes(' ') || /__(short|full|logo)$/.test(p.old) || p.media
  const covered = expand([...(isContext ? [] : pill(p.mods)), ...residual])
  const lostHere = []
  const droppedHere = []
  for (const d of before) {
    if (covered.has(d)) continue
    if (d === 'font-weight') { droppedHere.push(`${d} (one weight)`); continue }
    const why = DROPPED[`${tag}|${d}`]
    if (why) droppedHere.push(`${d} — ${why}`)
    else lostHere.push(d)
  }
  lost += lostHere.length
  dropped += droppedHere.length
  console.log(`\n${tag}  (${p.file})`)
  console.log(`  before  : ${before.join(', ')}`)
  console.log(`  residual: ${p.residual ? `${p.residual[1]} → ${residual.join(', ') || '(empty)'}` : '(none — absorbed)'}`)
  if (droppedHere.length) console.log(`  dropped : ${droppedHere.join('; ')}`)
  console.log(`  ${lostHere.length ? '*** LOST: ' + lostHere.join(', ') : 'all covered'}`)
}
console.log(`\n${lost === 0 ? 'No declaration lost.' : `${lost} declaration(s) LOST.`} ${dropped} dropped on purpose, each listed above.`)
process.exitCode = lost ? 1 : 0
