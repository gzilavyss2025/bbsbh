import { useEffect, useState } from 'react'
import { realHeadshotUrl } from '../lib/teams.js'
import { PlayerLink } from './PlayerLink.jsx'

// The "now pitching" notification card — the entering pitcher's headshot beside
// his name / number / throwing hand, on the seal-amber attention surface. Shared
// by two surfaces so a pitching change looks the same wherever it lands: the
// row-2 stat slot when a change is announced BEFORE a half's first pitch
// (StatBox), and the play-by-play feed when a change happens MID-inning
// (PlayByPlay). The outer card chrome (the statbox card vs. the inline feed
// card) comes from the caller's `className`; the inner photo+body layout is
// this component's. `pitcher` is the { id, name, jersey, hand } shape
// selectPrePitchChanges / pitchingChangePitcher build.
export function PitcherNotice({ pitcher, teamName, className = '' }) {
  if (!pitcher) return null
  return (
    <div className={`pitchernotice ${className}`}>
      <PitcherPhoto personId={pitcher.id} />
      <div className="pitchernotice__body">
        <span className="pitchernotice__now">
          Now pitching{teamName ? ` for the ${teamName}` : ''}
        </span>
        <span className="pitchernotice__pitcher">
          <PlayerLink id={pitcher.id}>{pitcher.name}</PlayerLink>
          {pitcher.jersey ? ` ${pitcher.jersey}` : ''}
          {pitcher.hand ? ` | ${pitcher.hand}HP` : ''}
        </span>
      </div>
    </div>
  )
}

// The entering pitcher's headshot, degrading to a plain baseball emoji rather
// than the mlbstatic CDN's own generic silhouette placeholder — realHeadshotUrl
// (unlike the usual headshotUrl) 404s for a personId with no real photo on file
// instead of silently serving that placeholder, so a true photo miss is
// distinguishable here (see lib/teams.js). A true network error degrades the
// same way.
export function PitcherPhoto({ personId }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [personId])
  const url = personId && !failed ? realHeadshotUrl(personId, 120) : null

  if (!url) {
    return (
      <span className="pitchernotice__shot pitchernotice__shot--fallback" aria-hidden="true">
        ⚾
      </span>
    )
  }
  return (
    <span className="pitchernotice__shot">
      <img
        key={url}
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        aria-hidden="true"
      />
    </span>
  )
}
