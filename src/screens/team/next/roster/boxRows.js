// The pure shapes behind the roster box (RosterBox.jsx): rows for the Lineup and Pitching
// staff cards, from loadRoster's lists only. No request. Every missing field falls back to
// '', null or a dash, so a MiLB club (no WAR, thin feeds) still draws.
const DASH = '—'

export const warText = (war) => (war == null ? DASH : war.toFixed(1))

// The one row whose WAR leads the box; null when no row has a WAR. A tie keeps the first.
export function warLeaderId(rows) {
  let best = null
  for (const r of rows) if (r.war != null && (best == null || r.war > best.war)) best = r
  return best?.id ?? null
}

export const warSum = (rows) => rows.reduce((sum, r) => sum + (r.war ?? 0), 0)

// Every player loadRoster returned, by id. The lineup's spots carry only a name and a
// position, so the number, WAR and marks come from here. A position player's own row comes
// first, so a two-way player's lineup WAR is his batting WAR.
export function metaById(d) {
  const meta = new Map()
  const lists = [d.position, d.substitutes, d.recentSubstitutes, d.pitchers, d.startingPitchers, d.bullpen, d.recentStartingPitchers, d.recentBullpen]
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
})

// The nine, in the diamond's order, each led by his position.
export const lineupRows = (lineup, meta) =>
  lineup.map((p) => rowOf({ id: p.id, name: p.name }, meta.get(p.id) ?? {}, Boolean(p.hurt), p.position ?? DASH))

// The top substitutes, each led by his roster position.
export const benchRows = (subs, meta, injuredIds) =>
  subs.map((p) => rowOf(p, meta.get(p.id) ?? {}, injuredIds.has(p.id), p.pos || meta.get(p.id)?.pos || DASH))

// A pitcher's season line, for the small line under his name: "30 G · 174.2 IP · 3.12 ERA".
// Only the Season view's lists carry it; a Current-view row, or an arm with no outing, has ''.
// A line, not columns: seven columns overran a phone and the half-width table at 820.
export function seasonLineOf(p) {
  if (!p.appearances) return ''
  return `${p.appearances} G · ${p.ip ?? DASH} IP · ${p.era ?? DASH} ERA`
}

// The rotation, led by its slot (1 to n, in the loader's order).
export const rotationRows = (sp, injuredIds) =>
  sp.map((p, i) => ({ ...rowOf(p, {}, injuredIds.has(p.id), String(i + 1)), line: seasonLineOf(p) }))

// The bullpen, led by its role: CL when the 40-man reads him as the closer, else RP.
export function penRows(pen, injuredIds, pitchers) {
  const roleById = new Map((pitchers ?? []).map((p) => [p.id, p.role]))
  return pen.map((p) => ({
    ...rowOf(p, {}, injuredIds.has(p.id), roleById.get(p.id) === 'CL' ? 'CL' : 'RP'),
    line: seasonLineOf(p),
  }))
}

// The pen week's three figures, off StaffGrid's own rows: arms that pitched yesterday,
// pitches thrown over the seven days, and the arm with the most. The last cell is today.
export function penWeekFigures(grid) {
  if (!grid?.length) return null
  const yesterday = grid[0].cells.length - 2
  const pitched = grid.filter((r) => r.cells[yesterday]?.pitches).length
  const total = grid.reduce((sum, r) => sum + (r.last7dayPitches ?? 0), 0)
  const busiest = grid.reduce((a, b) => ((b.last7dayPitches ?? 0) > (a.last7dayPitches ?? 0) ? b : a))
  return { pitched, arms: grid.length, total, busiest: (busiest.last7dayPitches ?? 0) > 0 ? busiest : null }
}
