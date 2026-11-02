// PINS TODAY'S `composeLive` (#2747, row 1a). No product code changes here; row 1b lifts
// composeLive into src/api/gameday/engine/engineLive.js and these values must pass UNCHANGED.
//
// Row 1a copied HalfInning's composeLive closure here; row 1b points `compose` at the lifted module.
// The expected values are literals read off the behaviour before the lift. They pin, from the old
// src/components/inning/HalfInning.jsx:
//   :200-206  the entering baseline's inputs (nowPitching, enteringPitches)
//   :257-264  battingLineFor (computeBatterLine, else preGameAvg)
//   :265-333  composeLive: batter (batterDone advance, not while windowed), pitcher (mid-half change,
//             else nowPitching + entering pitches), bases/outs, the 3rd-out branch (liveAtThirdOut)
//   :342-346  the entering call, composeLive(null), before the first step
// The live input is what PlayByPlay.jsx:225-233 reports: deriveLiveState(entries, cap).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { selectHalfStartingPitcher, halfIndex } from '../src/api/select.js'
import { computePitcherLines } from '../src/api/pitchers.js'
import { computeHalfInningFeed, deriveLiveState } from '../src/api/playbyplay.js'
import { composeLive, enteringPitchesFor } from '../src/api/gameday/engine/engineLive.js'

const load = (pk) => JSON.parse(readFileSync(new URL(`./fixtures/game-${pk}.gameday.json`, import.meta.url), 'utf8'))

// `live` null is the entering state; otherwise a cap into the half. The mark is the half before it,
// which is what a half being stepped through sits on (HalfInning's own reachability note, :207-215).
function compose(feed, inning, half, cap, windowed) {
  const battingSide = half === 'top' ? 'away' : 'home'
  const revealedThrough = halfIndex(inning, half) - 1
  const live = cap == null ? null : deriveLiveState(computeHalfInningFeed(feed, inning, half, battingSide, cap), cap)
  const nowPitching = selectHalfStartingPitcher(feed, inning, half, revealedThrough)
  const enteringPitches = enteringPitchesFor(computePitcherLines(feed, halfIndex(inning, half) - 1), nowPitching)
  return composeLive(live, { feed, inning, half, battingSide, revealedThrough, windowed, nowPitching, enteringPitches })
}

// `last` is a whole card; the pin is which at-bat it is.
const view = (r) => ({ ...r, last: r.last?.atBatIndex ?? null })

const CASES = [
  ['entering: live null, the leadoff man is due up (HalfInning.jsx:342)', 824716, 1, 'top', null, false],
  ['mid at-bat (interrupted, batterDone false): the same batter stays up, not windowed', 816025, 2, 'top', 1, false],
  ['mid at-bat: the same batter stays up, windowed', 816025, 2, 'top', 1, true],
  ['batter done, not windowed: the band advances to the next slot', 824716, 2, 'top', 2, false],
  ['batter done, windowed: the band keeps the finished batter', 824716, 2, 'top', 2, true],
  ['mid-half pitching change: the reliever, his own count since entering', 824716, 7, 'bottom', 9, false],
  ['3rd out, not windowed: liveAtThirdOut (HalfInning.jsx:332)', 824716, 1, 'top', 4, false],
  ['3rd out, windowed: liveAtThirdOut keeps the finished batter', 824716, 1, 'top', 4, true],
]
const EXPECTED = {
  'entering: live null, the leadoff man is due up (HalfInning.jsx:342)':
    {"bases": {"first": false, "second": false, "third": false}, "outs": 0, "batter": {"order": 1, "last": "Arozarena", "line": ".---"}, "pitcher": {"last": "Jedixson Paez", "pitches": 0}, "inning": 1, "half": "top", "last": null, "midHalfPitcherId": null},
  'mid at-bat (interrupted, batterDone false): the same batter stays up, not windowed':
    {"bases": {"first": false, "second": false, "third": false}, "outs": 0, "batter": {"order": 4, "last": "Wisely", "line": ".---"}, "pitcher": {"last": "Juaron Watts-Brown", "pitches": 20}, "inning": 2, "half": "top", "last": null, "midHalfPitcherId": null},
  'mid at-bat: the same batter stays up, windowed':
    {"bases": {"first": false, "second": false, "third": false}, "outs": 0, "batter": {"order": 4, "last": "Wisely", "line": ".---"}, "pitcher": {"last": "Juaron Watts-Brown", "pitches": 20}, "inning": 2, "half": "top", "last": null, "midHalfPitcherId": null},
  'batter done, not windowed: the band advances to the next slot':
    {"bases": {"first": true, "second": false, "third": true}, "outs": 0, "batter": {"order": 7, "last": "Montes", "line": ".---"}, "pitcher": {"last": "Jedixson Paez", "pitches": 16}, "inning": 2, "half": "top", "last": 9, "midHalfPitcherId": null},
  'batter done, windowed: the band keeps the finished batter':
    {"bases": {"first": true, "second": false, "third": true}, "outs": 0, "batter": {"order": 6, "last": "Young", "line": ".---"}, "pitcher": {"last": "Jedixson Paez", "pitches": 16}, "inning": 2, "half": "top", "last": 9, "midHalfPitcherId": null},
  'mid-half pitching change: the reliever, his own count since entering':
    {"bases": {"first": false, "second": true, "third": false}, "outs": 2, "batter": {"order": 4, "last": "Abreu", "line": "2-3"}, "pitcher": {"last": "Ferrer", "pitches": 0}, "inning": 7, "half": "bottom", "last": 67, "midHalfPitcherId": 678606},
  '3rd out, not windowed: liveAtThirdOut (HalfInning.jsx:332)':
    {"bases": {"first": false, "second": false, "third": false}, "outs": 0, "batter": {"order": 4, "last": "Raleigh", "line": ".---"}, "pitcher": {"last": "Jedixson Paez", "pitches": 11}, "over": true, "inning": 1, "half": "bottom", "last": 3, "midHalfPitcherId": null},
  '3rd out, windowed: liveAtThirdOut keeps the finished batter':
    {"bases": {"first": false, "second": false, "third": false}, "outs": 0, "batter": {"order": 4, "last": "Raleigh", "line": ".---"}, "pitcher": {"last": "Jedixson Paez", "pitches": 11}, "over": true, "inning": 1, "half": "bottom", "last": 3, "midHalfPitcherId": null},
}

for (const [name, pk, inning, half, cap, windowed] of CASES) {
  test(name, () => {
    assert.deepEqual(view(compose(load(pk), inning, half, cap, windowed)), EXPECTED[name])
  })
}
