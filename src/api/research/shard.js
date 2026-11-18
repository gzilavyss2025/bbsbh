// The /research store's month shard (#2234): one Savant pitch row per tracked pitch,
// written by scripts/research/gen-research-store.mjs and read by store.js. This file is the
// one place that knows the layout, so the writer and the reader cannot drift.
//
// LAYOUT. Column arrays, not row objects: a month is ~115,000 pitches, and repeating
// 20 key names per row would double the file. Repeated strings (pitch type, pitch
// call, event) are indexes into small dictionaries. Numbers that carry decimals are
// stored as scaled integers (SCALE below) so the JSON prints no long fractions.
//
//   { v, season, month, through,           'YYYY-MM-DD' of the newest game in the shard
//     games:  [[gamePk, date, gameType, home, away], ...]   Savant club abbreviations
//     people: { id: 'First Last' }          every batter and pitcher in the shard
//     order:  { gamePk: { batterId: slot } } batting order slot 1-9, from the MLB box score (v2)
//     dict:   { pt: [...], call: [...], ev: ['', ...], bb: [...] }
//     cols:   { g, ab, pn, b, s, o, r, i, t, bat, pit, h, pt, call, ev, px, hx, hy, ls, la, sd, rs, bb, ps, pz } }
//
//   g    index into games          ab   at_bat_number      pn  pitch_number
//   b/s  balls/strikes BEFORE the pitch                    o   outs when up
//   r    runners: bit 0 first, bit 1 second, bit 2 third    i   inning, t 1 = top
//   h    hands: bit 0 batter stands R, bit 1 pitcher throws R
//   px   plate_x (ft, catcher's view), hx/hy hc_x/hc_y (Savant's frame, NOT the feed's:
//        see gen-spray.mjs), ls launch_speed (mph), la launch_angle, sd bat_score_diff
//   rs   runs the batting club scored on the pitch (post_bat_score - bat_score)   (v2)
//   bb   bb_type, an index into dict.bb (ground_ball, line_drive, fly_ball, popup) (v2)
//   ps   release_speed (mph), pz plate_z (ft above the ground)                     (v3)
//
// VERSIONS. v3 (Gary, 2026-11-18) added ps and pz. v2 (#3140) added rs, bb and order. A v1 shard still decodes: those read as
// null, and the cards that need them are blocked for its season (filters.js `v`).
//
// A pitch-clock row with no plate_x is dropped unless it ends the plate appearance
// (the same rule as scout/headToHead.js's parser).
//
// SPOILER CLASSIFICATION: spoiler-free. Only games dated before the build day
// (the generator's rule); the page also drops games on or after `?d=`.

import { numOrNull } from '../../lib/math/number.js'
import { NON_PA_EVENT_TYPES } from '../playbyplay/eventTypes.js'

// An event that ends no plate appearance: truncated_pa marks a cut-short at-bat (the
// batter bats again under a new at_bat_number), and the baserunning set ends an
// inning without a result. Same set as scout/headToHead.js's NOT_A_PA.
const NOT_A_PA = new Set([...NON_PA_EVENT_TYPES, 'truncated_pa'])

export const SHARD_VERSION = 3

// Could this play have made the third out? Then a game that ends on it with the home club
// behind is a loss, not a walk-off the scores missed (decodePlateAppearances runsAt).
const ONE_OUT = new Set(['field_out', 'strikeout', 'force_out', 'fielders_choice_out', 'sac_bunt', 'other_out'])
const TWO_OUTS = new Set(['grounded_into_double_play', 'double_play', 'strikeout_double_play', 'sac_fly_double_play', 'sac_bunt_double_play'])
const thirdOut = (ev, outs) => ev === 'triple_play' || (ONE_OUT.has(ev) && outs >= 2) || (TWO_OUTS.has(ev) && outs >= 1)

// A count's bit in a PA's `counts` mask; 0 for a count off the 4x3 grid or not on file
// (null, which `>= 0` would read as 0).
export const countBit = (balls, strikes) => (Number.isInteger(balls) && Number.isInteger(strikes) && balls >= 0 && balls <= 3 && strikes >= 0 && strikes <= 2 ? 1 << (balls * 3 + strikes) : 0)

const SCALE = { px: 100, hx: 100, hy: 100, ls: 10, ps: 10, pz: 100 }
const COLS = ['g', 'ab', 'pn', 'b', 's', 'o', 'r', 'i', 't', 'bat', 'pit', 'h', 'pt', 'call', 'ev', 'px', 'hx', 'hy', 'ls', 'la', 'sd', 'rs', 'bb', 'ps', 'pz']

// Runs the batting club scored on a pitch; null with either score missing.
const runsOn = (r) => {
  const before = numOrNull(r.bat_score)
  const after = numOrNull(r.post_bat_score)
  return before == null || after == null ? null : after - before
}

const scaled = (v, k) => {
  const n = numOrNull(v)
  return n == null ? null : Math.round(n * (SCALE[k] ?? 1))
}

// Savant CSV rows (objects, csvObjects) for one month -> the shard object.
// `names` maps a person id to a display name; ids with no name are left out.
// `order` ({ gamePk: { batterId: slot } }) is kept for the shard's games only.
export function encodeMonth(rows, { season, month, names = {}, order = {} }) {
  const games = []
  const gameIdx = new Map()
  const dict = { pt: [], call: [], ev: [''], bb: [] }
  const dictIdx = { pt: new Map(), call: new Map(), ev: new Map([['', 0]]), bb: new Map() }
  const code = (k, v) => {
    const s = v || ''
    if (k !== 'ev' && !s) return null
    if (!dictIdx[k].has(s)) {
      dictIdx[k].set(s, dict[k].length)
      dict[k].push(s)
    }
    return dictIdx[k].get(s)
  }
  const cols = Object.fromEntries(COLS.map((c) => [c, []]))
  const people = {}
  let through = ''
  const kept = rows
    .filter((r) => r.game_pk && (r.plate_x || r.events))
    .sort((a, b) => a.game_date.localeCompare(b.game_date) || a.game_pk - b.game_pk || a.at_bat_number - b.at_bat_number || a.pitch_number - b.pitch_number)
  for (const r of kept) {
    if (!gameIdx.has(r.game_pk)) {
      gameIdx.set(r.game_pk, games.length)
      games.push([Number(r.game_pk), r.game_date, r.game_type, r.home_team, r.away_team])
    }
    if (r.game_date > through) through = r.game_date
    const row = {
      g: gameIdx.get(r.game_pk),
      ab: numOrNull(r.at_bat_number),
      pn: numOrNull(r.pitch_number),
      b: numOrNull(r.balls),
      s: numOrNull(r.strikes),
      o: numOrNull(r.outs_when_up),
      r: (r.on_1b ? 1 : 0) | (r.on_2b ? 2 : 0) | (r.on_3b ? 4 : 0),
      i: numOrNull(r.inning),
      t: r.inning_topbot === 'Top' ? 1 : 0,
      bat: numOrNull(r.batter),
      pit: numOrNull(r.pitcher),
      h: (r.stand === 'R' ? 1 : 0) | (r.p_throws === 'R' ? 2 : 0),
      pt: code('pt', r.pitch_type),
      call: code('call', r.description),
      ev: code('ev', r.events),
      px: scaled(r.plate_x, 'px'),
      hx: scaled(r.hc_x, 'hx'),
      hy: scaled(r.hc_y, 'hy'),
      ls: scaled(r.launch_speed, 'ls'),
      la: scaled(r.launch_angle, 'la'),
      sd: numOrNull(r.bat_score_diff),
      rs: runsOn(r),
      bb: code('bb', r.bb_type),
      ps: scaled(r.release_speed, 'ps'),
      pz: scaled(r.plate_z, 'pz'),
    }
    for (const c of COLS) cols[c].push(row[c])
    for (const id of [row.bat, row.pit]) if (id != null && names[id]) people[id] = names[id]
  }
  const keptOrder = Object.fromEntries(games.filter(([pk]) => order[pk]).map(([pk]) => [pk, order[pk]]))
  return { v: SHARD_VERSION, season, month, through, games, people, order: keptOrder, dict, cols }
}

// Shard -> plate appearances, oldest first. One entry per PA that ended in an event.
// COMPACT (2015 onward is twelve seasons): a PA keeps no pitch list, only what the
// filters read. `pitchType` and `px` are the last pitch's; `counts` is a 12-bit mask of
// the counts the PA passed through (bit balls*3 + strikes, countBit below); `nPitches`.
// `count` ([balls, strikes]) is the count the last pitch was thrown in. From v2:
// `marginAfter` (the batting club's margin after the last pitch), `bbType`, `slot`
// (batting order 1-9); null on a v1 shard. `first` / `last`: the game's first or last PA.
// `runs`: the runs the batting club scored on any of the PA's pitches; `eventRuns`: those
// on its last pitch, the play itself (#3137). `finalMargin` (the game's last PA only): away
// runs minus home runs at the end. Null where the store has no score for the last pitch.
export function decodePlateAppearances(shard) {
  const { games, dict, cols } = shard
  const order = shard.order ?? {}
  const n = cols.g.length
  const pas = []
  let cur = null
  // Game 2 of a doubleheader: the later gamePk of two games with the same date and clubs
  // (the route's `-2` slug). Assumes gamePk order is game order; not checked on a
  // rescheduled doubleheader.
  const gameNumber = new Map()
  const seen = new Map()
  for (const [pk, date, , home, away] of [...games].sort((a, b) => a[0] - b[0])) {
    const k = `${date}${home}${away}`
    seen.set(k, (seen.get(k) ?? 0) + 1)
    gameNumber.set(pk, seen.get(k))
  }
  const unscale = (k, v) => (v == null ? null : v / (SCALE[k] ?? 1))
  // RUNS ON A PITCH (#3137): the change in the batting club's margin to the next pitch of
  // the game (a new half flips the margin's side), not rs alone: Savant's post_bat_score
  // sometimes lags a play (a run-scoring triple with rs 0, 2025-04-13 NYM at ATH). A run
  // that scores after a play but before the next pitch (a steal of home) lands on that play.
  // The game's last pitch has no next one, so it reads rs (null on a v1 shard).
  const runsAt = (j) => {
    const k = j + 1
    if (k < n && cols.g[k] === cols.g[j] && cols.sd[k] != null && cols.sd[j] != null) {
      // The margin's side flips with the batting club (top/bottom), not with the inning.
      const sameSide = cols.t[k] === cols.t[j]
      return Math.max(0, (sameSide ? cols.sd[k] : -cols.sd[k]) - cols.sd[j])
    }
    const rs = cols.rs?.[j]
    if (rs == null) return null
    // A walk-off whose rs lags (2025-03-30 PIT at MIA reads 0): a bottom half that ends the
    // game with the home club not ahead scored the winning run, or a homer's runners and all.
    // From the 7th on only (a seven-inning doubleheader walks off there): a game called
    // earlier, mid-inning, is no walk-off.
    const ev = dict.ev[cols.ev[j]]
    if (cols.t[j] === 0 && cols.i[j] >= 7 && cols.sd[j] != null && cols.sd[j] + rs <= 0 && ev && !NOT_A_PA.has(ev) && !thirdOut(ev, cols.o[j])) {
      const onBase = ((cols.r[j] & 1) + ((cols.r[j] >> 1) & 1) + ((cols.r[j] >> 2) & 1))
      return ev === 'home_run' ? onBase + 1 : 1 - cols.sd[j]
    }
    return rs
  }
  // An at-bat that ends with no PA (a run scores, then a caught stealing ends the inning)
  // keeps its runs: they go to the club's previous PA in the game as between-play runs
  // (`runs` but not `eventRuns`), or with no such PA, to its next one (`carry`).
  let carry = null
  const flush = (c) => {
    if (!c || pas.at(-1) === c || !(c.runs > 0)) return
    const prev = pas.at(-1)
    if (prev && prev.gamePk === c.gamePk && prev.batTeam === c.batTeam && prev.runs != null) prev.runs += c.runs
    else {
      // A carry only grows within its own club and game; another club's pending runs are
      // dropped, and THE CHECK (games.js) then leaves that game out.
      const same = carry?.gamePk === c.gamePk && carry?.batTeam === c.batTeam
      carry = { gamePk: c.gamePk, batTeam: c.batTeam, runs: c.runs + (same ? carry.runs : 0) }
    }
  }
  for (let j = 0; j < n; j++) {
    const g = games[cols.g[j]]
    const key = `${g[0]}-${cols.ab[j]}`
    if (!cur || cur.key !== key) {
      flush(cur)
      cur = {
        key,
        gamePk: g[0],
        date: g[1],
        gameType: g[2],
        home: g[3],
        away: g[4],
        gameNumber: gameNumber.get(g[0]),
        atBat: cols.ab[j],
        batter: cols.bat[j],
        pitcher: cols.pit[j],
        stand: cols.h[j] & 1 ? 'R' : 'L',
        throws: cols.h[j] & 2 ? 'R' : 'L',
        inning: cols.i[j],
        top: cols.t[j] === 1,
        outs: cols.o[j],
        runners: cols.r[j],
        margin: cols.sd[j],
        counts: 0,
        nPitches: 0,
        runs: 0,
        event: '',
      }
      cur.batTeam = cur.top ? cur.away : cur.home
      cur.fieldTeam = cur.top ? cur.home : cur.away
      if (carry && carry.gamePk === cur.gamePk && carry.batTeam === cur.batTeam) {
        cur.runs = carry.runs
        carry = null
      }
    }
    cur.counts |= countBit(cols.b[j], cols.s[j])
    cur.count = [cols.b[j], cols.s[j]]
    cur.nPitches++
    // Runs on any pitch of the PA (a wild pitch, a steal of home) count toward `runs`.
    const rsj = runsAt(j)
    cur.runs = rsj == null || cur.runs == null ? null : cur.runs + rsj
    cur.pitchType = cols.pt[j] == null ? null : dict.pt[cols.pt[j]]
    cur.px = unscale('px', cols.px[j])
    // The last pitch's speed and height (v3); null on an older shard.
    cur.pitchSpeed = unscale('ps', cols.ps?.[j] ?? null)
    cur.pz = unscale('pz', cols.pz?.[j] ?? null)
    const ev = dict.ev[cols.ev[j]]
    if (ev && !NOT_A_PA.has(ev)) {
      cur.event = ev
      cur.hcX = unscale('hx', cols.hx[j])
      cur.hcY = unscale('hy', cols.hy[j])
      cur.launchSpeed = unscale('ls', cols.ls[j])
      cur.launchAngle = cols.la[j]
      cur.eventRuns = rsj
      // The Moment card (#3140) keeps reading rs on the last pitch, not runsAt.
      const rs = cols.rs?.[j]
      cur.marginAfter = rs == null || cols.sd[j] == null ? null : cols.sd[j] + rs
      cur.marginLast = cols.sd[j]
      cur.bbType = cols.bb?.[j] == null ? null : dict.bb[cols.bb[j]]
      cur.slot = order[cur.gamePk]?.[cur.batter] ?? null
      const prev = pas.at(-1)
      cur.first = prev?.gamePk !== cur.gamePk
      cur.last = false
      if (prev && prev.gamePk !== cur.gamePk) prev.last = true
      pas.push(cur)
    }
  }
  flush(cur)
  if (pas.length) pas.at(-1).last = true
  // THE FINAL MARGIN (away minus home) from each game's last pitch, on its last PA: a game
  // can end after its last PA (a wild-pitch walk-off in a cut-short at-bat).
  const finals = new Map()
  for (let j = 0; j < n; j++) {
    if (j + 1 < n && cols.g[j + 1] === cols.g[j]) continue
    const r = runsAt(j)
    if (r != null && cols.sd[j] != null) finals.set(games[cols.g[j]][0], (cols.t[j] === 1 ? 1 : -1) * (cols.sd[j] + r))
  }
  for (const pa of pas) if (pa.last) pa.finalMargin = finals.get(pa.gamePk) ?? null
  return markGameRoles(pas)
}

// THE PITCHER'S ROLE AND TIMES FACING HIM (Gary, 2026-11-18), from the PAs alone, oldest
// first: `role` 'SP' for the first pitcher a fielding club used in the game, else 'RP';
// `tto` the nth time this batter faces this pitcher in the game (Baseball-Reference's
// "times facing"). A starter pulled mid-PA before any PA ended reads as a reliever's PA.
export function markGameRoles(pas) {
  let game = null
  let starters = null
  let faced = null
  for (const pa of pas) {
    if (pa.gamePk !== game) {
      game = pa.gamePk
      starters = new Map()
      faced = new Map()
    }
    if (!starters.has(pa.fieldTeam)) starters.set(pa.fieldTeam, pa.pitcher)
    pa.role = starters.get(pa.fieldTeam) === pa.pitcher ? 'SP' : 'RP'
    // Person ids are under 10 million, so one number keys the pair.
    const k = pa.pitcher * 1e7 + pa.batter
    pa.tto = (faced.get(k) ?? 0) + 1
    faced.set(k, pa.tto)
  }
  return pas
}
