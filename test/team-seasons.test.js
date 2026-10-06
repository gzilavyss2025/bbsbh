import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildTeamSeasons, compactTeamSeasons } from '../scripts/lib/open-data/team-seasons.mjs'
import { CHADWICK_JOIN, RETROSHEET_CREDIT } from '../scripts/lib/open-data/credits.mjs'
import { loadTeamSeasons } from '../src/api/teamSeasons.js'

// "Six degrees of teammates" data (ADR-0100): one roster per MLB team-season from
// Retrosheet's allplayers.csv. Two players are teammates when both have g >= 1 for
// the same team code and season.

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const teams = [
  { team: 'CHN', city: 'Chicago', nickname: 'Cubs' },
  { team: 'SLN', city: 'St. Louis', nickname: 'Cardinals' },
  { team: 'ALS', city: 'American League', nickname: 'All Stars' },
  { team: 'KCM', city: 'Kansas City', nickname: 'Monarchs' },
]
const row = (id, team, season, g = 10) => ({ id, team, season: String(season), g: String(g) })
const players = [
  row('aaaa101', 'CHN', 1998), // traded: Cubs, then Cardinals, same season
  row('aaaa101', 'SLN', 1998),
  row('bbbb101', 'CHN', 1998),
  row('cccc101', 'SLN', 1998),
  row('dddd101', 'CHN', 1998, 0), // on the roster, never played: no edge
  row('eeee101', 'ALS', 1998), // All-Star game side: not a team
  row('ffff101', 'KCM', 1998), // Negro Leagues club: out of scope
  row('gggg101', 'CHN', 1998), // no MLBAM match
  row('aaaa101', 'CHN', 1999),
]
const retroToMlbam = new Map([
  ['aaaa101', '1'],
  ['bbbb101', '2'],
  ['cccc101', '3'],
  ['dddd101', '4'],
  ['eeee101', '5'],
  ['ffff101', '6'],
])
const build = (rows = players) => buildTeamSeasons({ players: rows, teams, retroToMlbam })
const rosterOf = (out, key) => out.teamSeasons.find((t) => t.key === key)?.playerIds

test('a midseason trade puts the player on both rosters, and only his own teammates beside him', () => {
  const out = build()
  assert.deepEqual(rosterOf(out, 'CHN-1998'), [1, 2])
  assert.deepEqual(rosterOf(out, 'SLN-1998'), [1, 3])
})

test('the label reads nickname and season; the same club in another year is another team-season', () => {
  const out = build()
  assert.equal(out.teamSeasons.find((t) => t.key === 'CHN-1998').label, 'Cubs 1998')
  assert.deepEqual(rosterOf(out, 'CHN-1999'), [1])
})

test('a g of 0, an All-Star side and a Negro Leagues club make no team-season', () => {
  const out = build()
  assert.deepEqual(out.teamSeasons.map((t) => t.key), ['CHN-1998', 'SLN-1998', 'CHN-1999'])
  assert.ok(!out.teamSeasons.some((t) => t.playerIds.some((id) => [4, 5, 6].includes(id))))
})

test('the report counts MLB players that do not bridge, and the share', () => {
  const { report } = build()
  assert.equal(report.mlbPlayers, 4) // a, b, c, g (d never played, e and f are out of scope)
  assert.equal(report.bridged, 3)
  assert.equal(report.unbridged, 1)
  assert.equal(report.share, 0.75)
})

test('input order does not change the output', () => {
  assert.deepEqual(build([...players].reverse()), build())
})

test('compact: players list once, rosters are indexes into it', () => {
  const c = compactTeamSeasons(build())
  assert.deepEqual(c.players, [1, 2, 3])
  assert.deepEqual(c.teamSeasons, [
    ['CHN-1998', 'Cubs 1998', [0, 1]],
    ['SLN-1998', 'Cardinals 1998', [0, 2]],
    ['CHN-1999', 'Cubs 1999', [0]],
  ])
})

test('the generator writes one file: credits, throughSeason, no clock; a low bridge share fails the run', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'team-seasons-'))
  const csv = (rows) => rows.map((r) => r.join(',')).join('\n') + '\n'
  const ap = join(dir, 'allplayers.csv')
  const tm = join(dir, 'teams0.csv')
  const reg = join(dir, 'people-0.csv')
  await writeFile(ap, csv([['id', 'last', 'first', 'team', 'g', 'season'], ...players.map((p) => [p.id, 'L', 'F', p.team, p.g, p.season])]))
  await writeFile(tm, csv([['team', 'city', 'nickname', 'first_g', 'last_g'], ...teams.map((t) => [t.team, t.city, t.nickname, '', ''])]))
  await writeFile(reg, csv([['key_mlbam', 'key_retro'], ...[...retroToMlbam].map(([r, m]) => [m, r])]))
  const out = join(dir, 'out.json')
  const run = (...extra) =>
    execFileSync('node', [join(root, 'scripts/gen-team-seasons.mjs'), ap, tm, reg, '--out', out, ...extra], { encoding: 'utf8', stdio: 'pipe' })

  assert.throws(() => run(), /98/) // 3 of 4 bridge: below the gate
  run('--min-share', '0.5')
  const file = JSON.parse(await readFile(out, 'utf8'))
  assert.deepEqual(file.credit, [RETROSHEET_CREDIT, CHADWICK_JOIN])
  assert.equal(file.throughSeason, 1999)
  assert.equal('generatedAt' in file, false)
  assert.deepEqual(file.players, [1, 2, 3])
  assert.equal(file.teamSeasons.length, 3)
})

test('the reader returns the compact structure, and an empty one when the file is missing', async () => {
  const real = globalThis.fetch
  try {
    globalThis.fetch = async () => ({ ok: false, status: 404 })
    assert.deepEqual(await loadTeamSeasons(), { credit: [], throughSeason: null, players: [], teamSeasons: [] })
  } finally {
    globalThis.fetch = real
  }
})
