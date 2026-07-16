import { useState } from 'react'
import { selectPrePitchChanges, selectOfficials } from '../api/select.js'
import { revealInning } from '../api/linescore.js'
import { revealDerived, rollingPitches } from '../api/derive.js'
import { selectChallengeState, gameHasAbs, START_CHALLENGES } from '../api/challenges.js'
import { selectUmpireFavor, hasPitchTracking } from '../api/umpireFavor.js'
import { teamLogoUrl, teamStripeGradient } from '../lib/teams.js'
import { SealBox } from './SealBox.jsx'
import { PitcherNotice } from './PitcherNotice.jsx'
import { PlayerLink } from './PlayerLink.jsx'
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
  awayLocation,
  homeLocation,
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
          // Plate-umpire favor + worst call through this half (reveal-only,
          // clamped — see api/umpireFavor.js). MLB + AAA only (pitch tracking).
          const umpireFavor = hasPitchTracking(feed)
            ? selectUmpireFavor(feed, runExpectancy, inning, half)
            : null
          // Crew assignment, not a score — spoiler-free, same footing as the
          // abbreviations/logo already used for the ABS row above.
          const hpName = selectOfficials(feed).find((o) => o.role === 'HP')?.name ?? null
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
                hpName={hpName}
                awayId={awayId}
                homeId={homeId}
                awayLocation={awayLocation || awayAbbr || 'Away'}
                homeLocation={homeLocation || homeAbbr || 'Home'}
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
// Exported: the box score's pitching-notes area reuses this exact row for the
// whole-game challenge tally instead of growing a second copy.
export function AbsRow({ teamId, abbr, outcomes }) {
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

// The plate umpire's worst missed call so far (biggest |favor| swing — see
// lib/runExpectancy.js) and the net favor it's part of, through the half
// being viewed. Same title treatment as the ABS row above it, but naming the
// HP ump when the crew is known ("Cruz behind the plate") rather than the
// generic "Plate umpire" — selectOfficials is spoiler-free (crew assignment,
// not a score), so hpName needs no reveal gate of its own. `.umpfavor__row`
// is the .bs__duo/.bs__col idiom (BoxScore.jsx) applied locally: display:
// contents keeps both cards stacking on .umpfavor's own gap on a phone, and
// only becomes a real two-up grid at the app's shared min-width:740px
// breakpoint. Each stat degrades independently — an unbuilt run-expectancy
// table means neither can be computed at all (both need it), so the whole
// row renders nothing until there's at least one missed call with favor
// behind it (which, since both are derived from the same hasFavor branch in
// selectUmpireFavor, also guarantees worstCall is set whenever net is).
function UmpireFavorRow({ data, hpName, awayId, homeId, awayLocation, homeLocation }) {
  if (!data) return null
  const { favorAway, favorHome, worstCall } = data
  const net = favorAway != null && favorHome != null ? favorAway - favorHome : null
  if (net == null) return null
  return (
    <div className="umpfavor">
      <span className="umpfavor__title">{hpName ? `${hpName} behind the plate` : 'Plate umpire'}</span>
      <div className="umpfavor__row">
        {worstCall && <WorstCallCard data={worstCall} />}
        <FavorMeter net={net} awayId={awayId} homeId={homeId} awayLocation={awayLocation} homeLocation={homeLocation} />
      </div>
    </div>
  )
}

// The zone rectangle's illustrative size (not to-scale per batter — schematic,
// like UmpireZoneMap's 3×3 grid, not a literal geometry render) and the fixed
// camera frame it's viewed through. The ball is ALWAYS drawn at BALL_R in
// these same units, on the SAME viewBox, on every card, regardless of how far
// off the actual pitch was — a scale that changed per pitch would render a
// near-miss and a blowout call as two different-sized baseballs. What varies
// per card is which edge is anchored at a fixed position in the frame (so the
// relevant boundary always reads the same way) and the ball's distance from
// it; the far side of the zone box simply runs past the frame's edge and is
// clipped (the SVG default for a non-root element), which is what lets the
// same fixed frame show "more or less of the zone" without ever rescaling.
const WCALL_FRAME = 100
const WCALL_ZONE_W = 50
const WCALL_ZONE_H = 76
const WCALL_BALL_R = 9
const WCALL_GAP_OUT = 12 // ball-to-edge gap for an expanded miss (ball outside the box)
const WCALL_GAP_IN = 8 // ball-to-edge gap for a squeezed miss (ball inside the box)
const WCALL_CENTER = WCALL_FRAME / 2
const WCALL_EDGE_WORD = { high: 'HIGH', low: 'LOW', inside: 'INSIDE', outside: 'OUTSIDE' }

// Geometry for one of the four edges, expanded (ball actually outside the
// zone, called a strike) or squeezed (ball actually inside, called a ball) —
// see missEdge in api/umpireFavor.js for how `edge`/`expanded` are derived
// from the pitch itself.
function wcallGeometry(edge, expanded) {
  const gap = expanded ? WCALL_GAP_OUT : WCALL_GAP_IN
  if (edge === 'high' || edge === 'low') {
    const edgeY = edge === 'low' ? 62 : 38
    const rectY = edge === 'low' ? edgeY - WCALL_ZONE_H : edgeY
    const outward = edge === 'low' ? expanded : !expanded
    const ballCy = outward ? edgeY + gap + WCALL_BALL_R : edgeY - gap - WCALL_BALL_R
    const nearY = ballCy > edgeY ? ballCy - WCALL_BALL_R : ballCy + WCALL_BALL_R
    return {
      rect: { x: WCALL_CENTER - WCALL_ZONE_W / 2, y: rectY, w: WCALL_ZONE_W, h: WCALL_ZONE_H },
      edgeLine: { x1: WCALL_CENTER - WCALL_ZONE_W / 2, y1: edgeY, x2: WCALL_CENTER + WCALL_ZONE_W / 2, y2: edgeY },
      bracket: { x1: WCALL_CENTER, y1: edgeY, x2: WCALL_CENTER, y2: nearY },
      ballCx: WCALL_CENTER,
      ballCy,
    }
  }
  const edgeX = edge === 'inside' ? 45 : 55
  const rectX = edge === 'inside' ? edgeX : edgeX - WCALL_ZONE_W
  const outward = edge === 'inside' ? expanded : !expanded
  const ballCx = outward ? edgeX - gap - WCALL_BALL_R : edgeX + gap + WCALL_BALL_R
  const nearX = ballCx > edgeX ? ballCx - WCALL_BALL_R : ballCx + WCALL_BALL_R
  return {
    rect: { x: rectX, y: 12, w: WCALL_ZONE_W, h: WCALL_ZONE_H },
    edgeLine: { x1: edgeX, y1: 12, x2: edgeX, y2: 88 },
    bracket: { x1: edgeX, y1: 50, x2: nearX, y2: 50 },
    ballCx,
    ballCy: 50,
  }
}

function WorstCallDiagram({ edge, expanded }) {
  const g = wcallGeometry(edge, expanded)
  const colorClass = expanded ? 'wcall__ink--clay' : 'wcall__ink--field'
  return (
    <svg className="wcall__svg" viewBox={`0 0 ${WCALL_FRAME} ${WCALL_FRAME}`} role="img" aria-hidden="true">
      <rect className="wcall__zone" x={g.rect.x} y={g.rect.y} width={g.rect.w} height={g.rect.h} rx="3" />
      <line className={`wcall__edgeline ${colorClass}`} x1={g.edgeLine.x1} y1={g.edgeLine.y1} x2={g.edgeLine.x2} y2={g.edgeLine.y2} />
      <line className={`wcall__bracket ${colorClass}`} x1={g.bracket.x1} y1={g.bracket.y1} x2={g.bracket.x2} y2={g.bracket.y2} />
      <circle className={`wcall__ball ${colorClass}`} cx={g.ballCx} cy={g.ballCy} r={WCALL_BALL_R} />
      <path className={colorClass} d={`M${g.ballCx - 4} ${g.ballCy - 5} Q${g.ballCx} ${g.ballCy} ${g.ballCx - 4} ${g.ballCy + 5}`} fill="none" />
      <path className={colorClass} d={`M${g.ballCx + 4} ${g.ballCy - 5} Q${g.ballCx} ${g.ballCy} ${g.ballCx + 4} ${g.ballCy + 5}`} fill="none" />
    </svg>
  )
}

// The before→after count, animated on mount: the old count fades/strikes
// through, the new one flashes in with --marker (the same highlighter-yellow
// the app already uses as a "watch this" flag) then settles to plain ink.
// `after` is the scorebook code (K, BB) when this pitch itself ended the
// plate appearance, otherwise the count it left behind — see afterLabel in
// api/umpireFavor.js. Fires once per mount (a half-inning's worth of reveals
// remounts this card via the parent's own key, same as the rest of the box
// score), never loops — a live box score re-flashing on its own all game
// would be exhausting to sit next to.
function CountBlink({ before, after }) {
  return (
    <div className="wcall__count">
      <span className="wcall__count-label">Count</span>
      <span className="wcall__count-old">{before}</span>
      <span className="wcall__count-arrow" aria-hidden="true">→</span>
      <span className="wcall__count-new">{after}</span>
    </div>
  )
}

function WorstCallCard({ data }) {
  const { batterId, batterName, strikeCall, edge, inches, preBalls, preStrikes, afterLabel, inning, half } = data
  const expanded = strikeCall
  return (
    <div className="wcall">
      <div className="wcall__top">
        <span className="wcall__label">Worst call</span>
      </div>
      <div className="wcall__body">
        <div className="wcall__diagram">
          <WorstCallDiagram edge={edge} expanded={expanded} />
          <span className="wcall__edgeword" aria-hidden="true">
            {inches.toFixed(1)}″ {WCALL_EDGE_WORD[edge]}
          </span>
        </div>
        <div className="wcall__side">
          <div className="wcall__calls">
            <span className="wcall__pill wcall__pill--wrong">{strikeCall ? 'Strike' : 'Ball'}</span>
            <span className="wcall__arrow" aria-hidden="true">→</span>
            <span className="wcall__pill wcall__pill--right">{strikeCall ? 'Ball' : 'Strike'}</span>
          </div>
          {batterName && (
            <div className="wcall__locator">
              <PlayerLink id={batterId}>
                <b>{batterName}</b>
              </PlayerLink>{' '}
              · {half === 'top' ? '▲' : '▼'}
              {inning}
            </div>
          )}
          <CountBlink before={`${preBalls}–${preStrikes}`} after={afterLabel} />
        </div>
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

// Three broadcast-toned buckets for the corner pill, in place of a spelled-
// out caption sentence — same three thresholds as before (FAVOR_MEDIAN_RUNS/
// FAVOR_P90_RUNS), just a short badge instead of a sentence.
const FAVOR_TIERS = {
  routine: 'Routine',
  standout: 'Standout',
  outlier: 'Outlier',
}

function favorTier(magnitude) {
  if (magnitude < FAVOR_MEDIAN_RUNS) return 'routine'
  if (magnitude < FAVOR_P90_RUNS) return 'standout'
  return 'outlier'
}

function FavorMeter({ net, awayId, homeId, awayLocation, homeLocation }) {
  if (net == null) return null
  const even = Math.abs(net) < FAVOR_EVEN_FLOOR
  const towardAway = net > 0
  const fillPct = Math.min(Math.abs(net) / FAVOR_SCALE_RUNS, 1) * 50
  const tier = even ? null : favorTier(Math.abs(net))
  // The favored club's own primary/secondary colors, at full brightness, so
  // the lean reads unmistakably as "that team's colors" rather than a
  // generic accent — see lib/teams.js's teamStripeGradient. Falls back to
  // the flat --winprob-away/--winprob-home pair (CSS) for an unmapped MiLB
  // team with no known color pair.
  const stripe = !even ? teamStripeGradient(towardAway ? awayId : homeId) : null
  return (
    <div className={`favormeter ${tier ? `favormeter--${tier}` : ''}`}>
      {tier && (
        <span className={`favormeter__tierpill favormeter__tierpill--${tier}`} aria-hidden="true">
          {FAVOR_TIERS[tier]}
        </span>
      )}
      <div className="favormeter__track-row">
        {/* The non-favored club's logo desaturates — the same .teamlogo--bw
            grayscale treatment UmpirePage already uses for an unworked team
            — so the colored mark unambiguously points at who the lean
            favors, on top of the fill's own direction/color. Neither dims
            when it's an even split. */}
        <TeamLogo teamId={awayId} name={awayLocation} size={28} bw={!even && !towardAway} />
        <div className="favormeter__track" role="img" aria-label={favorMeterLabel(net, awayLocation, homeLocation)}>
          <span className="favormeter__mid" aria-hidden="true" />
          {!even && (
            <span
              className={`favormeter__fill favormeter__fill--${towardAway ? 'away' : 'home'}`}
              style={{ width: `${fillPct}%`, ...(stripe ? { background: stripe } : {}) }}
              aria-hidden="true"
            />
          )}
        </div>
        <TeamLogo teamId={homeId} name={homeLocation} size={28} bw={!even && towardAway} />
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
            <span className="favormeter__label">for {towardAway ? awayLocation : homeLocation}</span>
          </>
        )}
      </div>
    </div>
  )
}

function favorMeterLabel(net, awayLocation, homeLocation) {
  if (Math.abs(net) < FAVOR_EVEN_FLOOR) return 'Missed calls have been even so far'
  const tierLabel = FAVOR_TIERS[favorTier(Math.abs(net))]
  return `Missed calls have added ${Math.abs(net).toFixed(1)} runs for ${net > 0 ? awayLocation : homeLocation} — ${tierLabel}`
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
