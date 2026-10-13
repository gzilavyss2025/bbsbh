import { BATTER_METRICS } from '../../../../../api/savantPercentiles.js'
import { pitchLabel } from '../../../../../api/pitchArsenal.js'
import { PROFILE_KEYS } from '../../../../../lib/hitterSimilarity.js'

// The Similar players board as plain data (#1926): per neighbour, the sections the
// dot plot draws. A section is one scale and its lines; a line is one metric with a dot
// for the subject (`me`) and one for the neighbour (`them`). Positions are percents of
// the rail, or null when that dot has no value. Pure: the hook loads, the card draws.
const DASH = '—'
const PITCHES_SHOWN = 5

// "Jazz Chisholm Jr." -> "JC": the board's initials box.
export const initials = (name) =>
  name.replace(/\./g, '').split(' ').filter((p) => p && !/^(Jr|Sr)$/.test(p)).map((p) => p[0]).slice(0, 2).join('')

// The arsenal pools to try for a pitcher, in order (true is MLB). The page's level is
// currentActivitySportId (read from the link scope): a free agent has no club and a rehabber is
// pinned to MLB, so both read MLB. A debuted player at a minor-league club may still have MLB games
// this season, which the live card ranks him on (context.js resolveCurrentSeasonStat), so MLB
// comes first and being in that pool stands in for those games. A prospect is in the minor pool only.
export const poolLevels = (sportId, debuted) =>
  sportId == null || sportId === 1 ? [true] : debuted ? [true, false] : [false]

// RHP / LHP, or a bare P when the pool has no hand for him.
export const pitcherPos = (throws) => (throws === 'R' ? 'RHP' : throws === 'L' ? 'LHP' : 'P')

const ok = Number.isFinite
const at = (n, [lo, hi]) => (ok(n) ? Math.max(0, Math.min(100, ((n - lo) * 100) / (hi - lo))) : null)
// The multiples of `step` that fall inside [from, to].
const range = (from, to, step) =>
  Array.from({ length: Math.floor(to / step) - Math.ceil(from / step) + 1 }, (_, i) => (Math.ceil(from / step) + i) * step)

function section(key, title, cols, scale, ticks, text, metrics) {
  return {
    key,
    title,
    ...cols,
    ticks: ticks.map((t) => ({ at: at(t, scale), text: String(t) + (key === 'usage' ? '%' : '') })),
    lines: metrics.map(([metric, me, them]) => ({
      metric,
      mePos: at(me, scale),
      themPos: at(them, scale),
      meText: ok(me) ? text(me) : DASH,
      themText: ok(them) ? text(them) : DASH,
    })),
  }
}

// "Hits like": the five Statcast percentiles the ranking runs on (PROFILE_KEYS), 0 to 100.
// `data` is savant-percentiles.json; `rows` the neighbours with names, from the hook.
export function hitterModel(data, id, rows) {
  const labels = PROFILE_KEYS.map((k) => BATTER_METRICS.find((m) => m.key === k)?.label ?? k)
  const profile = (their) =>
    section(
      'profile',
      'Season profile',
      { rowHead: 'Metric', scaleLab: 'percentile, 0 to 100', valHead: 'Percentile' },
      [0, 100],
      [0, 25, 50, 75, 100],
      String,
      PROFILE_KEYS.map((k, i) => [labels[i], data.bat[id]?.[k], their?.[k]]),
    )
  return { comps: rows.map((r) => ({ ...r, ini: initials(r.name), sections: [profile(data.bat[r.personId])] })) }
}

// "Pitches like": his five most-thrown pitches, each as a share of all his pitches
// (Usage) and an average speed (Velocity). `pool` is a pitch-arsenal-pool file, `rows`
// the ranking from similarPitchersFor. A pitch the neighbour never throws is 0% usage
// and has no speed dot. The scales cover every neighbour, so a dot keeps its place
// when the card switches from one to another.
export function pitcherModel(pool, id, rows) {
  const typesOf = (pid) => pool.pit[pid]?.types ?? []
  const shareOf = (types, code) => {
    const total = types.reduce((n, t) => n + t.pitches, 0)
    return ((types.find((t) => t.code === code)?.pitches ?? 0) / total) * 100
  }
  const veloOf = (types, code) => types.find((t) => t.code === code)?.avgVelo
  const mine = typesOf(id)
  const codes = [...mine].sort((a, b) => b.pitches - a.pitches).slice(0, PITCHES_SHOWN).map((t) => t.code)
  const everyone = [mine, ...rows.map((r) => typesOf(r.personId))]
  const shares = everyone.flatMap((t) => codes.map((c) => shareOf(t, c)))
  const velos = everyone.flatMap((t) => codes.map((c) => veloOf(t, c))).filter(ok)
  const usageHi = Math.max(35, Math.ceil(Math.max(...shares) / 5) * 5)
  const veloScale = [Math.floor(Math.min(...velos)) - 2, Math.ceil(Math.max(...velos)) + 2]
  const sections = (their) => [
    section(
      'usage',
      'Usage',
      { rowHead: 'Pitch', scaleLab: 'share of pitches thrown', valHead: 'Share' },
      [0, usageHi],
      range(0, usageHi, 10),
      (n) => `${n.toFixed(1)}%`,
      codes.map((c) => [pitchLabel(c), shareOf(mine, c), shareOf(their, c)]),
    ),
    section(
      'velocity',
      'Velocity',
      { rowHead: 'Pitch', scaleLab: 'average velo, mph', valHead: 'mph' },
      veloScale,
      range(...veloScale, 5),
      (n) => n.toFixed(1),
      codes.map((c) => [pitchLabel(c), veloOf(mine, c), veloOf(their, c)]),
    ),
  ]
  return {
    comps: rows.map((r) => ({
      ...r,
      pos: pitcherPos(r.throws),
      ini: initials(r.name),
      sections: sections(typesOf(r.personId)),
    })),
  }
}
