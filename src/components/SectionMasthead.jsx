// The navy/gold section masthead for the pre-game metric cards (Lineup
// Strength, Bullpen Tonight): a navy bar with a kraft-gold bottom border, a
// condensed-uppercase title, and a right-aligned slot for an info affordance.
// The team name deliberately stays OUT of the bar — team identity is already
// established by the TeamInfo page around these cards. `children` is the
// right-aligned slot (typically an <InfoPopover>).
export function SectionMasthead({ title, children }) {
  return (
    <div className="metricbar">
      <span className="metricbar__title">{title}</span>
      {children != null && <span className="metricbar__aside">{children}</span>}
    </div>
  )
}
