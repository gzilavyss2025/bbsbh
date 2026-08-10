import { useEffect, useState } from 'react'
import {
  computeHalfInningFeed,
  pitchLadder,
  hasPitchLocations,
  firstRunPlay,
  firstPAIndexByBatter,
  firstRispPAIndexByBatter,
  moundVisitRemainings,
  moundVisitsAllowed,
  pitchingChangePitcher,
  defensiveChangeFielder,
  pinchRunningPlayers,
  pinchHittingBatter,
  nextStepBoundary,
  stepBounds,
  lastVisibleAtBatIndex,
  deriveLiveState,
  buildTrailItems,
} from '../../api/playbyplay.js'
import { buildCallouts, computeCalloutProgress } from '../../api/callout-notes.js'
import { PlayDiamond } from '../scoring/PlayDiamond.jsx'
import { PitchLadder } from '../scoring/PitchLadder.jsx'
import { CalloutNote } from './CalloutNote.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { PitcherNotice, PitcherPhoto } from './PitcherNotice.jsx'
import { AtBatHero } from './AtBatHero.jsx'
import { FielderNotice } from './FielderNotice.jsx'
import { PinchRunNotice } from './PinchRunNotice.jsx'
import { BatterNotice } from './BatterNotice.jsx'
import { PlacedRunnerCard } from '../scoring/PlacedRunnerCard.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { UsagePips } from '../charts/UsagePips.jsx'
import { StrikeZone, PitchList, StrikeZoneGlyph, StrikeZoneModal } from '../scoring/StrikeZone.jsx'
import { HighlightSheet } from './HighlightSheet.jsx'

// Renders the play-by-play feed for one half-inning: one card per plate
// appearance (pitch-dot sequence, scorebook-style out notation, RBI tag, and
// an out-sequence badge), interleaved with mound-visit / pitching-change
// notes, first at-bat first. This reads score-revealing data
// (computeHalfInningFeed), so — same rule as the rest of the half's stat
// grid — it must only be rendered from inside a SealBox's reveal function.
//
// `stepCap` (ADR-0016, at-bat stepping): when not null, only the first
// `stepCap` entries render — the caller (HalfInning/InningViewer's floating
// bar) drives the cap forward one plate appearance at a time. Each render
// reports back either `onStepInfo({ nextCap, isLastStep, lastAtBatIndex })` —
// `nextCap` is the cap the NEXT "reveal next at-bat" tap should pass, computed
// via nextStepBoundary so one tap bundles a leading event note (a sub, a mound
// visit) with the plate appearance it precedes; `lastAtBatIndex` is the
// `about.atBatIndex` (same field the /winProbability array carries) of the
// last completed at-bat entry actually on screen, so InningViewer can clamp
// the win-probability chart to grow one point per step instead of jumping a
// whole half at once (see api/winprob.js's `stepHalfIndex`/`throughAtBatIndex`)
// — null before the first visible at-bat card (a fresh half's opening entries
// can be leading event notes only). Or, once `stepCap` has caught up to the
// full entries list (every entry shown, whether by tapping through or because
// the very first step happened to be the whole half), `onStepComplete()` once,
// so the caller can promote this half to a normal full commit.
//
// `focusOne` (focus mode) narrows that revealed PREFIX to ONE step's window.
// `focusStep` picks which (null = newest); `onFocusInfo(count)` says how many
// exist. Presentation only — `stepCap` stays the single reveal boundary.
export function PlayByPlay({ feed, inning, half, battingSide, pitchingName, pitchingTeamId, battingName, battingTeamId, callouts, vsTeam, highlightsMap, stepCap = null, onStepInfo, onStepComplete, onRunsSoFar, onLiveState, focusOne = false, focusStep = null, onFocusInfo }) {
  const stepping = stepCap != null
  // Pass stepCap through so any runner advancement/out that happens on a
  // later, not-yet-revealed play isn't retroactively written onto an earlier
  // card's diamond (see computeHalfInningFeed's stepCap doc).
  const rawEntries = computeHalfInningFeed(feed, inning, half, battingSide, stepCap)
  // The very first tap into a fresh half hardcodes stepCap to 1 (InningViewer
  // has no legitimate way to know what entries[0] is ahead of this render —
  // computeHalfInningFeed is reveal-only, ADR-0001). If entries[0] is a
  // leading event note rather than a plate-appearance card, that tap would
  // otherwise strand the note alone with no batter, unlike every later tap
  // (which always bundles a leading note forward via nextStepBoundary — see
  // its own doc). Snap the effective cap forward to the first genuine at-bat
  // boundary so a fresh half's first tap behaves the same as every later one.
  const effectiveCap = stepping ? Math.max(stepCap, nextStepBoundary(rawEntries, 0)) : stepCap
  // entries.push is unconditional in computeHalfInningFeed regardless of
  // stepCap — stepCap only gates RETROACTIVE writes onto already-pushed
  // entries (the `visible` check) — so rawEntries' entry KINDS/order above are
  // trustworthy even from a too-small stepCap, but the array actually used for
  // display/annotation must come from a call made with the corrected cap, or
  // the newly-bundled card would render with the right scorebook code and an
  // empty diamond (its own play's advancement bookkeeping never ran against
  // the original, too-small cap).
  const entries =
    effectiveCap > stepCap
      ? computeHalfInningFeed(feed, inning, half, battingSide, effectiveCap)
      : rawEntries
  // A live, still-updating half can have its ONLY currently-fetched content
  // be a leading event note with no plate appearance yet (e.g. extra innings'
  // automatic placed-runner note, posted before the leadoff batter's own PA
  // has resolved in the feed) — entries.length catching up to effectiveCap in
  // that state must not read as "the whole half, done," or onStepComplete
  // below fires a one-directional, localStorage-persisted commit of the
  // entire half before any real result exists. Require at least one genuine
  // at-bat card anywhere in entries first; a truly finished half always has
  // one (an inning needs at least one batter), so this only ever holds back
  // the live, still-populating edge case.
  const hasAtBat = entries.some((e) => e.kind === 'atbat')
  const exhausted = stepping && entries.length > 0 && hasAtBat && effectiveCap >= entries.length

  // Focus mode: the boundaries `nextStepBoundary` walks one tap at a time,
  // enumerated. Counting only those at or under effectiveCap is what keeps
  // every window inside the cap.
  const bounds = focusOne && stepping ? stepBounds(entries) : null
  const revealedSteps = bounds ? bounds.filter((b) => b <= effectiveCap).length : 0

  // Must run before the empty-entries early return below (rules-of-hooks) —
  // guarded internally by `stepping`/`exhausted` instead.
  useEffect(() => {
    if (!stepping || entries.length === 0) return
    if (exhausted) {
      onStepComplete?.()
    } else {
      const nextCap = nextStepBoundary(entries, effectiveCap)
      const lastAtBatIndex = lastVisibleAtBatIndex(entries, effectiveCap)
      onStepInfo?.({ nextCap, isLastStep: nextCap >= entries.length, lastAtBatIndex })
    }
  }, [stepping, exhausted, effectiveCap, entries.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Up to InningViewer (useFocusMode) — see buildTrailItems' own header.
  useEffect(() => {
    if (!focusOne) return
    onFocusInfo?.(revealedSteps, buildTrailItems(entries, bounds, revealedSteps, (t) => EVENT_CODES[t]))
  }, [focusOne, revealedSteps]) // eslint-disable-line react-hooks/exhaustive-deps

  // How many runs have scored in the STEPPED-THROUGH portion of this half so
  // far — reported upward (InningViewer, via HalfInning) so the linescore
  // grid's own cell for this half can build up as you reveal it one at-bat at
  // a time, instead of staying blank until the whole half commits. Reveal-
  // safe by construction: `entries` here is already clamped to `effectiveCap`
  // (computeHalfInningFeed's own stepCap), so this can never count a run from
  // an at-bat the user hasn't actually stepped into yet. Each scoring runner
  // is marked `scored: true` on HIS OWN at-bat card (the trip he reached base
  // on, not necessarily the play that drove him in), so summing every
  // entry's own flag — not just the batter of the play that just happened —
  // correctly totals a multi-run play (a grand slam scores the batter's own
  // card plus the three baserunners' own earlier cards).
  //
  // The extra-innings placed runner counts here too, on his own 'placed' card.
  // He has no plate appearance, but a run is a run — and before he had a card
  // at all his was silently dropped from this sum, so every extra half he
  // scored in built a linescore cell one short (verified against gamePk
  // 777747's bottom 10: a walk-off grand slam totalled 3).
  //
  // The dependency is the COUNT, not `entries`. `entries` is a fresh array every
  // render (computeHalfInningFeed runs at render top-level — reveal-only,
  // ADR-0001, so it cannot be hoisted into a memo above the seal), so an
  // `[entries]` dependency re-ran this effect on every render, the report
  // re-rendered InningViewer, which re-rendered this component, which re-ran the
  // effect… one "Next at-bat" tap cost 264 renders of the whole innings tree
  // (measured). A number compares by value.
  const runsSoFar = entries.filter(
    (e) => (e.kind === 'atbat' || e.kind === 'placed') && e.scored,
  ).length
  useEffect(() => {
    if (!stepping) return
    onRunsSoFar?.(runsSoFar)
  }, [stepping, runsSoFar]) // eslint-disable-line react-hooks/exhaustive-deps

  // The scorebug HUD's live snapshot (bases/outs/pitches/current batter),
  // reported for the SCOREBUG'S benefit only — deliberately NOT gated on
  // `stepping` the way onStepInfo/onRunsSoFar above are. Those two only fire
  // while a half is being actively stepped through one at-bat at a time; the
  // scorebug still needs a final snapshot once a half is fully committed
  // (stepCap null, effectiveCap null) or the HUD would go blank the instant
  // the last at-bat reveals. `deriveLiveState` itself is what keeps this
  // spoiler-safe either way — it never reads past `effectiveCap`.
  // Same `entries`-identity trap as onRunsSoFar above: the dependency is the set
  // of INPUTS `entries` is derived from — a poll minting a fresh feed still
  // re-reports, a bare re-render no longer does.
  useEffect(() => {
    onLiveState?.(deriveLiveState(entries, effectiveCap ?? entries.length))
  }, [feed, inning, half, battingSide, effectiveCap]) // eslint-disable-line react-hooks/exhaustive-deps

  // (This file used to report the currently-revealed pitcher back up to
  // HalfInning, which overrode its persistent "Now Pitching" header. That put
  // a mid-half reliever's card in two places at once and, on a half revealed
  // all at once, hoisted the LAST arm of the inning above at-bat cards the
  // starter had pitched. The header now names the half's starting pitcher and
  // only that; a mid-half change belongs here, in chronological place, where
  // the `pitching_substitution` branch below already renders it as the same
  // card. See HalfInning.jsx's nowPitching.)

  if (entries.length === 0) return null
  // One step's WINDOW. `focusStep` null is "the newest"; a number is clamped
  // rather than trusted, the count it was chosen against being a component away.
  let visibleEntries = stepping ? entries.slice(0, effectiveCap) : entries
  if (bounds && revealedSteps > 0) {
    const i = focusStep == null ? revealedSteps - 1 : Math.min(Math.max(focusStep, 0), revealedSteps - 1)
    visibleEntries = entries.slice(i === 0 ? 0 : bounds[i - 1], bounds[i])
  }

  // Annotate each mound-visit note with the club's visits-remaining right after
  // it (see moundVisitRemainings) — the mound-visit events come back in
  // chronological order, matching the remainings list one-for-one.
  // A lookup keyed by entry identity (not a mutation of the entry objects
  // themselves — `entries` may be a reveal-only derivation's own return
  // value, and mutating it in place risks corrupting a cached result).
  const mvRemaining = moundVisitRemainings(feed, inning, half, battingSide)
  let mvSeen = 0
  const mvRemainingByEntry = new Map()
  for (const e of entries) {
    if (e.kind === 'event' && e.eventType === 'mound_visit') {
      mvRemainingByEntry.set(e, mvRemaining[mvSeen] ?? null)
      mvSeen += 1
    }
  }

  // Season-context call-out plumbing (see api/callout-notes.js). All three
  // derivations read the whole-game feed but are reveal-only like everything
  // here, and only run when a bundle exists (a generated date) — otherwise
  // the cards render exactly as before. `firstRun` marks the play that scored
  // the game's first run; `firstPA` gates each batter's streak/situational/
  // vs-team notes to his first card of the game; `firstRispPA` gates the RISP
  // note to his first card with a runner actually in scoring position, since
  // (unlike the others) it reads as a non sequitur on a bases-empty PA;
  // `progress` carries the per-play in-game counts that keep a note's number
  // current through the play it sits on (never past it — see the two-tenses
  // rule in callout-notes.js).
  const firstRun = callouts ? firstRunPlay(feed) : null
  const firstPA = callouts ? firstPAIndexByBatter(feed) : null
  const firstRispPA = callouts ? firstRispPAIndexByBatter(feed) : null
  const progress = callouts ? computeCalloutProgress(feed) : null

  return (
    <div className="pbp">
      {visibleEntries.map((entry, i) => {
        let node
        if (entry.kind === 'placed') {
          // The extra-innings automatic runner. A card, not a notification —
          // he's a live baserunner whose trip is notated like everyone
          // else's — but not a plate appearance either, so it renders the
          // at-bat frame with the pitch ladder and RBI chip taken away.
          node = <PlacedRunnerCard entry={entry} />
        } else if (entry.kind !== 'event') {
          node = (
            <AtBatCard
              entry={entry}
              battingTeamId={battingTeamId}
              pitchingTeamId={pitchingTeamId}
              calloutCtx={{ bundle: callouts, firstRun, firstPA, firstRispPA, battingSide, vsTeam, progress }}
              highlight={entry.playId ? highlightsMap?.get(entry.playId) : null}
              focusHeader={focusOne}
            />
          )
        } else if (entry.eventType === 'pitching_substitution') {
          // A mid-inning pitching change renders as the same "now pitching" card
          // the stat slot shows for a between-halves change (see PitcherNotice),
          // headshot and all — falling back to the plain note only if the pitcher
          // can't be resolved.
          const pitcher = pitchingChangePitcher(feed, entry.playerId)
          node = pitcher ? (
            <PitcherNotice
              pitcher={pitcher}
              teamId={pitchingTeamId}
              teamName={pitchingName}
              className="pitchernotice--pbp"
            />
          ) : (
            <EventNote entry={entry} />
          )
        } else if (entry.eventType === 'mound_visit') {
          // A mound visit is a momentary stoppage — the same notification card
          // as a substitution, captioned with the visiting club's mark and its
          // used/open visit pips instead of a headshot.
          node = (
            <MoundVisitBar
              team={pitchingName}
              teamId={pitchingTeamId}
              remaining={mvRemainingByEntry.get(entry) ?? null}
              allowed={moundVisitsAllowed(inning)}
            />
          )
        } else if (entry.eventType === 'defensive_substitution' || entry.eventType === 'defensive_switch') {
          // A defensive substitution (a fresh fielder entering) AND a defensive
          // switch (a player already in the game moving to a new position) both
          // get the same "now playing" headshot card as a pitching change — a
          // position change is just as worth a scorer's notice as a fresh
          // entrant, so it shouldn't read as a lesser plain text line.
          const fielder = defensiveChangeFielder(feed, entry.playerId, entry.position)
          node = fielder ? (
            <FielderNotice
              fielder={fielder}
              teamId={pitchingTeamId}
              teamName={pitchingName}
              className="pitchernotice--pbp"
            />
          ) : (
            <EventNote entry={entry} />
          )
        } else if (entry.eventType === 'ejection') {
          // An ejection is a thin notification bar, same weight as a mound
          // visit — the description sentence already carries every detail
          // (who, by which umpire), so there's nothing else to add to a card.
          node = <EjectionBar text={entry.text} />
        } else if (entry.eventType === 'pinch_running') {
          // A pinch runner entering mid-flow gets the same headshot card as a
          // pitching/defensive change — on the BATTING team's side, since he's
          // an offensive substitution, not the fielding team the other cards
          // key off of.
          const { runner, replaced } = pinchRunningPlayers(feed, entry.pinchId, entry.replacedId)
          node = runner ? (
            <PinchRunNotice
              runner={runner}
              replaced={replaced}
              base={entry.base}
              teamId={battingTeamId}
              teamName={battingName}
              className="pitchernotice--pbp"
            />
          ) : (
            <EventNote entry={entry} />
          )
        } else if (entry.eventType === 'pinch_hitting') {
          // A pinch hitter entering mid-flow gets the same "now batting"
          // headshot card the pre-pitch staged list shows (BatterNotice),
          // on the BATTING team's side — the same symmetry every other
          // substitution type already has (pitching change, defensive
          // sub/switch, pinch runner), rather than showing up with no
          // announcement of his own, just his own at-bat card a moment later.
          const batter = pinchHittingBatter(feed, entry.playerId)
          node = batter ? (
            <BatterNotice
              batter={batter}
              teamId={battingTeamId}
              teamName={battingName}
              className="pitchernotice--pbp"
            />
          ) : (
            <EventNote entry={entry} />
          )
        } else if (EVENT_CODES[entry.eventType]) {
          // A baserunning/misc event with no plate appearance of its own
          // (steal, caught stealing, pickoff, wild pitch, passed ball, balk) —
          // the same notification card family, captioned with the real
          // scorer's shorthand instead of an emoji, plus the one clear person
          // most of these events are actually about.
          node = (
            <EventCard
              code={EVENT_CODES[entry.eventType]}
              runnerId={entry.playerId}
              teamId={BASERUNNER_EVENTS.has(entry.eventType) ? battingTeamId : pitchingTeamId}
              segments={entry.segments}
            />
          )
        } else {
          node = <EventNote entry={entry} />
        }

        return (
          <div
            className="pbp__entry"
            key={
              entry.kind === 'event'
                ? `event-${i}`
                : `${entry.kind === 'placed' ? entry.runnerId : entry.batterId}-${i}`
            }
          >
            {node}
          </div>
        )
      })}
    </div>
  )
}

// Icons for EventNote. For a substitution this is a FALLBACK, reached only
// when the fielder/pitcher/runner can't be resolved from gameData.players (a
// thin feed) and the entry stays a plain note instead of the FielderNotice/
// PitcherNotice/PinchRunNotice card. Baserunning/misc events never fall back
// here — they always resolve to EventCard (see EVENT_CODES below).
const EVENT_ICONS = {
  mound_visit: '⏱',
  pitching_substitution: '🔄',
  defensive_substitution: '👥',
  defensive_switch: '🧤',
  ejection: '🚫',
  pinch_running: '🏃',
  pinch_hitting: '🏏',
  // A delay advisory (injury, on-field, weather) — why a half stopped. Unlike
  // the rows above, EventNote is this one's INTENDED home rather than a
  // fallback: there is no person to card, and nothing to add to the sentence
  // the feed already wrote.
  game_advisory: '⏸',
}

// The real scorer's shorthand for a baserunning/misc event with no plate
// appearance of its own — the same abbreviation a scorer pencils on paper,
// captioning EventCard instead of an emoji.
//
// A pickoff is PK, not PO, and the tags here must keep matching the two places
// in api/playbyplay.js that write the same event onto a diamond —
// runnerOutCode's out notation ("PK 1-3") and interruptedCode's carry-over
// mark ("PK →"). Two spellings for one event on the same page reads as two
// different events, and "PO" is doubly wrong here: it's already this app's
// mark for a POP OUT (loadScorecard.js's classifyOut), besides being the
// scorebook's own abbreviation for a putout.
const EVENT_CODES = {
  stolen_base_2b: 'SB', stolen_base_3b: 'SB', stolen_base_home: 'SB',
  caught_stealing_2b: 'CS', caught_stealing_3b: 'CS', caught_stealing_home: 'CS',
  pickoff_1b: 'PK', pickoff_2b: 'PK', pickoff_3b: 'PK',
  pickoff_caught_stealing_2b: 'PK', pickoff_caught_stealing_3b: 'PK', pickoff_caught_stealing_home: 'PK',
  wild_pitch: 'WP', passed_ball: 'PB', balk: 'BK',
  // Not observed as a standalone top-level play in either sampled game (both
  // always nested inside a real plate appearance) — included for the same
  // reason every other NON_PA-adjacent code above is, so IF one ever does
  // surface on its own, it gets this card's real shorthand instead of
  // EventNote's generic fallback icon.
  runner_placed: 'RP', defensive_indiff: 'DI',
}

// Which side EventCard's one named person belongs to, for its headshot's team
// logo fallback: a steal/pickoff/placement is about the BASERUNNER (batting
// team); a wild pitch/passed ball/balk is about the pitcher or catcher
// (pitching team). Defensive indifference has no single player it's really
// "about" — defaults to the pitching team below along with the WP/PB/BK group.
const BASERUNNER_EVENTS = new Set([
  'stolen_base_2b', 'stolen_base_3b', 'stolen_base_home',
  'caught_stealing_2b', 'caught_stealing_3b', 'caught_stealing_home',
  'pickoff_1b', 'pickoff_2b', 'pickoff_3b',
  'pickoff_caught_stealing_2b', 'pickoff_caught_stealing_3b', 'pickoff_caught_stealing_home',
  'runner_placed',
])

// The play-by-play prose for a baserunning event (steal, caught stealing, wild
// pitch…), rendered as a secondary line beneath the batter's own description on
// the card of the plate appearance it happened during. Names linkify the same
// way the main description does.
function BaserunningNote({ segments }) {
  return (
    <div className="pbp__subnote">
      {segments.map((seg, i) =>
        seg.id != null ? (
          <span key={i} className="pbp__name">
            {seg.text}
          </span>
        ) : (
          seg.text
        ),
      )}
    </div>
  )
}

function EventNote({ entry }) {
  return (
    <div className="pbp__note">
      <span className="pbp__noteicon" aria-hidden="true">
        {EVENT_ICONS[entry.eventType] ?? '🔄'}
      </span>
      <span className="pbp__notetext">
        {entry.segments.map((seg, i) =>
          seg.id != null ? (
            <PlayerLink key={i} id={seg.id}>
              {seg.text}
            </PlayerLink>
          ) : (
            seg.text
          ),
        )}
      </span>
    </div>
  )
}

// A mound visit: the same kraft-amber notification card as a substitution —
// no headshot to show (it's a team-level event, not a person), so the visiting
// club's own mark sits up front instead of a code (the "Mound visit" label
// already says what this is). The useful bit is how many visits the club has
// left (MLB caps them — see moundVisitsAllowed), drawn as used/open pips
// (UsagePips) — the same shared component StatBox.jsx's ABS challenge row
// uses, sized up here (pitchernotice--mv) since this card has no other figure
// competing for attention. A visible "N left" tail rides alongside the pips,
// same idiom as the ABS row's own .abs__rec readout — the dots alone don't
// say which fill state means used vs. still available, so a viewer has to
// guess (verified feedback: kraft-brown fill read as ambiguous either way).
function MoundVisitBar({ team, teamId, remaining, allowed }) {
  const used = remaining != null && allowed != null ? Math.max(0, allowed - remaining) : null
  const label =
    used != null ? `${used} of ${allowed} mound visits used, ${remaining} left` : undefined
  return (
    <div className="pitchernotice pitchernotice--pbp pitchernotice--event pitchernotice--mv">
      <TeamLogo teamId={teamId} name={team} size={20} className="pitchernotice__teammark" />
      <span className="pitchernotice__label">Mound visit{team ? ` — ${team}` : ''}</span>
      <span className="pitchernotice__spacer" />
      {used != null && (
        <>
          <UsagePips allowed={allowed} used={used} label={label} />
          <span className="pitchernotice__mvcount" aria-hidden="true">
            {remaining} left
          </span>
        </>
      )}
    </div>
  )
}

// An ejection: the same kraft-amber notification card, captioned "EJ" in the
// negative accent instead of an icon — the description sentence already
// carries every detail worth showing (who, by which umpire), so there's
// nothing else to add.
function EjectionBar({ text }) {
  return (
    <div className="pitchernotice pitchernotice--pbp pitchernotice--event">
      <span className="pitchernotice__code pitchernotice__code--alert">EJ</span>
      <span className="pitchernotice__eventtext">{text}</span>
    </div>
  )
}

// A baserunning/misc event with no plate appearance of its own (steal, caught
// stealing, pickoff, wild pitch, passed ball, balk) — the same kraft-amber
// notification card, captioned with the real scorer's shorthand (EVENT_CODES)
// instead of an emoji, plus the one clear person the event is actually about
// when the feed names one (a runner stealing, the pitcher on a balk/wild
// pitch, the catcher on a passed ball).
function EventCard({ code, runnerId, teamId, segments }) {
  return (
    <div className="pitchernotice pitchernotice--pbp pitchernotice--event">
      <span className="pitchernotice__code">{code}</span>
      {runnerId != null && <PitcherPhoto personId={runnerId} teamId={teamId} />}
      <span className="pitchernotice__eventtext">
        {segments.map((seg, i) =>
          seg.id != null ? (
            <PlayerLink key={i} id={seg.id}>
              {seg.text}
            </PlayerLink>
          ) : (
            seg.text
          ),
        )}
      </span>
    </div>
  )
}

function AtBatCard({ entry, battingTeamId, pitchingTeamId, calloutCtx, highlight, focusHeader = false }) {
  const { batter, pitcher, pitches, pitchDetails, batSide, rbi, code, calledLooking, codeKind, outNumber, outAt, outCode, descSegments, reached, scored, earned, legNotations, pinchRunners, baserunningNotes } = entry
  const [zoneOpen, setZoneOpen] = useState(false)
  const [highlightOpen, setHighlightOpen] = useState(false)
  const calloutNotes = buildCallouts(entry, calloutCtx)
  // The pitch-zone diagram only exists where the park tracked plate locations
  // (most MiLB parks don't). On a phone it opens in a modal from an icon button
  // tucked into the card's bottom-left whitespace; the desktop layout shows it
  // inline instead (the button is hidden ≥740, see .pbp__zonebtn). With no
  // locations there is no right-hand pane at all, so the row drops to one
  // column rather than leaving the card penned into 38fr beside a gap.
  const hasZone = hasPitchLocations(pitchDetails)
  // A batter pinch-run for is crossed out on the card, with the pinch runner
  // penciled in beneath at the PR spot; the diamond gets a red PR by the base he
  // took over at (the last swap's base if a runner was himself pinch-run for).
  const replaced = pinchRunners && pinchRunners.length > 0
  const prBase = replaced ? pinchRunners[pinchRunners.length - 1].base : null
  const prJersey = replaced ? pinchRunners[pinchRunners.length - 1].jersey : null
  return (
    <div className={`pbp__atbat${hasZone ? '' : ' pbp__atbat--nozone'}`}>
      {/* Focus mode only — see AtBatHero.jsx. It REPLACES .pbp__top below
          (note the matching `!focusHeader` gate), rather than stacking a
          second name row above it. */}
      {focusHeader && (
        <AtBatHero
          batter={batter}
          pitcher={pitcher}
          rbi={rbi}
          pinchRunners={pinchRunners}
          battingTeamId={battingTeamId}
          pitchingTeamId={pitchingTeamId}
        />
      )}
      {/* Fills the room the missing zone pane leaves, so it rides with
          --nozone. Decorative — the card's first line already names him — and
          desktop-only, .pbp__batshot being display:none below 740. */}
      {!hasZone && (
        <div className="pbp__batshot" aria-hidden="true">
          <PitcherPhoto personId={batter.id} name={batter.last} teamId={battingTeamId} />
        </div>
      )}
      <div className="pbp__card">
        <div className="pbp__main">
          {!focusHeader && (
          <div className="pbp__top">
            <span className="pbp__batter">
              <span className={`pbp__batline ${replaced ? 'pbp__replaced' : ''}`}>
                <PlayerLink id={batter.id}>
                  {batter.last}
                  {batter.first ? `, ${batter.first}` : ''}
                </PlayerLink>
                {batter.pos && <span className="pbp__pos">{batter.pos}</span>}
              </span>
              {pinchRunners?.map((pr, i) => (
                <span
                  key={pr.id}
                  className={`pbp__batline ${i < pinchRunners.length - 1 ? 'pbp__replaced' : ''}`}
                >
                  <PlayerLink id={pr.id}>
                    {pr.last}
                    {pr.first ? `, ${pr.first}` : ''}
                  </PlayerLink>
                  <span className="pbp__pos">PR</span>
                </span>
              ))}
            </span>
            {rbi > 0 && <span className="pbp__rbi">{rbi} RBI</span>}
          </div>
          )}
          <div className="pbp__desc">
            {descSegments.map((seg, i) =>
              seg.id != null ? (
                <span key={i} className="pbp__name">
                  {seg.text}
                </span>
              ) : (
                seg.text
              ),
            )}
          </div>
          {/* A normal at-bat's own baserunning notes (a WP/PB/SB during the
              count) now get their own leading EventCard, hoisted out in
              computeHalfInningFeed — this sub-line only still fires for the
              rare interrupted-at-bat case (an inning-ending baserunning play
              mid-count), which isn't split out that way. */}
          {entry.interrupted && baserunningNotes?.map((note, i) => (
            <BaserunningNote key={i} segments={note.segments} />
          ))}
          {calloutNotes.map((note, i) => (
            <CalloutNote key={`c-${i}`} text={note.text} />
          ))}
          {hasZone && (
            <button
              type="button"
              className="pbp__zonebtn"
              onClick={() => setZoneOpen(true)}
              aria-label={`Show pitch zone for ${batter.last}`}
            >
              <StrikeZoneGlyph className="pbp__zoneicon" />
            </button>
          )}
          {/* Generic label only — never the clip's own title/description, which
              would spoil the play for anyone glancing at the card before
              reading the prose above it (see HighlightSheet's spoiler note).
              Just "Watch" + the play icon, not "Watch highlight" — the wide
              breakpoint's card column is only 38fr of the row (see
              .pbp__atbat), too narrow for the longer label. The full context
              still reaches screen readers via aria-label. */}
          {highlight && (
            <button
              type="button"
              className="pbp__hlbtn"
              onClick={() => setHighlightOpen(true)}
              aria-label={`Watch highlight for ${batter.last}`}
            >
              <span className="pbp__hlicon" aria-hidden="true">▶</span> Watch
            </button>
          )}
        </div>
        <div className="pbp__side">
          <PitchLadder ladder={pitchLadder(pitches)} />
          <div className="pbp__play">
            {codeKind !== 'out' && codeKind !== 'interrupted' && code && (
              <span className={`pbp__code pbp__code--${codeKind}`}>{code}</span>
            )}
            <PlayDiamond
              reached={reached}
              scored={scored}
              earned={earned}
              legNotations={legNotations}
              outAt={outAt}
              outCode={outCode}
              prBase={prBase}
              prJersey={prJersey}
            />
            {codeKind === 'out' &&
              (calledLooking ? (
                <span className="pbp__code pbp__code--center pbp__klooking" aria-label="strikeout looking">
                  K
                </span>
              ) : (
                code && <span className="pbp__code pbp__code--center pbp__code--out">{code}</span>
              ))}
            {/* An interrupted at-bat's carry-over mark ("CS →") is penciled in
                the MIDDLE of the diamond, where the scorer writes it — the
                otherwise-empty diamond (nobody aboard, no out) is what keeps it
                from reading as this batter's own baserunning. */}
            {codeKind === 'interrupted' && code && (
              <span className="pbp__code pbp__code--center pbp__code--interrupted">{code}</span>
            )}
            {outNumber != null && (
              <span className="pbp__outcircle" aria-label={`Out ${outNumber} of the inning`}>
                {outNumber}
              </span>
            )}
          </div>
        </div>
      </div>
      {/* Desktop/iPad: the pitch zone + sequence ride in the at-bat's right
          column (hidden on a phone, which uses the icon button + modal above).
          Just the pitches and their plot — the batter/pitcher matchup is
          already named in the card to the left. Collapses away entirely at
          parks with no pitch tracking. */}
      {hasZone && (
        <div className="pbp__zonecell">
          <PitchList pitchDetails={pitchDetails} />
          <StrikeZone pitchDetails={pitchDetails} batSide={batSide} className="strikezone--inline" />
        </div>
      )}
      {zoneOpen && hasZone && (
        <StrikeZoneModal
          pitchDetails={pitchDetails}
          batSide={batSide}
          batter={batter}
          pitcher={entry.pitcher?.last}
          onClose={() => setZoneOpen(false)}
        />
      )}
      {highlightOpen && highlight && (
        <HighlightSheet item={highlight} onClose={() => setHighlightOpen(false)} />
      )}
    </div>
  )
}
