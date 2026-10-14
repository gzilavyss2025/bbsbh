// The Advanced module's pure view (src/screens/player/next/modules/advanced/advancedView.js, #2012).
import test from 'node:test'
import assert from 'node:assert/strict'
import { advancedView } from '../src/screens/player/next/modules/advanced/advancedView.js'

const f = (label, value) => ({ label, value, note: `about ${label}` })
const hitFacts = [f('wOBA', '.358'), f('wRC+', '127'), f('K%', '25.1%'), f('BB%', '13.2%'), f('BB/K', '.53'), f('ISO', '.182'), f('BABIP', '.344'), f('P/PA', '4.25')]
const hitBundle = { season: { gamesPlayed: 151, plateAppearances: 680, strikeOuts: 4, baseOnBalls: 5 } }
const rates = { avg: 0.245, era: 4.1, k: 0.221, bb: 0.089, kbb: 0.132, bbk: 0.4, iso: 0.151, babip: 0.29, ppa: 3.9, ops: 0.72 }
const byKey = (v) => Object.fromEntries(v.tiles.map((t) => [t.key, t]))

test('batter: eight tiles in order, wRC+ leads, captions read against the league', () => {
  const v = advancedView({ role: 'hitting', facts: hitFacts, bundle: hitBundle, rates })
  assert.deepEqual(v.tiles.map((t) => t.key), ['wOBA', 'wRC+', 'K%', 'BB%', 'BB/K', 'ISO', 'BABIP', 'P/PA'])
  assert.equal(v.sample, '151 G · 680 PA')
  const t = byKey(v)
  assert.equal(t['wRC+'].lead, true)
  assert.equal(t['wRC+'].caption, '100 = MLB average')
  assert.equal(t['K%'].caption, 'MLB 22.1%')
  assert.equal(t['BB%'].caption, 'MLB 8.9%')
  assert.equal(t['BB/K'].caption, 'MLB .40')
  assert.equal(t.ISO.caption, 'MLB .151')
  assert.equal(t['P/PA'].caption, 'MLB 3.90')
  assert.equal(t.wOBA.caption, '')
  assert.equal(t.wOBA.note, 'about wOBA')
})

test('a null league field or no league row leaves only what is known, never a made-up rate', () => {
  const t = byKey(advancedView({ role: 'hitting', facts: hitFacts, bundle: hitBundle, rates: { ...rates, k: null } }))
  assert.equal(t['K%'].caption, '')
  assert.equal(t['BB%'].caption, 'MLB 8.9%')
  const none = byKey(advancedView({ role: 'hitting', facts: hitFacts, bundle: hitBundle, rates: null }))
  assert.equal(none['K%'].caption, '')
  assert.equal(none['wRC+'].caption, '100 = MLB average')
})

test('postseason: a dash is a hatched Not on file tile; K% and BB% caption the counts', () => {
  const post = [f('wOBA', '—'), f('wRC+', '—'), f('K%', '14.8%'), f('BB%', '18.5%'), f('BB/K', '1.25'), f('ISO', '.100'), f('BABIP', '.250'), f('P/PA', '4.10')]
  const v = advancedView({ role: 'hitting', facts: post, bundle: { season: { gamesPlayed: 6, plateAppearances: 27, strikeOuts: 4, baseOnBalls: 5 } }, rates, post: true })
  assert.equal(v.sample, '6 G · 27 PA')
  const t = byKey(v)
  assert.equal(t.wOBA.missing, true)
  assert.equal(t['wRC+'].missing, true)
  assert.equal(t['wRC+'].caption, '')
  assert.equal(t['K%'].caption, '4 of 27 PA')
  assert.equal(t['BB%'].caption, '5 of 27 PA')
  assert.equal(t['K%'].missing, false)
})

const pitFacts = [f('FIP', '4.23'), f('ERA−', '93'), f('K%', '22.2%'), f('BB%', '7.6%'), f('K−BB%', '14.7%'), f('Ground ball %', '34%'), f('Opp. AVG / OPS', '.229 / .702'), f('Quality starts', '6 of 20')]
const pitBundle = { season: { gamesPlayed: 21, gamesStarted: 20, inningsPitched: '109.1', era: '3.87' } }

test('pitcher: FIP shows ERA, ERA− leads, K−BB% reads against the league, QS last', () => {
  const v = advancedView({ role: 'pitching', facts: pitFacts, bundle: pitBundle, rates })
  assert.deepEqual(v.tiles.map((t) => t.key), ['FIP', 'ERA−', 'K%', 'BB%', 'K−BB%', 'Ground ball %', 'Opp. AVG / OPS', 'Quality starts'])
  assert.equal(v.sample, '21 G · 20 GS · 109.1 IP')
  const t = byKey(v)
  assert.equal(t.FIP.caption, 'ERA 3.87')
  assert.equal(t['ERA−'].lead, true)
  assert.equal(t['K−BB%'].caption, 'MLB 13.2%')
  assert.equal(t['Opp. AVG / OPS'].caption, 'MLB .245 / .720')
  assert.equal(t['Quality starts'].value, '6 of 20')
})

test('a reliever gets Inherited scored in the last place; tiles are found by label, not position', () => {
  const rp = [pitFacts[7] && f('Inherited scored', '3 of 14'), ...pitFacts.slice(0, 7)].filter(Boolean).reverse()
  const v = advancedView({ role: 'pitching', facts: rp, bundle: pitBundle, rates })
  assert.equal(v.tiles.at(-1).key, 'Inherited scored')
  assert.equal(v.tiles.length, 8)
})

test('no facts, or none that match the role, is null', () => {
  assert.equal(advancedView({ role: 'hitting', facts: null, bundle: hitBundle, rates }), null)
  assert.equal(advancedView({ role: 'hitting', facts: [], bundle: hitBundle, rates }), null)
  assert.equal(advancedView({ role: 'hitting', facts: pitFacts.slice(2, 3), bundle: hitBundle, rates }).tiles.length, 1)
  assert.equal(advancedView({ role: 'hitting', facts: [f('Mystery', '1')], bundle: hitBundle, rates }), null)
})

test('a missing sample count is left out of the sample line, never printed as 0', () => {
  const v = advancedView({ role: 'hitting', facts: hitFacts, bundle: { season: { gamesPlayed: 12 } }, rates })
  assert.equal(v.sample, '12 G')
  assert.equal(advancedView({ role: 'hitting', facts: hitFacts, bundle: null, rates }).sample, '')
})
