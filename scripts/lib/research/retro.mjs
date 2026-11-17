// Pure half of the history store (#3135): Retrosheet play-by-play, 1961 to 2014, as one
// row per plate appearance, keyed on MLB's gamePk and MLBAM person ids. The IO half is
// scripts/research/gen-retro-store.mjs; docs/research-store.md, "History store", has the
// layout and the decisions behind it. Kept here so it can be unit-tested (a gen-*.mjs file
// runs when imported).
//
// THE LAYOUT, written by this file only, so a later reader can copy one definition:
//   pa/{season}/{MM}.json       { v, season, month, cols: PA_COLS, c: [[...col], ...] }
//   pitches/{season}/{MM}.json  { v, season, month, pseq: [...] }  same row order as pa/
//   by-park/{code}.json         { v, park, cols: [...PA_COLS, 'pseq'], c }  every season
//   games/{season}.json         { v, season, cols: GAME_COLS, c }
// Rows sort by date, then gamePk, then `ab`. Column arrays, not row objects: 8.6 million
// rows would repeat every key name.
//
// THE COLUMNS (PA_COLS):
//   gamePk   MLB's game id                 ab       cwevent's event number in the game
//   batter   the responsible batter (cwevent 12: a pinch hitter who takes over with two
//            strikes leaves a strikeout to the man he replaced), MLBAM id, null if unbridged
//   pitcher  the responsible pitcher (cwevent 16), the same way
//   event    Retrosheet event type (cwevent 34: 2 generic out, 3 K, 14 walk, 15 IBB,
//            16 HBP, 18 error, 19 FC, 20-23 single-HR, ...)
//   inn      inning                        half     0 top, 1 bottom
//   outs     outs before the play          bases    runners: 1 first, 2 second, 4 third
//   balls, strikes  the count before the last pitch; null when Retrosheet does not know it
//            (`??`, or empty in 1984-87). Never 0 for "unknown".
//   stand, throws   'L' | 'R' (cwevent resolves a switch hitter by the pitcher), null unknown
//   bsd      batting club's score margin before the play
//   slot     lineup place (1-9)            hit      hit value (0-4)
//   rbi      RBI on the play
//   fl       flags: 1 sac bunt, 2 sac fly, 4 double play, 8 triple play. Not in the
//            2026-10-21 column list: added so the PA result chip's GIDP, double play, sac
//            fly and sac bunt answer on history rows (event type alone cannot).
//   er       runs on the play itself (v2, #3163): the batter and runners whose cwevent
//            destination (58-61) is 4 or more, scored
//   pr       runs that scored on non-PA events (a wild pitch, a balk, a steal of home) while
//            this batter was up (v2). A half that ends with no PA after such a run (caught
//            stealing for the third out) gives it to the club's last PA in the game.
//
// SPOILER CLASSIFICATION: spoiler-free. 1961 to 2014, all long final.

import { historyEvent } from '../../../src/api/research/history.js'

export const STORE_VERSION = 2
export const FIRST_SEASON = 1961
export const LAST_SEASON = 2014

export const PA_COLS = ['gamePk', 'ab', 'batter', 'pitcher', 'event', 'inn', 'half', 'outs', 'bases', 'balls', 'strikes', 'stand', 'throws', 'bsd', 'slot', 'hit', 'rbi', 'fl', 'er', 'pr']
export const GAME_COLS = ['gamePk', 'date', 'home', 'away', 'park', 'venue', 'num', 'night', 'dh', 'pitches', 'homeRuns', 'awayRuns']

// cwevent fields read (cwevent -d lists them). cwevent prints them in this order.
const FIELDS = { gid: 0, inn: 2, half: 3, outs: 4, balls: 5, strikes: 6, pseq: 7, vis: 8, home: 9, bat: 12, bh: 13, pit: 16, ph: 17, r1: 26, r2: 27, r3: 28, slot: 33, ev: 34, batEv: 35, hit: 37, sh: 38, sf: 39, dp: 41, tp: 42, rbi: 43, bd: 58, d1: 59, d2: 60, d3: 61, evn: 96 }
export const CWEVENT_FIELDS = Object.values(FIELDS).join(',')
const AT = Object.fromEntries(Object.keys(FIELDS).map((k, i) => [k, i]))

// The `info,pitches` value per game: what the event file knows of the pitches.
const PITCH_INFO = ['none', 'count', 'pitches']

// One Retrosheet event file (latin1 text) -> [{ id, info, plays: [[count, pitches]] }].
// `plays` skips `NP` lines: cwevent does not number substitutions, so plays[evn - 1] is
// the raw play line of cwevent's event `evn` (the 2026-10-21 research found this drift).
export function parseEventFile(text) {
  const games = []
  let g = null
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('id,')) games.push((g = { id: line.slice(3).trim(), info: {}, plays: [] }))
    else if (!g) continue
    else if (line.startsWith('info,')) {
      const i = line.indexOf(',', 5)
      g.info[line.slice(5, i)] = line.slice(i + 1).replace(/"/g, '')
    } else if (line.startsWith('play,')) {
      const p = line.split(',')
      if (p[6] !== 'NP') g.plays.push([p[4], p[5]])
    }
  }
  return games
}

// statsapi states that mean the game was played to an end. A suspended game is listed on
// each date it was played, with one gamePk and its start date as officialDate.
const DONE = new Set(['Final', 'Completed Early', 'Game Over', 'Forfeit', 'Final: Tied', 'Completed Early: Rain', 'Completed Early: Darkness'])

// One season's statsapi schedule (dates[].games[]) -> the flat rows the join reads.
export function scheduleRows(schedule) {
  return (schedule.dates ?? []).flatMap((d) => (d.games ?? []).map((g) => ({
    gamePk: g.gamePk, officialDate: g.officialDate, gameType: g.gameType, state: g.status?.detailedState,
    home: g.teams?.home?.team?.id, away: g.teams?.away?.team?.id, doubleHeader: g.doubleHeader, gameNumber: g.gameNumber,
    venue: g.venue?.id ?? null, venueName: g.venue?.name ?? null,
    homeRuns: g.linescore?.teams?.home?.runs ?? null, awayRuns: g.linescore?.teams?.away?.runs ?? null,
  })))
}

const iso = (d) => d.replace(/\//g, '-')

// Retrosheet games -> statsapi games, by the spike's join (#2490; 112,902 of 112,902 for
// 1961-2014). A Retrosheet club code maps to the statsapi club id it shares the most dates
// with, so no name is read. Pass 1: home club + date + game number. Pass 2, for the rest:
// the same date and the same two clubs either way round, nearest game number first (a
// makeup in the other park; a doubleheader numbered differently).
// -> { byId: Map(retroId -> schedule row), unjoined: [retroId], teamOf: Map(code -> id) }
export function joinSeason(retroGames, sched) {
  const done = sched.filter((g) => DONE.has(g.state) && !['S', 'E', 'A'].includes(g.gameType))
  const byDate = new Map()
  const seen = new Set()
  for (const g of done) {
    if (seen.has(g.gamePk)) continue
    seen.add(g.gamePk)
    if (!byDate.has(g.officialDate)) byDate.set(g.officialDate, [])
    byDate.get(g.officialDate).push(g)
  }
  const vote = new Map()
  const add = (code, id) => {
    if (!vote.has(code)) vote.set(code, new Map())
    vote.get(code).set(id, (vote.get(code).get(id) ?? 0) + 1)
  }
  for (const g of retroGames) for (const s of byDate.get(iso(g.info.date)) ?? []) {
    add(g.info.hometeam, s.home)
    add(g.info.visteam, s.away)
  }
  const teamOf = new Map([...vote].map(([code, v]) => [code, [...v].sort((a, b) => b[1] - a[1])[0][0]]))

  const key = (home, date, n) => `${home}|${date}|${n}`
  const idx = new Map()
  for (const g of [...byDate.values()].flat()) {
    const k = key(g.home, g.officialDate, g.doubleHeader === 'N' ? 1 : g.gameNumber)
    if (!idx.has(k)) idx.set(k, [])
    idx.get(k).push(g)
  }
  const used = new Set()
  const byId = new Map()
  // '0' is a single game; a missing number line counts as one too (never NaN in the sort).
  const gameNo = (g) => Number(g.info.number) || 1
  for (const g of retroGames) {
    const hit = (idx.get(key(teamOf.get(g.info.hometeam), iso(g.info.date), gameNo(g))) ?? []).filter((s) => !used.has(s.gamePk))
    if (hit.length !== 1) continue
    used.add(hit[0].gamePk)
    byId.set(g.id, hit[0])
  }
  for (const g of retroGames) {
    if (byId.has(g.id)) continue
    const home = teamOf.get(g.info.hometeam)
    const away = teamOf.get(g.info.visteam)
    const s = (byDate.get(iso(g.info.date)) ?? [])
      .filter((x) => !used.has(x.gamePk) && ((x.home === home && x.away === away) || (x.home === away && x.away === home)))
      .sort((a, b) => Math.abs(a.gameNumber - gameNo(g)) - Math.abs(b.gameNumber - gameNo(g)))[0]
    if (!s) continue
    used.add(s.gamePk)
    byId.set(g.id, s)
  }
  return { byId, unjoined: retroGames.filter((g) => !byId.has(g.id)).map((g) => g.id), teamOf }
}

// Quote-aware split of one cwevent CSV line.
export function splitCsvLine(line) {
  const out = []
  let cur = ''
  let q = false
  for (const c of line) {
    if (q) {
      if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === ',') {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  out.push(cur)
  return out
}

const hand = (h) => (h === 'L' || h === 'R' ? h : null)
const flag = (v) => v === 'T'

// One season: cwevent's CSV (CWEVENT_FIELDS), the parsed event files, the join, and
// retroId -> MLBAM id. -> { rows, games, stats }. `rows` holds one object per plate
// appearance (cwevent's batter event flag), each with its `pseq`, `date` and `month`,
// sorted; `games` one per joined game with at least one PA.
export function seasonRows(csv, retroGames, byId, mlbamOf) {
  const raw = new Map(retroGames.map((g) => [g.id, g]))
  const rows = []
  const gamesById = new Map()
  const stats = { pas: 0, skippedUnjoined: 0, noRawPlay: 0, pseqDiffers: 0, unbridged: new Set(), pitchString: 0, knownCount: 0 }
  // Runs on non-PA events wait for the next PA of the same half (`pending`); a half that
  // ends first gives them to that club's last row in the game (`lastOf`).
  let pending = null
  const lastOf = new Map()
  const settle = () => {
    if (!pending) return
    const r = lastOf.get(pending.side)
    if (r) r.pr += pending.runs
    pending = null
  }
  for (const line of csv.split(/\r?\n/)) {
    if (!line) continue
    const v = splitCsvLine(line)
    const gid = v[AT.gid]
    const half = Number(v[AT.half])
    const inHalf = `${gid}|${v[AT.inn]}|${half}`
    if (pending && pending.inHalf !== inHalf) settle()
    const scored = [AT.bd, AT.d1, AT.d2, AT.d3].filter((i) => Number(v[i]) >= 4).length
    if (v[AT.batEv] !== 'T') {
      if (scored) pending = { inHalf, side: `${gid}|${half}`, runs: scored + (pending?.runs ?? 0) }
      continue
    }
    const s = byId.get(gid)
    if (!s) {
      stats.skippedUnjoined++
      continue
    }
    const rg = raw.get(gid)
    const rp = rg?.plays[Number(v[AT.evn]) - 1]
    if (!rp) {
      stats.noRawPlay++
      continue
    }
    const pseq = v[AT.pseq]
    // cwevent trims the string: one 1974 play line reads ' X' (CHA197409200, event 47).
    if (rp[1].trim() !== pseq) stats.pseqDiffers++
    // Unknown count: '??' (1961-83) or an empty field (1984-87). cwevent prints 0-0 for both.
    const known = /^\d\d$/.test(rp[0])
    const date = iso(rg.info.date)
    const [vis, home] = [Number(v[AT.vis]), Number(v[AT.home])]
    const person = (rid) => {
      const id = mlbamOf(rid)
      if (id == null) stats.unbridged.add(rid)
      return id
    }
    rows.push({
      date, month: date.slice(5, 7), pseq,
      gamePk: s.gamePk, ab: Number(v[AT.evn]), batter: person(v[AT.bat]), pitcher: person(v[AT.pit]), event: Number(v[AT.ev]),
      inn: Number(v[AT.inn]), half, outs: Number(v[AT.outs]),
      bases: (v[AT.r1] ? 1 : 0) | (v[AT.r2] ? 2 : 0) | (v[AT.r3] ? 4 : 0),
      balls: known ? Number(v[AT.balls]) : null, strikes: known ? Number(v[AT.strikes]) : null,
      stand: hand(v[AT.bh]), throws: hand(v[AT.ph]), bsd: half ? home - vis : vis - home,
      slot: Number(v[AT.slot]), hit: Number(v[AT.hit]), rbi: Number(v[AT.rbi]),
      fl: (flag(v[AT.sh]) ? 1 : 0) | (flag(v[AT.sf]) ? 2 : 0) | (flag(v[AT.dp]) ? 4 : 0) | (flag(v[AT.tp]) ? 8 : 0),
      er: scored, pr: pending?.runs ?? 0,
    })
    pending = null
    lastOf.set(`${gid}|${half}`, rows.at(-1))
    stats.pas++
    if (pseq) stats.pitchString++
    if (known) stats.knownCount++
    if (!gamesById.has(gid)) {
      const info = rg.info
      gamesById.set(gid, {
        gamePk: s.gamePk, date, home: s.home, away: s.away, park: info.site || null, venue: s.venue,
        num: Number(info.number) || 0, night: info.daynight === 'night' ? 1 : 0, dh: info.usedh === 'true' ? 1 : 0,
        pitches: Math.max(0, PITCH_INFO.indexOf(info.pitches)), homeRuns: s.homeRuns, awayRuns: s.awayRuns, venueName: s.venueName,
      })
    }
  }
  settle()
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || a.gamePk - b.gamePk || a.ab - b.ab)
  const games = [...gamesById.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || a.gamePk - b.gamePk)
  return { rows, games, stats: { ...stats, unbridged: [...stats.unbridged].sort() } }
}

const columns = (rows, names) => names.map((n) => rows.map((r) => r[n] ?? null))

// Rows of one season -> [{ month, pa, pitches }], the two files of each month.
export function monthShards(rows, season) {
  const months = [...new Set(rows.map((r) => r.month))].sort()
  return months.map((month) => {
    const part = rows.filter((r) => r.month === month)
    return {
      month,
      pa: { v: STORE_VERSION, season, month, cols: PA_COLS, c: columns(part, PA_COLS) },
      pitches: { v: STORE_VERSION, season, month, pseq: part.map((r) => r.pseq) },
    }
  })
}

export const gameIndex = (games, season) => ({ v: STORE_VERSION, season, cols: GAME_COLS, c: columns(games, GAME_COLS) })

// One season's rows at one park, in the by-park column order (PA_COLS + pseq).
export const PARK_COLS = [...PA_COLS, 'pseq']
export const parkPart = (rows) => columns(rows, PARK_COLS)

// Season parts of one park (oldest first) -> the by-park file.
export function parkFile(park, parts) {
  return { v: STORE_VERSION, park, cols: PARK_COLS, c: PARK_COLS.map((_, i) => parts.flatMap((p) => p[i])) }
}

// Every season's games -> parks.json: Retrosheet park code -> the statsapi venue it holds
// most games at (a few codes carry a second venue on 1 to 3 games, #2505), its name, and
// first and last season.
export function parkTable(games) {
  const by = new Map()
  for (const g of games) {
    if (!g.park) continue
    const p = by.get(g.park) ?? { venues: new Map(), first: Infinity, last: -Infinity, games: 0 }
    const season = Number(g.date.slice(0, 4))
    p.first = Math.min(p.first, season)
    p.last = Math.max(p.last, season)
    p.games++
    if (g.venue != null) {
      const e = p.venues.get(g.venue) ?? { n: 0, name: g.venueName }
      e.n++
      p.venues.set(g.venue, e)
    }
    by.set(g.park, p)
  }
  const parks = {}
  for (const code of [...by.keys()].sort()) {
    const p = by.get(code)
    const [venue, top] = [...p.venues].sort((a, b) => b[1].n - a[1].n || a[0] - b[0])[0] ?? [null, { name: null }]
    parks[code] = { venue, name: top.name ?? null, first: p.first, last: p.last, games: p.games }
  }
  return parks
}

// A share, to the tenth of a percent, for the manifest's coverage line.
const share = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : 0)

// A month's result counts ({ event: n }), keyed by the Savant name the page reads a history
// row as (historyEvent, imported so the two cannot drift), for /research's season skip (#3159).
function monthEvents(pa) {
  const ev = pa.c[PA_COLS.indexOf('event')]
  const fl = pa.c[PA_COLS.indexOf('fl')]
  const out = {}
  ev.forEach((e, i) => {
    const k = historyEvent(e, fl[i])
    out[k] = (out[k] ?? 0) + 1
  })
  return out
}

// One season's entry in manifest.json: counts, the coverage shares, and each month's rows
// and result counts.
export function seasonEntry(stats, games, shards) {
  return {
    games: games.length, pas: stats.pas,
    pitchString: share(stats.pitchString, stats.pas), knownCount: share(stats.knownCount, stats.pas),
    months: Object.fromEntries(shards.map((s) => [s.month, { pas: s.pa.c[0].length, through: games.filter((g) => g.date.slice(5, 7) === s.month).at(-1)?.date ?? null, events: monthEvents(s.pa) }])),
  }
}

// Chadwick register rows -> { mlbamId: 'First Last' } for the ids in `ids`.
export function peopleNames(registerRows, ids) {
  const want = new Set([...ids].map(String))
  const out = {}
  for (const r of registerRows) {
    if (!want.has(r.key_mlbam) || out[r.key_mlbam]) continue
    const name = [r.name_first, r.name_last].filter(Boolean).join(' ')
    if (name) out[r.key_mlbam] = name
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => Number(a[0]) - Number(b[0])))
}
