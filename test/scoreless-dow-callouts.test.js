import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildScorelessThroughNote,
  buildBothScorelessNote,
  buildDayOfWeekNote,
  buildStarterPitchPaceNote,
  buildScorelessHeldNotes,
  buildBothScorelessHeldNotes,
  buildDayOfWeekNotes,
  buildTtoPitchesNote,
  buildThirdTimeThroughNote,
  weekdayFromDate,
  gameWeekday,
} from '../src/api/callout-notes.js'

const BASE = {
  away: { teamId: 1, name: 'Away Club' },
  home: { teamId: 2, name: 'Home Club' },
  dayNight: 'night',
}

// A bundle with the three new team-record families for both clubs.
function bundleWith(records) {
  return {
    ...BASE,
    teamRecords: {
      away: records.away ?? {},
      home: records.home ?? {},
    },
  }
}

// --- scoreless-through (live, entering-tense) --------------------------------

test('scorelessThrough fires on a one-sided run-drought record', () => {
  const bundle = bundleWith({ away: { scorelessThroughFull: { 6: { w: 2, l: 15 } } } })
  const note = buildScorelessThroughNote(bundle, 'away', 6)
  assert.ok(note, 'expected a scorelessThrough note')
  assert.equal(note.text, 'The Away Club are 2-15 when scoreless through 6 innings')
  assert.equal(note.kind, 'scorelessThrough')
  assert.equal(note.side, 'away')
})

test('scorelessThrough stays quiet on a coin-flip record', () => {
  // 9-8 is nearly .500 — a scoreless-through-1 record means nothing.
  const bundle = bundleWith({ home: { scorelessThroughFull: { 1: { w: 9, l: 8 } } } })
  assert.equal(buildScorelessThroughNote(bundle, 'home', 1), null)
})

test('scorelessThrough reads "1 inning" singular at the first checkpoint', () => {
  const bundle = bundleWith({ away: { scorelessThroughFull: { 1: { w: 1, l: 12 } } } })
  const note = buildScorelessThroughNote(bundle, 'away', 1)
  assert.ok(note)
  assert.match(note.text, /when scoreless through 1 inning$/)
})

test('scorelessThrough is absent for a checkpoint the bundle never carried', () => {
  const bundle = bundleWith({ away: { scorelessThroughFull: { 6: { w: 2, l: 15 } } } })
  assert.equal(buildScorelessThroughNote(bundle, 'away', 5), null)
})

// --- both-scoreless (0-0 game, live) -----------------------------------------

test('bothScoreless fires for a pitchers-duel record with no lopsidedness floor', () => {
  const bundle = bundleWith({ home: { bothScorelessThroughFull: { 7: { w: 4, l: 3 } } } })
  const note = buildBothScorelessNote(bundle, 'home', 7)
  assert.ok(note, 'expected a bothScoreless note')
  assert.equal(note.text, 'The Home Club are 4-3 in games still 0-0 after the 7th')
  assert.equal(note.kind, 'bothScoreless')
  // Edges tiedAfter (base 40) so the more dramatic framing wins the strip cap.
  assert.ok(note.score >= 42)
})

// --- day-of-week -------------------------------------------------------------

test('dayOfWeek fires on a lopsided, well-sampled weekday', () => {
  const dow = weekdayFromDate('2026-07-19') // a Sunday
  const bundle = bundleWith({ away: { dayOfWeek: { [dow]: { w: 12, l: 4 } } } })
  const note = buildDayOfWeekNote(bundle, 'away', dow)
  assert.ok(note, 'expected a dayOfWeek note')
  assert.equal(note.text, 'The Away Club are 12-4 on Sundays this season')
  assert.equal(note.kind, 'dayOfWeek')
})

test('dayOfWeek stays quiet below the sample floor or when balanced', () => {
  const dow = weekdayFromDate('2026-07-19')
  const small = bundleWith({ away: { dayOfWeek: { [dow]: { w: 3, l: 2 } } } })
  assert.equal(buildDayOfWeekNote(small, 'away', dow), null, 'below DOW_MIN_GAMES')
  const flat = bundleWith({ away: { dayOfWeek: { [dow]: { w: 10, l: 9 } } } })
  assert.equal(buildDayOfWeekNote(flat, 'away', dow), null, 'not one-sided enough')
})

test('weekdayFromDate / gameWeekday agree and null-guard', () => {
  assert.equal(weekdayFromDate('2026-07-19'), 0) // Sunday
  assert.equal(weekdayFromDate('2026-07-20'), 1) // Monday
  assert.equal(weekdayFromDate(null), null)
  assert.equal(gameWeekday({ gameData: { datetime: { officialDate: '2026-07-20' } } }), 1)
  assert.equal(gameWeekday({}), null)
})

// --- starter pitch pace ------------------------------------------------------

// The home starter (pitches the TOP halves) has thrown tops 1-3; we're entering
// the top of the 4th. `pitchesThrough` fouls/balls all count as pitches.
function paceFeed({ pitcherIds, pitchesThrough }) {
  const plays = []
  for (let inn = 1; inn <= 3; inn++) {
    const pid = pitcherIds[Math.min(inn - 1, pitcherIds.length - 1)]
    // Spread the per-inning pitch total across a couple of PAs.
    plays.push({
      about: { inning: inn, halfInning: 'top' },
      matchup: { pitcher: { id: pid }, batter: { id: 10 + inn } },
      playEvents: Array.from({ length: pitchesThrough / 3 }, () => ({ isPitch: true })),
    })
  }
  return {
    gameData: { players: { ID77: { fullName: 'Freddy Peralta', lastName: 'Peralta' } } },
    liveData: { plays: { allPlays: plays } },
  }
}

function paceBundle(pace) {
  return { ...BASE, starterRecords: { 77: { pitchPace: pace } } }
}

test('pitchPace fires when tonight is well off the season norm', () => {
  const feed = paceFeed({ pitcherIds: [77], pitchesThrough: 63 })
  const bundle = paceBundle({ n: 3, avg: 48, starts: 12 })
  const note = buildStarterPitchPaceNote(feed, bundle, 4, 'top')
  assert.ok(note, 'expected a pitchPace note')
  assert.match(note.text, /Through 3 tonight, Peralta is at 63 pitches — he averages 48/)
  assert.equal(note.side, 'home') // the pitching side entering the top half
  assert.equal(note.personId, 77)
})

test('pitchPace stays quiet within the normal band', () => {
  const feed = paceFeed({ pitcherIds: [77], pitchesThrough: 51 }) // diff 3 < 12
  const bundle = paceBundle({ n: 3, avg: 48, starts: 12 })
  assert.equal(buildStarterPitchPaceNote(feed, bundle, 4, 'top'), null)
})

test('pitchPace stands down once a reliever has entered', () => {
  const feed = paceFeed({ pitcherIds: [77, 77, 99], pitchesThrough: 63 })
  const bundle = paceBundle({ n: 3, avg: 48, starts: 12 })
  assert.equal(buildStarterPitchPaceNote(feed, bundle, 4, 'top'), null)
})

test('pitchPace only fires entering the half right after the Nth inning', () => {
  const feed = paceFeed({ pitcherIds: [77], pitchesThrough: 63 })
  const bundle = paceBundle({ n: 3, avg: 48, starts: 12 })
  assert.equal(buildStarterPitchPaceNote(feed, bundle, 3, 'top'), null) // entering top 3, not 4
})

// --- box-score roll-up (folded) ----------------------------------------------

// A finished game: the away club was shut out (0 through 9), home won 3-0.
function shutoutFinalFeed() {
  const innings = []
  for (let n = 1; n <= 9; n++) {
    innings.push({ num: n, away: { runs: 0 }, home: { runs: n === 3 || n === 5 || n === 7 ? 1 : 0 } })
  }
  return {
    gameData: {
      status: { abstractGameState: 'Final' },
      datetime: { officialDate: '2026-07-19', dayNight: 'night' },
    },
    liveData: {
      plays: { allPlays: [] },
      linescore: { innings, teams: { away: { runs: 0 }, home: { runs: 3 } } },
    },
  }
}

test('scorelessHeld folds tonight into the shut-out club’s record', () => {
  const feed = shutoutFinalFeed()
  const bundle = bundleWith({ away: { scorelessThroughFull: { 6: { w: 2, l: 15 } } } })
  const notes = buildScorelessHeldNotes(feed, { ...bundle, dayNight: 'night' }, {
    final: true,
    winnerSide: 'home',
  })
  assert.equal(notes.length, 1, 'only the shut-out away club')
  assert.equal(notes[0].side, 'away')
  assert.match(notes[0].text, /Away Club dropped to 2-16 when scoreless through 6 innings/)
})

// A finished game still 0-0 through 5, away scored in the 6th and won 1-0.
function duelFinalFeed() {
  const innings = []
  for (let n = 1; n <= 9; n++) {
    innings.push({ num: n, away: { runs: n === 6 ? 1 : 0 }, home: { runs: 0 } })
  }
  return {
    gameData: {
      status: { abstractGameState: 'Final' },
      datetime: { officialDate: '2026-07-19' },
    },
    liveData: {
      plays: { allPlays: [] },
      linescore: { innings, teams: { away: { runs: 1 }, home: { runs: 0 } } },
    },
  }
}

test('bothScorelessHeld folds tonight into both clubs at the deepest 0-0 checkpoint', () => {
  const feed = duelFinalFeed()
  const bundle = bundleWith({
    away: { bothScorelessThroughFull: { 5: { w: 3, l: 2 } } },
    home: { bothScorelessThroughFull: { 5: { w: 4, l: 4 } } },
  })
  const notes = buildBothScorelessHeldNotes(feed, bundle, { final: true, winnerSide: 'away' })
  assert.equal(notes.length, 2)
  const away = notes.find((n) => n.side === 'away')
  const home = notes.find((n) => n.side === 'home')
  assert.match(away.text, /Away Club/)
  assert.match(away.text, /4-2|moved to/) // winner's record moved up
  assert.match(home.text, /Home Club/)
  assert.match(home.text, /dropped to 4-5/)
})

test('dayOfWeek roll-up folds tonight in for a lopsided weekday', () => {
  const feed = duelFinalFeed() // officialDate 2026-07-19, Sunday
  const dow = weekdayFromDate('2026-07-19')
  const bundle = bundleWith({ away: { dayOfWeek: { [dow]: { w: 11, l: 3 } } } })
  const notes = buildDayOfWeekNotes(feed, bundle, { final: true, winnerSide: 'away' })
  const away = notes.find((n) => n.side === 'away')
  assert.ok(away, 'expected an away dayOfWeek note')
  assert.match(away.text, /on Sundays/)
})

// --- pitches-per-PA by times-through-the-order (ttoPitches) -------------------

// The away side (home pitcher 77 on the mound) faces him across `priorInnings`
// tops; batter 10 leads off each, then leads off the staged top half too — so
// entering the staged inning his trip = priorInnings + 1.
function tripFeed({ priorInnings, stagedInning, pid = 77 }) {
  const plays = []
  for (let inn = 1; inn <= priorInnings; inn++) {
    for (const b of [10, 11, 12]) {
      plays.push({
        about: { inning: inn, halfInning: 'top', atBatIndex: inn * 10 + b },
        result: { eventType: 'field_out' },
        matchup: { batter: { id: b }, pitcher: { id: pid } },
        playEvents: [],
      })
    }
  }
  plays.push({
    about: { inning: stagedInning, halfInning: 'top', atBatIndex: stagedInning * 100 },
    result: { eventType: 'strikeout' },
    matchup: { batter: { id: 10 }, pitcher: { id: pid } },
    playEvents: [],
  })
  return {
    gameData: { players: { [`ID${pid}`]: { lastName: 'Peralta', fullName: 'Freddy Peralta' } } },
    liveData: { plays: { allPlays: plays } },
  }
}
const ttoBundle = (tto) => ({ ...BASE, starterRecords: { 77: { tto } } })

test('ttoPitches fires entering the 2nd trip with the full escalation', () => {
  const feed = tripFeed({ priorInnings: 1, stagedInning: 2 })
  const bundle = ttoBundle({
    1: { pa: 60, ppa: 3.8 },
    2: { pa: 55, ppa: 4.6 },
    3: { pa: 42, ppa: 5.3 },
  })
  const note = buildTtoPitchesNote(feed, bundle, 2, 'top')
  assert.ok(note, 'expected a ttoPitches note')
  assert.equal(
    note.text,
    'Batters make Peralta work more each time through this season — 3.8 pitches per PA the 1st time through, 4.6 the 2nd, 5.3 the 3rd',
  )
  assert.equal(note.side, 'home')
  assert.equal(note.personId, 77)
})

test('ttoPitches stays quiet without a real per-PA climb', () => {
  const feed = tripFeed({ priorInnings: 1, stagedInning: 2 })
  const bundle = ttoBundle({ 1: { pa: 60, ppa: 4.0 }, 2: { pa: 55, ppa: 4.2 } }) // step 0.2 < 0.4
  assert.equal(buildTtoPitchesNote(feed, bundle, 2, 'top'), null)
})

test('ttoPitches drops the 3rd trip when the pace stops climbing', () => {
  const feed = tripFeed({ priorInnings: 1, stagedInning: 2 })
  const bundle = ttoBundle({
    1: { pa: 60, ppa: 3.8 },
    2: { pa: 55, ppa: 4.6 },
    3: { pa: 42, ppa: 4.4 }, // dips — not part of the "wear him down" line
  })
  const note = buildTtoPitchesNote(feed, bundle, 2, 'top')
  assert.ok(note)
  assert.match(note.text, /4\.6 the 2nd$/)
  assert.doesNotMatch(note.text, /the 3rd/)
})

test('ttoPitches only fires entering the 2nd trip, not the 3rd', () => {
  const feed = tripFeed({ priorInnings: 2, stagedInning: 3 }) // trip === 3 here
  const bundle = ttoBundle({ 1: { pa: 60, ppa: 3.8 }, 2: { pa: 55, ppa: 4.6 } })
  assert.equal(buildTtoPitchesNote(feed, bundle, 3, 'top'), null)
})

// Regression lock on the shared trip-detection refactor: the 3rd-time AVG card
// still fires on a genuine 3rd trip and stays quiet on a 2nd.
test('buildThirdTimeThroughNote still fires on a real 3rd trip', () => {
  const feed = tripFeed({ priorInnings: 2, stagedInning: 3 })
  const bundle = ttoBundle({
    1: { pa: 200, ab: 190, avg: '.242', ppa: 3.8 },
    3: { pa: 70, ab: 60, avg: '.310', ppa: 5.0 },
  })
  const note = buildThirdTimeThroughNote(feed, bundle, 3, 'top')
  assert.ok(note, 'expected a tto note')
  assert.equal(note.kind, 'tto')
  assert.match(note.text, /a 3rd time this inning/)
  assert.match(note.text, /\.310 off him the 3rd time through/)
})

test('buildThirdTimeThroughNote stays quiet entering only the 2nd trip', () => {
  const feed = tripFeed({ priorInnings: 1, stagedInning: 2 })
  const bundle = ttoBundle({ 1: { pa: 60, avg: '.242' }, 3: { pa: 40, avg: '.310', ab: 40 } })
  assert.equal(buildThirdTimeThroughNote(feed, bundle, 2, 'top'), null)
})
