// Which trips to the mound actually count against the club's allowance.
//
// MLB caps mound visits at five per club per nine innings (+1 per extra
// inning) — but "a manager or coach who visits the mound and removes the
// pitcher is not charged with a visit." statsapi logs that removal trip as a
// `mound_visit` playEvent all the same, immediately ahead of the
// `pitching_substitution` it produced: 66 of the 214 mound-visit events in a
// three-day sweep of the MLB slate (31%) were that trip, not a charged visit.
//
// Counting them charged isn't a rounding error, it's impossible: in that same
// sweep four club-games reached SIX visits against an allowance of five
// (gamePk 823843's home club showed 6 used where the rule-correct figure is
// 2). The pip row on the mound-visit card is the readout, so it was showing
// clubs out of visits they still had.
import assert from 'node:assert/strict'
import test from 'node:test'
import { moundVisitRemainings, moundVisitsAllowed } from '../src/api/playbyplay.js'

// One half-inning's worth of plays for the club fielding it. `events` is a
// compact script per play: 'P' a pitch, 'V' a mound visit, 'C' a pitching
// change — the same three the real walk cares about, in feed order.
function feedOf(scripts, { inning = 5, half = 'top' } = {}) {
  const play = (script) => ({
    about: { inning, halfInning: half },
    playEvents: [...script].map((ch) =>
      ch === 'P'
        ? { isPitch: true, details: { call: { code: 'B' } } }
        : { details: { eventType: ch === 'V' ? 'mound_visit' : 'pitching_substitution' } },
    ),
  })
  return { liveData: { plays: { allPlays: scripts.map(play) } } }
}

// top 5 → the AWAY club bats, so the HOME club is the one being charged.
const remainings = (scripts) => moundVisitRemainings(feedOf(scripts), 5, 'top', 'away')

test('a plain mound visit is charged', () => {
  assert.deepEqual(remainings(['PVP']), [moundVisitsAllowed(5) - 1])
})

test('the trip that removes the pitcher is not charged', () => {
  // Visit, then the change it produced: no visit is spent, so the card has no
  // usage to report and shows no pips at all — a pip row frozen at the same
  // number as the previous card would read as a stale figure, and one that
  // ticked down would be simply wrong.
  assert.deepEqual(remainings(['PVCP']), [null])
})

test('a visit he stayed in for is charged even if he is pulled later', () => {
  // Visit, a pitch (he stayed and threw), THEN the change — two separate
  // trips, and only the first one counts.
  assert.deepEqual(remainings(['PVPCP']), [moundVisitsAllowed(5) - 1])
})

test('the removal trip stops charging without stopping the count', () => {
  // Charged, uncharged, charged: the running "left" figure skips the middle
  // one rather than restarting, and every card still gets its own slot so the
  // caller's positional read (PlayByPlay walks the visits in order) holds.
  const allowed = moundVisitsAllowed(5)
  assert.deepEqual(remainings(['PVP', 'PVCP', 'PVP']), [allowed - 1, null, allowed - 2])
})

test('a removal trip that straddles into the next play is still uncharged', () => {
  // The feed nests a pitching change at the head of the plate appearance that
  // follows it, so a visit closing one play and the change opening the next is
  // the same trip. (Not observed in the sweep — every one was same-play — but
  // the walk must not depend on that.)
  assert.deepEqual(remainings(['PV', 'CP']), [null])
})

test('visits by the other club never touch this club’s tally', () => {
  const feed = feedOf(['PVP'], { inning: 5, half: 'top' })
  // Same feed read as the club batting in the top — that's the AWAY club's
  // defense, which never took the mound this half.
  assert.deepEqual(moundVisitRemainings(feed, 5, 'top', 'home'), [])
})

test('a trip left open at the end of an EARLIER half for this club still counts', () => {
  // Top 4 (home defends): a visit trails the half's only play with nothing
  // after it — no pitch, no pitching change, because the half simply ended.
  // That trip was real and must be charged, but the walk doesn't reach the
  // end of top 4 directly — it moves straight into bottom 4 (away defends,
  // skipped entirely for home's tally) and only comes back to processing a
  // home-defense play in top 5. A pending visit that survives that gap and
  // gets resolved by whatever top 5 happens to do first is being resolved by
  // the wrong trip.
  const feed = {
    liveData: {
      plays: {
        allPlays: [
          {
            about: { inning: 4, halfInning: 'top' },
            playEvents: [
              { isPitch: true, details: { call: { code: 'B' } } },
              { details: { eventType: 'mound_visit' } },
            ],
          },
          {
            about: { inning: 4, halfInning: 'bottom' },
            playEvents: [{ isPitch: true, details: { call: { code: 'B' } } }],
          },
          {
            // Top 5 opens with a fresh reliever — no visit preceded him. If
            // top 4's leftover trip is still "pending" here, this substitution
            // wrongly reads as the trip that produced it and un-charges it.
            about: { inning: 5, halfInning: 'top' },
            playEvents: [
              { details: { eventType: 'pitching_substitution' } },
              { isPitch: true, details: { call: { code: 'B' } } },
            ],
          },
          {
            // A genuine, fully-resolved visit in top 5 itself.
            about: { inning: 5, halfInning: 'top' },
            playEvents: [
              { isPitch: true, details: { call: { code: 'B' } } },
              { details: { eventType: 'mound_visit' } },
              { isPitch: true, details: { call: { code: 'B' } } },
            ],
          },
        ],
      },
    },
  }
  const allowed = moundVisitsAllowed(5)
  // Two visits charged by the time top 5's own trip resolves: top 4's
  // leftover (flushed at the half boundary) plus top 5's own — allowed - 2,
  // not allowed - 1 (which would mean top 4's trip was silently dropped).
  assert.deepEqual(moundVisitRemainings(feed, 5, 'top', 'away'), [allowed - 2])
})
