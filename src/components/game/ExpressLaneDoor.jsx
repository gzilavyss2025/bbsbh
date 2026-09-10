import { useNav } from '../../lib/nav.js'
import { gamePath } from '../../lib/route.js'
import { filmCanExist } from '../../api/expresslane/eligibility.js'
import { teamAbbr } from '../../lib/teams.js'

// THE DOOR INTO EXPRESS LANE (screens/expresslane/) — the full-screen surface
// that scores a finished game from the individual pitch clips instead of a
// three-hour broadcast. Clips on top, a paper scoring box beneath, one step per
// play. The reader it is built for opens a game at eleven at night, already
// knows the game is over, and wants to fill the sheet in twenty minutes.
//
// WHY IT LIVES ON THE LINEUP PAGE, and in this exact spot. The lineup page is
// the staging page — the one you copy your scorebook header from before a pitch
// is thrown — so its left column already collects the three things you can DO
// with a game that are not "walk the innings": make the preview card, print a
// blank sheet, and now score it from the film. The door belongs in that cluster
// and not at the foot of the page, where a reader who came for the film would
// have to scroll the whole batting order, the starting pitcher and the defense
// to find it. It sits BELOW the fill-in facts, though, because this page opens
// as a scorebook header and a departure must not shout over the sheet.
//
// WHY IT IS A CARD AND NOT A QUIET LINK. Express Lane can never have an
// unrevealed preview: the broadcast scorebug is burned into every clip frame,
// so a picture of the destination is the one thing this door may never show.
// That makes entering it a decision rather than a page turn, and the door has
// to read that way. What keeps a card here SAFE is that tapping it lands on the
// entry step, which asks which booth and states the consent in words before any
// film plays — so the door opens a chooser, never a frame.
//
// WHY IT NAVIGATES ITSELF. Its two neighbours take an `onSection` callback from
// GameView, which is the ordinary way a game section is reached. This one asks
// the router directly (useNav + gamePath, the same pair the season-series
// carousel uses to open another game) so a surface that wants the door pays one
// element and no new prop — the lineup screen is at its file-size budget, and a
// door that threads a callback through it would cost more of that budget than
// the door itself.
//
// EVERYTHING THIS MODULE READS LIVES UNDER `gameData` — the two clubs'
// abbreviations and the date. It never opens `liveData`, so there is no play,
// no linescore and no half-index anywhere near it, and the door's presence on
// an open page says nothing about the game beyond facts the schedule already
// published.
//
// WHETHER FILM CAN EXIST AT ALL is api/expresslane/eligibility.js's question,
// not this file's. It lives there because the five rules that answer it are
// MLB's clip coverage as this project has measured it, and rules that
// load-bearing belong somewhere `npm test` can reach — which a .jsx component
// is not. A game with no possible film gets NO DOOR: no disabled control and no
// "not available" note, because a door into a surface that cannot exist is a
// promise the app is unable to keep.

export function ExpressLaneDoor({ feed }) {
  const navigate = useNav()
  if (!filmCanExist(feed)) return null

  const gameData = feed?.gameData ?? {}
  const teams = gameData.teams ?? {}
  const path = gamePath(
    gameData.datetime?.officialDate ?? '',
    teamAbbr(teams.away),
    teamAbbr(teams.home),
    'express',
    gameData.game?.gameNumber ?? 1,
  )

  return (
    <section className="xldoor" aria-label="Express Lane">
      <h3 className="xldoor__title">Express Lane</h3>
      <p className="xldoor__lede">
        Score this game from the pitch clips, not the broadcast. Film on top, the
        scoring box under it, one play at a time.
      </p>
      {/* The consent belongs to the entry step, which states it in full. This
          line only makes sure the tap is not a surprise — the reader is told
          what the film carries before they are asked to agree to it. */}
      <p className="xldoor__note">
        Every clip carries the broadcast score. Nothing plays until you say so.
      </p>
      <button
        type="button"
        className="btn btn--reveal xldoor__go"
        onClick={() => navigate(path)}
      >
        Open Express Lane ›
      </button>
    </section>
  )
}
