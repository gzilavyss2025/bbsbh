import { selectBoxscore } from '../../api/boxscore.js'
import { useRouteLink } from '../../lib/nav.js'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { TeamLink } from '../team/TeamLink.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { Door } from '../ui/control/Door.jsx'

// A past, Final game's result card, once revealed (Stamp In and the postseason
// series pages; it was the slate flip card's back face until ADR-0116). Deliberately a SUMMARY, not the full box score — final R/H/E and the
// pitchers of record — with a link through to the complete page for anyone who
// wants more. `feed` is only ever passed in once the game has been revealed, so
// selectBoxscore (reveal-only, see boxscore.js's header) is safe to call
// directly here. It draws no Play of the Game: the Postseason Series page's
// per-game ledger entry builds its own, roomier one (headshot-led) from
// computePlayOfTheGame, and Stamp In's long list is read by scrolling.
//
// `trailing` is an ALREADY-RENDERED node the host drops at the right-hand end
// of the top row, beside Box score. The node arrives finished, so this file
// never learns what it is — which is what keeps it free of any stamp
// identifier (check-stamp-surfaces.mjs names it a forbidden surface, and that
// was not relaxed). Its one caller is the Stamp In page (ADR-0042); every
// other caller passes nothing and renders nothing extra. `door={false}` leaves Box score out, for a
// host that draws its own (the World Series page puts it in the game's head row); the row goes with it
// when nothing trails.
export function GameResultFace({ feed, boxScorePath, trailing = null, door = true }) {
  const routeLink = useRouteLink()
  const box = selectBoxscore(feed)
  const totalInnings = box.innings?.length ?? 9
  const wentToExtras = totalInnings > 9

  return (
    <div className="flipback">
      {(door || trailing) && (
        <div className="flipback__topRow">
          {/* A door, not a button: it leaves the card for the box score (#1174). */}
          {door && (
            <Door className="flipback__door" {...routeLink(boxScorePath)}>
              Box score
            </Door>
          )}
          {trailing}
        </div>
      )}
      <div className="flipback__linescore">
        <div className="flipback__lsHeader" aria-hidden="true">
          <span className="t-label t-label--bold flipback__lsTeamCol">
            {wentToExtras && `${totalInnings} innings`}
          </span>
          <span className="flipback__lsCol">R</span>
          <span className="flipback__lsCol">H</span>
          <span className="flipback__lsCol">E</span>
        </div>
        <TeamLine side={box.away} />
        <TeamLine side={box.home} />
      </div>
      <Decisions decisions={box.decisions} />
    </div>
  )
}

function TeamLine({ side }) {
  return (
    <div className="flipback__team">
      <span className="flipback__abbr">
        <TeamLogo teamId={side.id} name={side.teamName} size={32} />
        <TeamLink id={side.id}>{side.clubName || side.abbreviation}</TeamLink>
      </span>
      <span className="flipback__lsCol flipback__lsVal">{side.line.r}</span>
      <span className="flipback__lsCol flipback__lsVal">{side.line.h}</span>
      <span className="flipback__lsCol flipback__lsVal">{side.line.e}</span>
    </div>
  )
}

// W/L/S, each pitcher's name a clickable PlayerLink with his season record
// trailing in parens as plain text (the record isn't a name, so it doesn't
// need to be part of the link).
function Decisions({ decisions }) {
  const rows = [
    decisions.win && { k: 'W', id: decisions.winId, name: decisions.win, rec: decisions.winRecord },
    decisions.loss && { k: 'L', id: decisions.lossId, name: decisions.loss, rec: decisions.lossRecord },
    decisions.save && { k: 'S', id: decisions.saveId, name: decisions.save, rec: decisions.saveRecord },
  ].filter(Boolean)
  if (rows.length === 0) return null
  return (
    <div className="flipback__decisions">
      {rows.map((r) => (
        <span className="flipback__decision" key={r.k}>
          <b>{r.k}</b> <PlayerLink id={r.id}>{r.name}</PlayerLink>
          {r.rec ? ` (${r.rec})` : ''}
        </span>
      ))}
    </div>
  )
}
