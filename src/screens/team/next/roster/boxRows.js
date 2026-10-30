// The pure shapes behind the roster box (RosterBox.jsx): rows for the Lineup and Pitching
// staff cards, from loadRoster's lists only. No request. Every missing field falls back to
// '', null or a dash, so a MiLB club (no WAR, thin feeds) still draws.
export const DASH = '—'

// One place, and never "-0.0": a WAR that rounds to zero reads 0.0.
const tenths = (war) => Math.round(war * 10) / 10 || 0
export const warText = (war) => (war == null ? DASH : tenths(war).toFixed(1))
export const warIsDown = (war) => war != null && tenths(war) < 0

// The one row whose WAR leads the box; null when no row has a WAR. A tie keeps the first.
export function warLeaderId(rows) {
  let best = null
  for (const r of rows) if (r.war != null && (best == null || r.war > best.war)) best = r
  return best?.id ?? null
}

export const warSum = (rows) => rows.reduce((sum, r) => sum + (r.war ?? 0), 0)

// The foot row's words: each group's sum by its name ("Lineup 21.9 WAR · bench 5.2 WAR"). Null when
// no row has a WAR (a season the WAR file does not cover yet), so no 0.0 stands for "none".
export function footText(groups) {
  if (!groups.some((g) => g.rows.some((r) => r.war != null))) return null
  return groups.map((g) => `${g.sum} ${warText(warSum(g.rows))} WAR`).join(' · ')
}

// Every player loadRoster returned, by id. The lineup's spots carry only a name and a
// position, so the number, WAR and marks come from here. A position player's own row comes
// first, so a two-way player's lineup WAR is his batting WAR. The injured list comes last:
// it carries a number but no WAR, for a regular who is hurt now. A player who has left the
// club is in none of these, and his row reads a dash.
export function metaById(d) {
  const meta = new Map()
  const lists = [d.position, d.substitutes, d.recentSubstitutes, d.pitchers, d.startingPitchers, d.bullpen, d.recentStartingPitchers, d.recentBullpen, d.injured]
  for (const list of lists) {
    for (const p of list ?? []) if (p?.id != null && !meta.has(p.id)) meta.set(p.id, p)
  }
  return meta
}

const rowOf = (p, m, hurt, lead) => ({
  id: p.id,
  name: p.name ?? m.name ?? '',
  jersey: p.jersey ?? m.jersey ?? '',
  war: p.war ?? m.war ?? null,
  allStar: Boolean(p.allStar ?? m.allStar),
  prospect: p.prospect ?? m.prospect ?? null,
  rookie: Boolean(p.rookie ?? m.rookie),
  hurt,
  lead,
  line: seasonLineOf(p),
})

// The 40-man, one row a player, led by `leadOf(p)` (a position or a role), with no season line
// under the name: the same ruled box as the lineup and the staff (Gary, 2026-10-30).
export const fortyRows = (list, leadOf) =>
  list.map((p) => ({ ...rowOf(p, {}, false, leadOf(p) ?? DASH), line: '' }))

// The nine, in the diamond's order, each led by his position.
export const lineupRows = (lineup, meta) =>
  lineup.map((p) => rowOf(p, meta.get(p.id) ?? {}, Boolean(p.hurt), p.position ?? DASH))

// The top substitutes, each led by his roster position.
export const benchRows = (subs, meta, injuredIds) =>
  subs.map((p) => {
    const m = meta.get(p.id) ?? {}
    return rowOf(p, m, injuredIds.has(p.id), p.pos || m.pos || DASH)
  })

// A pitcher's season line, for the small line under his name: "30 G · 174.2 IP · 3.12 ERA".
// Only the Season view's pitcher lists carry it; a hitter, a Current-view row, or an arm with
// no outing has ''.
// A line, not columns: seven columns overran a phone and the half-width table at 820.
export function seasonLineOf(p) {
  if (!p.appearances) return ''
  return `${p.appearances} G · ${p.ip ?? DASH} IP · ${p.era ?? DASH} ERA`
}

// The rotation, led by its slot (1 to n, in the loader's order).
export const rotationRows = (sp, injuredIds) => sp.map((p, i) => rowOf(p, {}, injuredIds.has(p.id), String(i + 1)))

// The bullpen, led by its role: CL when the active roster reads him as the closer. A closer
// off the active roster (on the IL) is not in that list, so his own saves decide, by the
// loader's rule (8 or more, roleFromCounts in loadRoster.js). Else RP.
const CLOSER_SAVES = 8
export function penRows(pen, injuredIds, pitchers) {
  const roleById = new Map(pitchers.map((p) => [p.id, p.role]))
  const closer = (p) => (roleById.has(p.id) ? roleById.get(p.id) === 'CL' : (p.saves ?? 0) >= CLOSER_SAVES)
  return pen.map((p) => rowOf(p, {}, injuredIds.has(p.id), closer(p) ? 'CL' : 'RP'))
}

// The pen week's three figures, off StaffGrid's own rows: arms that pitched the day before the
// file's last day, pitches thrown over the seven days, and the arm with the most. The last
// cell is the file's today, which need not be the reader's (a frozen offseason file, `?d=`),
// so `day` names the date the first figure counts.
export function penWeekFigures(grid) {
  if (!grid?.length) return null
  const yesterday = grid[0].cells.length - 2
  const pitched = grid.filter((r) => r.cells[yesterday]?.pitches).length
  const total = grid.reduce((sum, r) => sum + (r.last7dayPitches ?? 0), 0)
  const busiest = grid.reduce((a, b) => ((b.last7dayPitches ?? 0) > (a.last7dayPitches ?? 0) ? b : a))
  return {
    day: grid[0].cells[yesterday]?.date ?? null,
    pitched,
    arms: grid.length,
    total,
    busiest: (busiest.last7dayPitches ?? 0) > 0 ? busiest : null,
  }
}
