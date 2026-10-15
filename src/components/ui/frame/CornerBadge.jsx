// THE CORNER BADGE (ADR-0112) — a label on the corner of a photo. `pos` is a
// position tab at the bottom left ("SS", "RHP"), in ink. `action` is a small
// paper square at the top right that holds a glyph (⤢ to expand a photo); it is a
// mark, not a control: wrap the host in the link or button that acts. Styled in
// styles/system/report/leader.css.
//
//   corner    'pos' (the default) or 'action'.
//   children  the badge's text or glyph.
//   host      the photo (an <img> or a Headshot), drawn under the badge.
//
// The host keeps its own size; this adds only the box the badge sits in.
export function CornerBadge({ corner = 'pos', host, children }) {
  if (corner !== 'pos' && corner !== 'action') throw new Error(`CornerBadge: unknown corner "${corner}" (pos, action)`)
  return (
    <span className="cornerhost">
      {host}
      <span className={`cornerbadge cornerbadge--${corner}`}>{children}</span>
    </span>
  )
}
