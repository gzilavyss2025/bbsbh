// usePrimer's gating and tab pick (ADR-0087, 2026-10-08 addendum), read through
// one server render, as callout-ledger.test.js reads its hook (test/CLAUDE.md).
import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { bracket2025 } from './fixtures.js'
import { usePrimer } from '../../src/hooks/postseason/usePrimer.js'

const ALCS_G5 = 813039
const NLCS_G4 = 813031
const DATE = '2025-10-17'
const slate = [ALCS_G5, NLCS_G4].map((gamePk, i) => ({ gamePk, gameDate: `2025-10-17T${i ? 23 : 22}:00:00Z`, away: {}, home: {}, venue: {} }))

function read(args) {
  const bracket = bracket2025(DATE)
  const Probe = () => {
    const p = usePrimer({ postseason: { bracket, cutoff: DATE }, slateDate: DATE, isToday: true, favoriteTeamId: 0, ...args })
    return createElement('i', null, JSON.stringify({ id: p.series?.id ?? null, tabs: p.list?.length ?? 0, game: p.game?.gamePk ?? null }))
  }
  return JSON.parse(renderToStaticMarkup(createElement(Probe)).replace(/<[^>]+>/g, '').replaceAll('&quot;', '"'))
}

test('two LCS games on the slate: both tabs, the earlier first pitch opens first', () => {
  const r = read({ enabled: true, games: slate })
  assert.equal(r.tabs, 2)
  assert.equal(r.game, ALCS_G5)
})

test('below the rail width, or with no slate yet, nothing is primed', () => {
  assert.equal(read({ enabled: false, games: slate }).id, null)
  assert.equal(read({ enabled: true, games: null }).id, null)
})
