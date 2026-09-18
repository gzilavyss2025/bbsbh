// THE OFFSEASON GATE, ONE LEVEL DOWN (issue #1077) — the pure half of the rule
// that decides whether a MINOR level's slate is looking at a winter, plus the
// derivation the page leads with.
//
// Every league row below is a REAL statsapi row, read live on 2026-09-18 from
// /api/v1/league?sportId={11,13}&season={2025,2026,2027}. They are here rather
// than a made-up shape because the whole design rests on a fact those rows
// carry and the sport-wide row does not: a level is three leagues that finish
// on three different days, so no single date says when its season is over.
//
// The 2025 High-A rows are the reason this module exists at all. sportId 13's
// own 2025 season row ends the season on September 19 — but two of its three
// leagues published September 20, and a gate reading the sport row would have
// called a winter while a league was still playing.
import assert from 'node:assert/strict'
import test from 'node:test'
import { levelOffseasonPhase, levelOpeningDay } from '../src/lib/time/seasonPhase.js'
import { movedUpAt } from '../src/api/minorsLeaders.js'

// High-A, 2025 / 2026 / 2027: South Atlantic, Midwest, Northwest.
const HIGH_A_2025 = [
  { leagueId: 116, regularSeasonStartDate: '2025-04-04', offseasonStartDate: '2025-09-21' },
  { leagueId: 118, regularSeasonStartDate: '2025-04-04', offseasonStartDate: '2025-09-21' },
  { leagueId: 126, regularSeasonStartDate: '2025-04-04', offseasonStartDate: '2025-09-18' },
]
const HIGH_A_2026 = [
  { leagueId: 116, regularSeasonStartDate: '2026-04-02', offseasonStartDate: '2026-09-16' },
  { leagueId: 118, regularSeasonStartDate: '2026-04-02', offseasonStartDate: '2026-09-16' },
  { leagueId: 126, regularSeasonStartDate: '2026-04-03', offseasonStartDate: '2026-09-12' },
]
const HIGH_A_2027 = [
  { leagueId: 116, regularSeasonStartDate: '2027-04-02', offseasonStartDate: '2027-09-20' },
  { leagueId: 118, regularSeasonStartDate: '2027-04-02', offseasonStartDate: '2027-09-20' },
  { leagueId: 126, regularSeasonStartDate: '2027-04-03', offseasonStartDate: '2027-09-20' },
]
// Triple-A, 2026: two leagues, both ending the same day — the case where the
// max and the min have nothing to do and the answer must still be right.
const TRIPLE_A_2026 = [
  { leagueId: 117, regularSeasonStartDate: '2026-03-27', offseasonStartDate: '2026-09-28' },
  { leagueId: 112, regularSeasonStartDate: '2026-03-27', offseasonStartDate: '2026-09-28' },
]

test('the level is not in a winter until its LAST league is out of one', () => {
  // The Northwest League's 2026 offseason opens September 12, a full four days
  // before the other two. A gate that took the first, or an average, or the
  // sport-wide row would put the page up over two leagues still playing.
  assert.equal(levelOffseasonPhase('2026-09-12', HIGH_A_2026), null)
  assert.equal(levelOffseasonPhase('2026-09-15', HIGH_A_2026), null)
  assert.deepEqual(levelOffseasonPhase('2026-09-16', HIGH_A_2026), {
    seasonEnded: 2026,
    startDate: '2026-09-16',
    openingDay: null,
    openerFromNextSeason: 2027,
  })
})

test('the 2025 High-A rows the sport-wide row got wrong', () => {
  // sportId 13's own 2025 row: seasonEndDate 2025-09-19, offseasonStartDate
  // 2025-09-20. Two of its three leagues played through the 20th, so the
  // leagues' own reading holds the winter back a day where the sport row would
  // have opened it early.
  assert.equal(levelOffseasonPhase('2025-09-20', HIGH_A_2025), null)
  assert.equal(levelOffseasonPhase('2025-09-21', HIGH_A_2025).startDate, '2025-09-21')
})

test('October is the offseason at a minor level, and has been since September', () => {
  // The mirror image of the MLB rule (ADR-0074), and the reason the design
  // study's October artboards were not showing the wrong month: by October 12
  // High-A has been dark for nearly four weeks.
  const phase = levelOffseasonPhase('2026-10-12', HIGH_A_2026)
  assert.equal(phase.seasonEnded, 2026)
  assert.equal(phase.openerFromNextSeason, 2027)
  // Nothing about the schedule was consulted to say so.
  assert.equal(phase.openingDay, null)
})

test('January is still last season, and the opener is already in hand', () => {
  // statsapi rolls a minor league over on January 1 exactly as it does MLB, so
  // the rows for the DATE's year are next season's and carry its opener.
  const phase = levelOffseasonPhase('2027-01-15', HIGH_A_2027)
  assert.equal(phase.seasonEnded, 2026)
  assert.equal(phase.openingDay, '2027-04-02')
  assert.equal(phase.openerFromNextSeason, null)
  assert.equal(phase.startDate, null)
})

test('the winter ends when the FIRST league plays again, not the last', () => {
  // The Northwest League opens a day after the other two in 2027. The page has
  // to be gone on April 2, when there is baseball at the level again.
  assert.equal(levelOffseasonPhase('2027-04-01', HIGH_A_2027).seasonEnded, 2026)
  assert.equal(levelOffseasonPhase('2027-04-02', HIGH_A_2027), null)
  assert.equal(levelOffseasonPhase('2027-04-03', HIGH_A_2027), null)
})

test('a two-league level reads the same way', () => {
  assert.equal(levelOffseasonPhase('2026-09-27', TRIPLE_A_2026), null)
  assert.equal(levelOffseasonPhase('2026-09-28', TRIPLE_A_2026).startDate, '2026-09-28')
  assert.equal(levelOffseasonPhase('2026-06-01', TRIPLE_A_2026), null)
})

test('it fails closed on anything it cannot read', () => {
  assert.equal(levelOffseasonPhase('2026-10-12', null), null)
  assert.equal(levelOffseasonPhase('2026-10-12', []), null)
  assert.equal(levelOffseasonPhase('nope', HIGH_A_2026), null)
  // One unreadable league stops the whole level: the answer is a max and a min
  // over all of them, and a partial list silently widens one end.
  const missing = [HIGH_A_2026[0], HIGH_A_2026[1], { leagueId: 126 }]
  assert.equal(levelOffseasonPhase('2026-10-12', missing), null)
  const bad = [HIGH_A_2026[0], { ...HIGH_A_2026[2], offseasonStartDate: 'soon' }]
  assert.equal(levelOffseasonPhase('2026-10-12', bad), null)
})

test('the opener is the earliest of a season, and all or nothing', () => {
  assert.equal(levelOpeningDay(HIGH_A_2027), '2027-04-02')
  assert.equal(levelOpeningDay(TRIPLE_A_2026), '2026-03-27')
  assert.equal(levelOpeningDay([]), null)
  assert.equal(levelOpeningDay(null), null)
  assert.equal(levelOpeningDay([HIGH_A_2027[0], { leagueId: 126 }]), null)
})

// ---------------------------------------------------------------------------
// WHO MOVED UP — the page's lead.
//
// `levels` is every level a player's season touched, and it decides whether he
// belongs on THIS level's page. `fromLevel`/`toLevel` are where that season
// BEGAN and where it ENDED (scripts/lib/level-path.mjs builds them), and they
// decide whether he moved UP — the distinction issue #1122 exists for, because
// `levels` is a Set sorted by level and a demotion is indistinguishable from a
// promotion inside it.

const LEADERS = {
  avg: [
    // A+ to AAA across a season, in that order — three levels of climb.
    { id: 1, name: 'Bodine', position: 'C', levels: [14, 13, 11], fromLevel: 14, toLevel: 11, displayTeamId: 139, displayTeamAbbr: 'TB' },
    // Appeared at High-A and stayed there. Not a promotion, and no span.
    { id: 2, name: 'Stayed', position: 'SS', levels: [13], displayTeamId: 158, displayTeamAbbr: 'MIL' },
  ],
  hr: [
    // Repeated in a second category — counted once.
    { id: 1, name: 'Bodine', position: 'C', levels: [14, 13, 11], fromLevel: 14, toLevel: 11, displayTeamId: 139, displayTeamAbbr: 'TB' },
    // Climbed INTO High-A from Single-A. Also a promotion, at this level.
    { id: 3, name: 'Arrived', position: 'RHP', levels: [14, 13], fromLevel: 14, toLevel: 13, displayTeamId: 112, displayTeamAbbr: 'CHC' },
    // Climbed, but never at High-A — belongs to the AA page, not this one.
    { id: 4, name: 'Elsewhere', position: 'LF', levels: [12, 11], fromLevel: 12, toLevel: 11, displayTeamId: 158, displayTeamAbbr: 'MIL' },
  ],
}

test('a player who climbed is read from the two ends of his season', () => {
  const rows = movedUpAt(LEADERS, 13)
  assert.deepEqual(
    rows.map((r) => [r.id, r.from.label, r.to.label, r.climbed, r.left]),
    [
      [1, 'A', 'AAA', 3, true],
      [3, 'A', 'A+', 1, false],
    ],
  )
  // Deduped across categories, and the org is the parent club rather than the
  // affiliate the player is listed with.
  assert.equal(rows.length, 2)
  assert.equal(rows[0].org, 'TB')
  assert.equal(rows[0].orgId, 139)
})

test('it answers per level, and only about players who were at that level', () => {
  assert.deepEqual(
    movedUpAt(LEADERS, 12).map((r) => r.id),
    [4],
  )
  // Triple-A: everyone who climbed INTO it. Nothing in this file can see a
  // player reaching the majors, which is why the AAA page reads arrivals.
  assert.deepEqual(
    movedUpAt(LEADERS, 11).map((r) => r.id),
    [1, 4],
  )
})

// The three cases the old reading got wrong, and the reason the two ends exist.
// Each one has the SAME `levels` as a real promotion; only the order differs.

test('a player sent DOWN is not a player who moved up', () => {
  const demoted = {
    avg: [
      { id: 5, name: 'Sent down', levels: [13, 11], fromLevel: 11, toLevel: 13, displayTeamId: 158, displayTeamAbbr: 'MIL' },
    ],
  }
  // `levels` is identical to a High-A-to-Triple-A promotion. The ends are not.
  assert.deepEqual(demoted.avg[0].levels, [13, 11])
  assert.deepEqual(movedUpAt(demoted, 13), [])
  assert.deepEqual(movedUpAt(demoted, 11), [])
})

test('a rehab assignment ends where it started, so it is not a move', () => {
  const rehab = {
    avg: [
      { id: 6, name: 'Rehabbing', levels: [13, 11], fromLevel: 11, toLevel: 11, displayTeamId: 158, displayTeamAbbr: 'MIL' },
    ],
  }
  assert.deepEqual(movedUpAt(rehab, 13), [])
  assert.deepEqual(movedUpAt(rehab, 11), [])
})

test('a detour does not disqualify a season that still ends higher', () => {
  const detour = {
    avg: [
      { id: 7, name: 'Up, down, up', levels: [14, 13, 12], fromLevel: 13, toLevel: 12, displayTeamId: 158, displayTeamAbbr: 'MIL' },
    ],
  }
  const [row] = movedUpAt(detour, 13)
  // Where he BEGAN and where he FINISHED — not the two ends of `levels`,
  // which would read "A to AA".
  assert.equal(row.from.label, 'A+')
  assert.equal(row.to.label, 'AA')
  assert.equal(row.climbed, 1)
})

test('an entry with no span is left off rather than guessed at', () => {
  // A board generated before the two ends existed, or one whose window pulls
  // failed. Falling back to `levels` is the bug, so there is no fallback.
  const noPath = {
    avg: [{ id: 8, name: 'Unknown', levels: [14, 13], displayTeamId: 158, displayTeamAbbr: 'MIL' }],
  }
  assert.deepEqual(movedUpAt(noPath, 13), [])
  // A season that ended where it began says the same thing about a climb.
  const flat = {
    avg: [{ id: 9, name: 'Flat', levels: [14, 13], fromLevel: 13, toLevel: 13, displayTeamId: 158, displayTeamAbbr: 'MIL' }],
  }
  assert.deepEqual(movedUpAt(flat, 13), [])
})

test('the order is total, so two readers see the same list', () => {
  const tied = {
    avg: [
      { id: 71, name: 'Zeller', levels: [14, 13], fromLevel: 14, toLevel: 13, displayTeamId: 158, displayTeamAbbr: 'MIL' },
      { id: 72, name: 'Adams', levels: [14, 13], fromLevel: 14, toLevel: 13, displayTeamId: 158, displayTeamAbbr: 'MIL' },
      { id: 73, name: 'Banks', levels: [13, 12], fromLevel: 13, toLevel: 12, displayTeamId: 158, displayTeamAbbr: 'MIL' },
    ],
  }
  // Same climb of one level: the one who finished higher leads, then by name.
  assert.deepEqual(
    movedUpAt(tied, 13).map((r) => r.name),
    ['Banks', 'Adams', 'Zeller'],
  )
})

test('it fails closed on a missing or unusable board', () => {
  assert.deepEqual(movedUpAt(null, 13), [])
  assert.deepEqual(movedUpAt({}, 13), [])
  // MLB is not a level this board covers.
  assert.deepEqual(movedUpAt(LEADERS, 1), [])
  // A row with no level information at all cannot have climbed.
  assert.deepEqual(movedUpAt({ avg: [{ id: 10, name: 'Thin' }] }, 13), [])
})
