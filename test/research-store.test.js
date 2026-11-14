// The /research store (#2234): the shard layout round trip, the filter definitions
// (Gary's decision 7), the URL format, the answer, and the generator's date rules.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countBit, decodePlateAppearances, encodeMonth } from '../src/api/research/shard.js'
import { basesOf, buildQuery, clubName, fieldOf, horizontalThird, isBlank, matcher, mayMatch, parseQuery, seasonsFor, unsupported } from '../src/api/research/filters.js'
import { answer } from '../src/api/research/answer.js'
import { coverage, seasonEvents, seasonsOnFile } from '../src/api/research/store.js'
import { mergeIndex, monthDays, recentMonths, savantDayUrl, seasonMonths, shrinkReason } from '../scripts/lib/research/store.mjs'

// One Savant CSV row, with only the columns the store reads.
const row = (o) => ({
  game_pk: '1', game_date: '2026-06-01', game_type: 'R', home_team: 'MIL', away_team: 'CHC',
  at_bat_number: '1', pitch_number: '1', balls: '0', strikes: '0', outs_when_up: '0',
  on_1b: '', on_2b: '', on_3b: '', inning: '1', inning_topbot: 'Top', batter: '10', pitcher: '20',
  stand: 'L', p_throws: 'L', pitch_type: 'SI', description: 'ball', events: '', plate_x: '0.5',
  hc_x: '', hc_y: '', launch_speed: '', launch_angle: '', bat_score_diff: '0', ...o,
})

const ROWS = [
  row({ pitch_number: '1' }),
  row({ pitch_number: '2', balls: '1', description: 'automatic_strike', plate_x: '', pitch_type: '' }), // pitch clock: dropped
  row({ pitch_number: '3', balls: '1', strikes: '0', description: 'hit_into_play', events: 'home_run', plate_x: '0.6', hc_x: '40', hc_y: '80', launch_speed: '101.3', launch_angle: '27' }),
  row({ at_bat_number: '2', batter: '11', stand: 'R', pitch_number: '1', description: 'called_strike', events: 'strikeout', on_2b: '7', outs_when_up: '1' }),
  row({ game_pk: '2', game_date: '2026-06-01', at_bat_number: '1', events: 'walk', balls: '3', strikes: '2' }), // game 2 of a doubleheader
  row({ game_pk: '3', game_date: '2026-06-03', at_bat_number: '1', batter: '10', pitch_number: '1', events: 'home_run', description: 'hit_into_play', plate_x: '-0.6', hc_x: '200', hc_y: '80' }),
]

const shard = encodeMonth(ROWS, { season: 2026, month: '06', names: { 10: 'Lefty Bat', 20: 'Lefty Arm' } })
const pas = decodePlateAppearances(shard)

test('a month shard round-trips to plate appearances', () => {
  assert.equal(shard.cols.g.length, 5, 'the pitch-clock row with no plate_x and no event is dropped')
  assert.equal(shard.through, '2026-06-03')
  assert.deepEqual(shard.people, { 10: 'Lefty Bat', 20: 'Lefty Arm' })
  assert.equal(pas.length, 4)
  const hr = pas[0]
  assert.equal(hr.event, 'home_run')
  assert.equal(hr.nPitches, 2)
  assert.equal(hr.px, 0.6, 'px is the last pitch')
  assert.equal(hr.pitchType, 'SI')
  assert.equal(hr.counts, (1 << 0) | (1 << 3), 'passed through 0-0 and 1-0')
  assert.equal(hr.launchSpeed, 101.3)
  assert.equal(hr.batTeam, 'CHC')
  assert.equal(pas[1].runners, 2)
  assert.equal(pas[1].stand, 'R')
})

test('a truncated plate appearance or a baserunning event is not a plate appearance', () => {
  const rows = [
    row({ at_bat_number: '7', events: 'truncated_pa', description: 'ball' }),
    row({ at_bat_number: '8', events: 'caught_stealing_2b', description: 'ball' }),
    row({ at_bat_number: '9', events: 'single', description: 'hit_into_play' }),
  ]
  const got = decodePlateAppearances(encodeMonth(rows, { season: 2026, month: '06' }))
  assert.deepEqual(got.map((p) => p.event), ['single'])
})

test('the later of two same-day games between the same clubs is game 2', () => {
  assert.equal(pas[0].gameNumber, 1)
  assert.equal(pas[2].gameNumber, 2)
  assert.equal(pas[3].gameNumber, 1)
})

test('inner third is the third of the plate nearest the batter, flipped by side', () => {
  assert.equal(horizontalThird(0.6, 'L'), 'inner')
  assert.equal(horizontalThird(-0.6, 'L'), 'outer')
  assert.equal(horizontalThird(-0.6, 'R'), 'inner')
  assert.equal(horizontalThird(0, 'R'), 'middle')
  assert.equal(horizontalThird(0.75, 'L'), null, 'off the plate is in no third')
  assert.equal(horizontalThird(null, 'L'), null)
})

test('opp field is more than 15 degrees from center toward the opposite side', () => {
  // hc_x 40 is toward left field (the home plate x is 125.42).
  assert.equal(fieldOf(40, 80, 'L'), 'oppo')
  assert.equal(fieldOf(40, 80, 'R'), 'pull')
  assert.equal(fieldOf(200, 80, 'R'), 'oppo')
  assert.equal(fieldOf(130, 60, 'R'), 'center')
  assert.equal(fieldOf(null, null, 'R'), null)
})

test('the worked example matches only the lefty oppo homer off a sinker inside', () => {
  const q = parseQuery('?res=home_run&fld=oppo&pt=SI&loc=inner&bh=L&ph=L')
  assert.deepEqual(pas.filter(matcher(q)).map((p) => p.key), ['1-1'])
})

test('invert excludes, count means passed through, and the cutoff holds out its day', () => {
  assert.deepEqual(pas.filter(matcher(parseQuery('?res=!home_run'))).map((p) => p.event), ['strikeout', 'walk'])
  assert.deepEqual(pas.filter(matcher(parseQuery('?cnt=1-0'))).map((p) => p.key), ['1-1'])
  assert.deepEqual(pas.filter(matcher(parseQuery('?res=home_run'), '2026-06-03')).map((p) => p.date), ['2026-06-01'])
})

test('the URL round-trips and drops values it does not know', () => {
  const q = parseQuery('?ask=most&res=!home_run.double&bh=L&bat=10&team=MIL&pt=ZZ&park=<x>')
  assert.deepEqual(q.chips, { res: { vals: ['home_run', 'double'], inv: true }, bh: { vals: ['L'], inv: false } })
  assert.equal(q.park, null)
  assert.deepEqual(parseQuery(buildQuery(q)), q)
  assert.equal(buildQuery(q, { d: '2026-06-02' }).endsWith('&d=2026-06-02'), true)
})

test('the answer is newest first, with ordinals and the any-result base', () => {
  const a = answer(pas, parseQuery('?res=home_run&bat=10'))
  assert.deepEqual(a.matches.map((m) => [m.date, m.ordinal]), [['2026-06-03', 2], ['2026-06-01', 1]])
  assert.equal(a.base, 3, 'the same query with any result: two homers and a walk')
  assert.equal(a.totals.hr, 2)
  assert.deepEqual(a.batters, [{ id: 10, n: 2 }])
})

test('a season range before the tracking era blocks the pitch cards', () => {
  assert.deepEqual(unsupported(2026), [])
  assert.deepEqual(unsupported(2000).map((u) => u.key), ['pt', 'loc', 'fld'])
})

test('the generator never asks Savant with the ignored hand params, and never for today', () => {
  const url = new URL(savantDayUrl('2026-06-01'))
  assert.equal(url.searchParams.has('stand'), false)
  assert.equal(url.searchParams.has('p_throws'), false)
  assert.equal(url.searchParams.get('game_date_gt'), '2026-06-01')
  assert.equal(url.searchParams.get('game_date_lt'), '2026-06-01')
  assert.deepEqual(monthDays(2026, '06', '2026-06-03'), ['2026-06-01', '2026-06-02'])
  assert.equal(monthDays(2026, '02', '2026-03-01').length, 28)
  assert.deepEqual(seasonMonths(2026, '2026-05-02'), ['03', '04', '05'])
})

test('the index keeps the months it already had', () => {
  const one = mergeIndex(null, 2026, '05', { through: '2026-05-31', cols: { g: [0, 0] } }, [{ event: 'single' }], 't1')
  const two = mergeIndex(one, 2026, '06', shard, pas, 't2')
  assert.deepEqual(Object.keys(two.seasons[2026].months), ['05', '06'])
  assert.equal(two.seasons[2026].months['06'].pitches, 5)
  assert.equal(two.built, 't2')
})

test('the nightly window rebuilds the month or two its last 3 days fall in, whole', () => {
  assert.deepEqual(recentMonths('2026-06-15'), [{ season: 2026, month: '06' }])
  assert.deepEqual(recentMonths('2026-07-02'), [{ season: 2026, month: '06' }, { season: 2026, month: '07' }])
  assert.deepEqual(recentMonths('2026-04-01'), [{ season: 2026, month: '03' }])
  assert.deepEqual(recentMonths('2026-11-01'), [{ season: 2026, month: '10' }])
  assert.deepEqual(recentMonths('2026-11-03'), [{ season: 2026, month: '10' }, { season: 2026, month: '11' }])
  assert.deepEqual(recentMonths('2027-01-02'), [], 'no season month in the window')
  assert.deepEqual(recentMonths('2026-03-01'), [], 'February is not a season month')
  assert.deepEqual(recentMonths('2026-03-02'), [{ season: 2026, month: '03' }])
})

test('a rebuilt month may grow or hold, never shrink', () => {
  assert.equal(shrinkReason(undefined, 10), null, 'a new month is fine')
  assert.equal(shrinkReason({ pitches: 100 }, 100), null)
  assert.equal(shrinkReason({ pitches: 100 }, 120), null)
  assert.match(shrinkReason({ pitches: 100 }, 99), /fewer than the 100 on file/)
})

test('a filter card with nothing picked stays open and filters nothing', () => {
  const q = { chips: { ph: { vals: [], inv: false } } }
  assert.equal(pas.filter(matcher(q)).length, pas.length)
  assert.equal(isBlank(q), true)
  assert.equal(pas.filter(matcher({ chips: { res: { vals: [], inv: true } } })).length, pas.length, 'an inverted empty card filters nothing either')
})

test('runners: one chip per base state, and old links still parse', () => {
  const run = (v) => pas.filter(matcher(parseQuery(`?run=${v}`))).map((p) => p.key)
  assert.deepEqual(run('---'), ['1-1', '2-1', '3-1'], 'bases empty')
  assert.deepEqual(run('-2-'), ['1-2'], 'runner on second only')
  assert.deepEqual(run('1--'), [], 'nobody stood on first alone')
  assert.deepEqual(parseQuery('?run=risp').chips.run.vals, ['-2-', '--3', '12-', '1-3', '-23'])
  assert.deepEqual(parseQuery('?run=risp.loaded').chips.run.vals, ['-2-', '--3', '12-', '1-3', '-23', '123'])
  assert.deepEqual(parseQuery('?run=empty.first').chips.run.vals, ['---', '1--'])
  assert.deepEqual(basesOf('1-3'), { first: true, second: false, third: true })
})

test('pitching club filters the fielding side, and every club code has a full name', () => {
  // The fixture's top halves: CHC bats, MIL pitches.
  assert.deepEqual(pas.filter(matcher(parseQuery('?pteam=MIL'))).length, 4)
  assert.deepEqual(pas.filter(matcher(parseQuery('?pteam=CHC'))).length, 0)
  assert.equal(parseQuery(buildQuery(parseQuery('?pteam=MIL'))).pitchTeam, 'MIL')
  assert.equal(isBlank(parseQuery('?pteam=MIL')), false)
  assert.equal(clubName('MIL'), 'Milwaukee Brewers')
  assert.equal(clubName('AZ'), 'Arizona Diamondbacks')
  assert.equal(clubName('ATH'), 'Athletics')
  assert.equal(clubName('ZZZ'), 'ZZZ', 'an unknown code shows as itself')
})

test('the index counts each month\'s results, and a season with none of a picked result is skipped', () => {
  const ix = mergeIndex(null, 2026, '06', shard, pas, 't')
  assert.deepEqual(ix.seasons[2026].months['06'].events, { home_run: 2, strikeout: 1, walk: 1 })
  assert.equal(ix.seasons[2026].months['06'].pas, 4)
  const events = seasonEvents(ix, 2026)
  assert.equal(mayMatch(parseQuery('?res=home_run'), events), true)
  assert.equal(mayMatch(parseQuery('?res=triple_play'), events), false)
  assert.equal(mayMatch(parseQuery('?res=!triple_play'), events), true, 'an inverted result card can match anything')
  assert.equal(mayMatch(parseQuery('?res=triple_play'), null), true, 'no counts on file: maybe')
  assert.equal(seasonEvents({ seasons: { 2025: { months: { '06': { pas: 3 } } } } }, 2025), null, 'a month built before the counts')
})

test('the seasons a query searches: a range, every season for Last time, else the latest', () => {
  const on = [2015, 2016, 2017, 2025, 2026]
  assert.deepEqual(seasonsFor(parseQuery('?res=triple_play'), on, null), [2026, 2025, 2017, 2016, 2015])
  assert.deepEqual(seasonsFor(parseQuery('?ask=often&res=home_run'), on, null), [2026])
  assert.deepEqual(seasonsFor(parseQuery('?ask=often&yr=2016-2015'), on, null), [2016, 2015], 'a reversed range is put in order')
  assert.deepEqual(seasonsFor(parseQuery('?res=walk'), on, '2025-06-01'), [2025, 2017, 2016, 2015], '?d= holds out later seasons')
  assert.deepEqual(seasonsFor(parseQuery('?ask=most&yr=2026'), on, '2025-06-01'), [], 'a range wholly after ?d= reads nothing')
})

test('the Seasons range round-trips in the URL, and a range alone is still blank', () => {
  assert.equal(buildQuery(parseQuery('?yr=2019-2015&res=walk')), '?res=walk&yr=2015-2019')
  assert.equal(buildQuery(parseQuery('?yr=2020')), '?yr=2020')
  assert.equal(parseQuery('?yr=20x0').years, null)
  assert.equal(isBlank(parseQuery('?yr=2020')), true)
})

test('the coverage line reads only the seasons asked, and a season with no plays is not on file', () => {
  const ix = { seasons: { 2015: { months: { '04': { through: '2015-04-30', pitches: 10, pas: 3 } } }, 2026: { months: { '04': { through: '2026-04-30', pitches: 20, pas: 5 } } }, 2027: { months: { '03': { through: '', pitches: 0, pas: 0 } } } } }
  assert.deepEqual(seasonsOnFile(ix), [2015, 2026])
  assert.deepEqual(coverage(ix, [2015]), { first: 2015, last: 2015, through: '2015-04-30', pitches: 10 })
  assert.equal(coverage(ix).pitches, 30)
})

test('a pitch with no count on file passes through no count', () => {
  assert.equal(countBit(null, null), 0, 'a null count is not 0-0')
  assert.equal(countBit(0, 0), 1)
  assert.equal(countBit(4, 2), 0, 'off the grid')
})

test('a matches-only answer has the same matches and no share or tables', () => {
  const q = parseQuery('?res=home_run')
  const full = answer(pas, q, null)
  const lean = answer(pas, q, null, { matchesOnly: true })
  assert.deepEqual(lean.matches, full.matches)
  assert.deepEqual(Object.keys(lean), ['matches'])
})
