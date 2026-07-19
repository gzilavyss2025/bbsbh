// Unit coverage for the three reveal-only derivation modules — the pure
// feed→data functions whose OUTPUT is the spoiler surface itself (a per-inning
// pitch/whiff count, an R/H/E line, a pitcher's IP/ER). Until now these were
// exercised only indirectly, through the two pinned-gamePk e2e specs that hit
// the live MLB API; a miscount here either leaks a sealed number or prints a
// wrong one, so the boundaries are worth pinning directly and deterministically.
//
// The fixture (test/fixtures/mini-game.js) is a tiny hand-built feed with a
// known play-by-play; see its header for the half-by-half layout.
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFeed } from './fixtures/mini-game.js'
import {
  computeDerivedByInning,
  revealDerived,
  computeGameSuperlatives,
  rollingPitches,
} from '../src/api/derive.js'
import { revealInning, revealTotals } from '../src/api/linescore.js'
import { computePitcherLines } from '../src/api/pitchers.js'

// --------------------------------------------------------------------------
// derive.js — per-inning pitches / whiffs / first-pitch strikes / PA
// --------------------------------------------------------------------------
test('computeDerivedByInning counts pitches, whiffs and first-pitch strikes per half', () => {
  const m = computeDerivedByInning(buildFeed())
  const top1 = revealDerived(m, 1, 'top')
  assert.equal(top1.pitches, 8)
  assert.equal(top1.whiffs, 4) // two swinging Ks (2 whiffs each)
  assert.equal(top1.firstPitchStrikes, 4) // C, X, X, C — none are balls
  assert.equal(top1.plateAppearances, 4)
})

test('a caught stealing counts its pitch but is not a plate appearance', () => {
  // Bottom 1 has 4 plays but one is an inning-ending caught stealing, so PA=3
  // while its swinging-strike pitch still counts toward pitches AND whiffs.
  const m = computeDerivedByInning(buildFeed())
  const bot1 = revealDerived(m, 1, 'bottom')
  assert.equal(bot1.plateAppearances, 3)
  assert.equal(bot1.pitches, 7)
  assert.equal(bot1.whiffs, 2) // the CS whiff + the strikeout's third strike
  assert.equal(bot1.firstPitchStrikes, 2) // CS's own first pitch is skipped (non-PA)
})

test('revealDerived returns zeros for a half with no recorded pitches', () => {
  const m = computeDerivedByInning(buildFeed())
  const empty = revealDerived(m, 9, 'top')
  assert.deepEqual(
    { p: empty.pitches, w: empty.whiffs, f: empty.firstPitchStrikes, pa: empty.plateAppearances },
    { p: 0, w: 0, f: 0, pa: 0 },
  )
  assert.equal(empty.maxVelo, null)
})

test('Statcast superlatives take the max velo / exit velo / distance in the half', () => {
  const m = computeDerivedByInning(buildFeed())
  const top1 = revealDerived(m, 1, 'top')
  assert.equal(top1.maxVelo, 95.1)
  assert.equal(top1.maxVeloType, 'Four-Seam Fastball')
  assert.equal(top1.maxVeloPlayerId, 200)
  assert.equal(top1.hardestHit, 104.3)
  assert.equal(top1.hardestHitPlayerId, 2)
  assert.equal(top1.longestHit, 420)
})

test('superlatives stay null for a half the feed carries no tracking data for', () => {
  // Top 2 (the reliever's inning) has pitches but no pitchData/hitData.
  const top2 = revealDerived(computeDerivedByInning(buildFeed()), 2, 'top')
  assert.equal(top2.pitches, 3)
  assert.equal(top2.maxVelo, null)
  assert.equal(top2.hardestHit, null)
})

test('computeGameSuperlatives reduces the per-half bests across the whole game', () => {
  const best = computeGameSuperlatives(buildFeed())
  assert.equal(best.maxVelo, 95.1) // top 1's fastball is the game high
  assert.equal(best.hardestHit, 104.3) // top 1's HR beats bottom 2's 99.0
  assert.equal(best.longestHit, 420)
})

test('rollingPitches accumulates one pitching side across innings', () => {
  const m = computeDerivedByInning(buildFeed())
  // Home pitches the TOP halves: 8 (top 1) + 3 (top 2) = 11 through the 2nd.
  assert.equal(rollingPitches(m, 2, 'top'), 11)
  assert.equal(rollingPitches(m, 1, 'top'), 8)
  // Away pitches the BOTTOM halves: only bottom 1 is nonzero through the 1st.
  assert.equal(rollingPitches(m, 1, 'bottom'), 7)
})

test('computeDerivedByInning tolerates an empty / malformed feed', () => {
  assert.deepEqual(computeDerivedByInning({}), {})
  assert.deepEqual(computeDerivedByInning(null), {})
  assert.deepEqual(computeDerivedByInning({ liveData: { plays: {} } }), {})
})

// --------------------------------------------------------------------------
// linescore.js — the R/H/E/LOB lines
// --------------------------------------------------------------------------
test('revealInning returns the per-side R/H/E/LOB for an inning', () => {
  const feed = buildFeed()
  assert.deepEqual(revealInning(feed, 1, 'away'), { runs: 1, hits: 2, errors: 0, leftOnBase: 1 })
  assert.deepEqual(revealInning(feed, 1, 'home'), { runs: 0, hits: 1, errors: 1, leftOnBase: 2 })
  assert.deepEqual(revealInning(feed, 2, 'home'), { runs: 2, hits: 2, errors: 0, leftOnBase: 1 })
})

test('revealInning returns null for an inning/side the linescore has no row for', () => {
  const feed = buildFeed()
  assert.equal(revealInning(feed, 5, 'away'), null)
  assert.equal(revealInning({}, 1, 'away'), null)
})

test('revealTotals reads the full-game team line', () => {
  const feed = buildFeed()
  assert.deepEqual(revealTotals(feed, 'away'), { runs: 1, hits: 2, errors: 1, leftOnBase: 1 })
  assert.deepEqual(revealTotals(feed, 'home'), { runs: 2, hits: 3, errors: 1, leftOnBase: 3 })
  assert.equal(revealTotals({}, 'home'), null)
})

// --------------------------------------------------------------------------
// pitchers.js — the reveal-gated running pitching lines (ADR-0009)
// --------------------------------------------------------------------------
test('computePitcherLines reveals nothing when the mark is -1', () => {
  const lines = computePitcherLines(buildFeed(), -1)
  assert.deepEqual(lines, { away: [], home: [] })
})

test('a pitcher only appears once the half he entered is revealed', () => {
  const feed = buildFeed()
  // Through top 1 (mark 0): only the home starter has thrown a revealed pitch.
  const thru0 = computePitcherLines(feed, 0)
  assert.deepEqual(thru0.away, [])
  assert.equal(thru0.home.length, 1)
  assert.equal(thru0.home[0].id, 200)
  // The home reliever entered in top 2 (mark 2) — still hidden at mark 1.
  assert.equal(computePitcherLines(feed, 1).home.length, 1)
  assert.equal(computePitcherLines(feed, 3).home.length, 2)
})

test('a still-active pitcher shows only his revealed-innings partial', () => {
  // Through bottom 1 (mark 1) the away starter has faced 3 batters (the CS is
  // excluded) for 1.0 IP — NOT his full 2.0-inning boxscore line.
  const away = computePitcherLines(buildFeed(), 1).away
  assert.equal(away.length, 1)
  assert.deepEqual(
    { id: away[0].id, ip: away[0].ip, bf: away[0].bf, h: away[0].h, r: away[0].r, k: away[0].k },
    { id: 300, ip: '1.0', bf: 3, h: 1, r: 0, k: 1 },
  )
})

test('a fully-revealed pitcher uses his exact boxscore line', () => {
  // Through the whole game (mark 3) the away starter shows his 2.0 IP / 8 BF
  // boxscore totals, not the running partial.
  const away = computePitcherLines(buildFeed(), 3).away
  assert.deepEqual(
    { ip: away[0].ip, bf: away[0].bf, h: away[0].h, r: away[0].r, er: away[0].er, k: away[0].k },
    { ip: '2.0', bf: 8, h: 3, r: 1, er: 1, k: 2 },
  )
})

// A focused second feed for run attribution: NO boxscore pitching stats, so the
// computed (responsiblePitcher-attributed) values are what surface even at full
// reveal — otherwise the exact boxscore line would mask them.
function inheritedRunnerFeed() {
  const person = (id, last) => ({ id, fullName: `First ${last}`, lastName: last, useName: 'First', pitchHand: { code: 'R' } })
  const pitch = () => ({ isPitch: true, pitchNumber: 1, details: { call: { code: 'X' } } })
  return {
    gamePk: 42,
    gameData: { players: { ID1: person(1, 'Ace'), ID2: person(2, 'Bull') } },
    liveData: {
      boxscore: {
        teams: {
          home: {
            pitchers: [1, 2],
            players: { ID1: { person: { id: 1 } }, ID2: { person: { id: 2 } } },
          },
          away: { pitchers: [], players: {} },
        },
      },
      plays: {
        allPlays: [
          {
            about: { inning: 1, halfInning: 'top' },
            matchup: { pitcher: { id: 1 } },
            result: { type: 'atBat', eventType: 'single' },
            count: { outs: 0 },
            playEvents: [pitch()],
          },
          {
            about: { inning: 1, halfInning: 'top' },
            matchup: { pitcher: { id: 2 } },
            result: { type: 'atBat', eventType: 'field_out' },
            count: { outs: 1 },
            playEvents: [
              { details: { eventType: 'pitching_substitution' }, player: { id: 2 } },
              pitch(),
            ],
            // The runner Ace left on scores after Bull relieves — charged to Ace.
            runners: [
              {
                details: { isScoringEvent: true, earned: true, responsiblePitcher: { id: 1 } },
                movement: { end: 'score' },
              },
            ],
          },
          {
            // A "Game Advisory" placeholder carries a real matchup.pitcher but is
            // never a batter faced — its pitch counts, the BF must not.
            about: { inning: 1, halfInning: 'top' },
            matchup: { pitcher: { id: 2 } },
            result: { type: 'atBat', eventType: 'game_advisory' },
            count: { outs: 1 },
            playEvents: [pitch()],
          },
        ],
      },
    },
  }
}

test('an inherited runner is charged to the responsible pitcher, not the reliever', () => {
  const home = computePitcherLines(inheritedRunnerFeed(), 5).home
  const ace = home.find((p) => p.id === 1)
  const bull = home.find((p) => p.id === 2)
  assert.equal(ace.r, 1) // the run scored while Bull pitched, charged back to Ace
  assert.equal(ace.er, 1)
  assert.equal(bull.r, 0)
})

test('a Game Advisory placeholder play never counts as a batter faced', () => {
  const bull = computePitcherLines(inheritedRunnerFeed(), 5).home.find((p) => p.id === 2)
  assert.equal(bull.bf, 1) // the field_out only; the advisory is excluded
  assert.equal(bull.pitches, 2) // but both pitches count
})
