import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_AWARD_ORDER,
  awardLeague,
  awardsView,
  formatAwardOrder,
  knownRankKeys,
  parseAwardCap,
  parseAwardOrder,
  rankAwards,
  rankKeyOf,
} from '../src/api/person/awards.js'

// Rows shaped like GET /api/v1/people/{id}/awards. Every id, name, season and
// club below is copied from Mike Trout's real response (545361, read
// 2026-08-21) — the shapes that broke the old Trophy Case are all real ones.
const LAA = { id: 108, teamName: 'LA Angels' }
const KERNELS = { id: 492, teamName: 'Cedar Rapids' }
const QUAKES = { id: 526, teamName: 'Rancho Cuca.' }

const award = (id, name, season, date, team = LAA) => ({ id, name, season, date, team })

const TROUT = [
  award('ALMVP', 'AL MVP', '2014', '2014-11-13'),
  award('ALMVP', 'AL MVP', '2016', '2016-11-17'),
  award('ALMVP', 'AL MVP', '2019', '2019-11-14'),
  award('ALROY', 'Jackie Robinson AL Rookie of the Year', '2012', '2012-11-12'),
  award('ALSS', 'AL Silver Slugger', '2012', '2012-11-08'),
  award('ALSS', 'AL Silver Slugger', '2013', '2013-11-07'),
  award('ALAS', 'AL All-Star', '2012', '2012-07-10'),
  award('ALAS', 'AL All-Star', '2013', '2013-07-16'),
  award('ALPOW', 'AL Player of the Week', '2012', '2012-07-08'),
  award('ALPOW', 'AL Player of the Week', '2019', '2019-04-28'),
  award('MLBAFIRST', 'All-MLB First Team', '2019', '2019-11-25'),
  award('MWLMVP', 'MID Most Valuable Player', '2010', '2010-08-24', KERNELS),
  award('MWLPSAS', 'MID Post-Season All-Star', '2010', '2010-08-24', KERNELS),
  award('TLPSAS', 'TEX Post-Season All-Star', '2011', '2011-08-30', KERNELS),
  award('TOPSPINK', 'Topps Minor League Player of the Year', '2010', '2010-10-05', QUAKES),
  award('WBCTT', 'WBC All-Tournament Team', '2023', '2023-03-22'),
]

const byKey = (view, key) => view.categories.find((c) => c.key === key)

test('every award in the feed becomes a category — no allowlist drops one', () => {
  const view = awardsView(TROUT)
  // 11 distinct categories out of 16 rows: MVP x3, Silver Slugger x2,
  // All-Star x2 and Player of the Week x2 each collapse into one.
  assert.equal(view.totals.categories, 11)
  assert.equal(view.totals.selections, 16)
  // The four the old two-allowlist Trophy Case dropped on the floor.
  for (const name of [
    'MID Most Valuable Player',
    'MID Post-Season All-Star',
    'Topps Minor League Player of the Year',
    'WBC All-Tournament Team',
  ]) {
    assert.ok(byKey(view, name), `${name} should have a category`)
  }
})

test('a curated AL/NL pair collapses into one table; a level pair does not', () => {
  const view = awardsView(TROUT)
  assert.equal(byKey(view, 'MVP').count, 3)
  // MLB.com shows the Midwest League's and the Texas League's post-season
  // all-star teams as two tables, and so do we — one weight entry still
  // governs both (see the rank-key test below).
  assert.equal(byKey(view, 'MID Post-Season All-Star').count, 1)
  assert.equal(byKey(view, 'TEX Post-Season All-Star').count, 1)
})

test('one weight entry governs every level of the same family', () => {
  assert.equal(rankKeyOf(award('MWLPSAS', 'MID Post-Season All-Star', '2010', '2010-08-24')), 'Post-Season All-Star')
  assert.equal(rankKeyOf(award('TLPSAS', 'TEX Post-Season All-Star', '2011', '2011-08-30')), 'Post-Season All-Star')
  // A curated id ranks under its collapsed label, not the feed's namesake.
  assert.equal(rankKeyOf(award('ALROY', 'Jackie Robinson AL Rookie of the Year', '2012', '2012-11-12')), 'Rookie of the Year')
})

test('the league column reads the feed, and prefers the voting league over the issuer', () => {
  assert.equal(awardLeague(award('ALSS', 'AL Silver Slugger', '2012', '2012-11-08')), 'AL')
  assert.equal(awardLeague(award('ALGG', 'Rawlings AL Gold Glove', '2012', '2012-11-01')), 'AL')
  assert.equal(awardLeague(award('MWLMVP', 'MID Most Valuable Player', '2010', '2010-08-24')), 'MID')
  assert.equal(awardLeague(award('MLBAFIRST', 'All-MLB First Team', '2019', '2019-11-25')), 'MLB')
  // "MLB Players Choice AL Outstanding Player" carries BOTH a leading MLB and
  // a standalone AL. The AL half is the one that says who voted.
  assert.equal(
    awardLeague(award('MLBPCALOP', 'MLB Players Choice AL Outstanding Player', '2014', '2014-11-07')),
    'AL',
  )
  // Nothing in the feed says — the column prints a dash rather than guessing.
  assert.equal(awardLeague(award('BAPOY', 'Baseball America Minor League Player of the Year', '2011', '2011-09-01')), null)
})

test('a single-league label folds the league in; rows keep their own', () => {
  const view = awardsView(TROUT)
  assert.equal(byKey(view, 'MVP').label, 'AL MVP')
  // A non-curated name already starts with its code — no "MID MID".
  assert.equal(byKey(view, 'MID Most Valuable Player').label, 'MID Most Valuable Player')
  assert.equal(byKey(view, 'MVP').rows[0].league, 'AL')
})

test('a repeat award split across leagues keeps the plain label', () => {
  const traded = [
    award('ALMVP', 'AL MVP', '2014', '2014-11-13'),
    award('NLMVP', 'NL MVP', '2016', '2016-11-17'),
  ]
  const cat = byKey(awardsView(traded), 'MVP')
  assert.equal(cat.label, 'MVP')
  assert.deepEqual(cat.rows.map((r) => r.league), ['NL', 'AL'])
})

test('rows are most recent first, and in-season honors carry their month', () => {
  const view = awardsView(TROUT)
  assert.deepEqual(byKey(view, 'MVP').rows.map((r) => r.when), ['2019', '2016', '2014'])
  // Two Players of the Week in one year would print "2012, 2012" as a year.
  assert.deepEqual(byKey(view, 'Player of the Week').rows.map((r) => r.when), ['Apr 2019', 'Jul 2012'])
})

test('rows carry the club id so the table can draw its mark', () => {
  const view = awardsView(TROUT)
  assert.equal(byKey(view, 'MVP').rows[0].teamId, 108)
  assert.equal(byKey(view, 'Topps Minor League Player of the Year').rows[0].teamId, 526)
})

test('the endDate cutoff drops an award not yet won, and an undated one never counts', () => {
  const view = awardsView(TROUT, '2013-01-01')
  assert.equal(byKey(view, 'MVP'), undefined)
  assert.equal(byKey(view, 'Rookie of the Year').count, 1)
  const undated = awardsView([{ id: 'ALMVP', name: 'AL MVP', season: '2014', date: null }])
  assert.equal(undated.totals.selections, 0)
})

test('an empty or missing feed produces an empty view rather than throwing', () => {
  for (const input of [null, undefined, []]) {
    const view = awardsView(input)
    assert.deepEqual(view.categories, [])
    assert.equal(view.totals.selections, 0)
  }
})

test('ranking follows the order, and an unranked award sorts last', () => {
  const view = awardsView(TROUT)
  const ranked = rankAwards(view.categories, DEFAULT_AWARD_ORDER)
  assert.deepEqual(ranked.slice(0, 3).map((c) => c.label), [
    'AL MVP',
    'AL Rookie of the Year',
    'All-MLB First Team',
  ])
  // Nothing in the shipped order names this one, so it cannot lead.
  const invented = awardsView([
    ...TROUT,
    award('NEWTHING', 'Brand New Trophy', '2026', '2026-08-01'),
  ])
  const withNew = rankAwards(invented.categories, DEFAULT_AWARD_ORDER)
  assert.equal(withNew[withNew.length - 1].label, 'Brand New Trophy')
})

test('a custom order re-leads the page, and the cap only decides how many get a table', () => {
  const view = awardsView(TROUT)
  const custom = ['All-Star', 'Player of the Week', ...DEFAULT_AWARD_ORDER]
  const ranked = rankAwards(view.categories, custom)
  assert.deepEqual(ranked.slice(0, 2).map((c) => c.label), ['AL All-Star', 'AL Player of the Week'])
  // Whatever the cap, nothing leaves the list — the rest is the index.
  const cap = 3
  assert.equal(ranked.slice(0, cap).length + ranked.slice(cap).length, view.totals.categories)
})

test('a duplicated key in a saved order takes its first position, not its last', () => {
  const view = awardsView(TROUT)
  const ranked = rankAwards(view.categories, ['All-Star', 'MVP', 'All-Star'])
  assert.equal(ranked[0].label, 'AL All-Star')
  assert.equal(ranked[1].label, 'AL MVP')
})

test('ties break on count then alphabetically, so the order is stable', () => {
  const view = awardsView(TROUT)
  const unranked = rankAwards(view.categories, [])
  const counts = unranked.map((c) => c.count)
  assert.deepEqual(counts, counts.slice().sort((a, b) => b - a))
})

test('a blank or missing stored order falls back to what shipped', () => {
  assert.deepEqual(parseAwardOrder(''), DEFAULT_AWARD_ORDER)
  assert.deepEqual(parseAwardOrder(null), DEFAULT_AWARD_ORDER)
  assert.deepEqual(parseAwardOrder('   \n  \n'), DEFAULT_AWARD_ORDER)
  assert.deepEqual(parseAwardOrder(' MVP \nAll-Star\n'), ['MVP', 'All-Star'])
  assert.equal(formatAwardOrder(['MVP', 'All-Star']), 'MVP\nAll-Star')
})

test('a cap is one digit 1-9, and anything else falls back', () => {
  assert.equal(parseAwardCap('6', 3), 6)
  assert.equal(parseAwardCap(' 4 ', 3), 4)
  // Zero would hide the section from a player who has awards.
  assert.equal(parseAwardCap('0', 3), 3)
  for (const bad of ['', null, undefined, 'x', '10', '-2', '2.5']) {
    assert.equal(parseAwardCap(bad, 3), 3, `${bad} should fall back`)
  }
})

test('the panel can offer a family the shipped order never named', () => {
  const view = awardsView(TROUT)
  const keys = knownRankKeys(DEFAULT_AWARD_ORDER, view.categories)
  assert.ok(keys.includes('MVP'))
  assert.equal(new Set(keys).size, keys.length, 'no duplicates')
  const withNew = awardsView([...TROUT, award('NEWTHING', 'Brand New Trophy', '2026', '2026-08-01')])
  assert.ok(knownRankKeys(DEFAULT_AWARD_ORDER, withNew.categories).includes('Brand New Trophy'))
})

test('the shipped order names each family once', () => {
  assert.equal(new Set(DEFAULT_AWARD_ORDER).size, DEFAULT_AWARD_ORDER.length)
})
