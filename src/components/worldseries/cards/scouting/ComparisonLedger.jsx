import '../../../../styles/worldseries/comparison.css'
import { teamClubNameShort, teamLocationName } from '../../../../lib/teams.js'
import { TeamLogo } from '../../../logo/TeamLogo.jsx'
import { NO_FIGURE, PairFigure, PairLedger, PairLegend } from '../../../ui/table/PairLedger.jsx'

// The home scouting cards share one reading order: measure, first club, second club.
// Models supply the figures and leaders; the shared PairLedger (#2455) draws them. This
// part only turns two club ids into the ledger's two sides: any pair, in the caller's order.
export function ComparisonLedger({ title, note, clubIds, measureLabel, footer, className = '', children }) {
  const sides = clubIds.map((id) => ({
    key: id,
    label: teamClubNameShort(id),
    kicker: teamLocationName(id),
    mark: <TeamLogo teamId={id} name={teamClubNameShort(id)} size={28} />,
  }))
  return (
    <PairLedger
      title={title}
      note={note}
      period="Regular season"
      sides={sides}
      measureLabel={measureLabel}
      footer={footer}
      className={className}
    >
      {children}
    </PairLedger>
  )
}

export { NO_FIGURE }
export const ComparisonFigure = PairFigure

// `lead` names what the amber mark means; `bar` is the model's rank cut-off for the failed item.
export function ComparisonLegend({ lead, bar }) {
  return <PairLegend lead={lead} failed={bar == null ? undefined : `Outside top ${bar}`} />
}
