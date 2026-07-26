// The extra-innings placed runner ("automatic runner") gets a card of his own.
//
// The feed posts his placement as a `runner_placed` playEvent nested inside
// the half's FIRST plate appearance — no play of its own, no pitches, no plate
// appearance. Before the fix pinned here he got only a grey sub-line under the
// leadoff batter's prose and NO card, which meant he never entered
// `originIndex` — so the advancement bookkeeping had nowhere to write his legs
// and silently discarded them. Three things fell out of that:
//
//   1. No diamond: taking 3rd, scoring, or being thrown out left no mark.
//   2. The stepped run tally undercounted. PlayByPlay's onRunsSoFar sums one
//      scoring runner per HIS OWN card; with no card, his run vanished.
//   3. A pinch runner FOR him resolved to no card (prAlias bails on a null
//      origin), so that swap left no trace either.
//
// The fixture mirrors the real half this was found on, field for field:
// gamePk 777747 (2025-05-27 BOS@MIL), bottom 10 — Joey Ortiz placed at 2nd,
// Brice Turang singles (Ortiz to 3rd), Jackson Chourio walks (Turang to 2nd on
// defensive indifference), William Contreras flies out, Christian Yelich hits
// a walk-off grand slam. Four runs, and the placed runner's is one of them —
// and per the official-scoring rule his alone rides `earned: false`, exactly
// as the live feed sends it.
import assert from 'node:assert/strict'
import test from 'node:test'
import { computeHalfInningFeed, nextStepBoundary } from '../src/api/playbyplay.js'

// ---- fixture --------------------------------------------------------------

function person(id, last, first) {
  return { id, fullName: `${first} ${last}`, lastName: last, firstName: first, useName: first, primaryNumber: String(id) }
}

const ORTIZ = 1
const TURANG = 2
const CHOURIO = 3
const CONTRERAS = 4
const YELICH = 5
const PITCHER = 9
const PINCH = 7

const PLAYERS = {
  ID1: person(ORTIZ, 'Ortiz', 'Joey'),
  ID2: person(TURANG, 'Turang', 'Brice'),
  ID3: person(CHOURIO, 'Chourio', 'Jackson'),
  ID4: person(CONTRERAS, 'Contreras', 'William'),
  ID5: person(YELICH, 'Yelich', 'Christian'),
  ID7: person(PINCH, 'Frelick', 'Sal'),
  ID9: { ...person(PITCHER, 'Chapman', 'Aroldis'), pitchHand: { code: 'L' } },
}

const BOX_HOME = {
  ID1: { person: { id: ORTIZ }, battingOrder: '600', position: { abbreviation: 'SS' }, allPositions: [{ abbreviation: 'SS' }] },
  ID2: { person: { id: TURANG }, battingOrder: '700', position: { abbreviation: '2B' }, allPositions: [{ abbreviation: '2B' }] },
  ID3: { person: { id: CHOURIO }, battingOrder: '800', position: { abbreviation: 'RF' }, allPositions: [{ abbreviation: 'RF' }] },
  ID4: { person: { id: CONTRERAS }, battingOrder: '100', position: { abbreviation: 'C' }, allPositions: [{ abbreviation: 'C' }] },
  ID5: { person: { id: YELICH }, battingOrder: '200', position: { abbreviation: 'DH' }, allPositions: [{ abbreviation: 'DH' }] },
  ID7: { person: { id: PINCH }, battingOrder: '601', position: { abbreviation: 'PR' } },
}

function pitch(code, n) {
  return { isPitch: true, pitchNumber: n, details: { call: { code } } }
}

// The placement, exactly as the feed nests it: a non-pitch `action` playEvent
// at the head of the half's first plate appearance, carrying the runner on
// `player.id` and the base he's given on `base`.
function placementEvent(runnerId = ORTIZ, last = 'Joey Ortiz') {
  return {
    details: {
      description: `${last} starts inning at 2nd base.`,
      event: 'Runner Placed On Base',
      eventType: 'runner_placed',
      isOut: false,
    },
    index: 1,
    isPitch: false,
    type: 'action',
    player: { id: runnerId },
    base: 2,
  }
}

function singlePlay(extraEvents = []) {
  return {
    about: { inning: 10, halfInning: 'bottom', atBatIndex: 80 },
    matchup: { batter: { id: TURANG, fullName: 'Brice Turang' }, pitcher: { id: PITCHER }, batSide: { code: 'L' } },
    result: {
      type: 'atBat',
      eventType: 'single',
      description: 'Brice Turang singles on a sharp line drive to center fielder Ceddanne Rafaela. Joey Ortiz to 3rd.',
      rbi: 0,
    },
    count: { balls: 0, strikes: 0, outs: 0 },
    playEvents: [placementEvent(), ...extraEvents, pitch('D', 1)],
    runners: [
      {
        details: { runner: { id: TURANG, fullName: 'Brice Turang' }, eventType: 'single' },
        movement: { start: null, end: '1B', isOut: false },
      },
      {
        details: { runner: { id: ORTIZ, fullName: 'Joey Ortiz' }, eventType: 'single' },
        movement: { start: '2B', end: '3B', isOut: false },
      },
    ],
  }
}

const WALK_PLAY = {
  about: { inning: 10, halfInning: 'bottom', atBatIndex: 81 },
  matchup: { batter: { id: CHOURIO, fullName: 'Jackson Chourio' }, pitcher: { id: PITCHER }, batSide: { code: 'R' } },
  result: { type: 'atBat', eventType: 'walk', description: 'Jackson Chourio walks.', rbi: 0 },
  count: { balls: 4, strikes: 1, outs: 0 },
  playEvents: [pitch('B', 1), pitch('B', 2), pitch('C', 3), pitch('B', 4), pitch('B', 5)],
  runners: [
    {
      details: { runner: { id: TURANG, fullName: 'Brice Turang' }, eventType: 'defensive_indiff' },
      movement: { start: '1B', end: '2B', isOut: false },
    },
    {
      details: { runner: { id: CHOURIO, fullName: 'Jackson Chourio' }, eventType: 'walk' },
      movement: { start: null, end: '1B', isOut: false },
    },
  ],
}

const FLYOUT_PLAY = {
  about: { inning: 10, halfInning: 'bottom', atBatIndex: 82 },
  matchup: { batter: { id: CONTRERAS, fullName: 'William Contreras' }, pitcher: { id: PITCHER }, batSide: { code: 'R' } },
  result: {
    type: 'atBat',
    eventType: 'field_out',
    description: 'William Contreras flies out to left fielder Jarren Duran.',
    rbi: 0,
  },
  count: { balls: 1, strikes: 1, outs: 1 },
  playEvents: [pitch('C', 1), pitch('B', 2), pitch('X', 3)],
  runners: [
    {
      details: { runner: { id: CONTRERAS, fullName: 'William Contreras' }, eventType: 'field_out' },
      movement: { start: null, end: null, isOut: true, outNumber: 1 },
      credits: [{ position: { code: '7' }, credit: 'f_putout' }],
    },
  ],
}

// The walk-off grand slam. Note the earned flags: only the PLACED runner's run
// is unearned — the official-scoring rule treats him as having reached on an
// error, and the feed says so.
const SLAM_PLAY = {
  about: { inning: 10, halfInning: 'bottom', atBatIndex: 83 },
  matchup: { batter: { id: YELICH, fullName: 'Christian Yelich' }, pitcher: { id: PITCHER }, batSide: { code: 'L' } },
  result: {
    type: 'atBat',
    eventType: 'home_run',
    description:
      'Christian Yelich hits a grand slam (10) to right center field. Joey Ortiz scores. Brice Turang scores. Jackson Chourio scores.',
    rbi: 4,
  },
  count: { balls: 1, strikes: 0, outs: 1 },
  playEvents: [pitch('B', 1), pitch('X', 2)],
  runners: [
    {
      details: { runner: { id: YELICH, fullName: 'Christian Yelich' }, eventType: 'home_run', earned: true, rbi: true },
      movement: { start: null, end: 'score', isOut: false },
    },
    {
      details: { runner: { id: ORTIZ, fullName: 'Joey Ortiz' }, eventType: 'home_run', earned: false, rbi: true },
      movement: { start: '3B', end: 'score', isOut: false },
    },
    {
      details: { runner: { id: TURANG, fullName: 'Brice Turang' }, eventType: 'home_run', earned: true, rbi: true },
      movement: { start: '2B', end: 'score', isOut: false },
    },
    {
      details: { runner: { id: CHOURIO, fullName: 'Jackson Chourio' }, eventType: 'home_run', earned: true, rbi: true },
      movement: { start: '1B', end: 'score', isOut: false },
    },
  ],
}

function buildFeed(plays) {
  return {
    gamePk: 777747,
    gameData: { players: PLAYERS },
    liveData: {
      linescore: { scheduledInnings: 9, innings: [] },
      boxscore: { teams: { home: { players: BOX_HOME }, away: { players: {} } } },
      plays: { allPlays: plays },
    },
  }
}

const FULL_HALF = [singlePlay(), WALK_PLAY, FLYOUT_PLAY, SLAM_PLAY]

const feedFor = (plays = FULL_HALF) => computeHalfInningFeed(buildFeed(plays), 10, 'bottom', 'home')

// How PlayByPlay's onRunsSoFar tallies the stepped-through portion of a half:
// each scoring runner is marked on HIS OWN card, so a placed runner's run only
// counts if he has one.
const runsIn = (entries) =>
  entries.filter((e) => (e.kind === 'atbat' || e.kind === 'placed') && e.scored).length

// ---- the card exists ------------------------------------------------------

test('the placed runner leads the half with a card of his own', () => {
  const entries = feedFor()
  assert.deepEqual(
    entries.map((e) =>
      e.kind === 'placed' ? `placed:${e.runner.last}` : e.kind === 'atbat' ? `atbat:${e.batter.last}` : `event:${e.eventType}`,
    ),
    ['placed:Ortiz', 'atbat:Turang', 'atbat:Chourio', 'atbat:Contreras', 'atbat:Yelich'],
  )

  const placed = entries[0]
  // He is given 2nd — no plate appearance, so no pitches, no result code, no
  // RBI, and the scorer's automatic-runner mark where a result would go.
  assert.equal(placed.base, 2)
  assert.equal(placed.code, 'AR')
  assert.equal(placed.runner.id, ORTIZ)
  assert.equal(placed.runner.pos, 'SS')
  assert.equal(placed.pitches, undefined)
  assert.equal(placed.rbi, undefined)
  // The feed's own sentence is the card's prose.
  // …his own name trimmed off the front, same as every at-bat card's prose.
  assert.match(placed.descSegments.map((s) => s.text).join(''), /^Starts inning at 2nd base\.$/)
})

test("the placement no longer doubles as a sub-line on the leadoff batter's card", () => {
  const turang = feedFor()[1]
  assert.equal(
    (turang.baserunningNotes ?? []).some((n) => n.eventType === 'runner_placed'),
    false,
  )
})

// ---- his trip runs on the same machinery as everyone else's ---------------

test('the placed runner starts on 2nd and his later legs are notated from there', () => {
  const placed = feedFor()[0]
  assert.equal(placed.reached, 4)
  assert.equal(placed.scored, true)
  // His run is UNEARNED — circled on the diamond, per the official-scoring
  // rule that treats him as having reached on an error.
  assert.equal(placed.earned, false)
  // No leg at 1 or 2: he was GIVEN those, he didn't leg them out. The card
  // draws them as the dotted ghost path instead (PlayDiamond's placedAt).
  assert.deepEqual(Object.keys(placed.legNotations).sort(), ['3', '4'])
  assert.equal(placed.legNotations[3].code, '1B') // to 3rd on Turang's single
  assert.equal(placed.legNotations[3].slot, 7) // …driven by the 7th slot
  assert.equal(placed.legNotations[4].code, 'HR')
  assert.equal(placed.legNotations[4].slot, 2)
})

test('a stranded placed runner ends the half standing where he got to', () => {
  // Same half, but Yelich flies out instead of clearing the bases: Ortiz took
  // 3rd on the single and never came home.
  const strandOut = {
    ...FLYOUT_PLAY,
    about: { inning: 10, halfInning: 'bottom', atBatIndex: 84 },
    matchup: { batter: { id: YELICH, fullName: 'Christian Yelich' }, pitcher: { id: PITCHER }, batSide: { code: 'L' } },
    result: { type: 'atBat', eventType: 'field_out', description: 'Christian Yelich flies out to left fielder Jarren Duran.', rbi: 0 },
    runners: [
      {
        details: { runner: { id: YELICH, fullName: 'Christian Yelich' }, eventType: 'field_out' },
        movement: { start: null, end: null, isOut: true, outNumber: 3 },
        credits: [{ position: { code: '7' }, credit: 'f_putout' }],
      },
    ],
  }
  const placed = feedFor([singlePlay(), WALK_PLAY, FLYOUT_PLAY, strandOut])[0]
  assert.equal(placed.reached, 3)
  assert.equal(placed.scored, false)
  assert.deepEqual(Object.keys(placed.legNotations), ['3'])
})

test('a placed runner thrown out on the bases gets the tick and the out code on his own card', () => {
  const csPlay = {
    about: { inning: 10, halfInning: 'bottom', atBatIndex: 81 },
    matchup: { batter: { id: CHOURIO, fullName: 'Jackson Chourio' }, pitcher: { id: PITCHER }, batSide: { code: 'R' } },
    result: { type: 'atBat', eventType: 'strikeout', description: 'Jackson Chourio strikes out swinging.', rbi: 0 },
    count: { balls: 0, strikes: 3, outs: 1 },
    playEvents: [pitch('S', 1), pitch('S', 2), pitch('S', 3)],
    runners: [
      {
        details: { runner: { id: CHOURIO, fullName: 'Jackson Chourio' }, eventType: 'strikeout' },
        movement: { start: null, end: null, isOut: true, outNumber: 1 },
      },
      {
        details: { runner: { id: ORTIZ, fullName: 'Joey Ortiz' }, eventType: 'caught_stealing_home' },
        movement: { start: '3B', end: null, isOut: true, outBase: 'score', outNumber: 2 },
        credits: [
          { position: { code: '2' }, credit: 'f_assist' },
          { position: { code: '5' }, credit: 'f_putout' },
        ],
      },
    ],
  }
  const placed = feedFor([singlePlay(), csPlay])[0]
  assert.equal(placed.reached, 3)
  assert.equal(placed.scored, false)
  assert.equal(placed.outNumber, 2)
  assert.equal(placed.outAt, 4)
  assert.equal(placed.outCode, 'CS 2-5')
})

// ---- the two bugs a missing card caused -----------------------------------

test('the placed runner’s run is counted in the half’s run tally', () => {
  // The walk-off grand slam scores FOUR: Yelich plus the three aboard, one of
  // whom is the placed runner. Without his card this read 3, and the stepped
  // linescore cell (ADR-0016) was wrong for the half.
  assert.equal(runsIn(feedFor()), 4)
})

test('a pinch runner for the placed runner lands on the placement card', () => {
  const swap = {
    details: {
      eventType: 'offensive_substitution',
      description: 'Offensive Substitution: Pinch-runner Sal Frelick replaces Joey Ortiz.',
    },
    position: { abbreviation: 'PR' },
    player: { id: PINCH },
    replacedPlayer: { id: ORTIZ },
    base: 2,
  }
  // The swap happens right after the placement, before the first pitch.
  const entries = feedFor([singlePlay([swap]), WALK_PLAY, FLYOUT_PLAY, SLAM_PLAY])
  const placed = entries[0]
  assert.deepEqual(
    (placed.pinchRunners ?? []).map((p) => ({ id: p.id, base: p.base })),
    [{ id: PINCH, base: 2 }],
  )
  // And the pinch runner's own legs resolve back to that card — he scores the
  // placed runner's (still unearned) run.
  assert.equal(placed.scored, true)
  assert.equal(placed.earned, false)
  assert.equal(runsIn(entries), 4)
})

// ---- it must not become a second spoiler boundary -------------------------

test('the placement card is not its own at-bat step', () => {
  const entries = feedFor()
  // One tap bundles the placement forward with the leadoff plate appearance,
  // exactly as it bundles any leading event note (ADR-0016) — the placement
  // is not a plate appearance, and making it a step would change what every
  // already-stored step count means.
  assert.equal(nextStepBoundary(entries, 0), 2)
  assert.equal(nextStepBoundary(entries, 2), 3)
})

test('a not-yet-revealed play cannot advance the placed runner early', () => {
  // Stepped to the placement + the single only: he's on 3rd, and the grand
  // slam three cards later must not have brought him home yet.
  const placed = computeHalfInningFeed(buildFeed(FULL_HALF), 10, 'bottom', 'home', 2)[0]
  assert.equal(placed.reached, 3)
  assert.equal(placed.scored, false)
})

test('the half’s first entry alone does not read as a whole revealed half', () => {
  // A live half can have the placement fetched before the leadoff batter's PA
  // resolves. PlayByPlay's `hasAtBat` guard keys on kind === 'atbat' so that
  // state can't fire a one-directional commit of the whole half — the
  // placement card must NOT satisfy it.
  const entries = feedFor()
  assert.equal(entries[0].kind, 'placed')
  assert.equal(
    entries.filter((e) => e.kind === 'atbat').length,
    4,
  )
})

// ---- the placed runner batting later in the same half ---------------------

test('a placed runner who later bats keeps his placement trip on its own card', () => {
  // He scores, the lineup bats around, and he comes to the plate — his second
  // trip must not retroactively rewrite the placement card's diamond.
  const ortizPA = {
    about: { inning: 10, halfInning: 'bottom', atBatIndex: 84 },
    matchup: { batter: { id: ORTIZ, fullName: 'Joey Ortiz' }, pitcher: { id: PITCHER }, batSide: { code: 'R' } },
    result: { type: 'atBat', eventType: 'field_out', description: 'Joey Ortiz grounds out, shortstop Trevor Story to first baseman Abraham Toro.', rbi: 0 },
    count: { balls: 0, strikes: 0, outs: 2 },
    playEvents: [pitch('X', 1)],
    runners: [
      {
        details: { runner: { id: ORTIZ, fullName: 'Joey Ortiz' }, eventType: 'field_out' },
        movement: { start: null, end: null, isOut: true, outNumber: 2 },
        credits: [
          { position: { code: '6' }, credit: 'f_assist' },
          { position: { code: '3' }, credit: 'f_putout' },
        ],
      },
    ],
  }
  const entries = feedFor([singlePlay(), WALK_PLAY, FLYOUT_PLAY, SLAM_PLAY, ortizPA])
  const placed = entries[0]
  const secondTrip = entries.at(-1)
  assert.equal(placed.kind, 'placed')
  assert.equal(placed.reached, 4)
  assert.equal(placed.scored, true)
  assert.equal(secondTrip.kind, 'atbat')
  assert.equal(secondTrip.reached, 0)
  assert.equal(secondTrip.scored, false)
  // …and the run still counts exactly once.
  assert.equal(runsIn(entries), 4)
})
