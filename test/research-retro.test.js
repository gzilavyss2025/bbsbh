// The history store (#3135): Retrosheet event files and cwevent rows -> plate-appearance
// rows keyed on gamePk. scripts/lib/research/retro.mjs.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CWEVENT_FIELDS, PA_COLS, PARK_COLS, gameIndex, joinSeason, monthShards, parkFile, parkPart, parkTable, parseEventFile, peopleNames, scheduleRows, seasonEntry, seasonRows, splitCsvLine,
} from '../scripts/lib/research/retro.mjs'

const EVENT_FILE = [
  'id,MIL201404010',
  'version,2',
  'info,visteam,ATL',
  'info,hometeam,MIL',
  'info,site,MIL06',
  'info,date,2014/04/01',
  'info,number,0',
  'info,daynight,night',
  'info,usedh,false',
  'info,pitches,pitches',
  'start,heywj001,"Jason Heyward",0,1,9',
  'play,1,0,heywj001,22,BCX,S8/G',
  'sub,smitj001,"Joe Smith",0,1,9',
  'play,1,0,upton001,??,,NP',
  'play,1,0,upton001,??,,K',
  'id,MIL201404020',
  'info,visteam,ATL',
  'info,hometeam,MIL',
  'info,date,2014/04/02',
  'info,number,0',
  'info,pitches,none',
  'play,1,0,heywj001,,,63',
].join('\r\n')

test('parseEventFile: games, info, and play lines without NP', () => {
  const games = parseEventFile(EVENT_FILE)
  assert.equal(games.length, 2)
  assert.equal(games[0].id, 'MIL201404010')
  assert.equal(games[0].info.site, 'MIL06')
  assert.deepEqual(games[0].plays, [['22', 'BCX'], ['??', '']]) // the NP line is not a play
  assert.deepEqual(games[1].plays, [['', '']])
})

const sched = (o) => ({ gamePk: 1, officialDate: '2014-04-01', gameType: 'R', state: 'Final', home: 158, away: 144, doubleHeader: 'N', gameNumber: 1, venue: 32, venueName: 'Miller Park', homeRuns: 2, awayRuns: 1, ...o })
const retro = (id, date, home = 'MIL', vis = 'ATL', number = '0') => ({ id, info: { date, hometeam: home, visteam: vis, number } })

test('joinSeason: exact key first, then the same two clubs either way round', () => {
  const rows = [
    sched({ gamePk: 1 }),
    // 04-02: statsapi has the clubs swapped (a makeup in the other park)
    sched({ gamePk: 2, officialDate: '2014-04-02', home: 144, away: 158 }),
    sched({ gamePk: 3, officialDate: '2014-04-03', state: 'Postponed' }),
    sched({ gamePk: 4, officialDate: '2014-04-03', gameType: 'S' }),
  ]
  const { byId, unjoined, teamOf } = joinSeason([retro('A', '2014/04/01'), retro('B', '2014/04/02'), retro('C', '2014/04/03')], rows)
  assert.equal(teamOf.get('MIL'), 158)
  assert.equal(byId.get('A').gamePk, 1)
  assert.equal(byId.get('B').gamePk, 2)
  assert.deepEqual(unjoined, ['C']) // a postponed game and a spring game never join
})

test('joinSeason: a game with no number line is game 1, even when statsapi lists game 2 first', () => {
  const rows = [
    sched({ gamePk: 22, doubleHeader: 'Y', gameNumber: 2 }),
    sched({ gamePk: 11, doubleHeader: 'Y', gameNumber: 1 }),
  ]
  const game = { id: 'A', info: { date: '2014/04/01', hometeam: 'MIL', visteam: 'ATL' } }
  assert.equal(joinSeason([game], rows).byId.get('A').gamePk, 11)
})

test('scheduleRows flattens a statsapi schedule', () => {
  const s = { dates: [{ games: [{ gamePk: 9, officialDate: '1961-04-10', gameType: 'R', status: { detailedState: 'Final' }, teams: { home: { team: { id: 120 } }, away: { team: { id: 145 } } }, doubleHeader: 'N', gameNumber: 1, venue: { id: 3, name: 'Park' }, linescore: { teams: { home: { runs: 3 }, away: { runs: 4 } } } }] }] }
  assert.deepEqual(scheduleRows(s), [{ gamePk: 9, officialDate: '1961-04-10', gameType: 'R', state: 'Final', home: 120, away: 145, doubleHeader: 'N', gameNumber: 1, venue: 3, venueName: 'Park', homeRuns: 3, awayRuns: 4 }])
  assert.deepEqual(scheduleRows({}), [])
})

test('splitCsvLine keeps a quoted comma', () => {
  assert.deepEqual(splitCsvLine('"a,b",c,'), ['a,b', 'c', ''])
})

// One cwevent line in CWEVENT_FIELDS order.
const FIELD_NAMES = ['gid', 'inn', 'half', 'outs', 'balls', 'strikes', 'pseq', 'vis', 'home', 'bat', 'bh', 'pit', 'ph', 'r1', 'r2', 'r3', 'slot', 'ev', 'batEv', 'hit', 'sh', 'sf', 'dp', 'tp', 'rbi', 'bd', 'd1', 'd2', 'd3', 'evn']
const line = (o) => {
  const d = { gid: 'MIL201404010', inn: 1, half: 0, outs: 0, balls: 0, strikes: 0, pseq: '', vis: 0, home: 0, bat: 'heywj001', bh: 'L', pit: 'garzm001', ph: 'R', r1: '', r2: '', r3: '', slot: 1, ev: 2, batEv: 'T', hit: 0, sh: 'F', sf: 'F', dp: 'F', tp: 'F', rbi: 0, bd: '', d1: '', d2: '', d3: '', evn: 1, ...o }
  return FIELD_NAMES.map((k) => `"${d[k]}"`).join(',')
}

test('the field list matches the line builder', () => {
  assert.equal(CWEVENT_FIELDS.split(',').length, FIELD_NAMES.length)
})

test('seasonRows: one row per PA, an unknown count is null, flags and runners', () => {
  const games = parseEventFile(EVENT_FILE)
  const byId = new Map([['MIL201404010', sched({ gamePk: 7 })]])
  const ids = { heywj001: 518792, garzm001: 446334 }
  const csv = [
    line({ evn: 1, balls: 2, strikes: 2, pseq: 'BCX', ev: 20, hit: 1, vis: 1, home: 3 }),
    line({ evn: 2, ev: 3, outs: 1, r1: 'x', r3: 'y', sf: 'T', dp: 'T', bat: 'nobody01', bh: '?' }), // the play after the NP line
    line({ evn: 3, ev: 4, batEv: 'F' }), // a stolen base: not a PA
    line({ gid: 'MIL201404020', evn: 1 }), // a game with no gamePk
  ].join('\n')
  const { rows, games: gs, stats } = seasonRows(csv, games, byId, (r) => ids[r] ?? null)
  assert.equal(rows.length, 2)
  const [a, b] = rows
  assert.deepEqual([a.gamePk, a.ab, a.batter, a.pitcher, a.event, a.balls, a.strikes, a.pseq, a.bsd, a.stand, a.hit], [7, 1, 518792, 446334, 20, 2, 2, 'BCX', -2, 'L', 1])
  assert.equal(a.month, '04')
  // Raw count '??': cwevent prints 0-0, the row says unknown.
  assert.deepEqual([b.balls, b.strikes, b.bases, b.fl, b.batter, b.stand], [null, null, 5, 2 | 4, null, null])
  assert.deepEqual([stats.pas, stats.skippedUnjoined, stats.pitchString, stats.knownCount, stats.unbridged], [2, 1, 1, 1, ['nobody01']])
  assert.deepEqual(gs.map((g) => [g.gamePk, g.park, g.night, g.pitches, g.venue]), [[7, 'MIL06', 1, 2, 32]])
})

test('seasonRows: the home half reads the margin from the home side; rows sort by date, game, event', () => {
  const games = parseEventFile(EVENT_FILE)
  const byId = new Map([['MIL201404010', sched({ gamePk: 7 })]])
  const csv = [line({ evn: 2, half: 1, vis: 1, home: 3 }), line({ evn: 1 })].join('\n')
  const { rows } = seasonRows(csv, games, byId, () => 1)
  assert.deepEqual(rows.map((r) => [r.ab, r.bsd]), [[1, 0], [2, 2]])
})

test('seasonRows: a raw pitch string with a stray space matches cwevent, which trims it', () => {
  // CHA197409200 event 47 (1974): the event file has ' X'; cwevent prints 'X'.
  const games = parseEventFile(EVENT_FILE.replace('play,1,0,heywj001,22,BCX,S8/G', 'play,1,0,heywj001,22, X,S8/G'))
  const { rows, stats } = seasonRows(line({ evn: 1, pseq: 'X' }), games, new Map([['MIL201404010', sched()]]), () => 1)
  assert.equal(stats.pseqDiffers, 0)
  assert.equal(rows[0].pseq, 'X')
})

test('seasonRows counts a pitch string that differs from the raw play line', () => {
  const games = parseEventFile(EVENT_FILE)
  const { stats } = seasonRows(line({ evn: 1, pseq: 'BBX' }), games, new Map([['MIL201404010', sched()]]), () => 1)
  assert.equal(stats.pseqDiffers, 1)
})

// #3163: runs on each PA (`er`) and runs on non-PA events while it was up (`pr`), from
// cwevent's destination fields (4 and up: scored).
test('seasonRows: runs on the play, and runs that scored between plays', () => {
  const plays = Array.from({ length: 6 }, (_, i) => `play,1,0,heywj001,00,X,E${i}`)
  const file = ['id,MIL201404010', 'info,visteam,ATL', 'info,hometeam,MIL', 'info,date,2014/04/01', ...plays].join('\n')
  const csv = [
    line({ evn: 1, ev: 20, bd: 1 }), // single
    line({ evn: 2, ev: 9, batEv: 'F', r1: 'a', r3: 'b', d3: 4 }), // a wild pitch scores the runner from 3rd
    line({ evn: 3, ev: 23, bd: 4, d1: 4, r1: 'a' }), // two-run homer
    line({ evn: 4, ev: 20, bd: 1, half: 1 }), // bottom half: a single
    line({ evn: 5, ev: 4, batEv: 'F', half: 1, r3: 'c', d3: 5 }), // a steal of home (unearned)...
    line({ evn: 6, ev: 6, batEv: 'F', half: 1, outs: 2, r1: 'd', d1: 0 }), // ...then caught stealing ends the half
  ].join('\n')
  const { rows } = seasonRows(csv, parseEventFile(file), new Map([['MIL201404010', sched()]]), () => 1)
  assert.deepEqual(rows.map((r) => [r.ab, r.er, r.pr]), [[1, 0, 0], [3, 2, 1], [4, 0, 1]], 'a half that ends with no PA gives its runs to the club’s last PA')
})

const row = (o) => ({ date: '2014-04-01', month: '04', pseq: 'X', gamePk: 1, ab: 1, batter: 1, pitcher: 2, event: 2, inn: 1, half: 0, outs: 0, bases: 0, balls: 0, strikes: 0, stand: 'R', throws: 'R', bsd: 0, slot: 1, hit: 0, rbi: 0, fl: 0, er: 0, pr: 0, ...o })

test('monthShards: two parallel files per month, the same row order', () => {
  const shards = monthShards([row({ ab: 1 }), row({ ab: 2, pseq: 'BX' }), row({ date: '2014-05-01', month: '05', ab: 1 })], 2014)
  assert.deepEqual(shards.map((s) => s.month), ['04', '05'])
  const [apr] = shards
  assert.deepEqual(apr.pa.cols, PA_COLS)
  assert.deepEqual(apr.pa.c[PA_COLS.indexOf('ab')], [1, 2])
  assert.deepEqual(apr.pitches.pseq, ['X', 'BX'])
  assert.equal(apr.pa.c.length, PA_COLS.length)
})

test('parkPart + parkFile join seasons column by column', () => {
  const f = parkFile('MIL06', [parkPart([row({ ab: 1 })]), parkPart([row({ ab: 9, pseq: 'C' })])])
  assert.deepEqual(f.cols, PARK_COLS)
  assert.deepEqual(f.c[PARK_COLS.indexOf('ab')], [1, 9])
  assert.deepEqual(f.c[PARK_COLS.indexOf('pseq')], ['X', 'C'])
})

test('parkTable: the venue a park code holds most games at', () => {
  const g = (o) => ({ date: '1990-05-01', park: 'CHI11', venue: 17, venueName: 'Wrigley Field', ...o })
  const parks = parkTable([g(), g(), g({ venue: 21, venueName: 'Elsewhere', date: '1995-05-01' }), g({ park: null })])
  assert.deepEqual(parks, { CHI11: { venue: 17, name: 'Wrigley Field', first: 1990, last: 1995, games: 3 } })
})

test('seasonEntry: coverage shares and month rows', () => {
  const shards = monthShards([row({}), row({ ab: 2 })], 2014)
  const games = [{ date: '2014-04-01' }]
  assert.deepEqual(seasonEntry({ pas: 3, pitchString: 1, knownCount: 2 }, games, shards), { games: 1, pas: 3, pitchString: 33.3, knownCount: 66.7, months: { '04': { pas: 2, through: '2014-04-01', events: { field_out: 2 } } } })
})

// #3159: each month's result counts, keyed the way the page reads history rows
// (history.js historyEvent), so /research skips a season that holds none of a picked result.
test('seasonEntry: month events count the Savant result names', () => {
  const shards = monthShards([row({ event: 23 }), row({ ab: 2, event: 23 }), row({ ab: 3, event: 2, fl: 4 }), row({ ab: 4, event: 2, fl: 2 })], 2014)
  const { events } = seasonEntry({ pas: 4, pitchString: 4, knownCount: 4 }, [{ date: '2014-04-01' }], shards).months['04']
  assert.deepEqual(events, { home_run: 2, double_play: 1, sac_fly: 1 })
})

test('gameIndex keeps the column order', () => {
  const idx = gameIndex([{ gamePk: 5, date: '1961-04-10', home: 1, away: 2, park: 'X', venue: 3, num: 0, night: 0, dh: 0, pitches: 0, homeRuns: null, awayRuns: null }], 1961)
  assert.equal(idx.c[0][0], 5)
  assert.equal(idx.c[idx.cols.indexOf('homeRuns')][0], null)
})

test('peopleNames: only the ids asked for, first row wins', () => {
  const reg = [
    { key_mlbam: '1', name_first: 'Hank', name_last: 'Aaron' },
    { key_mlbam: '1', name_first: 'Henry', name_last: 'Aaron' },
    { key_mlbam: '2', name_first: '', name_last: '' },
    { key_mlbam: '3', name_first: 'Not', name_last: 'Asked' },
  ]
  assert.deepEqual(peopleNames(reg, new Set([1, 2])), { 1: 'Hank Aaron' })
})
