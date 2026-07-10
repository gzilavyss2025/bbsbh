import { useEffect, useState } from 'react'
import { selectPrePitchChanges } from '../api/select.js'
import { revealInning } from '../api/linescore.js'
import { revealDerived, rollingPitches } from '../api/derive.js'
import { realHeadshotUrl } from '../lib/teams.js'
import { SealBox } from './SealBox.jsx'

// The R/H/E/LOB + pitch-stat summary card for the half being viewed, in row 2
// beside the win-probability chart — its own coverless seal driven by the same
// reveal flag as the rest of the half (nothing computed until revealed — the
// spoiler guard is unchanged). Before reveal, `placeholder` swaps in a sealed
// hint card rather than an empty slot — UNLESS a new pitcher is entering this
// half, in which case that takes over the slot as a notification card instead
// (a pitching change is pre-pitch/spoiler-free info, same as
// HalfInning.jsx's PrePitchChanges, and more worth a scorer's attention here
// than the generic "seal until you reveal" hint). Only checked for the
// IMMEDIATE next half to reveal (`isNextToReveal`) — same gate
// selectPrePitchChanges relies on elsewhere — so a further-out sealed half
// never leaks its subs.
export function StatBox({
  feed,
  inning,
  half,
  battingSide,
  getDerived,
  revealed,
  className = '',
  placeholder = false,
  pitchingName,
  isNextToReveal = false,
}) {
  if (!revealed && placeholder) {
    const pitcherChange = isNextToReveal
      ? selectPrePitchChanges(feed, inning, half).find((c) => c.eventType === 'pitching_substitution')
      : null
    if (pitcherChange?.pitcher) {
      return (
        <div className={`statbox statbox--pitchernotice ${className}`}>
          <PitcherPhoto personId={pitcherChange.pitcher.id} />
          <div className="pitchernotice__body">
            <span className="pitchernotice__now">
              Now pitching{pitchingName ? ` for the ${pitchingName}` : ''}
            </span>
            <span className="pitchernotice__pitcher">
              {pitcherChange.pitcher.name}
              {pitcherChange.pitcher.jersey ? ` ${pitcherChange.pitcher.jersey}` : ''}
              {pitcherChange.pitcher.hand ? ` | ${pitcherChange.pitcher.hand}HP` : ''}
            </span>
          </div>
        </div>
      )
    }
    return (
      <div className={`statbox statbox--sealed ${className}`} aria-hidden="true">
        <span className="statbox__hint">Totals seal until you reveal this half</span>
      </div>
    )
  }
  return (
    <div className={`statbox ${className}`} key={`${inning}-${half}`}>
      <SealBox forceRevealed={revealed} coverless>
        {() => {
          // R/H/LOB are the batting side's; E is a *fielding* stat, so it
          // belongs to the side in the field this half (ADR-0006). Same read as
          // the pre-split seal.
          const line = revealInning(feed, inning, battingSide)
          const fieldLine = revealInning(feed, inning, battingSide === 'away' ? 'home' : 'away')
          const d = revealDerived(getDerived(), inning, half)
          const rolling = rollingPitches(getDerived(), inning, half)
          return (
            <>
              <div className="rhe">
                <Stat k="R" v={line?.runs ?? 0} tone="run" big />
                <Stat k="H" v={line?.hits ?? 0} big />
                <Stat k="E" v={fieldLine?.errors ?? 0} big />
                <Stat k="LOB" v={line?.leftOnBase ?? 0} big />
              </div>
              <div className="pitchgrid">
                <Stat k="Pitches" v={d.pitches} />
                <Stat k="Total pitches" v={rolling} unit="rolling" />
                <Stat k="Whiffs" v={d.whiffs} />
                <Stat
                  k="1st-pitch strikes"
                  v={`${d.firstPitchStrikes}/${d.plateAppearances}`}
                  small
                />
              </div>
            </>
          )
        }}
      </SealBox>
    </div>
  )
}

// The entering pitcher's headshot for the notification card above, degrading
// to a plain baseball emoji rather than the mlbstatic CDN's own generic
// silhouette placeholder — realHeadshotUrl (unlike the usual headshotUrl)
// 404s for a personId with no real photo on file instead of silently serving
// that placeholder, so a true photo miss is distinguishable here (see
// lib/teams.js). A true network error degrades the same way.
function PitcherPhoto({ personId }) {
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

function Stat({ k, v, unit, tone, big, small }) {
  return (
    <div
      className={`stat ${big ? 'stat--big' : ''} ${small ? 'stat--small' : ''} ${
        tone ? `stat--${tone}` : ''
      }`}
    >
      <span className="stat__v">{v}</span>
      <span className="stat__k">
        {k}
        {unit ? <em className="stat__unit"> {unit}</em> : null}
      </span>
    </div>
  )
}
