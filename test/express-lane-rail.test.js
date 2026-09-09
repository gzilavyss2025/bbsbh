// Express Lane Tier 1 — the scoring rail (src/api/expresslane/rail.js).
//
// Two bodies of data, on purpose.
//
// THE CAPTURED REAL GAME (gamePk 823035, the same trimmed feed the spoiler
// invariant is pinned on) proves the shape against unedited MLB output: the
// paperwork rows that carry no clip, the lifecycle advisories that lead every
// game, the pickoff and the pitch-timer violation that are not pitches, and
// the plate-appearance anchor across the whole game.
//
// That capture was field-trimmed before `playId` mattered to anything, so it
// carries none. Rather than re-fetch it — and change a fixture four other test
// files read — these tests STAMP synthetic playIds onto exactly the events a
// real MLB feed from 2016 on carries one for: every pitch, plus the pickoffs,
// step-offs and pitch-timer violations MLB also cuts a clip for. The structure
// under test is real; only the UUIDs are made up. The un-stamped feed is then
// used as it stands, because a feed with no playId anywhere IS the MiLB and
// pre-2016 case.
//
// SMALL SYNTHETIC FEEDS cover the three documented fallbacks and the row
// shape. Not one of the fallbacks fired across 570 plate appearances in 7 real
// games, so no capture can exercise them.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { buildRail, resultModeRows, fullModeRows, RAIL_KINDS } from '../src/api/expresslane/rail.js'
import { halfIndex } from '../src/api/select.js'

const RAW = JSON.parse(
  readFileSync(new URL('./fixtures/game-823035.trimmed.json', import.meta.url), 'utf8'),
)

// The event types MLB cuts a clip for, beyond the pitches themselves — the
// measured set over 7 games: pickoff attempts, pitcher step-offs, and the
// automatic ball/strike a pitch-timer violation awards.
const CLIPPED_NON_PITCH = new Set(['pickoff', 'stepoff', 'no_pitch'])

// The captured feed with a synthetic playId on every event a real feed would
// carry one for. Deterministic, so a failure names the same row every run.
function stamped() {
  const feed = structuredClone(RAW)
  let n = 0
  for (const play of feed.liveData.plays.allPlays) {
    for (const event of play.playEvents ?? []) {
      if (event.isPitch || CLIPPED_NON_PITCH.has(event.type)) {
        n += 1
        event.playId = `play-${String(n).padStart(4, '0')}-uuid`
      }
    }
  }
  return feed
}

const FEED = stamped()

// Every half-inning the captured game actually played, as (inning, half) pairs.
function playedHalves(feed) {
  const seen = new Map()
  for (const play of feed.liveData.plays.allPlays) {
    const key = `${play.about.inning}:${play.about.halfInning}`
    if (!seen.has(key)) seen.set(key, [play.about.inning, play.about.halfInning])
  }
  return [...seen.values()]
}

const playsIn = (feed, inning, half) =>
  feed.liveData.plays.allPlays.filter(
    (p) => p.about.inning === inning && p.about.halfInning === half,
  )

test('the rail carries every event of a half, in feed order', () => {
  const rows = buildRail(FEED, 8, 'top')
  const events = playsIn(FEED, 8, 'top').flatMap((p) => p.playEvents ?? [])
  // Only the lifecycle advisories are dropped, and the top of the 8th has none.
  assert.equal(rows.length, events.length)
  assert.deepEqual(
    rows.map((r) => r.description),
    events.map((e) => e.details?.description ?? ''),
  )
})

test('rows with no playId survive into the rail — the paperwork a scorer writes', () => {
  const rows = buildRail(FEED, 8, 'top')
  const paperwork = rows.filter((r) => r.kind === 'action')
  // The captured half opens with two defensive switches, a pitching change, a
  // fielder staying in at a new position and a defensive substitution. MLB
  // clips none of them, and a scorer writes all five.
  assert.deepEqual(paperwork.map((r) => r.description), [
    'Defensive switch from third base to first base for Blaze Jordan.',
    'Defensive switch from left field to third base for José Fermín.',
    'Pitching Change: Bryan Torres replaces Gordon Graceffo, batting 5th, replacing first baseman Alec Burleson.',
    'Nelson Velázquez remains in the game as the left fielder.',
    'Defensive Substitution: Jimmy Crooks replaces catcher Iván Herrera, batting 2nd, playing catcher.',
  ])
  for (const row of paperwork) {
    assert.equal(row.playId, null)
    assert.equal(row.kind, 'action')
    assert.match(row.key, /^\d+:\d+$/)
  }
})

test('a mound visit and a pitching change both reach the rail', () => {
  const rows = buildRail(FEED, 6, 'top')
  const said = rows.map((r) => r.description)
  assert.ok(said.some((d) => d.startsWith('Mound Visit')))
  assert.ok(said.some((d) => d.startsWith('Pitching Change:')))
})

test('the lifecycle advisories that lead every game are dropped', () => {
  const rows = buildRail(FEED, 1, 'top')
  const events = playsIn(FEED, 1, 'top').flatMap((p) => p.playEvents ?? [])
  const lifecycle = events.filter((e) => /^Status Change/.test(e.details?.description ?? ''))
  assert.equal(lifecycle.length, 3, 'the capture really does carry three of them')
  assert.equal(rows.length, events.length - 3)
  assert.equal(
    rows.filter((r) => /^Status Change/.test(r.description)).length,
    0,
  )
})

test('the terminal row is the last clip-bearing pitch of the plate appearance', () => {
  for (const [inning, half] of playedHalves(FEED)) {
    const rows = buildRail(FEED, inning, half)
    for (const play of playsIn(FEED, inning, half)) {
      const mine = rows.filter((r) => r.atBatIndex === play.about.atBatIndex)
      const terminal = mine.filter((r) => r.isTerminal)
      assert.equal(terminal.length, 1, `one terminal row for PA ${play.about.atBatIndex}`)
      const pitches = (play.playEvents ?? []).filter((e) => e.isPitch && e.playId)
      assert.equal(terminal[0].playId, pitches[pitches.length - 1].playId)
    }
  }
})

test('every plate appearance in the captured game ends on a clip-bearing pitch', () => {
  // The anchor the PRD measured at 570 of 570 across 7 games, re-proved here on
  // an eighth. If this ever fails, one of the fallbacks below is now live code
  // rather than insurance.
  let checked = 0
  for (const [inning, half] of playedHalves(FEED)) {
    for (const row of buildRail(FEED, inning, half)) {
      if (!row.isTerminal) continue
      assert.equal(row.kind, 'pitch')
      assert.ok(row.playId)
      checked += 1
    }
  }
  assert.equal(checked, 78, 'every plate appearance in the capture')
})

test('a pitch-timer violation is a clipped non-pitch and still moves the count', () => {
  // Plate appearance 43 opens on an Automatic Ball the feed flags
  // `isPitch: false` and spends no pitch number on.
  const rows = buildRail(FEED, 6, 'top').filter((r) => r.atBatIndex === 43)
  const auto = rows[0]
  assert.equal(auto.description, 'Automatic Ball - Pitcher Pitch Timer Violation')
  assert.equal(auto.kind, 'nonPitchClipped')
  assert.ok(auto.playId)
  assert.equal(auto.pitch.callCode, 'VP')
  assert.equal(auto.pitch.dot, 'ball')
  assert.deepEqual(auto.count, { balls: 1, strikes: 0 })
})

test('a pickoff and a step-off carry no call, so they draw no pitch dot', () => {
  // `details.code` on both is a code that is NOT a call code ('1', 'PSO').
  // Reading it as one would draw a ball for a throw to first.
  const pickoff = buildRail(FEED, 7, 'top')
    .filter((r) => r.atBatIndex === 52)
    .find((r) => r.description === 'Pickoff Attempt 1B')
  assert.equal(pickoff.kind, 'nonPitchClipped')
  assert.equal(pickoff.pitch, null)

  const stepOff = buildRail(FEED, 7, 'top')
    .filter((r) => r.atBatIndex === 57)
    .find((r) => r.description === 'Pitcher Step Off')
  assert.equal(stepOff.kind, 'nonPitchClipped')
  assert.equal(stepOff.pitch, null)
})

test('a pitch row carries its call, dot, velocity and type', () => {
  const first = buildRail(FEED, 1, 'top').find((r) => r.kind === 'pitch')
  assert.equal(first.pitch.callCode, 'C')
  assert.equal(first.pitch.dot, 'called')
  assert.equal(first.pitch.mph, 95.4)
  assert.equal(first.pitch.type, 'Four-Seam Fastball')
  assert.deepEqual(first.count, { balls: 0, strikes: 1 })
})

test('the count carries balls and strikes only — an out is a result', () => {
  for (const row of buildRail(FEED, 1, 'top')) {
    assert.deepEqual(Object.keys(row.count).sort(), ['balls', 'strikes'])
  }
})

test('halfIndex is the app-wide seal unit', () => {
  for (const [inning, half] of playedHalves(FEED)) {
    for (const row of buildRail(FEED, inning, half)) {
      assert.equal(row.halfIndex, halfIndex(inning, half))
    }
  }
})

test('the play result rides on the terminal row and nowhere else', () => {
  const rows = buildRail(FEED, 1, 'top').filter((r) => r.atBatIndex === 0)
  const terminal = rows.find((r) => r.isTerminal)
  assert.equal(terminal.result.eventType, 'field_out')
  assert.equal(
    terminal.result.description,
    'Christian Yelich grounds out, shortstop Masyn Winn to first baseman Alec Burleson.',
  )
  assert.equal(terminal.result.isOut, true)
  assert.equal(terminal.result.rbi, 0)
  for (const row of rows) {
    if (row !== terminal) assert.equal(row.result, null)
  }
})

test('every row key is unique within a half, and is the playId when there is one', () => {
  for (const [inning, half] of playedHalves(FEED)) {
    const rows = buildRail(FEED, inning, half)
    const keys = rows.map((r) => r.key)
    assert.equal(new Set(keys).size, keys.length)
    for (const row of rows) {
      if (row.playId) assert.equal(row.key, row.playId)
      else assert.equal(row.key, `${row.atBatIndex}:${row.eventIndex}`)
    }
  }
})

test('every kind is one of the three the modes filter on, and matches its playId', () => {
  for (const [inning, half] of playedHalves(FEED)) {
    for (const row of buildRail(FEED, inning, half)) {
      assert.ok(RAIL_KINDS.includes(row.kind))
      // 'action' is exactly "no clip exists"; the other two both carry one here.
      assert.equal(row.kind === 'action', row.playId === null)
      if (row.kind === 'pitch') assert.ok(row.pitch, 'a pitch always carries its call')
    }
  }
})

// --- the two mode filters -------------------------------------------------

test('Result mode keeps one row per plate appearance, plus the paperwork', () => {
  const rows = buildRail(FEED, 8, 'top')
  const result = resultModeRows(rows)
  assert.equal(result.filter((r) => r.isTerminal).length, 4, 'four plate appearances')
  assert.equal(result.filter((r) => r.kind === 'action').length, 5, 'five pieces of paperwork')
  assert.equal(result.length, 9)
  // No mid-count pitch survives.
  assert.equal(result.filter((r) => r.kind === 'pitch' && !r.isTerminal).length, 0)
  // Order is the rail's own order.
  assert.deepEqual(
    result.map((r) => r.key),
    rows.filter((r) => r.isTerminal || r.kind === 'action').map((r) => r.key),
  )
})

test('Full mode drops nothing, including a pitch with no clip', () => {
  const rows = buildRail(FEED, 8, 'top')
  assert.deepEqual(
    fullModeRows(rows).map((r) => r.key),
    rows.map((r) => r.key),
  )
  // A feed with no playId anywhere is the MiLB / pre-2016 case, and Full mode
  // must still hand back a scorable rail rather than an empty screen.
  const bare = buildRail(RAW, 8, 'top')
  assert.ok(bare.length > 0)
  assert.equal(fullModeRows(bare).length, bare.length)
  assert.equal(
    bare.filter((r) => r.playId).length,
    0,
    'the un-stamped capture really does carry no playId',
  )
})

test('both filters tolerate a missing rail', () => {
  assert.deepEqual(resultModeRows(null), [])
  assert.deepEqual(fullModeRows(undefined), [])
})

// --- degradation ----------------------------------------------------------

test('a feed with no clips still marks a terminal row for every plate appearance', () => {
  // Fallback 2: the last pitch, clip or no clip. This is what MiLB and any
  // game before 2016 gets — the notation still has to be written.
  for (const [inning, half] of playedHalves(RAW)) {
    const rows = buildRail(RAW, inning, half)
    for (const play of playsIn(RAW, inning, half)) {
      const mine = rows.filter((r) => r.atBatIndex === play.about.atBatIndex)
      const terminal = mine.filter((r) => r.isTerminal)
      assert.equal(terminal.length, 1)
      assert.equal(terminal[0].playId, null)
      assert.equal(terminal[0].kind, 'pitch')
    }
  }
})

test('a missing feed, an empty feed and an unplayed inning all give an empty rail', () => {
  assert.deepEqual(buildRail(null, 1, 'top'), [])
  assert.deepEqual(buildRail({}, 1, 'top'), [])
  assert.deepEqual(buildRail({ liveData: { plays: {} } }, 1, 'top'), [])
  assert.deepEqual(buildRail(FEED, 14, 'bottom'), [])
})

// --- the fallbacks that never fired ---------------------------------------

const play = (about, result, playEvents) => ({
  liveData: { plays: { allPlays: [{ about: { inning: 1, halfInning: 'top', ...about }, result, playEvents }] } },
})

test('fallback 1: a plate appearance ending on a pickoff anchors on the pickoff', () => {
  const feed = play(
    { atBatIndex: 4 },
    { type: 'atBat', eventType: 'pickoff_1b', event: 'Pickoff 1B', description: 'Picked off.' },
    [
      { isPitch: true, index: 0, type: 'pitch', details: { call: { code: 'B' }, description: 'Ball' }, count: { balls: 1, strikes: 0 } },
      { index: 1, type: 'pickoff', playId: 'pk-1', details: { code: '1', description: 'Pickoff Attempt 1B' }, count: { balls: 1, strikes: 0 } },
    ],
  )
  const rows = buildRail(feed, 1, 'top')
  assert.equal(rows.length, 2)
  assert.equal(rows[0].isTerminal, false)
  assert.equal(rows[1].isTerminal, true)
  assert.equal(rows[1].playId, 'pk-1')
  assert.equal(rows[1].kind, 'nonPitchClipped')
})

test('fallback 3: a play with no pitch and no clip has no terminal row', () => {
  const feed = play(
    { atBatIndex: 7 },
    { type: 'atBat', eventType: 'game_advisory' },
    [{ index: 0, type: 'action', details: { eventType: 'mound_visit', description: 'Mound Visit' }, count: { balls: 0, strikes: 0 } }],
  )
  const rows = buildRail(feed, 1, 'top')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].isTerminal, false)
  assert.equal(rows[0].result, null)
  assert.equal(rows[0].kind, 'action')
})

test('a top-level baserunning play carries its own result — the scorer writes it', () => {
  const feed = play(
    { atBatIndex: 9 },
    {
      type: 'atBat',
      eventType: 'caught_stealing_2b',
      event: 'Caught Stealing 2B',
      description: 'Sal Frelick caught stealing 2nd base.',
      isOut: true,
      rbi: 0,
    },
    [
      { isPitch: true, index: 0, playId: 'p-1', type: 'pitch', details: { call: { code: 'B' }, description: 'Ball' }, count: { balls: 1, strikes: 0 } },
      { index: 1, type: 'action', details: { eventType: 'caught_stealing_2b', description: 'Sal Frelick caught stealing 2nd base.' }, count: { balls: 1, strikes: 0 } },
    ],
  )
  const rows = buildRail(feed, 1, 'top')
  assert.equal(rows[0].isTerminal, true)
  assert.equal(rows[0].result.eventType, 'caught_stealing_2b')
  // The steal itself has no clip of its own — the pitch it happened on shows
  // it — but it still gets a row.
  assert.equal(rows[1].kind, 'action')
  assert.equal(rows[1].playId, null)
})

test('a game_advisory placeholder play carries no result at all', () => {
  const feed = play(
    { atBatIndex: 0 },
    { type: 'atBat', eventType: 'game_advisory', event: 'Game Advisory', description: 'Status Change - In Progress' },
    [
      { index: 0, type: 'action', details: { eventType: 'game_advisory', description: 'Injury Delay.' }, count: { balls: 0, strikes: 0 } },
      { isPitch: true, index: 1, playId: 'p-9', type: 'pitch', details: { call: { code: 'C' }, description: 'Called Strike' }, count: { balls: 0, strikes: 1 } },
    ],
  )
  const rows = buildRail(feed, 1, 'top')
  // The in-game delay stays; only the lifecycle lines are dropped.
  assert.equal(rows.length, 2)
  assert.equal(rows[0].description, 'Injury Delay.')
  assert.equal(rows[1].isTerminal, true)
  assert.equal(rows[1].result, null)
})

test('a play with no atBatIndex still keys uniquely', () => {
  const feed = play(
    {},
    { type: 'atBat', eventType: 'strikeout' },
    [{ index: 0, type: 'action', details: { eventType: 'mound_visit', description: 'Mound Visit' }, count: {} }],
  )
  const rows = buildRail(feed, 1, 'top')
  assert.equal(rows[0].key, '0:0')
  assert.deepEqual(rows[0].count, { balls: null, strikes: null })
})
