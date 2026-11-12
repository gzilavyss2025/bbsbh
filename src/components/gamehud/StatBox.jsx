
// The before→after count, animated on mount: the old count fades/strikes
// through, the new one flashes in with --marker (the same highlighter-yellow
// the app already uses as a "watch this" flag) then settles to plain ink.
// `after` is the scorebook code (K, BB) when this pitch itself ended the
// plate appearance, otherwise the count it left behind — see afterLabel in
// api/umpireFavor.js. Fires once per mount (a half-inning's worth of reveals
// remounts this card via the parent's own key, same as the rest of the box
// score), never loops — a live box score re-flashing on its own all game
// would be exhausting to sit next to.
export function CountBlink({ before, after }) {
  return (
    <div className="wcall__count">
      <span className="wcall__count-label">Count</span>
      <span className="wcall__count-old">{before}</span>
      <span className="wcall__count-arrow" aria-hidden="true">→</span>
      <span className="wcall__count-new">{after}</span>
    </div>
  )
}






// One stat cell. Exported because HalfTally.jsx draws the same cells in the
// same `.statline` grid for focus mode's console band — one recipe, two hosts.
// `style` is optional and forwarded as-is: HalfTally is the only caller that
// passes one, an inline `--tally-i` custom property (ADR-0046) that times this
// cell's ink-in against its neighbors — StatBox's own cells pass nothing and
// render exactly as they did before.
export function Stat({ k, v, tone, style }) {
  return (
    <div className={`stat ${tone ? `stat--${tone}` : ''}`} style={style}>
      <span className="stat__v">{v}</span>
      <span className="stat__k">{k}</span>
    </div>
  )
}
