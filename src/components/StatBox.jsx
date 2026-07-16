import { useState } from 'react'
import { selectPrePitchChanges } from '../api/select.js'
import { revealInning } from '../api/linescore.js'
import { revealDerived, rollingPitches } from '../api/derive.js'
import { selectChallengeState, gameHasAbs, START_CHALLENGES } from '../api/challenges.js'
import { selectUmpireFavor, hasPitchTracking } from '../api/umpireFavor.js'
import { teamLogoUrl } from '../lib/teams.js'
import { SealBox } from './SealBox.jsx'
import { PitcherNotice } from './PitcherNotice.jsx'
import { StatcastCard } from './StatcastCard.jsx'
import { TeamLogo } from './TeamLogo.jsx'

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
  awayName,
  homeName,
  isNextToReveal = false,
  runExpectancy = null,
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
          // Plate-umpire consistency + favor through this half (reveal-only,
          // clamped — see api/umpireFavor.js). MLB + AAA only (pitch tracking).
          const umpireFavor = hasPitchTracking(feed)
            ? selectUmpireFavor(feed, runExpectancy, inning, half)
            : null
          // Structural (no score) — same footing as the abbreviations/logo
          // already used for the ABS row above.
          const awayId = feed?.gameData?.teams?.away?.id ?? null
          const homeId = feed?.gameData?.teams?.home?.id ?? null
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
                    <AbsRow
                      teamId={challenges.away.teamId}
                      abbr={awayAbbr || 'AWAY'}
                      outcomes={challenges.away.outcomes}
                    />
                    <AbsRow
                      teamId={challenges.home.teamId}
                      abbr={homeAbbr || 'HOME'}
                      outcomes={challenges.home.outcomes}
                    />
                  </div>
                </div>
              )}
              <UmpireFavorRow
                data={umpireFavor}
                awayId={awayId}
                homeId={homeId}
                awayName={awayName || awayAbbr || 'Away'}
                homeName={homeName || homeAbbr || 'Home'}
              />
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

// One club's ABS challenges: the club logo, then a pip per challenge the club
// MADE — colored by outcome (overturned = won, stood = lost, in the order they
// happened) — followed by any still-unused challenges as kraft-brown pips. A
// success is RETAINED and a failure SPENDS one (the real rule — see
// api/challenges.js), so a club that keeps winning shows a long green run and
// still has its full bank. Remaining is `START_CHALLENGES − fails`, floored at
// 0: extra-inning bonus challenges (see api/challenges.js) aren't tracked
// precisely, so the unused count is a conservative lower bound rather than an
// overstated bank. The logo falls back to the abbreviation for a club with no
// mark (never for MLB, where ABS lives, but keeps the row robust).
function AbsRow({ teamId, abbr, outcomes }) {
  const [logoBroken, setLogoBroken] = useState(false)
  const failed = outcomes.filter((o) => o === 'fail').length
  const won = outcomes.length - failed
  const remaining = Math.max(START_CHALLENGES - failed, 0)
  const logo = teamId != null ? teamLogoUrl(teamId) : null
  const left = remaining === 0 ? 'none left' : `${remaining} left`
  const label = `${abbr}: ${won} of ${outcomes.length} challenge${
    outcomes.length === 1 ? '' : 's'
  } overturned, ${left}`
  return (
    <div className="abs__row">
      {logo && !logoBroken ? (
        <img className="abs__logo" src={logo} alt={abbr} onError={() => setLogoBroken(true)} />
      ) : (
        <span className="abs__team">{abbr}</span>
      )}
      <span className="abs__pips" role="img" aria-label={label}>
        {outcomes.map((o, i) => (
          <span
            key={i}
            className={`abs__pip abs__pip--${o === 'success' ? 'won' : 'lost'}`}
            aria-hidden="true"
          />
        ))}
        {Array.from({ length: remaining }, (_, i) => (
          <span key={`open-${i}`} className="abs__pip abs__pip--open" aria-hidden="true" />
        ))}
      </span>
      <span className="abs__rec" aria-hidden="true">
        {won}–{failed} · {left}
      </span>
    </div>
  )
}

// The plate umpire's consistency (how well his calls agree with his OWN
// established zone this game — see lib/euz.js) and favor (the net
// run-expectancy swing his misses have handed one side so far — see
// lib/runExpectancy.js) through the half being viewed. Same title treatment
// as the ABS row above it. Both figures sit in the SAME .statcast grid as
// siblings — consistency as a plain StatcastCard tile, favor as its own
// FavorMeter card (a two-club lean bar, since "which side" is the whole
// point of that figure) — so the auto-fit grid splits them 50/50 when both
// are present, full-width when only one is, matching the rest of this row's
// sizing behavior rather than stacking favor as its own full-width block.
// Renders nothing until at least one called pitch has been revealed, and
// each stat degrades independently — a thin-sample game shows favor with no
// consistency tile, an unbuilt run-expectancy table shows consistency with
// no favor meter, and both missing renders nothing at all (never an empty
// shell).
function UmpireFavorRow({ data, awayId, homeId, awayName, homeName }) {
  if (!data) return null
  const { consistency, favorAway, favorHome } = data
  const pct = consistency ? Math.round((consistency.consistent / consistency.called) * 100) : null
  const net = favorAway != null && favorHome != null ? favorAway - favorHome : null
  if (pct == null && net == null) return null
  return (
    <div className="umpfavor">
      <span className="umpfavor__title">Plate umpire</span>
      <div className="statcast">
        {pct != null && <StatcastCard label="Consistent" value={pct} unit="%" />}
        <FavorMeter net={net} awayId={awayId} homeId={homeId} awayName={awayName} homeName={homeName} />
      </div>
    </div>
  )
}

// A diverging lean bar between the two clubs' logos — the fill grows from
// center toward whichever side missed calls have added value to, plus a
// tier caption ("more than a typical game", "among the biggest swings of
// the season") so the raw runs figure has real context, not just a bare
// number. Reuses WinProbChart's away/soft-clay · home/soft-navy palette —
// the same "which side" visual language already on this page. `net` is
// favorAway - favorHome (see api/umpireFavor.js): positive favors away,
// negative favors home. Renders nothing without a built run-expectancy
// table (net null).
//
// SCALE + TIER BENCHMARKS are empirical, not arbitrary — pulled from the
// real per-game NET favor across the 2,822-game backfill on file as of this
// writing (2026-03-25 through 2026-07-16, MLB + AAA): median |net| ≈ 0.36
// runs, 90th percentile ≈ 1.0, largest on file ≈ 3.9. The track's full
// half-width is scaled to roughly the 95th percentile (≈1.3) so the fill
// reads as "how far toward a genuinely lopsided night," not a bar pinned to
// an arbitrary 1.0 cap. Revisit if a later re-sweep shifts these meaningfully
// (see .scratch/umpire-accuracy/consistency-favor-scope.md).
const FAVOR_MEDIAN_RUNS = 0.36
const FAVOR_P90_RUNS = 1.0
const FAVOR_SCALE_RUNS = 1.3
const FAVOR_EVEN_FLOOR = 0.05

function favorTier(magnitude) {
  if (magnitude < FAVOR_MEDIAN_RUNS) return "Within a typical game's variance"
  if (magnitude < FAVOR_P90_RUNS) return 'More than a typical game'
  return 'Among the biggest swings of the season'
}

function FavorMeter({ net, awayId, homeId, awayName, homeName }) {
  if (net == null) return null
  const even = Math.abs(net) < FAVOR_EVEN_FLOOR
  const towardAway = net > 0
  const fillPct = Math.min(Math.abs(net) / FAVOR_SCALE_RUNS, 1) * 50
  return (
    <div className="favormeter">
      <div className="favormeter__track-row">
        <TeamLogo teamId={awayId} name={awayName} size={22} />
        <div className="favormeter__track" role="img" aria-label={favorMeterLabel(net, awayName, homeName)}>
          <span className="favormeter__mid" aria-hidden="true" />
          {!even && (
            <span
              className={`favormeter__fill favormeter__fill--${towardAway ? 'away' : 'home'}`}
              style={{ width: `${fillPct}%` }}
              aria-hidden="true"
            />
          )}
        </div>
        <TeamLogo teamId={homeId} name={homeName} size={22} />
      </div>
      <div className="favormeter__caption" aria-hidden="true">
        {even ? (
          <span className="favormeter__label">Missed calls have been even so far</span>
        ) : (
          <>
            <span className="favormeter__label">Missed calls have added</span>
            <strong className="favormeter__value">
              +{Math.abs(net).toFixed(1)} <span className="favormeter__unit">runs</span>
            </strong>
            <span className="favormeter__label">for {towardAway ? awayName : homeName}</span>
            <span className="favormeter__tier">{favorTier(Math.abs(net))}</span>
          </>
        )}
      </div>
    </div>
  )
}

function favorMeterLabel(net, awayName, homeName) {
  if (Math.abs(net) < FAVOR_EVEN_FLOOR) return 'Missed calls have been even so far'
  return `Missed calls have added ${Math.abs(net).toFixed(1)} runs for ${net > 0 ? awayName : homeName} — ${favorTier(Math.abs(net))}`
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
