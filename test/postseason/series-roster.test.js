// The declared postseason roster on the live series page (#1224). statsapi
// has no postseason roster type (checked live 2026-09-28: /api/v1/rosterTypes
// lists 40Man, fullSeason, fullRoster, nonRosterInvitees, active, allTime,
// depthChart, gameday, coach). A club's declared series roster is its ACTIVE
// roster on a date the series plays: 26 players, set the morning of Game 1.
// Before that the same call answers the September roster (28, or more on an
// off day), and after the club is out it answers the 40-man roster again.
// Pinned on real answers in test/fixtures/postseason/2025-rosters.json.
import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveBracket } from '../../src/api/postseason/bracket.js'
import { rosterReadDate, rosterUrl, seriesRosterDate, shapeRoster } from '../../src/api/postseason/roster.js'
import { rawFixture, results, seriesWith, skeleton } from './fixtures.js'

const bracket2025 = (cutoff) => deriveBracket(skeleton(2025), results(2025), cutoff)
const rosters = rawFixture('2025-rosters')

test('rosterUrl asks for the active roster on one date, and only the fields the card shows', () => {
  const url = rosterUrl(158, '2025-10-04')
  assert.match(url, /^\/api\/v1\/teams\/158\/roster\?/)
  assert.match(url, /rosterType=active/)
  assert.match(url, /date=2025-10-04/)
})

test('seriesRosterDate: the last date the series played on or before the cutoff', () => {
  // NLDS MIL-CHC: Game 1 on 2025-10-04. The morning of Game 1 is the first
  // date the roster is known.
  const nlds = (cutoff) => seriesWith(bracket2025(cutoff), 'NL', 'division', 'MIL')
  assert.equal(seriesRosterDate(nlds('2025-10-04'), '2025-10-04'), '2025-10-04')
  // Heading into 10-09 (Game 4 that day): the cutoff day itself.
  assert.equal(seriesRosterDate(nlds('2025-10-09'), '2025-10-09'), '2025-10-09')
  // Long after the series ended: its last game (Game 5, 2025-10-11), never a
  // later date, when a beaten club is back on its 40-man roster.
  assert.equal(seriesRosterDate(nlds('2025-10-20'), '2025-10-20'), '2025-10-11')
})

test('seriesRosterDate: null before Game 1 day, when no club has named a roster', () => {
  // Heading into 10-03 the NLDS has played nothing and does not play that day.
  const nlds = seriesWith(bracket2025('2025-10-03'), 'NL', 'division', 'MIL')
  assert.equal(seriesRosterDate(nlds, '2025-10-03'), null)
  assert.equal(seriesRosterDate(null, '2025-10-03'), null)
})

// Gary, 2026-09-28: before a series starts, the page shows each club's
// CURRENT roster as a stand-in, with a note that the club names its roster by
// Game 1. The read date is then the cutoff itself.
test('rosterReadDate: the series date once it plays, else the cutoff (the current roster)', () => {
  const nlds = (cutoff) => seriesWith(bracket2025(cutoff), 'NL', 'division', 'MIL')
  assert.equal(rosterReadDate(nlds('2025-10-03'), '2025-10-03'), '2025-10-03')
  assert.equal(rosterReadDate(nlds('2025-10-20'), '2025-10-20'), '2025-10-11')
  assert.equal(rosterReadDate(null, '2025-10-03'), null)
})

test('shapeRoster: a declared 26-man roster, split and ordered like the box-score roster', () => {
  const r = shapeRoster(rosters['158@2025-10-04'], 158, { onSeriesDate: true })
  assert.equal(r.declared, true)
  assert.equal(r.positionPlayers.length + r.pitchers.length, 26)
  assert.ok(r.pitchers.every((p) => p.position === 'P'))
  assert.ok(r.positionPlayers.every((p) => p.position !== 'P'))
  // Catchers lead the position players (scorebook order), names A to Z in a group.
  assert.equal(r.positionPlayers[0].position, 'C')
  const names = r.pitchers.map((p) => p.name)
  assert.deepEqual(
    names,
    [...names].sort((a, b) => a.localeCompare(b)),
  )
  const first = r.pitchers[0]
  assert.equal(typeof first.id, 'number')
  assert.equal(first.teamId, 158)
  assert.ok(first.jersey)
})

test('shapeRoster: the current roster stands in, marked not declared', () => {
  // CHC on 2025-09-29, the day before Wild Card Game 1: 39 active. Shown as
  // the stand-in, never as the declared roster.
  const before = shapeRoster(rosters['112@2025-09-29'], 112, { onSeriesDate: false })
  assert.equal(before.declared, false)
  assert.equal(before.positionPlayers.length + before.pitchers.length, 39)
  // Game 1 morning, before the club names its 26: more than 26 on a series
  // date is still the stand-in.
  assert.equal(shapeRoster(rosters['112@2025-10-20'], 112, { onSeriesDate: true }).declared, false)
  // CHC on its last day, 2025-10-11: still the 26 it named.
  assert.equal(shapeRoster(rosters['112@2025-10-11'], 112, { onSeriesDate: true }).declared, true)
  // 26 or fewer on a date the series did not play is not a declaration either.
  assert.equal(shapeRoster(rosters['112@2025-10-11'], 112, { onSeriesDate: false }).declared, false)
  assert.equal(shapeRoster(null, 112), null)
  assert.equal(shapeRoster({ roster: [] }, 112), null)
})
