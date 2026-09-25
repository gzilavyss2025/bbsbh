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
//   SLICE=3 node pill-audit.mjs    (slice 3 on: `git merge-base HEAD origin/main` vs the working tree)
//   BASE=<rev> SLICE=N node pill-audit.mjs   (a BASE env always wins)
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const SLICE = process.env.SLICE || '1'
const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 })
const FIXED_BASE = { 1: 'ef2eb7ba7', 2: '0aaa46737' }
const BASE = process.env.BASE || FIXED_BASE[SLICE] || sh('git merge-base HEAD origin/main').trim()
const atBase = (f) => { try { return sh(`git show ${BASE}:src/styles/${f}`) } catch { return '' } }
const now = (f) => { try { return readFileSync(join(ROOT, 'src/styles', f), 'utf8') } catch { return '' } }

// Properties of the rule written exactly as `sel`, top level only unless
// `media` names the at-rule params it sits in.
function props(css, sel, media = null, nth = 0) {
  if (!css) return null
  let found = null
  let seen = 0
  postcss.parse(css).walkRules((r) => {
    if (found) return
    const inMedia = r.parent?.type === 'atrule' ? r.parent.params : null
    if (inMedia !== media) return
    if (r.selectors.map((s) => s.trim()).includes(sel)) {
      if (seen++ < nth) return
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
  // The Button's skin is custom properties too (system/button.css).
  '--btn-fill': ['background', 'background-color'],
  '--btn-edge': ['border-color'],
  '--btn-ink': ['color'],
}
const expand = (list) => new Set(list.flatMap((p) => [p, ...(COVERS[p] || [])]))

const pillCss = now('system/pill.css')
const pill = (mods = []) => [
  ...(props(pillCss, '.pill') || []),
  ...mods.flatMap((m) => props(pillCss, m) || []),
  // The component writes --pill-ink inline when a consumer passes `ink`.
  '--pill-ink',
]

// A row that became a BUTTON, not a pill (slice 4 on), sets `button: true`:
// its cover is .btn plus the size modifier it wears (.btn--control), read from
// system/button.css, instead of the pill's rules.
const btnCss = now('system/button.css')
const btn = (mods = []) => [
  ...(props(btnCss, '.btn') || []),
  ...(props(btnCss, '.btn--control') || []),
  ...mods.flatMap((m) => props(btnCss, m) || []),
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
  // The slice 2 review fixes (84f56628b) deleted the residual .wcall__pill
  // rule, a no-op face rule: the base rule is absorbed into .pill now.
  { old: '.wcall__pill', file: '12-sealbox.css' },
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

// One slot per slice, each on its own line, so parallel slices never edit the
// same line. A slice fills only its own PAIRS_N and DROPPED_N.
// ---- slice 3 ----
const PAIRS_3 = []
const DROPPED_3 = {}
// ---- slice 4 ----
// Slice 4: the controls. A Pill row covers with .pill + .pill--control (+ the
// selected, pressed or focus rule it replaced); a Button row sets `button`.
const CTL = '.pill--control'
const SEL = ".pill--control[aria-pressed='true']"
const FOCUS = '.pill--control:focus-visible'
const BSEL = ".btn[aria-pressed='true']"
const BFOCUS = '.btn:focus-visible'
const BOFF = ".btn[aria-disabled='true']"
const PAIRS_4 = [
  { old: '.mastheadpill', file: '10-lineup.css', mods: [CTL] },
  { old: ".mastheadpill[aria-pressed='true']", file: '10-lineup.css', mods: [SEL] },
  own('22-box-score-tables.css', '.slate-filterbar__chip', { mods: [CTL] }),
  { old: '.slate-filterbar__chip--active', file: '22-box-score-tables.css', mods: [SEL] },
  { old: '.slate-filterbar__chip:active', file: '22-box-score-tables.css', mods: ['.pill--control:active'] },
  { old: '.slate-filterbar__chip:focus-visible', file: '22-box-score-tables.css', mods: [FOCUS] },
  own('26d-command-map.css', '.cmdmap__chip', { mods: [CTL] }),
  { old: '.cmdmap__chip--sm', file: '26d-command-map.css', mods: [CTL] },
  { old: '.cmdmap__chip--on', file: '26d-command-map.css', mods: [SEL] },
  own('26d-command-map.css', '.cmdmap__chip--thin'),
  { old: '.cmdmap__chip--on .cmdmap__chipn', file: '26d-command-map.css', residual: ['26d-command-map.css', ".cmdmap__chip[aria-pressed='true'] .cmdmap__chipn"] },
  { old: '.depthpos', file: '31-wild-card.css', mods: [CTL, '.pill--figure'] },
  { old: '.depthpos.is-active', file: '31-wild-card.css', mods: [SEL] },
  { old: '.scorebookstory__filters button', file: '42-first-scorebook.css', whole: true, mods: [CTL] },
  { old: '.scorebookstory__filters button.is-active', file: '42-first-scorebook.css', whole: true, mods: [SEL] },
  { old: '.logbookstats__levels button', file: '48a-logbook-stats.css', whole: true, mods: [CTL, '.pill--figure'], residual: ['48a-logbook-stats.css', '.logbookstats__levels .pill'] },
  { old: '.logbookstats__levels button.is-active', file: '48a-logbook-stats.css', whole: true, mods: [SEL] },
  { old: '.stampsheet__levels button', file: '48c-stamp-sheet.css', whole: true, mods: [CTL, '.pill--figure'], residual: ['48c-stamp-sheet.css', '.stampsheet__levels .pill'] },
  { old: '.stampsheet__levels button.is-active', file: '48c-stamp-sheet.css', whole: true, mods: [SEL] },
  { old: '.trrank__related a', file: 'situational-records/66a-detail.css', whole: true, mods: [CTL], residual: ['situational-records/66a-detail.css', '.trrank__related a'] },
  { old: '.trrank__related a.is-active', file: 'situational-records/66a-detail.css', whole: true, mods: [".pill--control[aria-current='page']"] },
  { old: '.trrank__related a:hover', file: 'situational-records/66a-detail.css', media: '(hover: hover) and (pointer: fine)' },
  { old: '.trrank__related a:focus-visible', file: '66-situational-records.css', whole: true, mods: [FOCUS] },
  // ---- the rows that became Buttons ----
  { old: '.animlab__play', file: '46-consent-modal.css', button: true, residual: ['46-consent-modal.css', '.animlab__play'] },
  { old: '.animlab__play:hover', file: '46-consent-modal.css', button: true },
  { old: '.logbookstats__watch', file: '48a-logbook-stats.css', button: true, residual: ['48a-logbook-stats.css', '.logbookstats__watch'] },
  { old: '.coverpick__favorite', file: '60-book-cover-picker.css', button: true, residual: ['60-book-cover-picker.css', '.coverpick__favorite'] },
  { old: '.coverpick__favorite.is-active', file: '60-book-cover-picker.css', button: true, mods: [BSEL] },
  { old: '.coverpick__favorite:focus-visible', file: '60-book-cover-picker.css', button: true, mods: [BFOCUS] },
  { old: '.idadmin__actions .idadmin__btn', file: '62-identity-admin.css', button: true },
  { old: '.idadmin__actions .idadmin__btn', nth: 1, file: '62-identity-admin.css', button: true },
  { old: '.idadmin__actions .idadmin__btn--save', file: '62-identity-admin.css', button: true },
  { old: '.idadmin__actions .idadmin__btn:disabled', file: '62-identity-admin.css', button: true, mods: [BOFF] },
  { old: '.idadmin__actions .idadmin__btn:focus-visible', file: '62-identity-admin.css', button: true, mods: [BFOCUS] },
  { old: '.iddrawer__btn', file: '62-identity-admin.css', button: true },
  { old: '.iddrawer__btn:disabled', file: '62-identity-admin.css', button: true, mods: [BOFF] },
  { old: '.iddrawer__btn:focus-visible', file: '62-identity-admin.css', button: true, mods: [BFOCUS] },
  { old: '.lookupdeck__usebtn', file: '74a-contract-lookup.css', button: true },
  { old: '.lookupdeck__usebtn:disabled', file: '74a-contract-lookup.css', button: true, mods: [BOFF] },
  { old: '.lookupdeck__usebtn:focus-visible', file: '74a-contract-lookup.css', button: true, mods: [BFOCUS] },
  { old: '.dlab__jumplink', file: 'designlab/lab.css', button: true },
  { old: '.dlab__jumplink:focus-visible', file: 'designlab/lab.css', button: true, mods: [BFOCUS] },
  { old: '.trailstrip__followbtn', file: 'focus/reference.css', button: true },
  { old: '.trailstrip__followbtn', nth: 1, file: 'focus/reference.css', button: true, residual: ['focus/reference.css', '.trailstrip__followbtn'] },
  { old: '.trailstrip__followbtn:hover', file: 'focus/reference.css', button: true },
  { old: '.trailstrip__followbtn:focus-visible', file: 'focus/reference.css', button: true, mods: [BFOCUS] },
  { old: ".trailstrip__followbtn[aria-disabled='true']", file: 'focus/reference.css', button: true, mods: [BOFF], residual: ['focus/reference.css', ".trailstrip__followbtn[aria-disabled='true']"] },
]
const RING = "the focus ring is the control's 2px outline (#1166 point 2), not box-shadow --ring"
const HOVER = "the control's own hover, inside (hover: hover): the fill and edge a step darker"
const DROPPED_4 = {
  '.slate-filterbar__chip:focus-visible|box-shadow': RING,
  '.cmdmap__chip--sm|padding': 'a second, smaller size: a control has one height (--control-min)',
  '.trrank__related a:hover@(hover: hover) and (pointer: fine)|border-color': HOVER,
  '.animlab__play:hover|border-color': HOVER,
  '.animlab__play:hover|color': HOVER + '; the ink does not change',
  '.coverpick__favorite.is-active|box-shadow': 'paper does not float (#1166 point 3); selected is navy with a tick',
  '.idadmin__actions .idadmin__btn|font': "a reset to the hero's type: the Button sets its own face",
  '.idadmin__actions .idadmin__btn--save|background': "Save was the hero's ink as a fill (a club colour on a control, ADR-0030); it is an outline Button now",
  '.idadmin__actions .idadmin__btn--save|-webkit-text-fill-color': 'the same inversion; the outline Button draws its own ink',
  '.idadmin__actions .idadmin__btn:focus-visible|box-shadow': RING,
  '.iddrawer__btn:focus-visible|box-shadow': RING,
  '.lookupdeck__usebtn:disabled|cursor': "the Button's disabled cursor (default), not not-allowed",
  '.trailstrip__followbtn|min-width': "a reset for the rail's tabs; the Button needs none",
  '.trailstrip__followbtn#1|box-shadow': 'paper does not float (#1166 point 3)',
  '.trailstrip__followbtn:hover|background': HOVER,
  '.trailstrip__followbtn:focus-visible|box-shadow': RING,
}
// ---- slice 5 ----
const PAIRS_5 = []
const DROPPED_5 = {}
// ---- end of slots ----
const PAIRS_BY_SLICE = { 1: PAIRS_1, 2: PAIRS_2, 3: PAIRS_3, 4: PAIRS_4, 5: PAIRS_5 }
const DROPPED_BY_SLICE = { 1: DROPPED_1, 2: DROPPED_2, 3: DROPPED_3, 4: DROPPED_4, 5: DROPPED_5 }
const PAIRS = PAIRS_BY_SLICE[SLICE]
const DROPPED = DROPPED_BY_SLICE[SLICE]
if (!PAIRS) throw new Error(`pill-audit.mjs: no pair slot for SLICE=${SLICE}`)
console.log(`Slice ${SLICE}, base ${BASE}`)

let lost = 0
let dropped = 0
for (const p of PAIRS) {
  const before = props(atBase(p.file), p.old, p.media ?? null, p.nth ?? 0)
  const tag = `${p.media ? `${p.old}@${p.media}` : p.old}${p.nth ? `#${p.nth}` : ''}`
  if (!before) { console.log(`${tag}: NOT FOUND at ${BASE}`); lost += 1; continue }
  const residual = p.residual ? props(now(p.residual[0]), p.residual[1]) : []
  if (p.residual && residual === null) { console.log(`${tag}: residual ${p.residual[1]} NOT FOUND`); lost += 1; continue }
  // A context rule, an element, or a media copy restates the base on purpose,
  // so the pill's base cannot be what covers it: only a residual can.
  // `whole: true` marks a context selector that WAS the control's base rule
  // (`.trrank__related a`): the pill it became covers it (slice 4).
  const isContext = !p.whole && (p.old.includes(' ') || /__(short|full|logo)$/.test(p.old) || p.media)
  const covered = expand([...(p.button ? btn(p.mods) : isContext ? [] : pill(p.mods)), ...residual])
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
