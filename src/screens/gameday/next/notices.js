// The strip under the band (#2748): a delay in the half on screen, and the clubs' extra-inning records.
// Delays are spoiler-free (selectDelays). The extras line says the game went to extras, so it exists only
// once the half on screen is past regulation, which the reader reaches only by revealing through it
// (extras unlock one at a time, ADR-0008); before that it takes no space (ADR-0046).

// "2 hr 42 min" / "1 hr" / "38 min": a stoppage's length. It lived in DelayCard.jsx
// until that card was deleted (#2747); the strip is its one reader now.
function formatDelay(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h} hr ${m} min`
  if (h) return `${h} hr`
  return `${m} min`
}

// `live` is whether the half on screen is the one being played now. selectDelays
// leaves a stoppage unresolved when it ran under a minute or the feed never
// stamped its end, so only on the live half does that mean it is still going.
export function gamedayNotices({ delays, inning, half, regulation, records, names, live = false }) {
  const out = delays
    .filter((d) => d.inning === inning && d.half === half)
    .map((d) => {
      const label = d.reason ? `${d.reason} delay` : 'Delay'
      if (d.resolved && d.durationMinutes != null) return `${label} · Play stopped for ${formatDelay(d.durationMinutes)}`
      return live ? `${label} in progress` : label
    })
  if (inning > regulation) {
    const clubs = ['away', 'home'].filter((s) => records?.[s]?.extraInning).map((s) => `${names[s]} ${records[s].extraInning}`)
    if (clubs.length) out.push(`Extra innings this season: ${clubs.join(' · ')}`)
  }
  return out
}
