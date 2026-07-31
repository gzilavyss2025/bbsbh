// computeBatterLine (src/api/boxscore.js) — the scorebug's "H-AB this game"
// line, walked from allPlays and capped to revealedThrough. This exists
// because feed.liveData.boxscore...stats.batting is the TRUE, always-live
// line: reading it directly for a HUD visible well before the box score's
// own SealBox would show a batter's actual, unrevealed at-bats (e.g. a
// leadoff batter reading "0-5" before his first plate appearance of the
// night ever gets revealed). This must never reflect a play beyond the cap.
import assert from 'node:assert/strict'
import test from 'node:test'
import { computeBatterLine } from '../src/api/boxscore.js'

function play(inning, halfInning, batterId, eventType, type = 'atBat') {
  return { about: { inning, halfInning }, matchup: { batter: { id: batterId } }, result: { type, eventType } }
}

test('never reflects a play beyond the cap — the exact reported bug', () => {
  // Batter 1 has gone 2-for-4 by the 3rd inning of the REAL live feed, but
  // the user has revealed nothing yet (revealedThrough = -1, before the
  // game's first half). He must read as a clean 0-for-0, not his real line.
  const feed = {
    liveData: {
      plays: {
        allPlays: [
          play(1, 'top', 1, 'single'),
          play(2, 'top', 1, 'strikeout'),
          play(3, 'top', 1, 'double'),
          play(3, 'top', 1, 'flyout'),
        ],
      },
    },
  }
  assert.deepEqual(computeBatterLine(feed, 1, -1), { hits: 0, atBats: 0 })
})

test('counts only plays through the revealed half, not later ones', () => {
  const feed = {
    liveData: {
      plays: {
        allPlays: [
          play(1, 'top', 1, 'single'), // halfIndex 0
          play(1, 'bottom', 9, 'flyout'), // halfIndex 1 — other team, irrelevant
          play(2, 'top', 1, 'double'), // halfIndex 2 — beyond the cap
        ],
      },
    },
  }
  assert.deepEqual(computeBatterLine(feed, 1, 0), { hits: 1, atBats: 1 })
})

test('walks, HBP, and sacrifices are plate appearances but not at-bats', () => {
  const feed = {
    liveData: {
      plays: {
        allPlays: [
          play(1, 'top', 1, 'walk'),
          play(1, 'top', 1, 'hit_by_pitch'),
          play(1, 'top', 1, 'sac_fly'),
          play(1, 'top', 1, 'single'),
        ],
      },
    },
  }
  assert.deepEqual(computeBatterLine(feed, 1, 5), { hits: 1, atBats: 1 })
})

test('ignores another batter\'s plays entirely', () => {
  const feed = {
    liveData: {
      plays: {
        allPlays: [play(1, 'top', 1, 'single'), play(1, 'top', 2, 'home_run')],
      },
    },
  }
  assert.deepEqual(computeBatterLine(feed, 2, 5), { hits: 1, atBats: 1 })
})
