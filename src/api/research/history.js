// The /research HISTORY store reader (#3150): 1961-2014 from Retrosheet, `retro/v1/` in the
// same Blob as the Savant store (layout: scripts/lib/research/retro.mjs and
// docs/research-store.md, "History store"). This file turns a history month into the PA
// objects shard.js decodePlateAppearances makes, so filters.js and answer.js read both
// stores the same way. Each file carries its own `cols`, so columns are read by name.
//
// WHAT A HISTORY PA LACKS (Gary, 2026-11-17, on #3150): pitch type, location, spray and
// batted-ball type (those cards are `since: 2015`). `counts` (passed through) comes from
// the pitch string, so it is 0 when the string is not on file. `marginAfter` is the next
// PA's margin, or the final score for a game's last PA, so a run that scores between
// plate appearances counts toward the PA before it. Every game is the regular season.
// Clubs read as today's abbreviation of the club id: the 1987 Expos are WSH.
//
// SPOILER CLASSIFICATION: spoiler-free. 1961-2014, all long final.

import { countBit } from './shard.js'
import { teamAbbr } from '../../lib/teams.js'

export const HISTORY_BASE = import.meta.env?.VITE_HISTORY_STORE || 'https://p6soal2x5kpgb0ll.public.blob.vercel-storage.com/retro/v1/'
// The last season in the history store; the Savant store starts the next one.
export const HISTORY_LAST = 2014

// Retrosheet event type (cwevent 34) -> Savant event. 2 (generic out), 3 (strikeout) and
// 19 (fielder's choice) read the `fl` flags too (historyEvent).
const EVENT = { 3: 'strikeout', 14: 'walk', 15: 'intent_walk', 16: 'hit_by_pitch', 17: 'catcher_interf', 18: 'field_error', 19: 'fielders_choice', 20: 'single', 21: 'double', 22: 'triple', 23: 'home_run' }
const SAC_BUNT = 1
const SAC_FLY = 2
const DP = 4
const TP = 8

// Retrosheet does not say a double play was on a ground ball, so every out-in-play double
// play reads 'double_play' (the GIDP chip finds none before 2015).
export function historyEvent(ev, fl = 0) {
  if (fl & TP) return 'triple_play'
  if (ev === 3) return fl & DP ? 'strikeout_double_play' : 'strikeout'
  if (fl & SAC_FLY) return fl & DP ? 'sac_fly_double_play' : 'sac_fly'
  if (fl & SAC_BUNT) return 'sac_bunt'
  if (ev === 2) return fl & DP ? 'double_play' : 'field_out'
  return EVENT[ev] ?? 'field_out'
}

// A Retrosheet pitch string -> the 12-bit mask of the counts its pitches were thrown in
// (shard.js countBit), or 0 when the string is empty or reaches an unknown pitch (U) first.
const BALLS = new Set(['B', 'I', 'P', 'V'])
const STRIKES = new Set(['C', 'S', 'K', 'M', 'Q', 'L', 'O', 'T'])
const FOULS = new Set(['F', 'R'])
const IN_PLAY = new Set(['X', 'Y', 'H'])
export function pitchCounts(pseq) {
  let b = 0
  let s = 0
  let mask = 0
  for (const ch of pseq ?? '') {
    const pitch = BALLS.has(ch) || STRIKES.has(ch) || FOULS.has(ch) || IN_PLAY.has(ch)
    if (ch === 'U') return 0
    if (!pitch) continue // pickoffs, catcher throws, runner markers, no-pitch (N)
    mask |= countBit(b, s)
    if (BALLS.has(ch)) b++
    else if (STRIKES.has(ch)) s++
    else if (FOULS.has(ch) && s < 2) s++
  }
  return mask
}

// Column-array file ({ cols, c }) -> a reader: col('name') is that column's array.
const reader = ({ cols, c }) => (name) => c[cols.indexOf(name)] ?? []

// games/{season}.json -> Map(gamePk -> { date, home, away, gameNumber, homeRuns, awayRuns }).
export function historyGames(file) {
  const col = reader(file)
  const [date, home, away, num, homeRuns, awayRuns] = ['date', 'home', 'away', 'num', 'homeRuns', 'awayRuns'].map(col)
  const out = new Map()
  col('gamePk').forEach((pk, i) => {
    out.set(pk, { date: date[i], home: teamAbbr({ id: home[i] }), away: teamAbbr({ id: away[i] }), gameNumber: num[i] || 1, homeRuns: homeRuns[i], awayRuns: awayRuns[i] })
  })
  return out
}

// One month: pa/ file, pitches/ file (same row order; null when absent) and historyGames.
export function decodeHistory(paFile, pitchFile, games) {
  const col = reader(paFile)
  const pseq = pitchFile?.pseq ?? []
  // Each column read once, not per row: a season is ~160,000 rows.
  const c = Object.fromEntries(paFile.cols.map((name) => [name, col(name)]))
  const n = c.gamePk.length
  const pas = []
  for (let j = 0; j < n; j++) {
    const g = games.get(c.gamePk[j])
    if (!g) continue
    const top = c.half[j] === 0
    const balls = c.balls[j]
    const strikes = c.strikes[j]
    const bsd = c.bsd[j]
    const pa = {
      key: `${c.gamePk[j]}-${c.ab[j]}`,
      gamePk: c.gamePk[j],
      date: g.date,
      gameType: 'R',
      home: g.home,
      away: g.away,
      gameNumber: g.gameNumber,
      atBat: c.ab[j],
      batter: c.batter[j],
      pitcher: c.pitcher[j],
      stand: c.stand[j],
      throws: c.throws[j],
      inning: c.inn[j],
      top,
      outs: c.outs[j],
      runners: c.bases[j],
      margin: bsd,
      marginLast: bsd,
      counts: pitchCounts(pseq[j]),
      count: [balls, strikes],
      event: historyEvent(c.event[j], c.fl[j]),
      slot: c.slot[j],
      pitchType: null,
      px: null,
      hcX: null,
      hcY: null,
      bbType: null,
      history: true,
    }
    pa.batTeam = top ? g.away : g.home
    pa.fieldTeam = top ? g.home : g.away
    const prev = pas.at(-1)
    pa.first = prev?.gamePk !== pa.gamePk
    pa.last = false
    if (prev) settle(prev, pa, games)
    pas.push(pa)
  }
  if (pas.length) settle(pas.at(-1), null, games)
  return pas
}

// `prev`'s margin after the PA: the next PA's margin from prev's side, or the final score.
function settle(prev, next, games) {
  if (next && next.gamePk === prev.gamePk) {
    prev.marginAfter = next.margin == null ? null : next.top === prev.top ? next.margin : -next.margin
    return
  }
  prev.last = true
  const g = games.get(prev.gamePk)
  const home = g?.homeRuns
  const away = g?.awayRuns
  prev.marginAfter = home == null || away == null ? null : prev.top ? away - home : home - away
}

// manifest.json -> the Savant index's `seasons` shape ({ season: { months: { MM: { pas,
// through, v, history, events } } } }), plus `pitchString` (% of PAs with a pitch string) per
// season. `events` (#3159) is absent on a store built before it: then no season is skipped.
// `v: 2`: the decoder fills every field a v2 card reads.
export function historySeasons(manifest) {
  const out = {}
  for (const [season, s] of Object.entries(manifest?.seasons ?? {})) {
    const months = Object.fromEntries(Object.entries(s.months ?? {}).map(([mm, m]) => [mm, { pas: m.pas, through: m.through, v: 2, history: true, ...(m.events && { events: m.events }) }]))
    out[season] = { months, pitchString: s.pitchString ?? 0 }
  }
  return out
}
