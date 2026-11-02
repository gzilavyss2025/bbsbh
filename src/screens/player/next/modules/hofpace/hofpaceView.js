// Which rows the Hall of Fame pace card shows (#1857 slice 3). Pure.
import { hofPaceView } from '../../../../../api/person/hof/pace.js'
import { outsToIp } from '../../../../../lib/math/innings.js'

const ROWS = {
  hitting: [['hr', 'HR', 'home runs'], ['h', 'H', 'hits']],
  pitching: [['w', 'W', 'wins'], ['so', 'SO', 'strikeouts'], ['outs', 'IP', 'innings pitched'], ['sv', 'SV', 'saves']],
}
// A pitcher gets the SV row only as a reliever: this many career saves.
const RELIEVER_SAVES = 20

const fmt = (stat, v) => (stat === 'outs' ? outsToIp(v) : v.toLocaleString('en-US'))

// Null when there is no card (under two seasons, a start after 30, an empty pool).
// `id` is his own: a Hall of Famer is never his own comp.
export function hofPaceRows({ id = null, players, splits, role, cutoff = null }) {
  players = (players ?? []).filter((p) => p.id !== id)
  if (!players.length) return null
  let age = null
  const rows = []
  for (const [stat, label, title] of ROWS[role] ?? []) {
    const v = hofPaceView({ players, splits, group: role, stat, cutoff })
    if (!v) return null
    if (stat === 'sv' && v.value < RELIEVER_SAVES) continue
    age = v.age
    rows.push({
      stat,
      label,
      title,
      value: fmt(stat, v.value),
      comps: v.comps.map((c) => ({ id: c.id, name: c.name, value: fmt(stat, c.value) })),
    })
  }
  return rows.length ? { age, rows } : null
}
