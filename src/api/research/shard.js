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
//     dict:   { pt: [...], call: [...], ev: ['', ...] }
//     cols:   { g, ab, pn, b, s, o, r, i, t, bat, pit, h, pt, call, ev, px, hx, hy, ls, la, sd } }
//
//   g    index into games          ab   at_bat_number      pn  pitch_number
//   b/s  balls/strikes BEFORE the pitch                    o   outs when up
//   r    runners: bit 0 first, bit 1 second, bit 2 third    i   inning, t 1 = top
//   h    hands: bit 0 batter stands R, bit 1 pitcher throws R
//   px   plate_x (ft, catcher's view), hx/hy hc_x/hc_y (Savant's frame, NOT the feed's:
//        see gen-spray.mjs), ls launch_speed (mph), la launch_angle, sd bat_score_diff
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

export const SHARD_VERSION = 1

// A count's bit in a PA's `counts` mask; 0 for a count off the 4x3 grid.
export const countBit = (balls, strikes) => (balls >= 0 && balls <= 3 && strikes >= 0 && strikes <= 2 ? 1 << (balls * 3 + strikes) : 0)

const SCALE = { px: 100, hx: 100, hy: 100, ls: 10 }
const COLS = ['g', 'ab', 'pn', 'b', 's', 'o', 'r', 'i', 't', 'bat', 'pit', 'h', 'pt', 'call', 'ev', 'px', 'hx', 'hy', 'ls', 'la', 'sd']

const scaled = (v, k) => {
  const n = numOrNull(v)
  return n == null ? null : Math.round(n * (SCALE[k] ?? 1))
}

// Savant CSV rows (objects, csvObjects) for one month -> the shard object.
// `names` maps a person id to a display name; ids with no name are left out.
export function encodeMonth(rows, { season, month, names = {} }) {
  const games = []
  const gameIdx = new Map()
  const dict = { pt: [], call: [], ev: [''] }
  const dictIdx = { pt: new Map(), call: new Map(), ev: new Map([['', 0]]) }
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
    }
    for (const c of COLS) cols[c].push(row[c])
    for (const id of [row.bat, row.pit]) if (id != null && names[id]) people[id] = names[id]
  }
  return { v: SHARD_VERSION, season, month, through, games, people, dict, cols }
}

// Shard -> plate appearances, oldest first. One entry per PA that ended in an event.
// COMPACT (2015 onward is twelve seasons): a PA keeps no pitch list, only what the
// filters read. `pitchType` and `px` are the last pitch's; `counts` is a 12-bit mask of
// the counts the PA passed through (bit balls*3 + strikes, countBit below); `nPitches`.
export function decodePlateAppearances(shard) {
  const { games, dict, cols } = shard
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
  for (let j = 0; j < n; j++) {
    const g = games[cols.g[j]]
    const key = `${g[0]}-${cols.ab[j]}`
    if (!cur || cur.key !== key) {
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
        event: '',
      }
      cur.batTeam = cur.top ? cur.away : cur.home
      cur.fieldTeam = cur.top ? cur.home : cur.away
    }
    cur.counts |= countBit(cols.b[j], cols.s[j])
    cur.nPitches++
    cur.pitchType = cols.pt[j] == null ? null : dict.pt[cols.pt[j]]
    cur.px = unscale('px', cols.px[j])
    const ev = dict.ev[cols.ev[j]]
    if (ev && !NOT_A_PA.has(ev)) {
      cur.event = ev
      cur.hcX = unscale('hx', cols.hx[j])
      cur.hcY = unscale('hy', cols.hy[j])
      cur.launchSpeed = unscale('ls', cols.ls[j])
      cur.launchAngle = cols.la[j]
      pas.push(cur)
    }
  }
  return pas
}
