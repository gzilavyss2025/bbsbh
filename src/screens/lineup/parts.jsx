import { Headshot } from '../../components/player/Headshot.jsx'
import { ManagerLink } from '../../components/team/ManagerLink.jsx'
import { monthDay } from '../../lib/dates.js'

// Small parts both lineup pages draw: the live page (screens/TeamInfo.jsx) and the new one
// (screens/lineup/next). They live here so the new page does not import the page it replaces.

// "8/18 @ MIL: 6.0 IP, 3 H, 0 ER, 2 K, 1 BB" — his ONE start against tonight's
// opponent so far this season (see fetchPitcherSeasonVsOpponent), formatted
// exactly like lastGameLine since that's what it is: a single past outing.
// The common case there's more than one, "3 GS vs MIL this year: ..." — no
// single date to lead with, so it reads like the season-line row instead.
export function seasonVsOpponentLine(v, oppAbbr) {
  const stat = [
    v.inningsPitched && `${v.inningsPitched} IP`,
    `${v.hits} H`,
    `${v.earnedRuns} ER`,
    `${v.strikeOuts} K`,
    `${v.baseOnBalls} BB`,
  ]
    .filter(Boolean)
    .join(', ')
  if (v.games.length === 1) {
    const g = v.games[0]
    return `${monthDay(g.date)} ${g.home ? 'vs' : '@'} ${oppAbbr}: ${stat}`
  }
  return `${v.games.length} GS vs ${oppAbbr} this year: ${stat}`
}

// The manager fill-in: his headshot (the coach photo, drawn like a lineup row's
// shot; no photo on file draws nothing), then first name, last name and the
// uniform number "#30" inked in seam red. Null (→ the Fact's "—") until resolved.
// Linked to his manager page once fetchManager resolves a personId (older
// cached data / a fetch that raced ahead of that field lands here without
// one — ManagerLink degrades to plain text rather than a dead link).
export function managerFact(manager) {
  if (!manager) return null
  return (
    <ManagerLink id={manager.personId} name={manager.name} className="fact__person">
      {manager.personId ? (
        <Headshot personId={manager.personId} name={manager.name} coach hideFallback className="fact__shot" />
      ) : null}
      <span className="fact__who">
        {manager.name}
        {manager.jersey ? (
          <>
            {' '}
            <span className="fact__jersey">#{manager.jersey}</span>
          </>
        ) : null}
      </span>
      {manager.interim ? <span className="fact__note">interim</span> : null}
    </ManagerLink>
  )
}

// A small crowd — three heads and shoulders — drawn as an SVG, filled like the
// Umpires card's home plate (UmpireTierGlyph), so the Attendance dot and the HP
// ump dot match. Exported so the box score's own Attendance field
// (BoxScore.jsx) draws the same glyph.
export function CrowdIcon() {
  return (
    <svg viewBox="0 0 20 20" width="12" height="12" aria-hidden="true" fill="currentColor">
      <circle cx="10" cy="6.5" r="2.6" />
      <path d="M5 16c0-3 2.2-5 5-5s5 2 5 5Z" />
      <circle cx="3.8" cy="8.8" r="1.8" />
      <circle cx="16.2" cy="8.8" r="1.8" />
      <path d="M1 15c0-2 1.3-3.5 3-3.5.6 0 1.1.1 1.5.4-.8.9-1.2 1.9-1.3 3.1ZM19 15c0-2-1.3-3.5-3-3.5-.6 0-1.1.1-1.5.4.8.9 1.2 1.9 1.3 3.1Z" />
    </svg>
  )
}

