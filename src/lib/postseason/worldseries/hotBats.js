// Hot bats (#1906, slice 2). Pure.
//
// Input is the `byDateRange` hitting split list, bounded by the caller to end
// the day before the slate date (ADR-0088): { player:{id,fullName},
// position:{abbreviation}, stat:{plateAppearances, ops:'1.271', avg, obp, slg,
// homeRuns, rbi} }. Splits come unsorted. The pick is the hitter with the most
// PA among those with OPS >= `minOps`; `ops` is a string and is parsed ("-.--"
// parses to NaN and never qualifies).
export function pickHotBat(splits, { minOps = 1 } = {}) {
  let best = null
  for (const s of splits ?? []) {
    const ops = Number.parseFloat(s?.stat?.ops)
    const pa = Number(s?.stat?.plateAppearances)
    if (!(ops >= minOps) || !(pa > 0)) continue
    if (!best || pa > best.pa) {
      const st = s.stat
      best = {
        id: s.player?.id ?? null,
        name: s.player?.fullName ?? '',
        pos: s.position?.abbreviation ?? '',
        pa,
        avg: st.avg,
        obp: st.obp,
        slg: st.slg,
        hr: st.homeRuns,
        rbi: st.rbi,
      }
    }
  }
  return best
}

// Which side leads a figure: 'a', 'b', or null on a tie or a missing side.
// The tile that leads gets the "best" fill; a tie paints neither.
export function leadSide(a, b, { lowerWins = false } = {}) {
  const x = Number.parseFloat(a)
  const y = Number.parseFloat(b)
  if (!Number.isFinite(x) || !Number.isFinite(y) || x === y) return null
  return (x > y) !== lowerWins ? 'a' : 'b'
}
