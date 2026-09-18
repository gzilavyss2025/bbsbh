import { OffDaySection } from '../team/OffDaySection.jsx'
import { WinterCountdown } from './WinterCalendar.jsx'

// THE COLUMN THE WIRE LEFT — what stands beside the offseason page on a wide
// screen (issue #1078).
//
// In season that 288px column is the roster rail. Through the winter the wire
// has been promoted into the page itself (ADR-0074), and for two steps of
// #1038 the column held a 112px countdown over seventeen hundred pixels of
// nothing — while the club grid, which in the winter is EVERY club, ran a
// thousand pixels down the bottom of the games column instead.
//
// So the column becomes a rail again: the countdown at its head, the league
// under it. It fills the margin and takes a third off the games column, because
// thirty tiles two-wide is far shorter than thirty tiles five-wide.
//
// WIDE ONLY, and the caller decides that rather than a media query — on a phone
// there is no second column, the countdown already sits inside the lead, and
// the grid already follows it down the one column there is. Nothing to move, so
// GameSelect simply does not mount this.
//
// It lives here rather than inline in GameSelect for the reason every other
// piece of the offseason page does: the screen is a screen, and what the winter
// puts in a slot is this directory's business.
export function WinterRail({ winter, teams, favoriteTeamId, favoriteAffiliateIds }) {
  return (
    <div className="winterrail">
      <WinterCountdown winter={winter} />
      {/* `winter` tells the section it is not looking at an off day. "Off Day"
          is a claim about TODAY, and over all thirty clubs in December it would
          be a false one — OffDaySection.jsx carries the heading it uses
          instead. */}
      {teams.length > 0 && (
        <OffDaySection
          teams={teams}
          favoriteTeamId={favoriteTeamId}
          favoriteAffiliateIds={favoriteAffiliateIds}
          winter
        />
      )}
    </div>
  )
}
