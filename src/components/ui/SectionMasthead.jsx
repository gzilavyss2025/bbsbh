// The navy/gold section masthead for the pre-game cards (Lineup Strength,
// Bullpen Health, and the batting order / opposing defense / opposing starter
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
// title.
export function SectionMasthead({ title, logo, children, as: TitleTag = 'span' }) {
  return (
    <div className="metricbar">
      <TitleTag className="metricbar__title">
        {logo}
        {title}
      </TitleTag>
      {children != null && <span className="metricbar__aside">{children}</span>}
    </div>
  )
}
