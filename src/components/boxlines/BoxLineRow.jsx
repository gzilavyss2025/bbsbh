import { useRouteLink } from '../../lib/nav.js'
import { monthDay } from '../../lib/dates.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'

// One row of the Box Lines sheet: the season (once per group), the mark of
// the club he wore THAT day, the date and side of the road, his one-game
// line, and the final score with his club's runs first — "CHC 8, MIL 2"
// rather than "W 8–2", because a W beside a score still made a reader work
// out who won. The whole row is one anchor to that game's box score
// (useRouteLink, so middle-click and cmd-click still reach the browser).
//
// Every value here arrived already gated (api/boxlines/rows.js); this row
// decides nothing about what may show.
//
// The mark is the knockout art the navy mastheads wear (TeamLogo `mono`),
// re-inked for paper with the same `brightness(0)` the themed mastheads use
// for a dark ink (lib/headerTheme.js's --mark-filter) — a knockout is a
// silhouette, and a silhouette in ink is exactly the pencil-scorebook mark.
export function BoxLineRow({ row, showSeason, band }) {
  const link = useRouteLink()
  const where = `${row.home ? 'vs' : '@'} ${row.opponentAbbr || '—'}`
  const score =
    row.runs != null && row.oppRuns != null
      ? `${row.teamAbbr} ${row.runs}, ${row.opponentAbbr} ${row.oppRuns}`
      : '—'
  const inner = (
    <>
      <span className="boxline__season">{showSeason ? row.season : ''}</span>
      <span className="boxline__mark">
        {row.teamId ? <TeamLogo teamId={row.teamId} name={row.teamAbbr} size={24} variant="mono" /> : null}
      </span>
      <span className="boxline__meta">
        <span className="boxline__date">{monthDay(row.date)}</span>
        <span className="boxline__where">{where}</span>
      </span>
      <span className="boxline__score">{score}</span>
      <span className="boxline__chev" aria-hidden="true">
        ›
      </span>
      <span className="boxline__line">{row.line}</span>
    </>
  )
  const cls = `boxline${band ? ' boxline--band' : ''}`
  return (
    <li className={cls}>
      {row.boxScorePath ? (
        <a className="boxline__link" {...link(row.boxScorePath)} aria-label={`${monthDay(row.date)} ${where}, ${score}: box score`}>
          {inner}
        </a>
      ) : (
        <span className="boxline__link">{inner}</span>
      )}
    </li>
  )
}

// A ruled placeholder row while the lines load, so the sheet keeps its height
// and does not jump when they land.
export function BoxLineSkeleton() {
  return (
    <li className="boxline boxline--skel">
      <span className="boxline__season">
        <i />
      </span>
      <span className="boxline__mark">
        <i />
      </span>
      <span className="boxline__meta">
        <i style={{ width: '55%' }} />
      </span>
      <span className="boxline__score">
        <i style={{ width: 72 }} />
      </span>
      <span className="boxline__chev" />
      <span className="boxline__line">
        <i style={{ width: '78%' }} />
      </span>
    </li>
  )
}
