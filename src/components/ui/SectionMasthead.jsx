// The navy/gold section masthead for the pre-game cards (Bullpen Health,
// and the batting order / opposing defense / opposing starter
// sections): a navy bar with a kraft-gold bottom border, a condensed-uppercase
// title, and a right-aligned slot for an info affordance. `children` is the
// right-aligned slot (typically an <InfoPopover>). `as` sets the title element:
// the interpretive cards leave it a plain span, but a standalone page section
// passes `as="h3"` so the document keeps a real heading for screen-reader
// navigation.
//
// `logo`, if given, is a decorative mark (a <TeamLogo>) rendered at the far
// RIGHT of the bar — the batting order / opposing starter / opposing defense
// cards use this to put the relevant club's mark in the bar without moving the
// title, which stays hard left in every bar on the page whether a mark is
// present or not. It renders LAST for that reason: the bar used to lay its
// children out with `justify-content: space-between`, so a logo-then-title bar
// with no aside pushed the title to the right edge and a logo-title-aside bar
// pushed it to the middle — the title wandered per card. The title now owns the
// leftover space (`margin-right: auto`), so everything after it packs right.
// The mark is decorative and the title names the same club, so last in the DOM
// costs nothing to a screen reader.
// It's a direct child of `.metricbar`, a sibling of the title rather than
// nested inside it, so the CSS can stretch it to the bar's own full height
// (see `.metricbar .teamlogo-crop-bar` in the pre-game-cards partial).
export function SectionMasthead({ title, logo, children, as: TitleTag = 'span' }) {
  return (
    <div className="metricbar">
      <TitleTag className="metricbar__title">{title}</TitleTag>
      {children != null && <span className="metricbar__aside">{children}</span>}
      {logo}
    </div>
  )
}
