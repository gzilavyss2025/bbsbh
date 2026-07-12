import { selectPrePitchChanges } from '../api/select.js'
import { revealInning } from '../api/linescore.js'
import { revealDerived, rollingPitches } from '../api/derive.js'
import { selectChallengeState, gameHasAbs, START_CHALLENGES } from '../api/challenges.js'
import { SealBox } from './SealBox.jsx'
import { PitcherNotice } from './PitcherNotice.jsx'

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
  awayAbbr,
  homeAbbr,
  isNextToReveal = false,
}) {
  if (!revealed && placeholder) {
    const pitcherChange = isNextToReveal
      ? selectPrePitchChanges(feed, inning, half).find((c) => c.eventType === 'pitching_substitution')
      : null
    if (pitcherChange?.pitcher) {
      return (
        <PitcherNotice
          pitcher={pitcherChange.pitcher}
          teamName={pitchingName}
          className={`statbox statbox--pitchernotice ${className}`}
        />
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
          // ABS challenge history through this half (reveal-only, clamped to the
          // reached half — see api/challenges.js). MLB only.
          const challenges = gameHasAbs(feed) ? selectChallengeState(feed, inning, half) : null
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
              {challenges && (
                <div className="abs">
                  <span className="abs__title">ABS challenges</span>
                  <div className="abs__rows">
                    <AbsRow abbr={awayAbbr || 'AWAY'} outcomes={challenges.away.outcomes} />
                    <AbsRow abbr={homeAbbr || 'HOME'} outcomes={challenges.home.outcomes} />
                  </div>
                </div>
              )}
            </>
          )
        }}
      </SealBox>
    </div>
  )
}

// One club's ABS challenge history: the club abbreviation, then a pip per
// challenge in order — a filled dot for a successful (retained) challenge, an ✗
// for a failed (lost) one. A club that hasn't challenged shows its two starting
// challenges as hollow pips ("both remaining"). Extra-inning bonus challenges
// need no special case — they just extend the outcome list, so a club can show
// more than two ✗ across a long extra-inning game.
function AbsRow({ abbr, outcomes }) {
  const used = outcomes.length > 0
  const successes = outcomes.filter((o) => o === 'success').length
  const fails = outcomes.length - successes
  const label = used
    ? `${abbr}: ${successes} successful, ${fails} unsuccessful ABS challenge${
        outcomes.length === 1 ? '' : 's'
      }`
    : `${abbr}: both ABS challenges remaining`
  return (
    <div className="abs__row" aria-label={label}>
      <span className="abs__team">{abbr}</span>
      <span className="abs__pips" aria-hidden="true">
        {used
          ? outcomes.map((o, i) => (
              <span key={i} className={`abs__pip abs__pip--${o}`}>
                {o === 'fail' ? '✕' : '●'}
              </span>
            ))
          : Array.from({ length: START_CHALLENGES }, (_, i) => (
              <span key={i} className="abs__pip abs__pip--ghost">
                ○
              </span>
            ))}
      </span>
    </div>
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
