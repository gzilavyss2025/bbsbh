// The navy/gold section masthead for the pre-game cards (Bullpen Health,
// and the batting order / opposing defense / opposing starter
// sections): a navy bar with a kraft-gold bottom border, a condensed-uppercase
// title, and a right-aligned slot for an info affordance. `children` is the
// right-aligned slot (typically an <InfoPopover>). `as` sets the title element:
// the interpretive cards leave it a plain span, but a standalone page section
// passes `as="h3"` so the document keeps a real heading for screen-reader
// navigation.
//
// `logo`, if given, is a decorative mark (a <TeamLogo>) rendered before the
// title text — the batting order / opposing starter / opposing defense cards
// use this to put the relevant club's mark right in the bar, alongside the
// title. It's a direct child of `.metricbar`, a sibling of the title rather
// than nested inside it, so the CSS can stretch it to the bar's own full
// height (see `.metricbar .teamlogo-crop-bar` in the pre-game-cards partial).
export function SectionMasthead({ title, logo, children, as: TitleTag = 'span' }) {
  return (
    <div className="metricbar">
      {logo}
      <TitleTag className="metricbar__title">{title}</TitleTag>
      {children != null && <span className="metricbar__aside">{children}</span>}
    </div>
  )
}
