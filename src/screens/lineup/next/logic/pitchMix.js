// The starter card's pitch mix as rows, for the side of the plate and the look through the
// order the reader picked. Pure. `arsenal` is api/pitchArsenal.js's pitchArsenalFor rows;
// `tto` and `sides` are arsenalTtoView and arsenalSidesView (null when the file has no split).
// `side` is 'L', 'R' or null (both); `look` is 1, 2, 3 or null (the whole season).

// The looks the card can offer for a side: the side's own, else the season's.
export function looksFor(tto, sides, side) {
  return (side ? sides?.[side]?.tto : tto) ?? []
}

// A look one side never reached cannot stay picked when the reader crosses to that side.
export function lookAfterSideChange(look, tto, sides, nextSide) {
  if (look == null) return null
  return looksFor(tto, sides, nextSide).some((l) => l.look === look) ? look : null
}

// One row per pitch, most thrown first: { code, name, pct, velo, delta }. Pitch names come from
// the season rows either way, so a name never changes when a tab is tapped.
export function mixRows(arsenal, tto, sides, side, look) {
  if (!arsenal?.length) return []
  const nameOf = new Map(arsenal.map((t) => [t.code, t.description || t.code]))
  const seasonRows = (side ? sides?.[side]?.rows : arsenal) ?? arsenal
  const selected = look == null ? null : looksFor(tto, sides, side).find((l) => l.look === look) ?? null
  if (selected) {
    return selected.rows.map((r) => ({
      code: r.code,
      name: nameOf.get(r.code) ?? r.name,
      pct: Math.round(r.usage * 1000) / 10,
      velo: r.velo ?? null,
      delta: r.delta ?? null,
    }))
  }
  return seasonRows.map((t) => ({
    code: t.code,
    name: nameOf.get(t.code) ?? t.description ?? t.code,
    pct: t.pct,
    velo: t.avgVelo ?? null,
    delta: null,
  }))
}

// How many of the lineup bat from each side against this pitcher. A switch-hitter bats from
// the side opposite the pitcher's hand. `bats` is each hitter's bat side code ('L', 'R', 'S',
// or '' when unknown); `hand` is the pitcher's throwing hand.
export function batterCounts(bats, hand) {
  let L = 0
  let R = 0
  for (const b of bats) {
    if (b === 'L') L += 1
    else if (b === 'R') R += 1
    else if (b === 'S') {
      if (hand === 'L') R += 1
      else if (hand === 'R') L += 1
    }
  }
  return { L, R }
}

// The pitches thrown across the season: the card's "741 pitches" caption.
export const totalPitches = (arsenal) => (arsenal ?? []).reduce((n, t) => n + (t.pitches ?? 0), 0)
