import { selectPrePitchChanges } from '../api/select.js'
import { revealInning } from '../api/linescore.js'
import { revealDerived, rollingPitches } from '../api/derive.js'
import { selectChallengeState, gameHasAbs, START_CHALLENGES } from '../api/challenges.js'
import { SealBox } from './SealBox.jsx'
import { PitcherNotice } from './PitcherNotice.jsx'
import { StatcastCard } from './StatcastCard.jsx'
import { UsagePips } from './UsagePips.jsx'

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
              {/* Statcast superlatives for the half — the game-notes numbers
                  (fastest pitch, hardest/longest ball) — sat below the play-by-play
                  feed until moved here, right under the ABS row, so they're at the
                  top of the half's content with the rest of the totals instead of
                  wherever the feed happened to scroll to. Tracking data is often
                  absent at MiLB levels, so the row only renders when the feed
                  carried it. Same reveal path as everything else in this card —
                  and since this whole block only runs once SealBox has actually
                  revealed (never mid-step, see HalfInning.jsx/PlayByPlay.jsx's
                  stepping gate), it can't leak plays not yet shown. */}
              {(d.maxVelo != null || d.hardestHit != null || d.longestHit != null) && (
                <div className="statcast">
                  {d.maxVelo != null && (
                    <StatcastCard
                      label="Fastest pitch"
                      value={d.maxVelo.toFixed(1)}
                      unit="MPH"
                      who={d.maxVeloPlayer}
                      detail={d.maxVeloType}
                    />
                  )}
                  {d.hardestHit != null && (
                    <StatcastCard
                      label="Hardest hit"
                      value={d.hardestHit.toFixed(1)}
                      unit="MPH"
                      who={d.hardestHitPlayer}
                    />
                  )}
                  {d.longestHit != null && (
                    <StatcastCard
                      label="Longest ball"
                      value={Math.round(d.longestHit)}
                      unit="FT"
                      who={d.longestHitPlayer}
                    />
                  )}
                </div>
              )}
            </>
          )
        }}
      </SealBox>
    </div>
  )
}

// One club's ABS challenges: the club abbreviation, then how many are left as
// used/open pips — a challenge is only SPENT when it fails (a success is
// retained, per the real rule — see api/challenges.js), so a club that keeps
// winning its challenges always shows its full starting count, and a pip only
// fills in once a challenge has actually been lost. Extra-inning bonus
// challenges (see api/challenges.js) aren't tracked precisely here — the
// max() below just guarantees the pip row never shows fewer challenges than
// the fails on record prove the club actually had.
function AbsRow({ abbr, outcomes }) {
  const failed = outcomes.filter((o) => o === 'fail').length
  const allowed = Math.max(START_CHALLENGES, failed)
  const remaining = allowed - failed
  const label = `${abbr}: ${remaining} ABS challenge${remaining === 1 ? '' : 's'} remaining`
  return (
    <div className="abs__row">
      <span className="abs__team">{abbr}</span>
      <UsagePips allowed={allowed} used={failed} label={label} />
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
