import assert from 'node:assert/strict'
import test from 'node:test'
import { hitterFormView } from '../src/api/hitterForm.js'

// Coverage for the PLAYER page's Recent form card (src/api/hitterForm.js) —
// the pure view over already-fetched lastXGames/season stat bundles.
// fetchHitterForm itself is a thin network wrapper (four parallel getJson
// calls), not covered here — same split as workload.test.js /
// PitcherWorkloadCard. Not to be confused with test/recent-form.test.js,
// which covers the unrelated TEAM page's Last 10 Games module.
//
// The view is a time series with a baseline, not a bag of facts: three nested
// windows, the season line they are measured against, and a signed OPS delta
// per window placed on a FIXED ±.300 scale. Most of what follows pins that
// scale, since a fitted one would make every hitter's worst week look extreme.

const stat = ({
  gamesPlayed, atBats, avg, obp, slg, ops, homeRuns, rbi,
  strikeOuts, baseOnBalls, plateAppearances,
}) => ({
  gamesPlayed, atBats, avg, obp, slg, ops, homeRuns, rbi,
  strikeOuts, baseOnBalls, plateAppearances,
})

const FULL = {
  last7: stat({ gamesPlayed: 7, atBats: 23, plateAppearances: 27, avg: '.320', obp: '.400', slg: '.560', ops: '.960', homeRuns: 2, rbi: 5 }),
  last15: stat({ gamesPlayed: 15, atBats: 56, plateAppearances: 61, avg: '.179', obp: '.250', slg: '.347', ops: '.597', homeRuns: 1, rbi: 4 }),
  last30: stat({
    gamesPlayed: 30, atBats: 115, avg: '.255', obp: '.310', slg: '.410', ops: '.720',
    homeRuns: 4, rbi: 12, strikeOuts: 33, baseOnBalls: 13, plateAppearances: 132,
  }),
  season: stat({ gamesPlayed: 100, atBats: 314, plateAppearances: 355, avg: '.260', obp: '.330', slg: '.430', ops: '.760' }),
}

const rowFor = (view, key) => view.rows.find((r) => r.key === key)

test('the three windows are rows in narrowing order, verbatim from the API strings', () => {
  const view = hitterFormView(FULL)
  assert.deepEqual(view.rows.map((r) => r.key), ['last7', 'last15', 'last30'])
  assert.deepEqual(view.rows.map((r) => r.label), ['Last 7', 'Last 15', 'Last 30'])
  assert.equal(rowFor(view, 'last7').avg, '.320')
  assert.equal(rowFor(view, 'last7').ops, '.960')
  assert.equal(rowFor(view, 'last30').ops, '.720')
})

test('each window carries its own PLATE APPEARANCES — the sample is a column, not a footnote', () => {
  const view = hitterFormView(FULL)
  // PA, not AB: the counting figures on this card (K%, BB%) divide by PA, so a
  // printed AB count beside them would change the denominator mid-row.
  assert.equal(rowFor(view, 'last7').pa, '27')
  assert.equal(rowFor(view, 'last15').pa, '61')
  assert.equal(rowFor(view, 'last30').pa, '132')
  assert.equal(view.anchor.pa, '355')
})

test('the season line is a printed anchor row, flagged, with no delta of its own', () => {
  const view = hitterFormView(FULL)
  assert.equal(view.anchor.isAnchor, true)
  assert.equal(view.anchor.label, 'Season')
  assert.equal(view.anchor.ops, '.760')
  assert.equal(view.anchor.delta, null)
  assert.equal(view.anchor.lean, null)
  // The anchor is NOT one of the windows — it must not be counted as a fourth.
  assert.equal(view.rows.some((r) => r.isAnchor), false)
})

test('the delta is signed OPS points against the season line, U+2212 not a hyphen', () => {
  const view = hitterFormView(FULL)
  assert.equal(rowFor(view, 'last15').deltaText, '−.163')
  assert.equal(rowFor(view, 'last15').deltaText[0], '−') // exact minus-sign codepoint
  assert.equal(rowFor(view, 'last7').deltaText, '+.200')
})

test('lean places the bar on a FIXED ±.300 scale, not one fitted to this player', () => {
  const view = hitterFormView({
    ...FULL,
    // +.150 is exactly half the domain, so the bar must run exactly half way.
    last7: stat({ gamesPlayed: 7, atBats: 23, plateAppearances: 27, avg: '.300', ops: '.910' }),
    season: stat({ gamesPlayed: 100, atBats: 314, plateAppearances: 355, avg: '.260', ops: '.760' }),
  })
  const r = rowFor(view, 'last7')
  assert.ok(Math.abs(r.lean - 0.5) < 1e-9)
  assert.equal(r.clamped, false)
})

test('a window past the domain clamps to the end of the track and says so', () => {
  const view = hitterFormView({
    ...FULL,
    last7: stat({ gamesPlayed: 7, atBats: 23, plateAppearances: 27, avg: '.450', ops: '1.400' }),
    season: stat({ gamesPlayed: 100, atBats: 314, plateAppearances: 355, avg: '.260', ops: '.760' }),
  })
  const r = rowFor(view, 'last7')
  assert.equal(r.lean, 1)
  assert.equal(r.clamped, true)
  // The exact figure still prints — clamping is the BAR's limit, not the data's.
  assert.equal(r.deltaText, '+.640')
})

test('a negative window clamps to −1, the other end of the same track', () => {
  const view = hitterFormView({
    ...FULL,
    last7: stat({ gamesPlayed: 7, atBats: 23, plateAppearances: 27, avg: '.050', ops: '.100' }),
    season: stat({ gamesPlayed: 100, atBats: 314, plateAppearances: 355, avg: '.260', ops: '.760' }),
  })
  assert.equal(rowFor(view, 'last7').lean, -1)
  assert.equal(rowFor(view, 'last7').clamped, true)
})

// ---------------------------------------------------------------------------
// Sample size. A 7-game window is mostly its own denominator: across the 60
// highest-PA hitters in the league the mean absolute deviation from a player's
// own season line runs .191 / .134 / .080 over 7 / 15 / 30 games — a ratio of
// 1 : 0.70 : 0.42 against the 1 : 0.68 : 0.48 that pure sampling noise predicts.
// Left alone, this card would draw its longest bar on its noisiest row for
// every hitter alive, and a reader would see a slump in the arithmetic. These
// cases pin the three defences: the noise band, the no-bar floor, and the
// no-row floor.
// ---------------------------------------------------------------------------

test('every window carries its own noise band, wider the smaller the sample', () => {
  const view = hitterFormView(FULL)
  const b7 = rowFor(view, 'last7').band
  const b15 = rowFor(view, 'last15').band
  const b30 = rowFor(view, 'last30').band
  assert.ok(b7 > b15 && b15 > b30, `expected a narrowing band, got ${b7}/${b15}/${b30}`)
  // 1.2/sqrt(27) = .231 OPS points, over a .300 domain = 0.770 of the track.
  assert.ok(Math.abs(b7 - 0.7698) < 1e-3, `last7 band was ${b7}`)
})

test("a bar inside its own band is the card's way of saying nothing happened", () => {
  // −.060 over 132 PA. The band is 1.2/sqrt(132) = .104, so the bar sits well
  // inside it — this hitter is not in a slump, he is in a sample.
  const view = hitterFormView({
    ...FULL,
    last30: { ...FULL.last30, ops: '.700' },
    season: stat({ gamesPlayed: 100, atBats: 314, plateAppearances: 355, avg: '.260', ops: '.760' }),
  })
  const r = rowFor(view, 'last30')
  assert.ok(Math.abs(r.lean) < r.band, `|lean| ${Math.abs(r.lean)} should sit inside band ${r.band}`)
})

test('under 25 PA a window keeps its figures and loses its bar', () => {
  // The live case this was written for: a bat whose "last 7 games" holds a
  // handful of trips, printing a 1.000 OPS as a near-full bar directly above a
  // game log showing four hitless nights.
  const view = hitterFormView({
    ...FULL,
    last7: stat({ gamesPlayed: 7, atBats: 16, plateAppearances: 18, avg: '.500', ops: '1.000' }),
  })
  const r = rowFor(view, 'last7')
  assert.equal(r.thin, true)
  assert.equal(r.lean, null)
  assert.equal(r.band, null)
  // The numbers are still what he did — they just stop being evidence.
  assert.equal(r.avg, '.500')
  assert.equal(r.deltaText, '+.240')
})

test('under 10 PA the window is not a row at all', () => {
  const view = hitterFormView({
    ...FULL,
    last7: stat({ gamesPlayed: 7, atBats: 5, plateAppearances: 5, avg: '.400', ops: '.900' }),
  })
  assert.equal(view.rows.some((r) => r.key === 'last7'), false)
  assert.equal(view.rows.some((r) => r.key === 'last15'), true)
})

test('the season anchor is never gated — it is the baseline, not a window', () => {
  const view = hitterFormView({
    ...FULL,
    season: stat({ gamesPlayed: 3, atBats: 8, plateAppearances: 8, avg: '.250', ops: '.700' }),
  })
  assert.equal(view.anchor.pa, '8')
  assert.equal(view.anchor.isAnchor, true)
})

test('the counting footer reports the WIDEST window and names it', () => {
  const view = hitterFormView(FULL)
  // 33 K / 132 PA = 25%, 13 BB / 132 PA = 10% — computed from last30 only, so
  // no reader has to notice that one line quietly changed windows.
  // No RBI — the split tables on this same page drop it for reporting how often
  // his team-mates reached base, and that does not stop being true up here.
  assert.equal(view.footer, '4 HR  ·  25% K · 10% BB')
})

test('no season line means no bars at all rather than an unanchored axis', () => {
  const view = hitterFormView({ last15: FULL.last15, last30: FULL.last30 })
  assert.equal(view.hasBars, false)
  assert.equal(view.anchor, null)
  assert.equal(rowFor(view, 'last15').delta, null)
  assert.equal(rowFor(view, 'last15').lean, null)
  assert.equal(rowFor(view, 'last15').deltaText, '')
})

test('a missing last7 split skips its row rather than nulling the card', () => {
  const view = hitterFormView({ last15: FULL.last15, last30: FULL.last30, season: FULL.season })
  assert.equal(view.rows.some((r) => r.key === 'last7'), false)
  assert.equal(view.rows.some((r) => r.key === 'last30'), true)
})

test('a missing last15 split drops only its own row; the footer still reports last30', () => {
  const view = hitterFormView({ last7: FULL.last7, last30: FULL.last30, season: FULL.season })
  assert.equal(view.rows.some((r) => r.key === 'last15'), false)
  assert.equal(view.footer, '4 HR  ·  25% K · 10% BB')
})

test('null when last30 is missing entirely', () => {
  assert.equal(hitterFormView({}), null)
  assert.equal(hitterFormView({ last7: stat({ gamesPlayed: 7, ops: '.900' }) }), null)
  assert.equal(hitterFormView(undefined), null)
})

test('null when last30 has zero games played (call-up with no games yet this window)', () => {
  assert.equal(hitterFormView({ last30: stat({ gamesPlayed: 0, avg: '.000', ops: '.000' }) }), null)
})
