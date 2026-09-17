import { useRouteLink } from '../../lib/nav.js'
import { slatePath } from '../../lib/route.js'
import { WINTER_SPORT_ID } from '../../lib/winter/leagues.js'

// THE WINTER TAB'S LEAGUE PICKER — four leagues share one rail tab, so the
// choice between them is made here instead (issue #1055).
//
// EVERY CHIP IS A REAL ADDRESS. They are anchors carrying an href, never local
// state: '/mex/12152025' names exactly one page, so reloading it, sharing it
// and the browser's own Back button all work, which is ADR-0056's rule that a
// slate day is a shareable address. `useRouteLink` keeps middle-click and
// cmd-click doing what a reader expects while a plain click stays a push.
//
// A CHIP IN SEASON BUT IDLE TODAY STAYS, AND SAYS SO. The chips are drawn from
// each league's SEASON, not from the day's game list (src/lib/winter/window.js
// explains why), so on December 15 the Mexican league is offered although it
// is not playing. Dimming it is the honest reading of that: the league exists,
// it has no game today, and the reader can still open it and see so. Deleting
// the chip instead would make a quiet Tuesday look like the end of a season.
export function LeaguePicker({ leagues, leagueId, dateStr, isToday }) {
  const linkProps = useRouteLink()
  // One league is not a choice. The tab itself already says where the reader
  // is, so a lone chip would be a control with nothing to control — which is
  // October 6 to 14 every year, when the AFL is the only winter baseball.
  if (!leagues || leagues.length < 2) return null

  return (
    <div className="leaguepicker" aria-label="Winter league">
      {leagues.map((league) => {
        const active = league.leagueId === Number(leagueId)
        return (
          <a
            key={league.leagueId}
            className={`leaguepicker__chip${active ? ' is-active' : ''}${
              league.games ? '' : ' is-idle'
            }`}
            aria-current={active ? 'page' : undefined}
            {...linkProps(
              slatePath(isToday ? null : dateStr, WINTER_SPORT_ID, league.leagueId),
            )}
          >
            <span className="leaguepicker__chiplabel">{league.chip}</span>
            {/* The full name is what a reader who does not know 'LMP' needs,
                and it cannot be a title= tooltip: those are invisible on a
                touch screen, which is this app's first screen. So it is here,
                in the DOM, and CSS hides it below the phone breakpoint where
                four of them will not fit. */}
            <span className="leaguepicker__chipname">{league.name}</span>
          </a>
        )
      })}
    </div>
  )
}
