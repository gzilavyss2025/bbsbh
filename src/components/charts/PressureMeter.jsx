// The Pressure meter (#2939): ten LED bars rising left to right, lit up to
// `bars` (1–10, from tenseBars in api/tensest/tenseBars.js). How tense a play
// was, ranked against the whole season. A play's leverage is score-revealing,
// so `bars` arrives already reveal-gated by the caller (charts/ rule). Null or
// 0 draws nothing: a game's first play has no leverage reading.
//
// This is the inline size (the swing rows, Gary's option A, 2026-11-09): no
// caption, no motion. Gameday's captioned, pulsing meter is #3006.
const RANK = { 5: 'top 30%', 6: 'top 20%', 7: 'top 12%', 8: 'top 7%', 9: 'top 3%', 10: 'top 1%' }

export function PressureMeter({ bars }) {
  if (!Number.isInteger(bars) || bars < 1 || bars > 10) return null
  const rank = RANK[bars]
  return (
    <span
      className="pressure"
      role="meter"
      aria-label="Pressure"
      aria-valuemin={0}
      aria-valuemax={10}
      aria-valuenow={bars}
      aria-valuetext={`${bars} of 10${rank ? `, ${rank} of the season` : ''}`}
    >
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className={`pressure__bar${i < bars ? ' is-lit' : ''}`} aria-hidden="true" />
      ))}
    </span>
  )
}
