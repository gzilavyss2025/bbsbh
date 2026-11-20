// The lineup a club fields before and after a deal (/trade's Lineups sheet).
// Pure. A player is { id, name, pos, war, level } as the depth grid reads him
// (depth.js); only big-league and Triple-A players start.
//
// A rough lineup, said plainly in the sheet: the best player at each fielding
// spot by last season's WAR, his own position first (an outfielder may slide
// across the outfield); a spot with nobody of its own takes the best bat left;
// the best bat after that is the DH; the five best arms who are not known relievers are the rotation.
// A spot under 1.0 WAR is weak, the same line the depth card's Starter view draws.

export const BAT_SPOTS = ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'DH']
const ARMS = 5
const WEAK = 1
const NEAR = new Set(['MLB', 'AAA'])
const BULLPEN = new Set(['RP', 'CL'])
const PITCHER = new Set(['P', 'SP', 'RP', 'RHP', 'LHP', 'TWP'])
// Where a player may start, in the order he is tried: his own spot, then the
// spots a general label covers.
// An outfielder slides to another outfield spot before he would sit.
const FITS = { OF: ['CF', 'LF', 'RF'], IF: ['SS', '2B', '3B'], DH: ['DH'], LF: ['LF', 'CF', 'RF'], CF: ['CF', 'LF', 'RF'], RF: ['RF', 'LF', 'CF'] }
const fits = (pos) => FITS[pos] ?? (BAT_SPOTS.includes(pos) ? [pos] : [])
const byWar = (a, b) => (b.war ?? -99) - (a.war ?? -99)

function field(players) {
  const pool = players.filter((p) => NEAR.has(p.level) && p.pos)
  const bats = pool.filter((p) => !PITCHER.has(p.pos)).sort(byWar)
  const at = {}
  const used = new Set()
  for (const p of bats) {
    const spot = fits(p.pos).find((s) => s !== 'DH' && !at[s])
    if (spot) {
      at[spot] = p
      used.add(p.id)
    }
  }
  // A spot with nobody of its own takes the best bat left, before the DH does.
  for (const spot of BAT_SPOTS) {
    if (spot === 'DH' || at[spot]) continue
    const p = bats.find((b) => !used.has(b.id))
    if (!p) break
    at[spot] = p
    used.add(p.id)
  }
  at.DH = bats.find((p) => !used.has(p.id)) ?? null
  // A known reliever (RP, closer) stays in the pen; an arm with no role may start.
  const arms = pool.filter((p) => PITCHER.has(p.pos) && !BULLPEN.has(p.role)).sort(byWar).slice(0, ARMS)
  return { at, arms }
}

// A trade-desk player as the lineup reads him; an arrival plays at the level he plays now.
export const asDepth = (p) => ({ id: p.id, name: p.name, pos: p.pos, level: p.levelCode, war: p.war, role: p.line?.role ?? p.role ?? null })

const warSum = (ps) => ps.reduce((t, p) => t + (p?.war ?? 0), 0)

// { spots: [{ spot, group: 'bat'|'arm', before, after, changed, incoming, weak }],
//   before, after } — the two WAR totals of every starter.
export function lineupAfter(players, { out = [], inn = [] } = {}) {
  const outIds = new Set(out.map((p) => p.id))
  const innIds = new Set(inn.map((p) => p.id))
  const was = field(players)
  const now = field([...players.filter((p) => !outIds.has(p.id)), ...inn])
  const row = (spot, group, before, after) => ({
    spot,
    group,
    before: before ?? null,
    after: after ?? null,
    changed: (before?.id ?? null) !== (after?.id ?? null),
    incoming: Boolean(after && innIds.has(after.id)),
    weak: (after?.war ?? -99) < WEAK,
  })
  const spots = [
    ...BAT_SPOTS.map((s) => row(s, 'bat', was.at[s], now.at[s])),
    ...Array.from({ length: ARMS }, (_, i) => row(`SP${i + 1}`, 'arm', was.arms[i], now.arms[i])),
  ]
  return {
    spots,
    before: warSum([...BAT_SPOTS.map((s) => was.at[s]), ...was.arms]),
    after: warSum([...BAT_SPOTS.map((s) => now.at[s]), ...now.arms]),
  }
}
