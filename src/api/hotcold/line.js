// Hot and cold seasons (#1855): the line math the generator and the rule share.
//
// One player-season is folded game by game into a cumulative line. A CHECKPOINT is the
// line at the first game where the sample reaches a multiple of STEP: games played for a
// hitter, innings for a pitcher. `scripts/gen-season-checkpoints.mjs` folds ten past
// seasons of league game logs with these functions; `rule.js` folds one player's log
// with the SAME functions, so "through 40 games" means one thing on both sides.
//
// Spoiler-free: season aggregates on an open surface (ADR-0034). The rule, not this
// file, holds back a game still being played (see rule.js).
import { ipToOuts } from '../../lib/math/innings.js'
import { num } from '../../lib/math/number.js'

// A checkpoint every STEP games (hitters) or STEP innings (pitchers).
export const STEP = 10

// The cumulative line, as a flat array so the stored checkpoints stay small.
export const HIT_FIELDS = ['g', 'pa', 'ab', 'h', 'd', 't', 'hr', 'bb', 'hbp', 'sf', 'so', 'sb']
export const PITCH_FIELDS = ['g', 'outs', 'bf', 'h', 'hr', 'bb', 'hbp', 'so', 'er']

function hitAdd(line, st) {
  line.g += num(st.gamesPlayed) || 1
  line.pa += num(st.plateAppearances)
  line.ab += num(st.atBats)
  line.h += num(st.hits)
  line.d += num(st.doubles)
  line.t += num(st.triples)
  line.hr += num(st.homeRuns)
  line.bb += num(st.baseOnBalls)
  line.hbp += num(st.hitByPitch)
  line.sf += num(st.sacFlies)
  line.so += num(st.strikeOuts)
  line.sb += num(st.stolenBases)
}

function pitchAdd(line, st) {
  line.g += num(st.gamesPlayed) || 1
  line.outs += ipToOuts(st.inningsPitched)
  line.bf += num(st.battersFaced)
  line.h += num(st.hits)
  line.hr += num(st.homeRuns)
  line.bb += num(st.baseOnBalls)
  line.hbp += num(st.hitByPitch)
  line.so += num(st.strikeOuts)
  line.er += num(st.earnedRuns)
}

const ROLE = {
  hitting: { fields: HIT_FIELDS, add: hitAdd, sample: (l) => l.g },
  pitching: { fields: PITCH_FIELDS, add: pitchAdd, sample: (l) => Math.floor(l.outs / 3) },
}

const blank = (fields) => Object.fromEntries(fields.map((f) => [f, 0]))
export const pack = (role, line) => ROLE[role].fields.map((f) => line[f])
export const unpack = (role, arr) => Object.fromEntries(ROLE[role].fields.map((f, i) => [f, arr[i] ?? 0]))

// The sample a line has reached: games for a hitter, whole innings for a pitcher.
export const sampleOf = (role, line) => ROLE[role].sample(line)

// The checkpoint a sample falls in: 47 games -> 40. Null below the first one.
export const checkpointOf = (n) => (n >= STEP ? Math.floor(n / STEP) * STEP : null)

// Game-log rows (statsapi `gameLog` splits) in date order, then game number.
const inOrder = (rows) =>
  (rows ?? [])
    .filter((g) => g?.stat)
    .sort((a, b) =>
      String(a.date).localeCompare(String(b.date)) ||
      (a.game?.gameNumber ?? 0) - (b.game?.gameNumber ?? 0))

// Fold a season's rows into { final, checkpoints }: `final` is the whole line, and
// `checkpoints` maps each checkpoint (10, 20, …) to the line at the first game that
// reached it. A pitcher who jumps from 9 to 21 innings in one start fills 10 and 20
// with the same line.
export function foldSeason(role, rows) {
  const { fields, add, sample } = ROLE[role]
  const line = blank(fields)
  const checkpoints = {}
  for (const row of inOrder(rows)) {
    add(line, row.stat)
    const top = checkpointOf(sample(line))
    for (let c = STEP; top != null && c <= top; c += STEP) {
      if (!checkpoints[c]) checkpoints[c] = { ...line }
    }
  }
  return { final: line, checkpoints }
}

// --- The stats the rule tests -----------------------------------------------------------
//
// `rate(line)` is the number the league is ranked on; null when the line cannot carry it.
// `better` says which tail is hot. `tails` limits a stat to one tail: a count stat with a
// floor of zero (home runs, steals) has a crowded bottom, and "no steals" is a style, not
// a cold spell. `group` keeps two stats that say the same thing (AVG and OPS, ERA and
// WHIP) from taking both callout places. The order is the tie-break.
const per = (n, d) => (d > 0 ? n / d : null)
const obp = (l) => per(l.h + l.bb + l.hbp, l.ab + l.bb + l.hbp + l.sf)
const slg = (l) => per(l.h + l.d + 2 * l.t + 3 * l.hr, l.ab)

export const STATS = {
  hitting: [
    { key: 'ops', label: 'OPS', group: 'slash', better: 'high', rate: (l) => (obp(l) == null || slg(l) == null ? null : obp(l) + slg(l)) },
    { key: 'avg', label: 'AVG', group: 'slash', better: 'high', rate: (l) => per(l.h, l.ab) },
    { key: 'hr', label: 'HR', better: 'high', tails: ['high'], rate: (l) => per(l.hr, l.pa) },
    { key: 'so', label: 'K%', better: 'low', rate: (l) => per(l.so, l.pa) },
    { key: 'bb', label: 'BB%', better: 'high', rate: (l) => per(l.bb, l.pa) },
    { key: 'sb', label: 'SB', better: 'high', tails: ['high'], rate: (l) => per(l.sb, l.g) },
  ],
  pitching: [
    { key: 'era', label: 'ERA', group: 'runs', better: 'low', rate: (l) => per(27 * l.er, l.outs) },
    { key: 'whip', label: 'WHIP', group: 'runs', better: 'low', rate: (l) => per(3 * (l.h + l.bb), l.outs) },
    { key: 'so', label: 'K%', better: 'high', rate: (l) => per(l.so, l.bf) },
    { key: 'bb', label: 'BB%', better: 'low', rate: (l) => per(l.bb, l.bf) },
    { key: 'hr', label: 'HR', group: 'hr', better: 'low', rate: (l) => per(l.hr, l.bf) },
  ],
}

// Who belongs in the league pool at a checkpoint. A hitter needs MIN_PA_PER_G plate
// appearances a game, so a pinch-runner's 40 games do not sit beside a regular's 40.
// A pitcher is sized by innings already, so every pitcher counts.
export const MIN_PA_PER_G = 3
export const inPool = (role, line) => role !== 'hitting' || line.pa >= MIN_PA_PER_G * line.g
