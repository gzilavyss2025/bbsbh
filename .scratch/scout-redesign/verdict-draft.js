// DRAFT for slice 1 (#2319). Paste into src/screens/scout/hitterBoard.js,
// below expectedAll. The tests in verdict-draft.test.js pin it.
//
// THE SINGLE VERDICT (#2319): the hitter's expected xwOBA (est.) on this
// pitcher's whole mix, against the league's on the same pitches. One number,
// because xwOBA (est.) already prices every strikeout at 0 (ADR-0097), so the
// whiffs are inside it.
//
// Each pilled type counts at its pitch count to this stance (`board.byType[code].n`,
// unrounded, #1490 "Formatting"). Its hitter value is the location-weighted
// `exp` where the pitcher's map clears its floor, else the hitter's whole-type
// `typeVal`; its league value is always `leagueFlat` (the same league number
// `hitterSide` puts beside `exp`). A type with no hitter value drops out, and
// `covered` says how much of the mix is left.
//
// `side` is hitterSide(...) for the xwOBA (est.) metric. Null with no board,
// no side, or no type left. `band` is metrics.band: 0 Even, ±1 Slight, ±2 Clear,
// positive for the hitter. `push` per row is that type's part of `gap`; the
// pushes add up to `gap`.
export function matchupVerdict(board, side) {
  if (!board || !side) return null
  const rows = board.types.flatMap((t) => {
    const h = side.byType[t.code]
    const value = h?.exp ?? h?.typeVal ?? null
    const n = board.byType[t.code]?.n ?? 0
    return value != null && h.leagueFlat != null && n > 0
      ? [{ code: t.code, name: t.name, n, mapped: h.exp != null, value, league: h.leagueFlat }]
      : []
  })
  const total = rows.reduce((s, r) => s + r.n, 0)
  if (!total) return null
  const weigh = (key) => rows.reduce((s, r) => s + r.n * r[key], 0) / total
  const value = weigh('value')
  const league = weigh('league')
  return {
    value,
    league,
    gap: value - league,
    band: band('xwoba', value, league),
    covered: total / board.all.n,
    rows: rows.map((r) => ({ ...r, share: r.n / total, push: (r.n * (r.value - r.league)) / total })),
  }
}
