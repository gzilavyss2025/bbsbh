// Coverage for the club exposure file's new per-man fields: wins, results
// strings and pitches received (scripts/lib/abs/export.mjs, received.mjs).
//
// Each test fails without the code it pins. The results strings and the win
// counts come from the same rows as asBatter / asCatcher, so they have to
// reconcile with them. Pitches received is replayed from a feed, and its limit
// (a half with no known catcher credits nobody) is the one a guess would break.
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb, dumpGroup } from '../scripts/lib/db.js'
import {
  buildExposureClubsExport,
  gamesMissingReceived,
  ingestReceived,
  pitchesReceivedForGame,
} from '../scripts/lib/abs/index.mjs'
import { catcherChart } from '../src/api/catcherOfRecord.js'

const ch = (over) => ({
  season: 2026, level: 'MLB', date: '2026-04-01', game_pk: 1, seq: 0,
  team_id: 100, player_id: 7, role: 'batter', outcome: 'success', ...over,
})
const ex = (teamId, playerId, over) => ({
  season: 2026, level: 'MLB', team_id: teamId, player_id: playerId, name: `P${playerId}`,
  position: 'C', pitches: 500, plate_appearances: 120, catcher_innings: 300, catcher_starts: 40, ...over,
})
const man = (file, teamId, playerId) =>
  file.levels.MLB.byTeam[teamId].find((p) => p.playerId === playerId)

// Man 7: a batter and a catcher at club 100, then traded to club 200 where he
// only bats. Man 8 never challenged.
const rows = [
  // Out of order on purpose: the string must come out oldest first.
  ch({ date: '2026-04-03', game_pk: 30, seq: 0, outcome: 'fail' }),
  ch({ date: '2026-04-01', game_pk: 10, seq: 1, outcome: 'success' }),
  ch({ date: '2026-04-01', game_pk: 10, seq: 0, outcome: 'fail' }),
  ch({ date: '2026-04-02', game_pk: 20, seq: 0, outcome: 'success' }),
  ch({ date: '2026-04-02', game_pk: 21, seq: 0, role: 'catcher', outcome: 'success' }),
  ch({ date: '2026-04-04', game_pk: 40, seq: 0, role: 'catcher', outcome: 'fail' }),
  ch({ date: '2026-04-05', game_pk: 50, seq: 0, team_id: 200, outcome: 'success' }),
]
const exposure = [ex(100, 7), ex(200, 7), ex(100, 8)]

test('wins and results reconcile with asBatter and asCatcher, per club', () => {
  const file = buildExposureClubsExport(rows, exposure, { season: 2026, levels: ['MLB'], generatedAt: 'x' })
  const a = man(file, 100, 7)
  assert.equal(a.asBatter, 4)
  assert.equal(a.asCatcher, 2)
  assert.equal(a.resultsBatter, '0110')
  assert.equal(a.resultsCatcher, '10')
  assert.equal(a.wonBatter, 2)
  assert.equal(a.wonCatcher, 1)
  // The traded man's other club holds only that club's call.
  const b = man(file, 200, 7)
  assert.equal(b.asBatter, 1)
  assert.equal(b.resultsBatter, '1')
  assert.equal(b.wonBatter, 1)
  assert.equal(b.resultsCatcher, '')
  assert.equal(b.wonCatcher, 0)
  for (const p of [a, b, man(file, 100, 8)]) {
    assert.equal(p.resultsBatter.length, p.asBatter)
    assert.equal(p.resultsCatcher.length, p.asCatcher)
  }
})

test('a man with no challenges gets empty strings and zero wins', () => {
  const file = buildExposureClubsExport(rows, exposure, { season: 2026, levels: ['MLB'], generatedAt: 'x' })
  const z = man(file, 100, 8)
  assert.equal(z.resultsBatter, '')
  assert.equal(z.resultsCatcher, '')
  assert.equal(z.wonBatter, 0)
  assert.equal(z.wonCatcher, 0)
})

test('results order by date, then game, then seq', () => {
  const r = [
    ch({ date: '2026-05-02', game_pk: 5, seq: 0, outcome: 'success' }),
    ch({ date: '2026-05-01', game_pk: 9, seq: 0, outcome: 'fail' }),
    ch({ date: '2026-05-01', game_pk: 8, seq: 1, outcome: 'success' }),
    ch({ date: '2026-05-01', game_pk: 8, seq: 0, outcome: 'fail' }),
  ]
  const file = buildExposureClubsExport(r, [ex(100, 7)], { season: 2026, levels: ['MLB'], generatedAt: 'x' })
  // 05-01 game 8 seq 0 (0), game 8 seq 1 (1), game 9 (0), then 05-02 (1).
  assert.equal(man(file, 100, 7).resultsBatter, '0101')
})

// ---------------------------------------------------------------------------
// pitches received
// ---------------------------------------------------------------------------

const play = (inning, halfInning, pitches, extra = 0) => ({
  about: { inning, halfInning },
  playEvents: [
    ...Array.from({ length: pitches }, () => ({ isPitch: true })),
    ...Array.from({ length: extra }, () => ({ isPitch: false })),
  ],
})
const synth = {
  gameData: { teams: { home: { id: 120 }, away: { id: 142 } } },
  liveData: {
    plays: {
      allPlays: [
        play(1, 'top', 4, 2), // home catcher 11
        play(1, 'top', 3),
        play(1, 'bottom', 5), // away catcher 22
        play(2, 'top', 6), // home catcher swapped to 12
        play(2, 'bottom', 2), // no chart entry: credits nobody
      ],
    },
  },
}
const chart = new Map([
  ['1:top', { id: 11 }], ['1:bottom', { id: 22 }], ['2:top', { id: 12 }],
])

test('pitchesReceivedForGame credits each half to the fielding club catcher', () => {
  const got = pitchesReceivedForGame(synth, chart)
  const sorted = got.sort((a, b) => a.playerId - b.playerId)
  assert.deepEqual(sorted, [
    { teamId: 120, playerId: 11, pitches: 7 },
    { teamId: 120, playerId: 12, pitches: 6 },
    { teamId: 142, playerId: 22, pitches: 5 },
  ])
})

test('pitchesReceivedForGame on a real feed credits every pitch of a fully charted game', () => {
  const feed = JSON.parse(readFileSync(new URL('./fixtures/game-822740.trimmed.json', import.meta.url), 'utf8'))
  const total = feed.liveData.plays.allPlays.reduce((n, p) => n + p.playEvents.filter((e) => e.isPitch).length, 0)
  assert.ok(catcherChart(feed).size > 0)
  const got = pitchesReceivedForGame(feed)
  assert.equal(got.reduce((n, r) => n + r.pitches, 0), total)
  assert.ok(got.every((r) => r.teamId === 120 || r.teamId === 142))
})

// ---------------------------------------------------------------------------
// the export
// ---------------------------------------------------------------------------

test('the export ships pitchesReceived null with no catcher rows, and sums with them', () => {
  const opts = { season: 2026, levels: ['MLB'], generatedAt: 'x' }
  const bare = buildExposureClubsExport(rows, exposure, opts)
  for (const p of [man(bare, 100, 7), man(bare, 200, 7), man(bare, 100, 8)]) assert.equal(p.pitchesReceived, null)
  const catcherPitches = [
    { season: 2026, level: 'MLB', game_pk: 10, team_id: 100, player_id: 7, pitches: 120 },
    { season: 2026, level: 'MLB', game_pk: 20, team_id: 100, player_id: 7, pitches: 130 },
    { season: 2026, level: 'MLB', game_pk: 20, team_id: 200, player_id: 7, pitches: 9 },
    { season: 2026, level: 'AAA', game_pk: 99, team_id: 100, player_id: 8, pitches: 77 },
    { season: 2026, level: 'MLB', game_pk: 20, team_id: 0, player_id: 0, pitches: 0 },
  ]
  const full = buildExposureClubsExport(rows, exposure, { ...opts, catcherPitches })
  assert.equal(man(full, 100, 7).pitchesReceived, 250)
  assert.equal(man(full, 200, 7).pitchesReceived, 9)
  // Another level's pitches never reach this level's man.
  assert.equal(man(full, 100, 8).pitchesReceived, null)
})

// ---------------------------------------------------------------------------
// the table
// ---------------------------------------------------------------------------

test('abs_catcher_pitches survives a dump and reopen, and a missing game is findable', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'abs-received-'))
  const db = await openDb(dir)
  const mark = db.prepare("INSERT INTO abs_ingested_games (game_pk, date, season, level) VALUES (?, '2026-04-01', 2026, 'MLB')")
  for (const pk of [1, 2, 3]) mark.run(pk)
  ingestReceived(db, { season: 2026, level: 'MLB', gamePk: 1 }, [{ teamId: 120, playerId: 11, pitches: 7 }])
  // A game with no catcher gets a sentinel, so it is done and not refetched.
  ingestReceived(db, { season: 2026, level: 'MLB', gamePk: 2 }, [])
  // Idempotent.
  ingestReceived(db, { season: 2026, level: 'MLB', gamePk: 1 }, [{ teamId: 120, playerId: 11, pitches: 7 }])
  assert.deepEqual(gamesMissingReceived(db, 2026).map((g) => g.game_pk), [3])
  await dumpGroup(db, 'abs-challenges', dir)
  const again = await openDb(dir)
  const got = again.prepare('SELECT game_pk, team_id, player_id, pitches FROM abs_catcher_pitches ORDER BY game_pk').all()
  assert.deepEqual(got.map((r) => ({ ...r })), [
    { game_pk: 1, team_id: 120, player_id: 11, pitches: 7 },
    { game_pk: 2, team_id: 0, player_id: 0, pitches: 0 },
  ])
  assert.deepEqual(gamesMissingReceived(again, 2026).map((g) => g.game_pk), [3])
})
