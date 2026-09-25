// The keyboard focus ring on a coloured band (#1215), asserted from the
// stylesheet text and the club colour stores.
//
// A control's stock ring is --focus-ring (--field green), drawn 2px off the
// control. On paper it passes. On a band it sits on the band's colour, not on
// paper: 1.04:1 on the Cardinals' bar, 2.41:1 on the house navy. WCAG AA asks
// 3:1 for a focus indicator, so on a band a keyboard user could not see which
// control had focus.
//
// THE BAND RING. A paper ring (--focus-ring-band) with an ink halo around it
// (--ring-band, a box-shadow). Paper and ink are 13:1 apart, so on ANY colour
// one of the two is at 3:1 or more. The ring does not depend on the club.
// It is on the band controls only; the paper-page ring does not change.
//
// Four more things this file holds:
//   - a control that is focused AND pressed (:active) shows both: the press
//     inset and the halo, in one box-shadow;
//   - every club bar and hero tile the app can draw is at 3:1 against one of
//     the two ring colours;
//   - the records page's chips, tiles and back link draw a ring at all (their
//     rule named a colour with no style, so the outline style was none);
//   - check-focus-ring.mjs fails on that fault now.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ratio } from '../src/lib/design/contrastPairings.js'
import {
  ALL_MLB_TEAM_IDS,
  MLB_TREATMENT_KEYS,
  TREATMENT_HEADER_COLOR_OVERRIDES,
  treatmentTile,
} from '../src/lib/teams.js'
import { MILB_HEADER_COLOR_OVERRIDES } from '../src/lib/milbColors.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const STYLES = join(ROOT, 'src', 'styles')
const TOKENS = join(ROOT, 'src', 'tokens')
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const read = (rel) => stripComments(readFileSync(join(STYLES, rel), 'utf8'))

// Every `selectors { body }` in a sheet, innermost only, so a rule inside
// @media is found too.
const rules = (css) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selectors: m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' ')),
    body: m[2],
  }))

const decl = (body, property) =>
  body
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${property}:`))
    ?.slice(property.length + 1)
    .trim()

const rulesFor = (rel, selector) => rules(read(rel)).filter((r) => r.selectors.includes(selector))

// Every custom property under src/tokens/, resolved through var() chains to a
// hex, the way scripts/check-contrast.mjs reads them.
const tokens = new Map()
for (const file of readdirSync(TOKENS).filter((f) => f.endsWith('.css'))) {
  const css = stripComments(readFileSync(join(TOKENS, file), 'utf8'))
  for (const m of css.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    if (!tokens.has(m[1])) tokens.set(m[1], m[2].trim())
  }
}
const token = (name) => tokens.get(name)
const hex = (ref) => {
  if (ref.startsWith('#')) return ref
  const name = ref.match(/^var\(--([\w-]+)\)$/)?.[1] ?? ref
  assert.ok(tokens.has(name), `--${name} is a token`)
  return hex(tokens.get(name))
}

// ---- 1. the band ring rules ----

// Each control that rides a coloured band, as its focus rule is written.
// Pill controls: the card band's Postseason Odds / Stamp In, and the masthead
// toggles (Bullpen, "vs pitcher", MLB only, AAA log) on a section masthead
// (always a bar: navy or the club's) or on a themed player page's section bar.
// Button: Game Notes, on a themed lineup page's club-name bar and on the team
// hub's hero, which wears the club's tile colour.
const BAND_CONTROLS = [
  ['09-team-info.css', '.team-hub.is-themed .psodds-pill'],
  ['10-lineup.css', '.metricbar .mastheadpill'],
  ['10-lineup.css', '.player.is-themed .section__title--bar .mastheadpill'],
  ['11-innings.css', '.teaminfo.is-themed > .teaminfo__head .innings__notes'],
  ['11-innings.css', '.team-hub__id .innings__notes'],
]

test('the band ring tokens: a paper ring, and an ink halo outside it', () => {
  assert.equal(token('focus-ring-band'), 'var(--text-on-ink)')
  assert.equal(token('focus-ring-band-halo'), 'var(--accent-primary)')
  // The outline is --bw-heavy wide, --bw-heavy off the control, so it ends
  // 2 x --bw-heavy out. The halo reaches 3 x: one --bw-heavy of ink outside
  // the paper ring, and it fills the gap inside it too.
  assert.equal(token('ring-band'), '0 0 0 calc(var(--bw-heavy) * 3) var(--focus-ring-band-halo)')
})

for (const [rel, host] of BAND_CONTROLS) {
  test(`${host}: focused on a band, the ring is paper with an ink halo`, () => {
    const found = rulesFor(rel, `${host}:focus-visible`)
    assert.equal(found.length, 1, `one ${host}:focus-visible rule in ${rel}`)
    const { body } = found[0]
    // `outline: <colour>` alone sets the style to none: no ring draws. The
    // system rule draws the width, style and offset; the band sets the colour.
    assert.equal(decl(body, 'outline'), undefined, 'set outline-color, not the outline shorthand')
    assert.equal(decl(body, 'outline-color'), 'var(--focus-ring-band)')
    assert.equal(decl(body, 'box-shadow'), 'var(--ring-band)')
    assert.doesNotMatch(body, /--bar-|--seal|--marker|--tint/, 'no club colour, seal or marker on the ring (ADR-0030, ADR-0083)')
  })

  test(`${host}: focused AND pressed, it shows the press inset and the halo`, () => {
    // The control's :active rule draws its press as an inset box-shadow. A
    // focus rule that sets box-shadow alone would erase it (or the :active
    // rule would erase the halo). One box-shadow carries both.
    const found = rulesFor(rel, `${host}:focus-visible:active`)
    assert.equal(found.length, 1, `one ${host}:focus-visible:active rule in ${rel}`)
    assert.equal(decl(found[0].body, 'box-shadow'), 'var(--inset-cell), var(--ring-band)')
  })
}

test('the paper-page ring does not change: 2px --focus-ring on the Pill and the Button', () => {
  for (const [rel, selector] of [
    ['system/pill.css', '.pill--control:focus-visible'],
    ['system/button.css', '.btn:focus-visible'],
  ]) {
    const found = rulesFor(rel, selector)
    assert.equal(found.length, 1, selector)
    assert.equal(decl(found[0].body, 'outline'), 'var(--bw-heavy) solid var(--focus-ring)')
    assert.equal(decl(found[0].body, 'outline-offset'), 'var(--bw-heavy)')
  }
})

// ---- 2. every bar and tile the ring can sit on ----

// Each colour a band control can sit on: every landed header bar (MLB Main and
// City Connect, every MiLB affiliate), the house navy an unthemed masthead
// wears, and every hero tile an MLB club can wear (a flat tint, or a
// pinstripe's white or coloured ground).
function bandGrounds() {
  const grounds = [{ where: 'house navy masthead', colour: hex('navy') }]
  for (const [label, table] of [
    ['MLB bar', TREATMENT_HEADER_COLOR_OVERRIDES],
    ['MiLB bar', MILB_HEADER_COLOR_OVERRIDES],
  ]) {
    for (const [teamId, slots] of Object.entries(table)) {
      for (const [slot, header] of Object.entries(slots ?? {})) {
        if (header?.bar) grounds.push({ where: `${label} ${teamId} ${slot}`, colour: header.bar })
      }
    }
  }
  for (const teamId of ALL_MLB_TEAM_IDS) {
    for (const treatment of MLB_TREATMENT_KEYS) {
      const tile = treatmentTile(teamId, treatment)
      if (tile.tint) grounds.push({ where: `hero tile ${teamId} ${treatment}`, colour: tile.tint })
      if (tile.pinstripeColor) {
        grounds.push({ where: `hero pinstripe ground ${teamId} ${treatment}`, colour: tile.pinstripeBg ?? '#FFFFFF' })
      }
    }
  }
  return grounds
}

test('on every club bar and hero tile, one ring colour reaches 3:1', () => {
  const ring = hex('focus-ring-band')
  const halo = hex('focus-ring-band-halo')
  const grounds = bandGrounds()
  // Not a vacuous pass: the stores hold well over a hundred bars, and the four
  // clubs the issue measured are among them.
  assert.ok(grounds.length > 150, `found ${grounds.length} grounds`)
  for (const id of ['138', '110', '158', '147']) {
    assert.ok(TREATMENT_HEADER_COLOR_OVERRIDES[id]?.main?.bar, `club ${id} has a Main bar`)
  }
  const misses = grounds
    .map((g) => ({ ...g, best: Math.max(ratio(ring, g.colour), ratio(halo, g.colour)) }))
    .filter((g) => g.best < 3)
    .map((g) => `${g.where} ${g.colour}: ${g.best.toFixed(2)}:1`)
  assert.deepEqual(misses, [], 'every ground has a ring colour at 3:1 or more')
})

test('the stock green ring fails on these bars, so the test can fail', () => {
  const green = hex('focus-ring')
  const cardinals = TREATMENT_HEADER_COLOR_OVERRIDES['138'].main.bar
  assert.ok(ratio(green, cardinals) < 3, 'green on the Cardinals bar is under 3:1')
  assert.ok(ratio(green, hex('navy')) < 3, 'green on the house navy is under 3:1')
})

test('paper and ink are far enough apart that one of them passes on ANY colour', () => {
  // For a ground of luminance L, the better of the two ratios is lowest where
  // they are equal, and there each is sqrt(paper : ink). At 9:1 that floor is
  // 3:1, so the ring holds on a club colour nobody has landed yet.
  const apart = ratio(hex('focus-ring-band'), hex('focus-ring-band-halo'))
  assert.ok(apart >= 9, `paper to ink is ${apart.toFixed(2)}:1`)
})

// ---- 3. the records page draws a ring ----

test('the records chips, tiles and back link draw a real outline', () => {
  const sheet = rules(read('66-situational-records.css'))
  for (const selector of ['.trrank__chip:focus-visible', '.trrank__tile:focus-visible', '.trrank__back:focus-visible']) {
    const found = sheet.filter((r) => r.selectors.includes(selector))
    assert.ok(found.length > 0, `${selector} has a rule`)
    const outline = found.map(({ body }) => decl(body, 'outline')).find(Boolean)
    assert.match(outline ?? '', /\bsolid\b/, `${selector}: an outline with a style, or no ring draws`)
    assert.match(outline, /var\(--focus-ring\)/, `${selector}: the shared ring colour`)
  }
})

// ---- 4. the guard catches a colour with no style ----

// check-focus-ring.mjs reads src/styles from its working directory, so each
// case writes one sheet into a temp tree and runs the script there.
const GUARD = join(ROOT, 'scripts', 'check-focus-ring.mjs')
function runGuard(css) {
  const dir = mkdtempSync(join(tmpdir(), 'focus-ring-'))
  try {
    mkdirSync(join(dir, 'src', 'styles'), { recursive: true })
    writeFileSync(join(dir, 'src', 'styles', 'case.css'), css)
    return spawnSync(process.execPath, [GUARD], { cwd: dir, encoding: 'utf8' })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('check-focus-ring fails on an outline with a colour and no style', () => {
  const result = runGuard('.x:focus-visible {\n  outline: var(--focus-ring);\n  outline-offset: 2px;\n}\n')
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.match(result.stderr, /case\.css:2/, 'names the line')
  assert.match(result.stderr, /no style/i, 'says why')
})

test('check-focus-ring passes the stock ring and the band ring', () => {
  const result = runGuard(
    [
      '.a:focus-visible { outline: var(--bw-heavy) solid var(--focus-ring); outline-offset: var(--bw-heavy); }',
      '.b:focus-visible { outline: none; }',
      '.c:focus-visible { box-shadow: var(--ring); }',
      '.d .e:focus-visible { outline-color: var(--focus-ring-band); box-shadow: var(--ring-band); }',
      '.d .e:focus-visible:active { box-shadow: var(--inset-cell), var(--ring-band); }',
    ].join('\n'),
  )
  assert.equal(result.status, 0, result.stdout + result.stderr)
})

test('check-focus-ring still fails a hand-rolled ring', () => {
  for (const css of [
    '.x:focus-visible { outline: 2px solid var(--accent-primary); }',
    '.x:focus-visible { box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.3); }',
    // The press inset alone is not a focus ring.
    '.x:focus-visible { box-shadow: var(--inset-cell); }',
  ]) {
    assert.equal(runGuard(css).status, 1, css)
  }
})
