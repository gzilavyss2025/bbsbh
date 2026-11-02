// The strip under the band (#2748): a delay in the half on screen, and the clubs' extra-inning records.
// Delays are spoiler-free (selectDelays). The extras line says the game went to extras, so it exists only
// once the half on screen is past regulation, which the reader reaches only by revealing through it
// (extras unlock one at a time, ADR-0008); before that it takes no space (ADR-0046). `format` is
// DelayCard's formatDelay, passed in as cardCopy.js's delaySentence takes it, so the suite needs no JSX.
export function gamedayNotices({ format, delays, inning, half, regulation, records, names }) {
  const out = delays
    .filter((d) => d.inning === inning && d.half === half)
    .map((d) => `${d.reason ? `${d.reason} delay` : 'Delay'} · ${d.resolved && d.durationMinutes != null ? `Play stopped for ${format(d.durationMinutes)}` : 'Delay in progress'}`)
  if (inning > regulation) {
    const clubs = ['away', 'home'].filter((s) => records?.[s]?.extraInning).map((s) => `${names[s]} ${records[s].extraInning}`)
    if (clubs.length) out.push(`Extra innings this season: ${clubs.join(' · ')}`)
  }
  return out
}
