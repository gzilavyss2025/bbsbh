// Numbers Game #22-style ball/strike lanes beside the diamond: two thin
// vertical columns — a light "ball" lane and a shaded "strike" lane (strikes,
// fouls, and balls in play, the last shown as X). Each lane lists its pitches'
// 1-based numbers stacked from the TOP independently, so a strike on the 4th
// pitch sits at the top of the strike lane even if the first three were balls.
// An automatic ball or strike — awarded on a violation, with no pitch thrown
// and so no pitch number to carry — takes an A instead of a number.
// Filed here rather than in playbyplay/ because it is a drawn scorebook mark
// like PlayDiamond and StrikeZone, not one of that bucket's notification cards.
// `ladder` arrives already built by the caller (api/playbyplay.js's pitchLadder,
// reveal-only): this file decides nothing about what may be shown, same footing
// as every other drawing in this bucket.
export function PitchLadder({ ladder }) {
  if (ladder.length === 0) return null
  // The lanes stack independently, but the WRITE-ON runs in the order the
  // pitches were actually thrown (styles/motion/playbyplay.css, beat 1), so
  // each cell carries its place in the whole sequence rather than its place in
  // its own lane. `--cell-i` is the only thing that index is for.
  const seq = ladder.map((p, i) => ({ ...p, i }))
  const balls = seq.filter((p) => p.side === 'ball')
  const strikes = seq.filter((p) => p.side === 'strike')
  const label = ladder
    .map((p) => {
      if (p.label === 'X') return 'in play'
      if (p.label === 'A') return `automatic ${p.side}`
      return `${p.side} ${p.label}`
    })
    .join(', ')
  return (
    <div className="pbp__ladder" role="img" aria-label={`Pitch sequence: ${label}`}>
      <div className="pbp__laddercol pbp__laddercol--ball">
        <span className="pbp__ladderhead">B</span>
        {balls.map((p, i) => (
          <span key={i} className="pbp__cell" style={{ '--cell-i': p.i }}>
            {p.label}
          </span>
        ))}
      </div>
      <div className="pbp__laddercol pbp__laddercol--strike">
        <span className="pbp__ladderhead">S</span>
        {strikes.map((p, i) => (
          <span key={i} className="pbp__cell" style={{ '--cell-i': p.i }}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  )
}
