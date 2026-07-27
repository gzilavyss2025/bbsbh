import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { headerThemeFor, headerThemeStyle, headerThemeClass } from '../src/lib/headerTheme.js'
import { contrastRatio } from '../src/lib/contrast.js'
import MLB_TREATMENT_TUNING from '../src/lib/data/mlb-treatment-tuning.json' with { type: 'json' }
import MILB_TREATMENT_TUNING from '../src/lib/data/milb-treatment-tuning.json' with { type: 'json' }

// The (teamId, treatment) -> header chrome resolver behind the lineup page's
// theming (ADR-0030). Two things are worth pinning: that it reads the right
// table for an id from either vocabulary, and — the part that matters for the
// spoiler rule — that its answer depends on NOTHING but those two arguments.

test('an MLB club with a landed triad resolves its own bar, accent, and ink', () => {
  // Brewers City Connect — a landed entry with all three fields.
  assert.deepEqual(headerThemeFor(158, 'city-connect'), {
    bar: '#0C436A',
    accent: '#ff6c58',
    onBar: '#FBF6E9',
    onBarTone: 'light',
  })
})

test('a MiLB affiliate resolves through the Home/Away table, not the MLB one', () => {
  // 234 Durham Bulls, away — keyed by game SIDE rather than a treatment name.
  const theme = headerThemeFor(234, 'away')
  assert.equal(theme.bar, '#0054A4')
  assert.equal(theme.accent, '#B15C12')
  // The MLB vocabulary must not resolve for a MiLB id, and vice versa.
  assert.equal(headerThemeFor(234, 'city-connect'), null)
  assert.equal(headerThemeFor(158, 'away'), null)
})

test('an uncovered (club, treatment) answers null so the caller keeps default chrome', () => {
  // 147 Yankees have no header entry at all — coverage is partial by design.
  assert.equal(headerThemeFor(147, 'main'), null)
  assert.equal(headerThemeFor(158, 'alternate-4'), null)
  assert.equal(headerThemeFor(null, 'main'), null)
  assert.equal(headerThemeFor(158, null), null)
  assert.equal(headerThemeFor(999999, 'main'), null)
})

test('onBarTone flags a dark ink so a themed masthead can re-ink its mono mark', () => {
  // Braves Alternate 3 — a pale grey bar carrying their navy.
  assert.equal(headerThemeFor(144, 'alternate-3').onBarTone, 'dark')
  // Braves City Connect — same club, also retuned to navy ink on a light bar.
  assert.equal(headerThemeFor(144, 'city-connect').onBarTone, 'dark')
  // Guardians Alternate 2 — white ink on their red.
  assert.equal(headerThemeFor(114, 'alternate-2').onBarTone, 'light')
})

test('headerThemeStyle/headerThemeClass are inert without a theme', () => {
  assert.equal(headerThemeStyle(null), undefined)
  assert.equal(headerThemeClass(null), '')
  const theme = headerThemeFor(158, 'city-connect')
  assert.deepEqual(headerThemeStyle(theme), {
    '--bar-fill': '#0C436A',
    '--bar-accent': '#ff6c58',
    '--bar-text': '#FBF6E9',
  })
  assert.equal(headerThemeClass(theme), 'is-themed')
  assert.equal(headerThemeClass(headerThemeFor(144, 'alternate-3')), 'is-themed is-themed--dark')
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
  assert.equal(checked, 67, 'expected the 67 landed triads — update this count deliberately')
})
