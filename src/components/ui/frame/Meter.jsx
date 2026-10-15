import { meterModel } from '../../../lib/design/report/classes.js'

// THE METER (ADR-0112) — the player page's pitch mix bar as a shared part: one
// segment per part, as wide as its share, the code over the figure, an ink rule
// between segments. Styled once, in styles/system/report/meter.css. It replaces
// the bullpen status bar, the stacked pillars and the foul average meter.
//
//   parts  [{ code, share, tone, ring, figure }]. `share` is a weight (counts or
//          percents both work). `tone` is a role: good, caution, bad or neutral.
//          `ring` draws a part that is not a real share (the "other" of a mix) as
//          a ringed segment. `figure` is the text shown, defaulting to the share.
//   label  the accessible name; left out, it is built from the parts.
//
// It computes nothing but the split, and fetches nothing: the shares are the
// caller's, so a reveal gate stays where the caller put it.
export function Meter({ parts, label, className = '' }) {
  const model = meterModel(parts)
  return (
    <div className={`meter ${className}`.trim()} role="img" aria-label={label ?? model.label}>
      {model.parts.map((p, i) => (
        <div
          // Keyed by position: two parts may share a code (two OTH parts).
          key={i}
          className={`meter__seg meter__seg--${p.tone}${p.ring ? ' meter__seg--ring' : ''}`}
          style={{ '--share': p.share }}
        >
          {p.code}
          <span className="meter__figure">{p.figure}</span>
        </div>
      ))}
    </div>
  )
}
