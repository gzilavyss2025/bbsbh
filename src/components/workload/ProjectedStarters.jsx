import { PlayerLink } from '../player/PlayerLink.jsx'
import { monthDay } from '../../lib/dates.js'

// PROJECTED STARTERS — who is likely to start when MLB has not named a probable
// pitcher. Takes the rows `api/rotation/liveStarters.js` builds and prints them as a
// short list under the label "Likely starters", with the one fact each guess
// rests on (days of rest, and how long his last start ran). Never styled like an
// announced starter: no headshot, no season line, and a note that says it is a
// guess. The caller swaps it out for the real card the moment a probable posts.
//
// Spoiler-free, inherited from api/rotation/: completed starts before
// this game's date only. Renders nothing for an empty list, so a minor-league
// game (no workload file) keeps the caller's "Not posted yet."
const restLine = (r) =>
  [
    `${r.restDays} days rest`,
    r.lastPitches != null && `${r.lastPitches} pitches on ${monthDay(r.lastStart)}`,
  ]
    .filter(Boolean)
    .join(' · ')

export function ProjectedStarters({ rows }) {
  if (!rows?.length) return null
  return (
    <div className="projection">
      <p className="projection__label">Likely starters</p>
      <ol className="projection__list">
        {rows.map((r) => (
          <li key={r.id} className="projection__row">
            <PlayerLink id={r.id} className="projection__name">
              {r.name}
            </PlayerLink>
            <span className="projection__facts">{restLine(r)}</span>
          </li>
        ))}
      </ol>
      <p className="projection__note">Not announced yet. A guess from days of rest.</p>
    </div>
  )
}
