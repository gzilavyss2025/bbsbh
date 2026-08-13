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
  stepTotals,
  lastVisibleAtBatIndex,
  deriveLiveState,
  buildTrailItems,
} from '../../api/playbyplay.js'
import { buildCallouts, computeCalloutProgress } from '../../api/callout-notes.js'
import { INK_SET_MS, INK_SET_OVERSHOOT } from '../inning/focus/beats.js'
import { useDenotationBeat } from '../inning/focus/useDenotationBeat.js'
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
import {
  BASERUNNER_EVENTS,
  BaserunningNote,
  EVENT_CODES,
  EjectionBar,
  EventCard,
  EventNote,
  MoundVisitBar,
} from './EventCards.jsx'
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
  // enumerated. Counting only those at or under the cap is what keeps every
  // window inside it.
  //
  // `focusOne` ALONE, not `focusOne && stepping`. The last at-bat of a half
  // commits it, which drops `stepCap` to null and turned `stepping` off — and
  // the window went with it, so the tap that revealed the 3rd out answered by
  // dumping the entire half onto the screen at once. That is the one moment
  // focus mode is meant to hold still: the reader has just charted a play and
  // is writing it down. Focus mode itself outlives the commit on purpose
  // (`held`, FocusControls.jsx) until the reader taps Summary, and Summary is
  // exactly where the whole half belongs. The windowing now outlives it too.
  // Once the commit lands there is no cap left to measure against, so the cap
  // is the full array — every step is revealed by then, which is what makes
  // the half a summary in the first place. Nothing here reveals: `stepCap` is
  // still the single boundary, and past the commit the whole half is already
  // past it.
  const bounds = focusOne ? stepBounds(entries) : null
  const stepCountCap = effectiveCap ?? entries.length
  const revealedSteps = bounds ? bounds.filter((b) => b <= stepCountCap).length : 0

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
  // `feed` is a dependency alongside the count: a Refresh can rewrite an
  // entry's content under an UNCHANGED step count (an interrupted at-bat
  // resolving, a scorer's correction), and the chips must follow. Same
  // inputs-not-identity discipline as the onLiveState effect below — `entries`
  // itself is a fresh array every render and would loop.
  useEffect(() => {
    if (!focusOne) return
    onFocusInfo?.(revealedSteps, buildTrailItems(entries, bounds, revealedSteps, (t) => EVENT_CODES[t]))
  }, [focusOne, revealedSteps, feed]) // eslint-disable-line react-hooks/exhaustive-deps

  // The runs and hits scored in the STEPPED-THROUGH portion of this half —
  // reported upward (InningViewer, via HalfInning) so the linescore grid's own
  // cell and its R/H totals column build up as you reveal the half one at-bat
  // at a time, instead of staying blank until the whole half commits.
  //
  // `effectiveCap` is passed EXPLICITLY, and stepTotals slices by it. `entries`
  // is not a revealed prefix — computeHalfInningFeed pushes a card for every
  // play in the half regardless of stepCap, and only gates the RETROACTIVE
  // annotations written onto already-pushed cards. Folding a card's own
  // `eventType` over the unclamped array is how the half's final hit total
  // reached the running line from the first tap; see entriesView.js's module
  // header, which owns this arithmetic now so no call site has to remember.
  //
  // The dependency is the two COUNTS, not `entries`. `entries` is a fresh array
  // every render (computeHalfInningFeed runs at render top-level — reveal-only,
  // ADR-0001, so it cannot be hoisted into a memo above the seal), so an
  // `[entries]` dependency re-ran this effect on every render, the report
  // re-rendered InningViewer, which re-rendered this component, which re-ran the
  // effect… one "Next at-bat" tap cost 264 renders of the whole innings tree
  // (measured). A number compares by value.
  const { runs: runsSoFar, hits: hitsSoFar } = stepTotals(entries, effectiveCap)
  useEffect(() => {
    if (!stepping) return
    onRunsSoFar?.(runsSoFar, hitsSoFar)
  }, [stepping, runsSoFar, hitsSoFar]) // eslint-disable-line react-hooks/exhaustive-deps

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
  // Which step the window landed on, or null outside focus mode — handed down
  // as `beatKey` so the denotation hold (ADR-0046) replays on every fresh step.
  // NOT the card's React key: that is `${batterId}-${indexWithinTheWindow}`,
  // and a club batting around sends the same man up twice at the same index,
  // so React reconciles the second card onto the first and the mark prints
  // with no hold. A step index is unique for the life of a half.
  let beatKey = null
  if (bounds && revealedSteps > 0) {
    const i = focusStep == null ? revealedSteps - 1 : Math.min(Math.max(focusStep, 0), revealedSteps - 1)
    beatKey = i
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
              beatKey={beatKey}
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


// The ink-set's two knobs, published to the CSS from beats.js so the numbers
// have one home (see that file's TUNING note).
const INK_SET_STYLE = { '--ink-set': `${INK_SET_MS}ms`, '--ink-overshoot': INK_SET_OVERSHOOT }

function AtBatCard({ entry, battingTeamId, pitchingTeamId, calloutCtx, highlight, focusHeader = false, beatKey = null }) {
  const { batter, pitcher, pitches, pitchDetails, batSide, rbi, code, calledLooking, codeKind, outNumber, outAt, outCode, descSegments, reached, scored, earned, legNotations, pinchRunners, baserunningNotes } = entry
  const [zoneOpen, setZoneOpen] = useState(false)
  const [highlightOpen, setHighlightOpen] = useState(false)
  // THE BEAT (ADR-0046), focus mode only: the denotation cells below hold blank
  // for a CONSTANT 180ms and then land. It takes no argument off `entry` and
  // must never take one — a duration that varied with the play would announce
  // the play. See useDenotationBeat.js.
  const beat = useDenotationBeat(focusHeader, beatKey)
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
              {/* The word is wrapped so focus mode can take it off and leave
                  the glyph — an icon-scale control beside the zone button
                  (styles/focus/atbat.css). A bare text node can't be selected.
                  The button keeps its aria-label either way, so dropping the
                  visible word costs a screen reader nothing. */}
              <span className="pbp__hlicon" aria-hidden="true">▶</span>{' '}
              <span className="pbp__hllabel">Watch</span>
            </button>
          )}
        </div>
        <div className="pbp__side">
          <PitchLadder ladder={pitchLadder(pitches)} />
          <div className="pbp__play" style={focusHeader ? INK_SET_STYLE : undefined}>
            {codeKind !== 'out' && codeKind !== 'interrupted' && code && (
              <span className={`pbp__code pbp__code--${codeKind}${beat}`}>
                {code}
                {focusHeader && rbi > 0 && (
                  <span className="pbp__code__rbi">
                    {rbi}
                    <span className="pbp__code__rbi-unit"> RBI</span>
                  </span>
                )}
              </span>
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
                <span className={`pbp__code pbp__code--center pbp__klooking${beat}`} aria-label="strikeout looking">
                  K
                </span>
              ) : (
                code && (
                  <span className={`pbp__code pbp__code--center pbp__code--out${beat}`}>
                    {code}
                    {focusHeader && rbi > 0 && (
                  <span className="pbp__code__rbi">
                    {rbi}
                    <span className="pbp__code__rbi-unit"> RBI</span>
                  </span>
                )}
                  </span>
                )
              ))}
            {/* An interrupted at-bat's carry-over mark ("CS →") is penciled in
                the MIDDLE of the diamond, where the scorer writes it — the
                otherwise-empty diamond (nobody aboard, no out) is what keeps it
                from reading as this batter's own baserunning. */}
            {codeKind === 'interrupted' && code && (
              <span className={`pbp__code pbp__code--center pbp__code--interrupted${beat}`}>{code}</span>
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
