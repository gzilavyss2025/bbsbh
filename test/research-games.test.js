// The /research game mode (#3137): plays grouped by game and batting club, then tested on
// totals and on how the runs scored. src/api/research/games.js.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodePlateAppearances, encodeMonth } from '../src/api/research/shard.js'
import { answerGames, buildGameParams, clubGames, gameMatcher, isGameBlank, parseGameQuery, summarizeGames } from '../src/api/research/games.js'

// One Savant row; `s` is [bat_score, post_bat_score], `d` the batting club's margin before.
const row = (o) => ({
  game_pk: '1', game_date: '2026-06-01', game_type: 'R', home_team: 'MIL', away_team: 'CIN',
  at_bat_number: '1', pitch_number: '1', balls: '0', strikes: '0', outs_when_up: '0',
  on_1b: '', on_2b: '', on_3b: '', inning: '1', inning_topbot: 'Top', batter: '10', pitcher: '20',
  stand: 'R', p_throws: 'R', pitch_type: 'FF', description: 'hit_into_play', events: 'field_out', plate_x: '0',
  bat_score_diff: '0', bat_score: '0', post_bat_score: '0', ...o,
})

// CIN scores 2 on two solo homers (1st, 3rd) off MIL; MIL scores 1 on a wild pitch then a
// single, and strikes out to end it. Final CIN 2, MIL 1. A pitch's runs are the change in
// the batting club's margin to the next pitch (shard.js runsAt), so `bat_score_diff` must
// run true from row to row.
const ROWS = [
  row({ at_bat_number: '1', events: 'home_run', post_bat_score: '1' }),
  row({ at_bat_number: '2', batter: '11', events: 'strikeout', description: 'swinging_strike', bat_score: '1', post_bat_score: '1', bat_score_diff: '1' }),
  row({ at_bat_number: '3', inning_topbot: 'Bot', batter: '30', pitcher: '40', on_3b: '9', description: 'ball', events: '', pitch_number: '1' }),
  row({ at_bat_number: '3', inning_topbot: 'Bot', batter: '30', pitcher: '40', description: 'wild_pitch_scores', events: '', pitch_number: '2', on_3b: '9', bat_score_diff: '-1', post_bat_score: '1' }),
  row({ at_bat_number: '3', inning_topbot: 'Bot', batter: '30', pitcher: '40', pitch_number: '3', events: 'single', bat_score: '1', post_bat_score: '1', bat_score_diff: '0' }),
  row({ at_bat_number: '4', inning: '3', batter: '12', events: 'home_run', bat_score: '1', post_bat_score: '2', bat_score_diff: '0' }),
  row({ at_bat_number: '5', inning: '9', inning_topbot: 'Bot', batter: '31', pitcher: '40', events: 'strikeout', description: 'swinging_strike', outs_when_up: '2', bat_score: '1', post_bat_score: '1', bat_score_diff: '-1' }),
]
const pas = decodePlateAppearances(encodeMonth(ROWS, { season: 2026, month: '06' }))

test('a plate appearance carries every run scored during it, not only on its last pitch', () => {
  assert.deepEqual(pas.map((p) => p.runs), [1, 0, 1, 1, 0])
  assert.deepEqual(pas.map((p) => p.eventRuns), [1, 0, 0, 1, 0], 'the wild-pitch run is not on the single')
})

test('plays group into one row per game and batting club, with its totals', () => {
  const { games, leftOut } = clubGames(pas)
  assert.equal(leftOut, 0)
  const cin = games.find((g) => g.batTeam === 'CIN')
  const mil = games.find((g) => g.batTeam === 'MIL')
  assert.deepEqual([cin.runs, cin.hits, cin.hr, cin.bb, cin.so, cin.fieldTeam], [2, 2, 2, 0, 1, 'MIL'])
  assert.deepEqual([mil.runs, mil.hits, mil.hr, mil.so, mil.pitches], [1, 1, 0, 1, 4])
})

test('a game whose runs on file do not add up to its final margin is left out and counted', () => {
  const bad = pas.map((p) => (p.batTeam === 'MIL' && p.event === 'single' ? { ...p, runs: 2 } : p))
  const { games, leftOut } = clubGames(bad)
  assert.equal(games.length, 0)
  assert.equal(leftOut, 1)
})

test('how runs scored: all on solo homers, in one inning, none on a hit', () => {
  const { games } = clubGames(pas)
  const cin = games.find((g) => g.batTeam === 'CIN')
  const mil = games.find((g) => g.batTeam === 'MIL')
  const t = (how, g) => gameMatcher({ g: { totals: {}, how } })(g)
  assert.equal(t(['solo'], cin), true)
  assert.equal(t(['hr'], cin), true)
  assert.equal(t(['oneinn'], cin), false, 'CIN scored in the 1st and the 3rd')
  assert.equal(t(['nohit'], mil), true, 'the run scored on a wild pitch, not on the single')
  assert.equal(t(['nohit'], cin), false)
  assert.equal(t(['hr'], mil), false, 'a run between plays is not on a homer')
  assert.equal(t(['solo', 'oneinn'], cin), false, 'every picked condition must hold')
  assert.equal(t(['solo'], mil), false)
})

test('a total range: either end may be blank', () => {
  const { games } = clubGames(pas)
  const cin = games.find((g) => g.batTeam === 'CIN')
  const m = (lo, hi) => gameMatcher({ g: { totals: { r: [lo, hi] }, how: [] } })(cin)
  assert.equal(m(2, 2), true)
  assert.equal(m(3, null), false)
  assert.equal(m(null, 2), true)
  assert.equal(m(null, 1), false)
})

test('the game URL round-trips', () => {
  const g = parseGameQuery('?mode=game&gr=6-6&ghr=2-&gso=-9&how=solo.late')
  assert.deepEqual(g, { totals: { r: [6, 6], hr: [2, null], so: [null, 9] }, how: ['solo', 'late'] })
  assert.equal(buildGameParams(g).toString(), 'gr=6-6&ghr=2-&gso=-9&how=solo.late')
  assert.equal(parseGameQuery('?gr=6-6'), null, 'no mode=game, no game query')
  assert.equal(parseGameQuery('?mode=game&gr=x&how=nope').how.length, 0)
})

test('answer: the pitching club is the subject; ordinals count oldest first', () => {
  const g2 = pas.map((p) => ({ ...p, key: `${p.key}b`, gamePk: 2, date: '2026-06-05' }))
  const q = { mode: 'game', g: { totals: { r: [1, null] }, how: [] }, pitchTeam: 'MIL', chips: {} }
  const a = answerGames([...pas, ...g2], q, null)
  assert.equal(a.matches.length, 2)
  assert.equal(a.matches[0].date, '2026-06-05')
  assert.deepEqual(a.matches.map((m) => m.ordinal), [2, 1])
  assert.equal(a.base, 2, 'MIL pitching games in range')
  assert.deepEqual(a.clubs, [{ club: 'MIL', n: 2 }])
  assert.equal(summarizeGames(a.matches, null, 0, q).clubs[0].club, 'MIL')
})

test('a cutoff holds out that day and later', () => {
  const q = { mode: 'game', g: { totals: { r: [0, null] }, how: [] }, chips: {} }
  assert.equal(answerGames(pas, q, '2026-06-01').matches.length, 0)
})

test('a game query with no total, no how and no club is blank', () => {
  assert.equal(isGameBlank({ g: { totals: {}, how: [] }, chips: {} }), true)
  assert.equal(isGameBlank({ g: { totals: {}, how: [] }, chips: {}, team: 'MIL' }), false)
})

test('a run in an at-bat that ends with no plate appearance goes to the club’s previous PA, between plays', () => {
  const rows = [
    row({ at_bat_number: '1', events: 'single' }),
    row({ at_bat_number: '2', batter: '11', events: 'caught_stealing_2b', description: 'ball', post_bat_score: '1' }),
    row({ at_bat_number: '3', inning: '9', inning_topbot: 'Bot', batter: '30', pitcher: '40', events: 'field_out', outs_when_up: '2', bat_score_diff: '-1' }),
  ]
  const got = decodePlateAppearances(encodeMonth(rows, { season: 2026, month: '06' }))
  assert.deepEqual(got.map((p) => [p.runs, p.eventRuns]), [[1, 0], [0, 0]])
  assert.equal(clubGames(got).leftOut, 0)
})

test('runs come from the margin, where Savant’s post_bat_score lags a play (2025-04-13 NYM at ATH)', () => {
  const rows = [
    row({ at_bat_number: '1', events: 'triple', bat_score: '3', post_bat_score: '3', bat_score_diff: '3' }), // rs 0, yet a run scored
    row({ at_bat_number: '2', batter: '11', events: 'field_out', bat_score: '4', post_bat_score: '4', bat_score_diff: '4' }),
    row({ at_bat_number: '3', inning: '9', inning_topbot: 'Bot', batter: '30', pitcher: '40', events: 'field_out', outs_when_up: '2', bat_score_diff: '-4' }),
  ]
  const got = decodePlateAppearances(encodeMonth(rows, { season: 2026, month: '06' }))
  assert.equal(got[0].eventRuns, 1)
})

test('a walk-off whose last-pitch rs lags still counts the winning run; a final out does not', () => {
  const walkoff = (o) => decodePlateAppearances(encodeMonth([
    row({ at_bat_number: '1', events: 'field_out', bat_score_diff: '0' }),
    row({ at_bat_number: '2', inning: '9', inning_topbot: 'Bot', batter: '30', pitcher: '40', bat_score_diff: '0', on_3b: '9', ...o }),
  ], { season: 2026, month: '06' }))
  const single = walkoff({ events: 'single' })
  assert.equal(single[1].eventRuns, 1)
  assert.equal(single[1].finalMargin, -1)
  assert.equal(walkoff({ events: 'home_run' })[1].eventRuns, 2, 'a homer brings its runner home too')
  assert.equal(walkoff({ events: 'strikeout', outs_when_up: '2' })[1].eventRuns, 0, 'a play that can be the third out adds no inferred run')
})

test('review fixes: margin side flips with top/bottom only; no walk-off before the 7th', () => {
  // Bottom 4 missing on file: top 4 -> top 5 keeps the margin's side.
  const gap = decodePlateAppearances(encodeMonth([
    row({ at_bat_number: '1', inning: '4', events: 'field_out', bat_score_diff: '-1' }),
    row({ at_bat_number: '2', inning: '5', batter: '11', events: 'field_out', bat_score_diff: '-1' }),
    row({ at_bat_number: '3', inning: '9', inning_topbot: 'Bot', batter: '30', pitcher: '40', events: 'field_out', outs_when_up: '2', bat_score_diff: '1' }),
  ], { season: 2026, month: '06' }))
  assert.equal(gap[0].runs, 0)
  // A game called in the bottom 5th after a single, home behind: no inferred run.
  const called = decodePlateAppearances(encodeMonth([
    row({ at_bat_number: '1', events: 'home_run', post_bat_score: '1' }),
    row({ at_bat_number: '2', inning: '5', inning_topbot: 'Bot', batter: '30', pitcher: '40', events: 'single', bat_score_diff: '-1' }),
  ], { season: 2026, month: '06' }))
  assert.equal(called[1].eventRuns, 0)
})

test('opening an empty How card does not change the search', async () => {
  const { searchKey } = await import('../src/api/research/filters.js')
  const q = { mode: 'game', g: { totals: {}, how: [] }, chips: {} }
  assert.equal(searchKey(q), searchKey({ ...q, g: { ...q.g, howOpen: true } }))
})

// Player-game lines (#3156): one row per batter and per pitcher per game, for streaks (#3142).
test('plays group into one batting line and one pitching line per player per game', async () => {
  const { playerGames } = await import('../src/api/research/games.js')
  const { lines, leftOut } = playerGames(pas)
  assert.equal(leftOut, 0)
  const bat = Object.fromEntries(lines.filter((l) => l.role === 'bat').map((l) => [l.player, l]))
  assert.deepEqual(Object.keys(bat).map(Number).sort(), [10, 11, 12, 30, 31])
  assert.deepEqual([bat[10].pa, bat[10].hr, bat[10].h, bat[10].runsOn], [1, 1, 1, 1])
  assert.equal(bat[11].so, 1)
  assert.deepEqual([bat[30].h, bat[30].runsOn], [1, 0], 'the wild-pitch run is not on his single')
  assert.equal(bat[30].team, 'MIL')
  const pit = Object.fromEntries(lines.filter((l) => l.role === 'pit').map((l) => [l.player, l]))
  assert.deepEqual([pit[20].bf, pit[20].h, pit[20].hr, pit[20].so, pit[20].runs, pit[20].pitches, pit[20].starter, pit[20].team], [3, 2, 2, 1, 2, 3, true, 'MIL'])
  assert.deepEqual([pit[40].bf, pit[40].h, pit[40].so, pit[40].runs, pit[40].pitches, pit[40].team], [2, 1, 1, 1, 4, 'CIN'])
})

test('a player-game line is left out when its game fails the final-margin check', async () => {
  const { playerGames } = await import('../src/api/research/games.js')
  const broken = pas.map((p, i) => (i === pas.length - 1 ? { ...p, finalMargin: 5 } : p))
  const { lines, leftOut } = playerGames(broken)
  assert.deepEqual([lines.length, leftOut], [0, 1])
})
