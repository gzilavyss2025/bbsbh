import { selectBoxscore, computePlayOfTheGame } from '../api/boxscore.js'
import { useNav } from '../lib/nav.js'
import { PlayerLink } from './PlayerLink.jsx'
import { TeamLink } from './TeamLink.jsx'
import { TeamLogo } from './TeamLogo.jsx'

// The flip card's back face: what a past, Final game's card turns into once
// revealed. Deliberately a SUMMARY, not the full box score — final R/H/E, the
// pitchers of record, and the game's single most memorable play — with a
// link through to the complete page for anyone who wants more. `feed`/
// `winProb` are only ever passed in once the game has been revealed, so
// selectBoxscore/computePlayOfTheGame (both reveal-only, see boxscore.js's
// header) are safe to call directly here.
export function GameResultFace({ feed, winProb, boxScorePath }) {
  const navigate = useNav()
  const box = selectBoxscore(feed)
  const potg = computePlayOfTheGame(winProb, feed)

  return (
    <div className="flipback">
      <div className="flipback__linescore">
        <div className="flipback__lsHeader" aria-hidden="true">
          <span className="flipback__lsTeamCol" />
          <span className="flipback__lsCol">R</span>
          <span className="flipback__lsCol">H</span>
          <span className="flipback__lsCol">E</span>
        </div>
        <TeamLine side={box.away} />
        <TeamLine side={box.home} />
      </div>
      <Decisions decisions={box.decisions} />
      {potg?.desc && <PlayOfTheGame potg={potg} />}
      <button
        type="button"
        className="btn btn--ghost flipback__full"
        onClick={() => navigate(boxScorePath)}
      >
        Full box score ›
      </button>
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

// The night's single most memorable moment (see computePlayOfTheGame). Reads
// as a natural-case sentence in the app's serif "read" face (see --font-read
// / .pbp__desc for the established precedent) rather than the app's usual
// all-caps display type — approved caps-exempt, see the CSS block comment.
// The batter's name is split off the front of MLB's own description (which
// almost always opens with it) and made a clickable PlayerLink; the rest of
// the sentence stays plain text rather than attempting a fragile name-match
// against every player mentioned in it.
function PlayOfTheGame({ potg }) {
  const { desc, batterId, batterName } = potg
  const hasClickableLead = batterId && batterName && desc.startsWith(batterName)
  return (
    <div className="flipback__potgWrap">
      <span className="flipback__potgLabel">Play of the game</span>
      <p className="flipback__potg">
        {hasClickableLead ? (
          <>
            <PlayerLink id={batterId}>{batterName}</PlayerLink>
            {desc.slice(batterName.length)}
          </>
        ) : (
          desc
        )}
      </p>
    </div>
  )
}
