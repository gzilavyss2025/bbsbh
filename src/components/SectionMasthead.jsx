// The navy/gold section masthead for the pre-game cards (Lineup Strength,
// Bullpen Tonight, and the batting order / opposing defense / opposing starter
// sections): a navy bar with a kraft-gold bottom border, a condensed-uppercase
// title, and a right-aligned slot for an info affordance. The team name
// deliberately stays OUT of the bar — team identity is already established by the
// TeamInfo page around these cards. `children` is the right-aligned slot
// (typically an <InfoPopover>). `as` sets the title element: the interpretive
// cards leave it a plain span, but a standalone page section passes `as="h3"` so
// the document keeps a real heading for screen-reader navigation.
export function SectionMasthead({ title, children, as: TitleTag = 'span' }) {
  return (
    <div className="metricbar">
      <TitleTag className="metricbar__title">{title}</TitleTag>
      {children != null && <span className="metricbar__aside">{children}</span>}
    </div>
  )
}
