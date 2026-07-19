// A tiny, fully hand-built `feed/live`-shaped object — just enough of the MLB
// feed's real shape to exercise the reveal-only derivations (derive.js,
// linescore.js, pitchers.js) and the caller-gated pre-pitch selectors
// (defense.js, battingorder.js) without a multi-megabyte captured feed.
//
// It's a 2-inning game (regulation 9) built to the field paths the selectors
// actually read; every value here is chosen so a single assertion pins a
// specific behavior. Where a real feed carries dozens of fields per node we
// keep only the ones the code under test touches. Field-path fidelity is the
// point — see the module docs in each selector for why a given path matters.
//
// Layout of the play-by-play (half-index in brackets — see select.halfIndex):
//   [0] top 1    — home starter #200 pitches: 4 batters, a HR, whiffs, Statcast
//   [1] bottom 1 — away starter #300 pitches: a single, an inning-ending CS
//   [2] top 2    — home reliever #201 enters; away pinch-hitter #10 announced;
//                  a home LF defensive sub (#20) — all before the half's 1st pitch
//   [3] bottom 2 — away #300 stays in: a solo HR then three outs

// ---- players (gameData.players), keyed "ID{n}" as the feed does ----
function batter(id, last, first, num) {
  return {
    id,
    fullName: `${first} ${last}`,
    lastName: last,
    firstName: first,
    useName: first,
    boxscoreName: last,
    lastFirstName: `${last}, ${first}`,
    primaryNumber: String(num),
  }
}
function pitcher(id, last, first, num, hand = 'R') {
  return { ...batter(id, last, first, num), pitchHand: { code: hand } }
}

const PEOPLE = {
  // away batting order (bats the top half) — ids 1..9, DH game (no batting pitcher)
  ID1: batter(1, 'Ashby', 'Aaron', 1),
  ID2: batter(2, 'Bell', 'Ben', 2),
  ID3: batter(3, 'Cruz', 'Carl', 3),
  ID4: batter(4, 'Diaz', 'Dan', 4),
  ID5: batter(5, 'Ellis', 'Ed', 5),
  ID6: batter(6, 'Frye', 'Finn', 6),
  ID7: batter(7, 'Gore', 'Gil', 7),
  ID8: batter(8, 'Hill', 'Hal', 8),
  ID9: batter(9, 'Ivey', 'Ike', 9),
  ID10: batter(10, 'Judge', 'Jim', 24), // away pinch-hitter for slot 4
  // home batting order (bats the bottom half) — ids 11..19
  ID11: batter(11, 'Kane', 'Kal', 11),
  ID12: batter(12, 'Lowe', 'Leo', 12),
  ID13: batter(13, 'Mays', 'Moe', 13),
  ID14: batter(14, 'Nash', 'Ned', 14),
  ID15: batter(15, 'Ott', 'Oli', 15),
  ID16: batter(16, 'Pena', 'Pat', 16),
  ID17: batter(17, 'Quin', 'Quy', 17),
  ID18: batter(18, 'Ruiz', 'Rey', 18),
  ID19: batter(19, 'Soto', 'Sam', 19),
  ID20: batter(20, 'Toro', 'Tom', 25), // home LF defensive replacement
  // pitchers
  ID200: pitcher(200, 'Starter', 'Hank', 40, 'R'), // home starter (tops)
  ID201: pitcher(201, 'Reliever', 'Rob', 41, 'L'), // home reliever (top 2)
  ID300: pitcher(300, 'Whit', 'Walt', 42, 'R'), // away starter (bottoms)
}

// ---- pitch-event helpers ----
// call codes: C called strike, S swinging strike (whiff), B ball, X in play.
function pitch(code, opts = {}) {
  const e = { isPitch: true, pitchNumber: opts.pitchNumber ?? 1, details: { call: { code } } }
  if (opts.type) e.details.type = { description: opts.type }
  if (opts.velo != null) e.pitchData = { startSpeed: opts.velo }
  if (opts.ev != null || opts.dist != null) {
    e.hitData = {}
    if (opts.ev != null) e.hitData.launchSpeed = opts.ev
    if (opts.dist != null) e.hitData.totalDistance = opts.dist
  }
  return e
}
function seq(...codes) {
  return codes.map((c, i) => pitch(c, { pitchNumber: i + 1 }))
}
function scoringRunner(pitcherId, earned = true) {
  return {
    details: { isScoringEvent: true, earned, responsiblePitcher: { id: pitcherId } },
    movement: { end: 'score' },
  }
}

const ALL_PLAYS = [
  // ---------- [0] TOP 1 — home #200 pitches ----------
  {
    about: { inning: 1, halfInning: 'top' },
    matchup: { pitcher: { id: 200, fullName: 'Hank Starter' }, batter: { id: 1, fullName: 'Aaron Ashby' } },
    result: { type: 'atBat', eventType: 'strikeout' },
    count: { outs: 1 },
    playEvents: [
      pitch('C', { pitchNumber: 1, velo: 95.1, type: 'Four-Seam Fastball' }),
      pitch('S', { pitchNumber: 2 }),
      pitch('S', { pitchNumber: 3 }),
    ],
  },
  {
    about: { inning: 1, halfInning: 'top' },
    matchup: { pitcher: { id: 200, fullName: 'Hank Starter' }, batter: { id: 2, fullName: 'Ben Bell' } },
    result: { type: 'atBat', eventType: 'home_run' },
    count: { outs: 1 },
    playEvents: [pitch('X', { pitchNumber: 1, velo: 92.0, ev: 104.3, dist: 420 })],
    runners: [scoringRunner(200, true)],
  },
  {
    about: { inning: 1, halfInning: 'top' },
    matchup: { pitcher: { id: 200 }, batter: { id: 3 } },
    result: { type: 'atBat', eventType: 'field_out' },
    count: { outs: 2 },
    playEvents: [pitch('X', { pitchNumber: 1 })],
  },
  {
    about: { inning: 1, halfInning: 'top' },
    matchup: { pitcher: { id: 200 }, batter: { id: 4 } },
    result: { type: 'atBat', eventType: 'strikeout' },
    count: { outs: 3 },
    playEvents: seq('C', 'S', 'S'),
  },

  // ---------- [1] BOTTOM 1 — away #300 pitches ----------
  {
    about: { inning: 1, halfInning: 'bottom' },
    matchup: { pitcher: { id: 300 }, batter: { id: 11 } },
    result: { type: 'atBat', eventType: 'single' },
    count: { outs: 0 },
    playEvents: seq('B', 'X'),
  },
  {
    // Inning-ending caught stealing: NOT a plate appearance, but its pitch and
    // its out still count (derive.js / pitchers.js both special-case this).
    about: { inning: 1, halfInning: 'bottom' },
    matchup: { pitcher: { id: 300 }, batter: { id: 11 } },
    result: { type: 'atBat', eventType: 'caught_stealing_2b' },
    count: { outs: 1 },
    playEvents: [pitch('S', { pitchNumber: 1 })],
  },
  {
    about: { inning: 1, halfInning: 'bottom' },
    matchup: { pitcher: { id: 300 }, batter: { id: 12 } },
    result: { type: 'atBat', eventType: 'strikeout' },
    count: { outs: 2 },
    playEvents: seq('C', 'C', 'S'),
  },
  {
    about: { inning: 1, halfInning: 'bottom' },
    matchup: { pitcher: { id: 300 }, batter: { id: 13 } },
    result: { type: 'atBat', eventType: 'field_out' },
    count: { outs: 3 },
    playEvents: [pitch('X', { pitchNumber: 1 })],
  },

  // ---------- [2] TOP 2 — reliever + subs announced pre-pitch ----------
  {
    about: { inning: 2, halfInning: 'top' },
    matchup: { pitcher: { id: 201 }, batter: { id: 10 } },
    result: { type: 'atBat', eventType: 'strikeout' },
    count: { outs: 1 },
    playEvents: [
      // three pre-pitch, non-isPitch substitution events (real feed order):
      { details: { eventType: 'defensive_substitution', description: 'Defensive sub' }, position: { abbreviation: 'LF' }, player: { id: 20 } },
      { details: { eventType: 'pitching_substitution', description: 'Pitching Change' }, position: { abbreviation: 'P' }, player: { id: 201 } },
      { details: { eventType: 'offensive_substitution', description: 'Offensive sub' }, position: { abbreviation: 'PH' }, player: { id: 10 } },
      pitch('S', { pitchNumber: 1 }),
      pitch('S', { pitchNumber: 2 }),
      pitch('S', { pitchNumber: 3 }),
    ],
  },

  // ---------- [3] BOTTOM 2 — away #300 stays in ----------
  {
    about: { inning: 2, halfInning: 'bottom' },
    matchup: { pitcher: { id: 300 }, batter: { id: 14 } },
    result: { type: 'atBat', eventType: 'home_run' },
    count: { outs: 0 },
    playEvents: [pitch('X', { pitchNumber: 1, ev: 99.0, dist: 405 })],
    runners: [scoringRunner(300, true)],
  },
  {
    about: { inning: 2, halfInning: 'bottom' },
    matchup: { pitcher: { id: 300 }, batter: { id: 15 } },
    result: { type: 'atBat', eventType: 'strikeout' },
    count: { outs: 1 },
    playEvents: seq('C', 'S', 'S'),
  },
  {
    about: { inning: 2, halfInning: 'bottom' },
    matchup: { pitcher: { id: 300 }, batter: { id: 16 } },
    result: { type: 'atBat', eventType: 'field_out' },
    count: { outs: 2 },
    playEvents: [pitch('X', { pitchNumber: 1 })],
  },
  {
    about: { inning: 2, halfInning: 'bottom' },
    matchup: { pitcher: { id: 300 }, batter: { id: 17 } },
    result: { type: 'atBat', eventType: 'field_out' },
    count: { outs: 3 },
    playEvents: [pitch('X', { pitchNumber: 1 })],
  },
]

// ---- boxscore players: batting order + positions + final pitching lines ----
const AWAY_POS = ['CF', 'SS', '1B', 'DH', 'LF', 'RF', '3B', 'C', '2B']
const HOME_POS = ['CF', 'SS', '1B', 'DH', 'LF', 'RF', '3B', 'C', '2B']

function boxBatter(id, slot, pos, num) {
  return {
    person: { id, fullName: PEOPLE[`ID${id}`].fullName },
    jerseyNumber: String(num),
    battingOrder: String(slot * 100),
    position: { abbreviation: pos },
    allPositions: [{ abbreviation: pos }],
  }
}

function buildBoxTeam(startIds, positions, extras) {
  const players = {}
  startIds.forEach((id, i) => {
    players[`ID${id}`] = boxBatter(id, i + 1, positions[i], PEOPLE[`ID${id}`].primaryNumber)
  })
  for (const ex of extras ?? []) players[`ID${ex.id}`] = ex.box
  return players
}

const awayPlayers = buildBoxTeam([1, 2, 3, 4, 5, 6, 7, 8, 9], AWAY_POS, [
  {
    id: 10, // pinch-hitter for slot 4 (battingOrder 401 — slot 4, sub #1)
    box: {
      person: { id: 10, fullName: 'Jim Judge' },
      jerseyNumber: '24',
      battingOrder: '401',
      position: { abbreviation: 'PH' },
      gameStatus: { isSubstitute: true },
    },
  },
  {
    id: 300,
    box: {
      person: { id: 300, fullName: 'Walt Whit' },
      jerseyNumber: '42',
      position: { abbreviation: 'P' },
      stats: {
        pitching: {
          inningsPitched: '2.0',
          numberOfPitches: 14,
          battersFaced: 8,
          hits: 3,
          runs: 1,
          earnedRuns: 1,
          baseOnBalls: 0,
          strikeOuts: 2,
        },
      },
    },
  },
])

const homePlayers = buildBoxTeam([11, 12, 13, 14, 15, 16, 17, 18, 19], HOME_POS, [
  {
    id: 20, // defensive replacement in LF
    box: {
      person: { id: 20, fullName: 'Tom Toro' },
      jerseyNumber: '25',
      position: { abbreviation: 'LF' },
      gameStatus: { isSubstitute: true },
    },
  },
  {
    id: 200,
    box: {
      person: { id: 200, fullName: 'Hank Starter' },
      jerseyNumber: '40',
      position: { abbreviation: 'P' },
      stats: {
        pitching: {
          inningsPitched: '1.0',
          numberOfPitches: 8,
          battersFaced: 4,
          hits: 1,
          runs: 1,
          earnedRuns: 1,
          baseOnBalls: 0,
          strikeOuts: 2,
        },
      },
    },
  },
  {
    id: 201,
    box: {
      person: { id: 201, fullName: 'Rob Reliever' },
      jerseyNumber: '41',
      position: { abbreviation: 'P' },
      stats: {
        pitching: {
          inningsPitched: '0.1',
          numberOfPitches: 3,
          battersFaced: 1,
          hits: 0,
          runs: 0,
          earnedRuns: 0,
          baseOnBalls: 0,
          strikeOuts: 1,
        },
      },
    },
  },
])

// Deep-clones so a test mutating the feed can't bleed into another test.
export function buildFeed() {
  return structuredClone({
    gamePk: 999001,
    gameData: {
      datetime: { officialDate: '2026-07-07', dayNight: 'night' },
      status: { abstractGameState: 'Final', detailedState: 'Final' },
      players: PEOPLE,
      teams: {
        away: { id: 158, name: 'Away Club', teamName: 'Aways', abbreviation: 'AWY' },
        home: { id: 138, name: 'Home Club', teamName: 'Homes', abbreviation: 'HOM' },
      },
    },
    liveData: {
      linescore: {
        scheduledInnings: 9,
        innings: [
          {
            num: 1,
            away: { runs: 1, hits: 2, errors: 0, leftOnBase: 1 },
            home: { runs: 0, hits: 1, errors: 1, leftOnBase: 2 },
          },
          {
            num: 2,
            away: { runs: 0, hits: 0, errors: 0, leftOnBase: 0 },
            home: { runs: 2, hits: 2, errors: 0, leftOnBase: 1 },
          },
        ],
        teams: {
          away: { runs: 1, hits: 2, errors: 1, leftOnBase: 1 },
          home: { runs: 2, hits: 3, errors: 1, leftOnBase: 3 },
        },
      },
      boxscore: {
        teams: {
          away: { team: { id: 158 }, players: awayPlayers, pitchers: [300], bullpen: [], bench: [] },
          home: { team: { id: 138 }, players: homePlayers, pitchers: [200, 201], bullpen: [], bench: [] },
        },
      },
      plays: { allPlays: ALL_PLAYS },
    },
  })
}
