import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { headerThemeFor, headerThemeStyle, headerThemeClass } from '../src/lib/headerTheme.js'
import { milbHeaderColorOverride, MILB_HEADER_COLOR_OVERRIDES } from '../src/lib/milbColors.js'
import { contrastRatio } from '../src/lib/contrast.js'
import MLB_TREATMENT_TUNING from '../src/lib/data/mlb-treatment-tuning.json' with { type: 'json' }
import MILB_TREATMENT_TUNING from '../src/lib/data/milb-treatment-tuning.json' with { type: 'json' }

// The (teamId, treatment) -> header chrome resolver behind the lineup page's
// theming (ADR-0030). Two things are worth pinning: that it reads the right
// table for an id from either vocabulary, and — the part that matters for the
// spoiler rule — that its answer depends on NOTHING but those two arguments.

const HEX_RE = /^#[0-9a-fA-F]{6}$/ // caps-js-exempt

test('an MLB club with a landed triad resolves its own bar, accent, and ink', () => {
  // Brewers City Connect — a landed entry with all three fields.
  const theme = headerThemeFor(158, 'city-connect')
  assert.match(theme.bar, HEX_RE)
  assert.match(theme.accent, HEX_RE)
  assert.match(theme.onBar, HEX_RE)
  assert.ok(theme.onBarTone === 'light' || theme.onBarTone === 'dark')
})

test('a MiLB affiliate resolves through the Home/Away table, not the MLB one', () => {
  // 234 Durham Bulls, away — keyed by game SIDE rather than a treatment name.
  const theme = headerThemeFor(234, 'away')
  assert.match(theme.bar, HEX_RE)
  assert.match(theme.accent, HEX_RE)
  // The MLB vocabulary must not resolve for a MiLB id, and vice versa.
  assert.equal(headerThemeFor(234, 'city-connect'), null)
  assert.equal(headerThemeFor(158, 'away'), null)
})

test("a MiLB club's Home and Away share the exact same bar", () => {
  // 234 Durham Bulls — landed under the 'home' slot (milbHeaderColorOverride,
  // src/lib/milbColors.js); Away must resolve to the identical triad rather
  // than owning a second bar of its own.
  assert.deepEqual(headerThemeFor(234, 'home'), headerThemeFor(234, 'away'))
})

test('milbHeaderColorOverride rejects anything but home/away', () => {
  assert.equal(milbHeaderColorOverride(999999, 'home'), null)
  assert.equal(milbHeaderColorOverride(234, 'sideways'), null)
})

test('milbHeaderColorOverride falls back to a legacy away-only entry', () => {
  // Every real club was migrated onto the 'home' slot (see
  // milb-treatment-tuning.json), so this scratches a fake away-only entry —
  // same toggle-the-shared-table trick wpa-logo.test.js uses for WPA_OWN_ART —
  // to exercise the fallback a hand-edited store could still land.
  const SCRATCH = 999999
  assert.equal(MILB_HEADER_COLOR_OVERRIDES[SCRATCH], undefined, 'fixture assumption: scratch id starts clean')
  MILB_HEADER_COLOR_OVERRIDES[SCRATCH] = { away: { bar: '#111111', accent: '#222222', onBar: '#FFFFFF' } }
  try {
    assert.deepEqual(milbHeaderColorOverride(SCRATCH, 'home'), MILB_HEADER_COLOR_OVERRIDES[SCRATCH].away)
    assert.deepEqual(milbHeaderColorOverride(SCRATCH, 'away'), MILB_HEADER_COLOR_OVERRIDES[SCRATCH].away)
  } finally {
    delete MILB_HEADER_COLOR_OVERRIDES[SCRATCH]
  }
})

test('an uncovered (club, treatment) answers null so the caller keeps default chrome', () => {
  // 112 Cubs have no City Connect look at all (their CC-era mark moved to
  // Alternate 2 instead, see teams.js's CITY_CONNECT_COLORS comment) — a
  // structural, not just not-yet-tuned, gap, so it's a stable example even as
  // every club's Main header gets landed one by one.
  assert.equal(headerThemeFor(112, 'city-connect'), null)
  assert.equal(headerThemeFor(null, 'main'), null)
  assert.equal(headerThemeFor(158, null), null)
  assert.equal(headerThemeFor(999999, 'main'), null)
})

test('every non-City-Connect treatment collapses onto the club Main header', () => {
  // Two bars per club, not one per treatment (src/lib/teams.js): 'alternate',
  // 'alternate-2', 'alternate-3'… all resolve identically to 'main', and only
  // 'city-connect' gets its own separate answer.
  const main = headerThemeFor(144, 'main')
  for (const treatment of ['alternate', 'alternate-2', 'alternate-3', 'alternate-4']) {
    assert.deepEqual(headerThemeFor(144, treatment), main)
  }
  assert.notDeepEqual(headerThemeFor(144, 'city-connect'), main)
})

test('onBarTone flags a dark ink so a themed masthead can re-ink its mono mark', () => {
  // Braves Main — cream ink, via the 'alternate-3' jersey collapsing onto it.
  assert.equal(headerThemeFor(144, 'alternate-3').onBarTone, 'light')
  // Braves City Connect — same club, its own navy-ink bar.
  assert.equal(headerThemeFor(144, 'city-connect').onBarTone, 'dark')
  // Guardians Main — cream ink, via the 'alternate-2' jersey collapsing onto it.
  assert.equal(headerThemeFor(114, 'alternate-2').onBarTone, 'light')
})

test('headerThemeStyle/headerThemeClass are inert without a theme', () => {
  assert.equal(headerThemeStyle(null), undefined)
  assert.equal(headerThemeClass(null), '')
  const theme = headerThemeFor(158, 'city-connect')
  assert.deepEqual(headerThemeStyle(theme), {
    '--bar-fill': theme.bar,
    '--bar-accent': theme.accent,
    '--bar-text': theme.onBar,
  })
  assert.equal(headerThemeClass(theme), 'is-themed')
  assert.equal(headerThemeClass(headerThemeFor(144, 'city-connect')), 'is-themed is-themed--dark')
})

// The spoiler invariant, asserted rather than merely written down: the resolver
// is a pure function of (teamId, treatment). Calling it repeatedly, in any
// order, always gives the same answer — there is no hidden input a game state
// could ever ride in on.
test('the resolver is pure in (teamId, treatment) — no third input exists', () => {
  const pairs = [[158, 'city-connect'], [234, 'away'], [147, 'main'], [144, 'alternate-3']]
  const first = pairs.map(([id, t]) => JSON.stringify(headerThemeFor(id, t)))
  for (let pass = 0; pass < 3; pass += 1) {
    // Reversed, so a stateful resolver would drift.
    const again = [...pairs].reverse().map(([id, t]) => JSON.stringify(headerThemeFor(id, t)))
    assert.deepEqual(again, [...first].reverse())
  }
  // And structurally: the module imports no feed, linescore, reveal, or
  // derivation module. This is the check that catches someone wiring one in.
  const source = readFileSync(new URL('../src/lib/headerTheme.js', import.meta.url), 'utf8')
  const imports = [...source.matchAll(/^import .*? from '([^']+)'/gm)].map((m) => m[1])
  assert.deepEqual(imports.sort(), ['./contrast.js', './milbColors.js', './teams.js'])
})

// Every landed triad is reachable through the resolver, and every one of them
// clears WCAG AA — the same assertion scripts/check-contrast.mjs makes at lint
// time, repeated here so a store edit fails the unit suite too rather than only
// the lint step someone might skip locally.
test('every landed triad resolves and clears WCAG AA for normal text', () => {
  let checked = 0
  for (const store of [MLB_TREATMENT_TUNING, MILB_TREATMENT_TUNING]) {
    for (const [teamId, entry] of Object.entries(store)) {
      for (const [treatment, record] of Object.entries(entry.treatments ?? {})) {
        if (!record.header) continue
        const theme = headerThemeFor(Number(teamId), treatment)
        assert.ok(theme, `${teamId} ${treatment} has a header record but resolved null`)
        assert.equal(theme.bar, record.header.bar)
        assert.ok(
          contrastRatio(theme.onBar, theme.bar) >= 4.5,
          `${teamId} ${treatment}: ${theme.onBar} on ${theme.bar} fails AA`,
        )
        checked += 1
      }
    }
  }
  // 67 before the Main/City-Connect collapse (this file's earlier tests):
  // dropping every alternate-treatment's own header entry in favor of the
  // club's shared Main bar took MLB from 56 down to 19, then further Identity
  // Lab sessions landed more Main/City-Connect pairs (58 MLB records today,
  // all 30 clubs' Main headers landed). MiLB's own Home/Away collapse
  // (milbHeaderColorOverride) folded every already-tuned club's header onto
  // the shared Home slot and dropped the redundant Away copy — this tuning
  // session landed a further batch of MiLB clubs, 32 MiLB records today, then
  // one more AAA tuning pass landed 2 more, 34 MiLB records today. This
  // session's milb-treatment-tuning.json edits landed 3 more, 37 MiLB
  // records today (95 total), then one more final tuning pass landed 1
  // more, 38 MiLB records today (96 total).
  assert.equal(checked, 96, 'expected the 96 landed triads — update this count deliberately')
})
