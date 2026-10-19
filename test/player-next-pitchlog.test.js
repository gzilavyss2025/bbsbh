import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { mock } from 'node:test'
import { fetchFinalScores } from '../src/api/boxlines/fetch.js'
import { earlierSeason, keyOf, linesOf, loadPitchlog, pitchlogView, scopeRows, totalsOf } from '../src/screens/player/next/modules/pitchlog/pitchlogView.js'
import { loadStart, resultOf, startDetail } from '../src/screens/player/next/modules/pitchlog/gameDetail.js'

// The pitcher Game Log's rows (#1851): every game of the gameLog split, newest first, with the
// score and decision from fetchFinalScores (which holds today back) and the per-game pitch mix.

const app = (date, pk, { gs = 1, type = 'R', w = 0, l = 0, ip = '6.0', er = 1, k = 5, bb = 1, opp = 112, ...rest } = {}) => ({
  date,
  gameType: type,
  isHome: true,
  league: { id: 104 },
  opponent: { id: opp, name: 'Chicago Cubs' },
  game: { gamePk: pk, gameNumber: 1 },
  stat: {
    gamesStarted: gs, wins: w, losses: l, inningsPitched: ip, hits: 4, runs: er, earnedRuns: er,
    baseOnBalls: bb, strikeOuts: k, homeRuns: 0, numberOfPitches: 90, strikes: 60, ...rest,
  },
})

// Robert Gasser (688107), 2026-05-23 vs LAD, gamePk 823787, as the live gameLog split and the
// pitch-arsenal-starts store have it.
const GASSER = {
  date: '2026-05-23',
  gameType: 'R',
  isHome: true,
  league: { id: 104 },
  team: { id: 158, name: 'Milwaukee Brewers' },
  opponent: { id: 119, name: 'Los Angeles Dodgers' },
  game: { gamePk: 823787, gameNumber: 1 },
  stat: {
    gamesStarted: 1, wins: 0, losses: 1, inningsPitched: '4.1', hits: 4, runs: 4, earnedRuns: 4,
    baseOnBalls: 4, strikeOuts: 4, homeRuns: 1, numberOfPitches: 89, strikes: 53,
  },
}

// Gary, 2026-10-13: every game is a row. Gasser's 2026-08-26 bulk relief outing at NYM is row 16 of 22.
test('every game is a row: a relief outing is tagged, newest first, numbered from his first game', () => {
  const rows = pitchlogView([app('2026-05-01', 1), app('2026-05-06', 2, { gs: 0 }), app('2026-05-11', 3)]).rows
  assert.deepEqual(rows.map((r) => [r.gamePk, r.n, r.relief]), [[3, 3, false], [2, 2, true], [1, 1, false]])
})

test('a reliever gets rows; no game is no view', () => {
  assert.deepEqual(pitchlogView([app('2026-05-06', 2, { gs: 0 }), app('2026-05-07', 4, { gs: 0 })]).rows.map((r) => r.relief), [true, true])
  assert.equal(pitchlogView([]), null)
  assert.equal(pitchlogView(null), null)
})

test('a relief outing with no decision shows none: ND is a start word; a save is SV', () => {
  const scores = new Map([[1, { runs: 5, oppRuns: 2 }], [2, { runs: 4, oppRuns: 3 }], [3, { runs: 1, oppRuns: 2 }]])
  const rows = pitchlogView([app('2026-05-01', 1, { gs: 0 }), app('2026-05-06', 2, { gs: 0, saves: 1 }), app('2026-05-11', 3)], { scores }).rows
  assert.deepEqual(rows.map((r) => [r.result, r.dec]), [['L', 'ND'], ['W', 'SV'], ['W', null]])
})

test('Gasser 5/23 vs LAD: L 3-11, his loss, 4.1 IP, 4 ER, 4 K, 89 pitches, 53 strikes, cutter 29', () => {
  const scores = new Map([[823787, { won: false, runs: 3, oppRuns: 11 }]])
  const mixes = new Map([[823787, { CH: 8, FC: 29, FF: 16, SI: 18, ST: 18 }]])
  const [r] = pitchlogView([GASSER], { scores, mixes }).rows
  assert.deepEqual([r.date, r.home, r.oppId, r.opp], ['5/23', true, 119, 'Los Angeles Dodgers'])
  assert.deepEqual([r.result, r.runs, r.oppRuns, r.dec], ['L', 3, 11, 'L'])
  assert.deepEqual([r.ip, r.h, r.r, r.er, r.bb, r.k, r.hr, r.pitches, r.strikes], ['4.1', 4, 4, 4, 4, 4, 1, 89, 53])
  // The fixed order FF, SI, FC, ST, CH, and each share of the start's pitches.
  assert.deepEqual(r.mix.map((m) => [m.code, m.n, m.pct]), [['FF', 16, 18], ['SI', 18, 20], ['FC', 29, 33], ['ST', 18, 20], ['CH', 8, 9]])
})

test('the decision: W, L, or ND once the game is final', () => {
  const scores = new Map([[1, { runs: 5, oppRuns: 2 }], [2, { runs: 4, oppRuns: 3 }], [3, { runs: 1, oppRuns: 2 }]])
  const rows = pitchlogView([app('2026-05-01', 1, { w: 1 }), app('2026-05-06', 2), app('2026-05-11', 3, { l: 1 })], { scores }).rows
  assert.deepEqual(rows.map((r) => [r.result, r.dec]), [['L', 'L'], ['W', 'ND'], ['W', 'W']])
})

test('the key lists every pitch in the bars, in the bar order, whatever start shows it first', () => {
  const mixes = new Map([[2, { ST: 9, FF: 30, CU: 5 }], [1, { FC: 4, SL: 3, FF: 20 }]])
  const { rows } = pitchlogView([app('2026-05-01', 1), app('2026-05-06', 2), app('2026-05-11', 3)], { mixes })
  assert.deepEqual(keyOf(rows), ['FF', 'FC', 'SL', 'ST', 'CU'])
})

test('a start with no row in the per-start store has no mix bar', () => {
  assert.equal(pitchlogView([app('2026-05-01', 1)], { mixes: new Map() }).rows[0].mix, null)
  assert.equal(pitchlogView([app('2026-05-01', 1)]).rows[0].mix, null)
})

// ADR-0117 retired ADR-0110's guard: a game played today, start or relief, shows its score and decision once Final.
// (A game still on has no row: see test/player-log-today.test.js.)
test('a game played today shows its score and decision, start or relief', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-13T20:00:00Z') }) // 13:00 Pacific on 2026-10-13: the day the rows are dated
  const asked = []
  const m = mock.method(globalThis, 'fetch', async (url) => {
    const pks = (String(url).match(/gamePks=([\d,]+)/)?.[1] ?? '').split(',').map(Number)
    asked.push(...pks)
    const games = pks.map((gamePk) => ({
      gamePk,
      status: { abstractGameState: 'Final' },
      teams: { away: { score: 2, team: { id: 112 } }, home: { score: 6, team: { id: 158 } } },
    }))
    return { ok: true, status: 200, json: async () => ({ dates: [{ games }] }) }
  })
  try {
    const games = [app('2026-10-08', 1, { w: 1 }), app('2026-10-13', 2, { w: 1 }), app('2026-10-13', 3, { gs: 0, saves: 1 })]
    const scores = await fetchFinalScores(games, 'pitching', null)
    assert.deepEqual(asked, [1, 2, 3])
    const [relief, today, before] = pitchlogView(games, { scores }).rows
    assert.deepEqual([relief.relief, relief.result, relief.runs, relief.dec], [true, 'W', 6, 'SV'])
    assert.deepEqual([today.result, today.runs, today.oppRuns, today.dec], ['W', 6, 2, 'W'])
    assert.deepEqual([before.result, before.runs, before.oppRuns, before.dec], ['W', 6, 2, 'W'])
  } finally {
    m.mock.restore()
    mock.timers.reset()
  }
})

test('a cutoff keeps the games before that day only', () => {
  const rows = pitchlogView([app('2026-05-01', 1), app('2026-05-11', 3)], { cutoff: '2026-05-11' }).rows
  assert.deepEqual(rows.map((r) => r.gamePk), [1])
})

test('the filter and the totals row: games, W-L (the decisions shown), ERA, IP, K, BB', () => {
  const { rows } = pitchlogView([
    app('2026-05-01', 1, { w: 1, ip: '6.0', er: 2, k: 7, bb: 1 }),
    app('2026-05-06', 2, { l: 1, ip: '4.1', er: 4, k: 4, bb: 4 }),
    app('2026-10-07', 3, { type: 'D', ip: '4.0', er: 1, k: 3, bb: 1 }),
  ], { scores: new Map([1, 2, 3].map((pk) => [pk, { runs: 3, oppRuns: 2 }])) })
  assert.deepEqual(scopeRows(rows, 'post').map((r) => r.gamePk), [3])
  assert.deepEqual(scopeRows(rows, 'reg').map((r) => r.gamePk), [2, 1])
  assert.equal(scopeRows(rows, 'all').length, 3)
  assert.equal(rows[0].series, 'NLDS')
  assert.deepEqual(totalsOf(rows), { games: 3, w: 1, l: 1, era: '4.40', ip: '14.1', k: 14, bb: 6 })
  assert.equal(totalsOf([]).era, '—')
})

test('the totals W–L leave out a held row, though its split already says W', () => {
  // A start in progress today: fetchFinalScores gives it no score, so it shows no decision and adds none.
  const scores = new Map([[1, { runs: 5, oppRuns: 2 }]])
  const { rows } = pitchlogView([app('2026-10-12', 1, { w: 1 }), app('2026-10-13', 2, { w: 1 })], { scores })
  const t = totalsOf(rows)
  assert.deepEqual([t.games, t.w, t.l], [2, 1, 0])
})

test('the loader: a log with no game, or a failed fetch, ends as no view', async () => {
  const m = mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200, json: async () => ({ stats: [{ splits: [] }] }) }))
  try {
    assert.equal(await loadPitchlog(1, 2026, null), null)
    m.mock.mockImplementation(async () => {
      throw new Error('offline')
    })
    assert.equal(await loadPitchlog(1, 2026, null), null)
  } finally {
    m.mock.restore()
  }
})

// ---- The game detail view (#1851 slice 3) and earlier seasons (slice 4). ----
// The fixture is the live feed of gamePk 823787 (Gasser vs LAD, 2026-05-23), read with the
// detail view's own `fields=` list and cut to his plays, and the game's content items cut
// to the fields the view reads.
const FIX = JSON.parse(readFileSync(new URL('./fixtures/game-823787-gasser.trimmed.json', import.meta.url)))
const ROW = pitchlogView([GASSER], { scores: new Map([[823787, { runs: 3, oppRuns: 11 }]]) }).rows[0]
const D = startDetail(FIX, 688107, ROW)

test('the detail row keeps what the view needs: the ISO day, the game count, both abbreviations, the game number', () => {
  assert.deepEqual([ROW.day, ROW.of, ROW.clubAbbr, ROW.oppAbbr, ROW.gameNumber], ['2026-05-23', 1, 'MIL', 'LAD', 1])
})

test('pitches in this game: used, share, avg mph and whiffs (foul tips in, as Savant) per pitch, most used first', () => {
  assert.deepEqual(D.pitches.map((p) => [p.code, p.n, p.pct, p.mph, p.whiffs]), [
    ['FC', 29, 33, '87.8', 5],
    ['SI', 18, 20, '91.5', 1],
    ['ST', 18, 20, '79.8', 3],
    ['FF', 16, 18, '92.3', 1],
    ['CH', 8, 9, '86.9', 0],
  ])
})

test('his strikeouts: inning, batter, play text, in order', () => {
  assert.deepEqual(D.strikeouts.map((p) => [p.inning, p.batter, p.text]), [
    [1, 'Shohei Ohtani', 'Shohei Ohtani called out on strikes.'],
    [2, 'Teoscar Hernández', 'Teoscar Hernández strikes out swinging.'],
    [4, 'Shohei Ohtani', 'Shohei Ohtani strikes out swinging.'],
    [5, 'Mookie Betts', 'Mookie Betts called out on strikes.'],
  ])
})

test('big plays against him: every hit, run-scoring play or RBI, with the RBI built from the count', () => {
  assert.deepEqual(D.bigPlays.map((p) => [p.inning, p.batter, p.event]), [
    [2, 'Kyle Tucker', 'Triple'],
    [4, 'Freddie Freeman', 'Double'],
    [4, 'Andy Pages', 'Double, 1 RBI'],
    [4, 'Teoscar Hernández', 'Home Run, 3 RBI'],
  ])
})

test('the clip: MLB highlight joined on the last pitch playId, else the Savant pitch clip', () => {
  const labels = (list) => list.map((p) => p.clip?.label ?? null)
  // The 0:14 clip is of the first Ohtani strikeout only; the fourth-inning one has its own pitch clip.
  assert.deepEqual(labels(D.strikeouts), ['Watch 0:14', 'Pitch clip', 'Pitch clip', 'Pitch clip'])
  // The home run joins its own clip (0:29), not the six-RBI reel that also names Hernández.
  assert.deepEqual(labels(D.bigPlays), ['Pitch clip', 'Pitch clip', 'Watch 0:30', 'Watch 0:29'])
  assert.match(D.bigPlays[3].clip.href, /\.mp4$/)
  assert.equal(D.bigPlays[0].clip.href, 'https://baseballsavant.mlb.com/sporty-videos?playId=171b6eeb-d84f-328a-8e48-30cba54fe02b')
})

test('a play with no tracked pitch and no highlight has no clip button (a 2008 game)', () => {
  const play = { matchup: { pitcher: { id: 1 }, batter: { fullName: 'A B' } }, about: { inning: 1 }, result: { eventType: 'strikeout', description: 'x' }, playEvents: [{ isPitch: true, playId: 'p1', pitchData: {} }] }
  const d = startDetail({ feed: { liveData: { plays: { allPlays: [play] } } }, items: [] }, 1, { day: '2008-05-25', result: 'W' })
  assert.equal(d.strikeouts[0].clip, null)
  // Savant has no clip before 2016, even for a pitch PITCHf/x tracked.
  play.playEvents[0].pitchData.startSpeed = 92
  assert.equal(startDetail({ feed: { liveData: { plays: { allPlays: [play] } } }, items: [] }, 1, { day: '2014-05-25', result: 'W' }).strikeouts[0].clip, null)
  assert.equal(startDetail({ feed: { liveData: { plays: { allPlays: [play] } } }, items: [] }, 1, { day: '2016-05-25', result: 'W' }).strikeouts[0].clip.label, 'Pitch clip')
  assert.deepEqual(d.pitches, [])
})

test('game clips: his own clips not joined to a play, from this game only; none for Gasser 5/23', () => {
  assert.deepEqual(D.clips, [])
  const mine = (date, guid) => ({ guid, headline: 'Gasser works out of a jam', date, duration: '00:00:20', keywordsAll: [{ type: 'player_id', value: '688107' }, { type: 'taxonomy', value: 'highlight' }], playbacks: [{ name: 'mp4Avc', url: 'https://x/a.mp4' }] })
  const d = startDetail({ ...FIX, items: [...FIX.items, mine('2026-05-24T01:00:00Z', 'g1'), mine('2026-09-25T01:00:00Z', 'g2')] }, 688107, ROW)
  assert.deepEqual(d.clips.map((c) => [c.title, c.label]), [['Gasser works out of a jam', 'Watch 0:20']])
})

test('no feed: no parts, no crash', () => {
  const d = startDetail({ feed: null, items: [] }, 688107, ROW)
  assert.deepEqual([d.pitches, d.strikeouts, d.bigPlays, d.clips], [[], [], [], []])
})

// THE GUARD (ADR-0110) reaches the clips: a clip headline says "in win" or "records the save",
// and the video carries the broadcast scorebug. A held row (no final score on file) gets no clip
// list and no clip button, and its clips are never fetched.
test('a held game: no clip list, no Watch or Pitch clip button, the plays stay', () => {
  const held = { ...ROW, result: null, runs: null, oppRuns: null, dec: null }
  const d = startDetail(FIX, 688107, held)
  assert.deepEqual(d.clips, [])
  assert.equal(d.strikeouts.length, 4)
  assert.deepEqual([...d.strikeouts, ...d.bigPlays].map((p) => p.clip), Array(8).fill(null))
})

test('a held game fetches the feed only, never the clips', async () => {
  const asked = []
  const m = mock.method(globalThis, 'fetch', async (url) => {
    asked.push(String(url))
    return { ok: true, status: 200, json: async () => ({}) }
  })
  try {
    await loadStart({ gamePk: 823787, result: null })
    assert.equal(asked.some((u) => u.includes('/content')), false)
    assert.equal(asked.some((u) => u.includes('/feed/live')), true)
    await loadStart({ gamePk: 823787, result: 'L' })
    assert.equal(asked.some((u) => u.includes('/content')), true)
  } finally {
    m.mock.restore()
  }
})

test('the result strip comes from the log row; a held game has none', () => {
  // One name form, from the row, so the strip never changes in place when the feed lands.
  assert.deepEqual(resultOf(ROW, 'Gasser'), { label: 'MIL lose', score: 'MIL 3, LAD 11', dec: 'Gasser takes the loss.' })
  const held = pitchlogView([app('2026-10-13', 2, { w: 1 })]).rows[0]
  assert.equal(resultOf(held, 'Gasser'), null)
  const relief = pitchlogView([{ ...app('2026-05-06', 2, { gs: 0 }), team: { id: 114 } }], { scores: new Map([[2, { runs: 4, oppRuns: 3 }]]) }).rows[0]
  assert.deepEqual(resultOf(relief, 'Smith'), { label: 'CLE win', score: 'CLE 4, CHC 3', dec: null })
})

test('earlier seasons: one season back each time, never before his debut year', () => {
  assert.equal(earlierSeason([2026], '2024-05-10'), 2025)
  assert.equal(earlierSeason([2026, 2025], '2024-05-10'), 2024)
  assert.equal(earlierSeason([2026, 2025, 2024], '2024-05-10'), null)
  assert.equal(earlierSeason([2026], ''), null)
})

test('the season blocks: one season has no season heading; more add a labelled divider each, and a season with no game says so', () => {
  const now = pitchlogView([app('2026-05-01', 1), app('2026-05-06', 2)]).rows
  const then = pitchlogView([app('2025-06-01', 3)]).rows
  assert.deepEqual(linesOf([{ season: 2026, rows: now }], 'all').map((l) => l.divider ?? l.gamePk), [2, 1])
  assert.deepEqual(linesOf([{ season: 2026, rows: now }], 'all', 1).map((l) => l.gamePk), [2])
  const lines = linesOf([{ season: 2026, rows: now }, { season: 2025, rows: then }, { season: 2024, rows: [] }], 'all')
  assert.deepEqual(lines.map((l) => (l.divider ? `${l.divider} (${l.note})` : l.gamePk)), ['2026 (2 games)', 2, 1, '2025 (1 game)', 3, '2024 (no games on file)'])
})

test('a season divider counts the season\'s games, not the rows a collapsed view shows', () => {
  const now = pitchlogView([app('2026-05-01', 1), app('2026-05-06', 2)]).rows
  const then = pitchlogView([app('2025-06-01', 3)]).rows
  const lines = linesOf([{ season: 2026, rows: now }, { season: 2025, rows: then }], 'all', 1)
  assert.deepEqual(lines.map((l) => (l.divider ? `${l.divider} (${l.note})` : l.gamePk)), ['2026 (2 games)', 2, '2025 (1 game)'])
})

test('an earlier season loads with no pitch mix (the per-game store holds 2026 only) and ends as null with no game', async () => {
  const m = mock.method(globalThis, 'fetch', async (url) => {
    const u = String(url)
    if (u.includes('/stats?') && u.includes('season=2025')) return { ok: true, status: 200, json: async () => ({ stats: [{ splits: [app('2025-06-01', 3)] }] }) }
    if (u.includes('/stats?')) return { ok: true, status: 200, json: async () => ({ stats: [{ splits: [] }] }) }
    if (u.includes('seasons.json')) return { ok: true, status: 200, json: async () => ({ seasons: [2026], current: 2026 }) }
    if (u.includes('schedule')) return { ok: true, status: 200, json: async () => ({ dates: [] }) }
    return { ok: false, status: 404, json: async () => null }
  })
  try {
    const v = await loadPitchlog(1, 2025, null)
    assert.deepEqual(v.rows.map((r) => [r.gamePk, r.mix, r.ip]), [[3, null, '6.0']])
    assert.equal(await loadPitchlog(1, 2024, null), null)
  } finally {
    m.mock.restore()
  }
})
