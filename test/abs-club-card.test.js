// Coverage for the model behind the team page's ABS Challenges card
// (src/api/around-the-game/absClubCard.js).
//
// Three things here were real mistakes or real traps, not hypotheticals:
//
//   1. A SHARE IS CUT, NOT ROUNDED. 29 of 100 reads 29.0% and 0.249% reads
//      0.24%. A float multiply puts 28.999999 where 29 belongs, and rounding
//      moves a man across a line the reader can check by hand.
//   2. EXPOSURE HAS MORE THAN ONE BASIS. The file carries the calls a man could
//      challenge (strikes a hitter saw, balls a catcher received) only after the
//      generator's backfill. Until then the card keeps the rate it had (all
//      pitches for a hitter, per nine innings for a catcher), and it must never
//      mix two bases on one board.
//   3. A MAN WHO NEVER CALLED A REVIEW HAS NO SUCCESS RATE. A zero divided by
//      zero is not a 0%; it prints a dash and drops off the success plot.
import assert from 'node:assert/strict'
import test from 'node:test'
import { challengeCard, cutPercent, resultsStrip } from '../src/api/around-the-game/absClubCard.js'

const man = (over) => ({
  playerId: 1,
  name: 'A Hitter',
  pitches: 1000,
  plateAppearances: 250,
  catcherInnings: null,
  asBatter: 5,
  asCatcher: 0,
  ...over,
})

const file = (byTeam) => ({ levels: { MLB: { byTeam } } })

test('cutPercent cuts at the place and never rounds up', () => {
  assert.equal(cutPercent(7, 2890, 2), '0.24%')
  assert.equal(cutPercent(7, 2890, 1), '0.2%')
  assert.equal(cutPercent(29, 100, 1), '29.0%')
  assert.equal(cutPercent(2, 3, 1), '66.6%')
  assert.equal(cutPercent(1, 1, 1), '100.0%')
  assert.equal(cutPercent(0, 5, 2), '0.00%')
  assert.equal(cutPercent(3, 0, 2), null)
  assert.equal(cutPercent(null, 10, 2), null)
})

test('a club with no rows has no card', () => {
  assert.equal(challengeCard(file({ 1: [man({})] }), 2), null)
  assert.equal(challengeCard(null, 1), null)
  assert.equal(challengeCard(file({ 1: [] }), 1), null)
})

test('hitters: share of pitches, floors, order, rank and the league line', () => {
  const data = file({
    1: [
      man({ playerId: 10, name: 'Regular', pitches: 2000, plateAppearances: 500, asBatter: 8 }),
      man({ playerId: 11, name: 'Bench', pitches: 100, plateAppearances: 25, asBatter: 0 }),
    ],
    2: [man({ playerId: 20, name: 'Other', pitches: 2000, plateAppearances: 500, asBatter: 20 })],
  })
  const b = challengeCard(data, 1).batter
  assert.equal(b.basis, 'pitches')
  assert.deepEqual(b.rows.map((r) => r.name), ['Regular', 'Bench'])
  assert.equal(b.rows[0].rateText, '0.4%')
  assert.equal(b.rows[1].rateText, '0.0%')
  assert.deepEqual(b.plotted.map((r) => r.name), ['Regular'])
  // League: 28 reviews over 4,100 pitches.
  assert.ok(Math.abs(b.league.frac - 28 / 4100) < 1e-12)
  assert.equal(b.rows[0].over, false)
  assert.deepEqual(b.rank, { rank: 2, of: 2 })
  assert.equal(b.lead.called.value, cutPercent(8, 2100, 1))
  assert.equal(b.lead.called.caption, 'MLB average 0.6%')
})

test('the average qualified hitter is the mean over every regular in the file', () => {
  const data = file({
    1: [man({ playerId: 10, pitches: 2000, plateAppearances: 500, asBatter: 8 }), man({ playerId: 11, pitches: 90, plateAppearances: 20, asBatter: 9 })],
    2: [man({ playerId: 20, pitches: 1000, plateAppearances: 300, asBatter: 4 })],
  })
  const { average } = challengeCard(data, 1).batter
  assert.deepEqual(average, { exposure: 1500, calls: 6, of: 2 })
})

test('catchers fall back to innings until the file carries the balls they received', () => {
  const old = file({
    1: [man({ playerId: 30, name: 'Old Way', pitches: 10, plateAppearances: 5, catcherInnings: 900, asBatter: 0, asCatcher: 100 })],
  })
  const c = challengeCard(old, 1).catcher
  assert.equal(c.basis, 'innings')
  assert.equal(c.exposureLabel, 'Innings')
  assert.equal(c.rows[0].rateText, '1.00')
  assert.equal(c.lead.called.label, 'Per 9 innings caught')

  const fresh = file({
    1: [man({ playerId: 30, name: 'New Way', catcherInnings: 900, asBatter: 0, asCatcher: 100, ballsReceived: 4000 })],
  })
  const n = challengeCard(fresh, 1).catcher
  assert.equal(n.basis, 'calls')
  assert.equal(n.rows[0].rateText, '2.5%')
  assert.equal(n.rows[0].exposureText, '4,000')
  assert.equal(n.exposureLabel, 'Balls')
  assert.equal(n.exposureTitle, 'Called balls received')
  assert.equal(n.lead.called.label, 'Called balls received, challenged')
})

test('hitters run on the strikes they saw once the file has them, and on all pitches before', () => {
  const before = challengeCard(file({ 1: [man({ pitches: 2000, asBatter: 10 })] }), 1).batter
  assert.equal(before.basis, 'pitches')
  assert.equal(before.exposureTitle, 'Pitches seen')
  assert.equal(before.rows[0].rateText, '0.5%')
  // The same man, 800 of whose 2,000 pitches were called strikes by the umpire.
  const after = challengeCard(file({ 1: [man({ pitches: 2000, strikesSeen: 800, asBatter: 10 })] }), 1).batter
  assert.equal(after.basis, 'calls')
  assert.equal(after.exposureLabel, 'Strikes')
  assert.equal(after.exposureTitle, 'Called strikes seen')
  assert.equal(after.rows[0].exposure, 800)
  assert.equal(after.rows[0].rateText, '1.2%')
  assert.equal(after.lead.called.label, 'Called strikes seen, challenged')
})

test('a catcher with balls received is only listed on the calls basis', () => {
  // One catcher in the file has the new field: the whole board runs on it and a
  // man without it is left off rather than compared on innings.
  const data = file({
    1: [
      man({ playerId: 30, name: 'Has It', catcherInnings: 500, asCatcher: 50, ballsReceived: 2000 }),
      man({ playerId: 31, name: 'Lacks It', catcherInnings: 500, asCatcher: 40, ballsReceived: null }),
    ],
  })
  const c = challengeCard(data, 1).catcher
  assert.deepEqual(c.rows.map((r) => r.name), ['Has It'])
})

test('success: wins, the dash for a man with no reviews, and the league rate', () => {
  const data = file({
    1: [
      man({ playerId: 10, name: 'Caller', asBatter: 10, wonBatter: 6, resultsBatter: '1110100110' }),
      man({ playerId: 11, name: 'Quiet', asBatter: 0, wonBatter: 0, resultsBatter: '' }),
    ],
    2: [man({ playerId: 20, name: 'Other', asBatter: 10, wonBatter: 4 })],
  })
  const b = challengeCard(data, 1).batter
  assert.equal(b.hasSuccess, true)
  assert.equal(b.hasResults, true)
  const caller = b.rows.find((r) => r.name === 'Caller')
  assert.equal(caller.successText, '60.0%')
  assert.equal(caller.pct, 0.6)
  assert.equal(caller.results, '1110100110')
  const quiet = b.rows.find((r) => r.name === 'Quiet')
  assert.equal(quiet.successText, '—')
  assert.equal(quiet.pct, null)
  assert.equal(b.lead.success.value, '60.0%')
  assert.equal(b.lead.success.label, 'Overturned at the plate, 6 of 10')
  // This club won 6 of 10 and the other club 4 of 10, so it ranks first of two.
  assert.deepEqual(b.lead.success.rank, { rank: 1, of: 2 })
  assert.equal(b.lead.success.caption, 'MLB average 50.0%')
  assert.equal(b.league.success, 0.5)
})

test('a file from before the generator added wins has no success view', () => {
  const b = challengeCard(file({ 1: [man({})] }), 1).batter
  assert.equal(b.hasSuccess, false)
  assert.equal(b.hasResults, false)
  assert.equal(b.rows[0].won, null)
  assert.equal(b.rows[0].results, null)
})

test('resultsStrip counts every review and draws the latest forty', () => {
  assert.equal(resultsStrip(''), null)
  assert.equal(resultsStrip(null), null)
  const small = resultsStrip('1011')
  assert.deepEqual(small, { marks: '1011', right: 3, wrong: 1, total: 4, shown: 4 })
  const long = `${'0'.repeat(10)}${'1'.repeat(40)}`
  const cut = resultsStrip(long)
  assert.equal(cut.shown, 40)
  assert.equal(cut.marks, '1'.repeat(40))
  assert.equal(cut.right, 40)
  assert.equal(cut.wrong, 10)
  assert.equal(cut.total, 50)
})
