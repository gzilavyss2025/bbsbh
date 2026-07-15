import { TeamLogo } from './TeamLogo.jsx'

// The All-Star Rosters page's one game-result card — full-width, both
// leagues' marks, the final score, and a tap into the (still sealed) box
// score. This is a DELIBERATE, narrow exception to the "never print a score"
// spoiler invariant: see docs/adr/0019-all-star-rosters-shows-final-scores.md
// for why that's safe here specifically (roster membership already carries
// no individual game's stakes, and an All-Star Game is exhibition). Every
// other game surface in the app still renders through the ordinary
// SealBox/reveal-only path, including the box score this card links to.
//
// teamId 159/160 are the fixed AL/NL All-Star pseudo-clubs (not real MLB
// clubs) — TeamLogo already degrades to a plain monogram if no mark exists
// for them, same as any other team id.
export function AllStarGameResult({ score, dateLabel, onBoxScore }) {
  if (!score) return null
  const winner = score.al === score.nl ? null : score.al > score.nl ? 'al' : 'nl'
  return (
    <div className="allstargame">
      {dateLabel && <div className="allstargame__date">{dateLabel}</div>}
      <div className="allstargame__teams">
        <span
          className={`allstargame__side${winner === 'al' ? ' allstargame__side--winner' : ''}`}
        >
          <TeamLogo teamId={159} name="American League" size={40} />
          <span className="allstargame__label">AL</span>
          <span className="allstargame__score">{score.al}</span>
        </span>
        <span className="allstargame__sep" aria-hidden="true">
          –
        </span>
        <span
          className={`allstargame__side allstargame__side--away${
            winner === 'nl' ? ' allstargame__side--winner' : ''
          }`}
        >
          <span className="allstargame__score">{score.nl}</span>
          <span className="allstargame__label">NL</span>
          <TeamLogo teamId={160} name="National League" size={40} />
        </span>
      </div>
      {onBoxScore && (
        <button type="button" className="allstargame__box" onClick={onBoxScore}>
          Box score ›
        </button>
      )}
    </div>
  )
}
