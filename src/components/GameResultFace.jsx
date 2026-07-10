import { selectBoxscore, computePlayOfTheGame } from '../api/boxscore.js'
import { useNav } from '../lib/nav.js'
import { TeamLogo } from './TeamLogo.jsx'

// The flip card's back face: what a past, Final game's card turns into once
// tapped. Deliberately a SUMMARY, not the full box score — final R/H/E, the
// pitchers of record, and the game's single most memorable play — with a
// link through to the complete page for anyone who wants more. `feed`/
// `winProb` are only ever passed in once FlipCard has revealed this card, so
// selectBoxscore/computePlayOfTheGame (both reveal-only, see boxscore.js's
// header) are safe to call directly here.
export function GameResultFace({ feed, winProb, boxScorePath, onFlipBack }) {
  const navigate = useNav()
  const box = selectBoxscore(feed)
  const potg = computePlayOfTheGame(winProb, feed)

  return (
    <div className="flipback">
      <button type="button" className="flipback__flipBtn" onClick={onFlipBack} aria-label="Flip back">
        ‹
      </button>
      <div className="flipback__teams">
        <TeamLine side={box.away} />
        <TeamLine side={box.home} />
      </div>
      <Decisions decisions={box.decisions} />
      {potg?.desc && (
        <p className="flipback__potg">
          <span className="flipback__potgLabel">Play of the game</span> {potg.desc}
        </p>
      )}
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
      <TeamLogo teamId={side.id} name={side.teamName} size={32} />
      <span className="flipback__abbr">{side.abbreviation || side.clubName}</span>
      <span className="flipback__stat">
        {side.line.r}
        <small>R</small>
      </span>
      <span className="flipback__stat">
        {side.line.h}
        <small>H</small>
      </span>
      <span className="flipback__stat">
        {side.line.e}
        <small>E</small>
      </span>
    </div>
  )
}

function Decisions({ decisions }) {
  const withRec = (name, rec) => (rec ? `${name} (${rec})` : name)
  const parts = [
    decisions.win && { k: 'W', v: withRec(decisions.win, decisions.winRecord) },
    decisions.loss && { k: 'L', v: withRec(decisions.loss, decisions.lossRecord) },
    decisions.save && { k: 'S', v: withRec(decisions.save, decisions.saveRecord) },
  ].filter(Boolean)
  if (parts.length === 0) return null
  return (
    <div className="flipback__decisions">
      {parts.map((p) => (
        <span className="flipback__decision" key={p.k}>
          <b>{p.k}</b> {p.v}
        </span>
      ))}
    </div>
  )
}
