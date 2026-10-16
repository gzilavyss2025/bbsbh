// Coverage for the challengeable-calls denominator (scripts/lib/abs/calls.mjs)
// and the new fields of the club exposure file (export-clubs.mjs).
//
// A batter can only challenge a called strike and a catcher only a called ball,
// counted by the umpire's ORIGINAL call. The feed stores the FINAL call, so an
// overturned strike reads B. Each test fails without the code it pins.
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb, dumpGroup } from '../scripts/lib/db.js'
import {
  buildExposureClubsExport,
  challengeableCallsForGame,
  gamesMissingCalls,
  ingestCalls,
} from '../scripts/lib/abs/index.mjs'

const pitch = (n, code, review) => ({
  isPitch: true, pitchNumber: n, details: { call: { code } }, ...(review ? { reviewDetails: review } : {}),
})
const review = (isOverturned, teamId) => ({ reviewType: 'MJ', challengeTeamId: teamId, isOverturned, player: { id: 1 } })
const play = (atBatIndex, inning, halfInning, batter, events) => ({
  about: { atBatIndex, inning, halfInning }, matchup: { batter: { id: batter } }, playEvents: events,
})
const AWAY = 142
const HOME = 120

// Top 1: away bats, home catcher 11 catches.
//   batter 501: called strike (stands); strike overturned (final B);
//               ball overturned (final C); ball; upheld challenge on a strike.
//               swinging strike S, foul F, intentional ball I, pitchout P.
//   batter 502: one called strike.
// Bottom 1: home bats, away catcher 22 catches. batter 601: one ball.
// Top 2: home catcher swapped to 12. batter 503: one ball.
// Bottom 2: no chart entry. batter 602: one called strike, one ball.
const feed = {
  gameData: { teams: { away: { id: AWAY }, home: { id: HOME } } },
  liveData: {
    plays: {
      allPlays: [
        play(0, 1, 'top', 501, [
          pitch(1, 'C'),
          pitch(2, 'B', review(true, AWAY)),
          pitch(3, 'C', review(true, HOME)),
          pitch(4, 'B'),
          pitch(5, 'C', review(false, AWAY)),
          pitch(6, 'S'), pitch(7, 'F'), pitch(8, 'I'), pitch(9, 'P'),
          { isPitch: false, details: { call: { code: 'C' } } },
        ]),
        play(1, 1, 'top', 502, [pitch(1, 'C')]),
        play(2, 1, 'bottom', 601, [pitch(1, 'B')]),
        play(3, 2, 'top', 503, [pitch(1, '*B')]),
        play(4, 2, 'bottom', 602, [pitch(1, 'C'), pitch(2, 'B')]),
      ],
    },
  },
}
const chart = new Map([
  ['1:top', { id: 11 }], ['1:bottom', { id: 22 }], ['2:top', { id: 12 }],
])
const key = (r) => `${r.role}:${r.teamId}:${r.playerId}`
const byKey = (rows) => Object.fromEntries(rows.map((r) => [key(r), r.calls]))

test('challengeableCallsForGame counts the ORIGINAL call, per role and club', () => {
  const got = byKey(challengeableCallsForGame(feed, chart))
  assert.deepEqual(got, {
    // 501: a strike that stands, a strike overturned to B (still a strike he
    // saw), and an upheld strike. The ball overturned to C is NOT his.
    [`batter:${AWAY}:501`]: 3,
    [`batter:${AWAY}:502`]: 1,
    // Bottom 2 has no catcher in the chart, but its batter still counts.
    [`batter:${HOME}:602`]: 1,
    // Catcher 11: the ball overturned to C (original ball) and a plain ball.
    // The strike overturned to B is NOT his. Swing, foul, I and P are out.
    [`catcher:${HOME}:11`]: 2,
    [`catcher:${AWAY}:22`]: 1,
    // After the swap, and a *B (umpire-called ball in the dirt).
    [`catcher:${HOME}:12`]: 1,
  })
})

test('a half with no catcher credits nobody, and a guess is never made', () => {
  const rows = challengeableCallsForGame(feed, new Map())
  assert.ok(rows.every((r) => r.role === 'batter'))
  assert.equal(byKey(rows)[`batter:${AWAY}:501`], 3)
})

// ---------------------------------------------------------------------------
// the export
// ---------------------------------------------------------------------------

const ex = (teamId, playerId) => ({
  season: 2026, level: 'MLB', team_id: teamId, player_id: playerId, name: `P${playerId}`,
  position: 'C', pitches: 500, plate_appearances: 120, catcher_innings: 300, catcher_starts: 40,
})
const man = (file, teamId, playerId) => file.levels.MLB.byTeam[teamId].find((p) => p.playerId === playerId)
const opts = { season: 2026, levels: ['MLB'], generatedAt: 'x' }
const call = (o) => ({ season: 2026, level: 'MLB', game_pk: 1, ...o })

test('the export ships null with no call rows, and sums per role with them', () => {
  const exposure = [ex(100, 7), ex(100, 8)]
  const bare = buildExposureClubsExport([], exposure, opts)
  assert.equal(man(bare, 100, 7).strikesSeen, null)
  assert.equal(man(bare, 100, 7).ballsReceived, null)
  const gameCalls = [
    call({ game_pk: 1, team_id: 100, player_id: 7, role: 'batter', calls: 30 }),
    call({ game_pk: 2, team_id: 100, player_id: 7, role: 'batter', calls: 20 }),
    call({ game_pk: 2, team_id: 100, player_id: 7, role: 'catcher', calls: 11 }),
    call({ game_pk: 2, team_id: 999, player_id: 7, role: 'batter', calls: 5 }),
    call({ game_pk: 3, level: 'AAA', team_id: 100, player_id: 8, role: 'batter', calls: 9 }),
    call({ game_pk: 4, team_id: 0, player_id: 0, role: 'none', calls: 0 }),
  ]
  const full = buildExposureClubsExport([], exposure, { ...opts, gameCalls })
  assert.equal(man(full, 100, 7).strikesSeen, 50)
  assert.equal(man(full, 100, 7).ballsReceived, 11)
  assert.equal(man(full, 100, 8).strikesSeen, null)
  assert.equal(man(full, 100, 8).ballsReceived, null)
})

// ---------------------------------------------------------------------------
// results strings and wins
// ---------------------------------------------------------------------------

const ch = (over) => ({
  season: 2026, level: 'MLB', date: '2026-04-01', game_pk: 1, seq: 0,
  team_id: 100, player_id: 7, role: 'batter', outcome: 'success', ...over,
})
const rows = [
  ch({ date: '2026-04-03', game_pk: 30, outcome: 'fail' }),
  ch({ date: '2026-04-01', game_pk: 10, seq: 1, outcome: 'success' }),
  ch({ date: '2026-04-01', game_pk: 10, seq: 0, outcome: 'fail' }),
  ch({ date: '2026-04-02', game_pk: 20, outcome: 'success' }),
  ch({ date: '2026-04-02', game_pk: 21, role: 'catcher', outcome: 'success' }),
  ch({ date: '2026-04-04', game_pk: 40, role: 'catcher', outcome: 'fail' }),
  ch({ date: '2026-04-05', game_pk: 50, team_id: 200, outcome: 'success' }),
]

test('wins and results reconcile with asBatter and asCatcher, oldest first, per club', () => {
  const file = buildExposureClubsExport(rows, [ex(100, 7), ex(200, 7), ex(100, 8)], opts)
  const a = man(file, 100, 7)
  assert.equal(a.resultsBatter, '0110')
  assert.equal(a.resultsCatcher, '10')
  assert.equal(a.wonBatter, 2)
  assert.equal(a.wonCatcher, 1)
  const b = man(file, 200, 7)
  assert.equal(b.resultsBatter, '1')
  assert.equal(b.resultsCatcher, '')
  const z = man(file, 100, 8)
  assert.equal(z.resultsBatter, '')
  assert.equal(z.wonBatter, 0)
  for (const p of [a, b, z]) {
    assert.equal(p.resultsBatter.length, p.asBatter)
    assert.equal(p.resultsCatcher.length, p.asCatcher)
  }
})

// ---------------------------------------------------------------------------
// the table
// ---------------------------------------------------------------------------

test('abs_game_calls survives a dump and reopen, and a missing game is findable', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'abs-calls-'))
  const db = await openDb(dir)
  const mark = db.prepare("INSERT INTO abs_ingested_games (game_pk, date, season, level) VALUES (?, '2026-04-01', 2026, 'MLB')")
  for (const pk of [1, 2, 3]) mark.run(pk)
  const rowsFor = [{ teamId: 120, playerId: 11, role: 'catcher', calls: 7 }]
  ingestCalls(db, { season: 2026, level: 'MLB', gamePk: 1 }, rowsFor)
  ingestCalls(db, { season: 2026, level: 'MLB', gamePk: 2 }, [])
  ingestCalls(db, { season: 2026, level: 'MLB', gamePk: 1 }, rowsFor)
  assert.deepEqual(gamesMissingCalls(db, 2026).map((g) => g.game_pk), [3])
  await dumpGroup(db, 'abs-challenges', dir)
  const again = await openDb(dir)
  const got = again.prepare('SELECT game_pk, team_id, player_id, role, calls FROM abs_game_calls ORDER BY game_pk').all()
  assert.deepEqual(got.map((r) => ({ ...r })), [
    { game_pk: 1, team_id: 120, player_id: 11, role: 'catcher', calls: 7 },
    { game_pk: 2, team_id: 0, player_id: 0, role: 'none', calls: 0 },
  ])
  assert.deepEqual(gamesMissingCalls(again, 2026).map((g) => g.game_pk), [3])
})
