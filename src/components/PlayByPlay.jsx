import { useEffect, useRef, useState } from 'react'
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
  nextStepBoundary,
} from '../api/playbyplay.js'
import { buildCallouts, computeCalloutProgress } from '../api/callout-notes.js'
import { PlayDiamond } from './PlayDiamond.jsx'
import { CalloutNote } from './CalloutNote.jsx'
import { PlayerLink } from './PlayerLink.jsx'
import { PitcherNotice, PitcherPhoto } from './PitcherNotice.jsx'
import { FielderNotice } from './FielderNotice.jsx'
import { PinchRunNotice } from './PinchRunNotice.jsx'
import { TeamLogo } from './TeamLogo.jsx'
import { UsagePips } from './UsagePips.jsx'
import { StrikeZone, PitchList, StrikeZoneGlyph, StrikeZoneModal } from './StrikeZone.jsx'
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
// reports back either `onStepInfo({ nextCap, isLastStep })` — the cap the
// NEXT "reveal next at-bat" tap should pass, computed via nextStepBoundary so
// one tap bundles a leading event note (a sub, a mound visit) with the
// plate appearance it precedes — or, once `stepCap` has caught up to the full
// entries list (every entry shown, whether by tapping through or because the
// very first step happened to be the whole half), `onStepComplete()` once, so
// the caller can promote this half to a normal full commit.
export function PlayByPlay({ feed, inning, half, battingSide, pitchingName, pitchingTeamId, battingName, callouts, vsTeam, highlightsMap, stepCap = null, onStepInfo, onStepComplete, onCurrentPitcher }) {
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

  // Must run before the empty-entries early return below (rules-of-hooks) —
  // guarded internally by `stepping`/`exhausted` instead.
  useEffect(() => {
    if (!stepping || entries.length === 0) return
    if (exhausted) {
      onStepComplete?.()
    } else {
      const nextCap = nextStepBoundary(entries, effectiveCap)
      onStepInfo?.({ nextCap, isLastStep: nextCap >= entries.length })
    }
  }, [stepping, exhausted, effectiveCap, entries.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll the newly revealed at-bat into view on each step (ADR-0016): a
  // step boundary always lands right after a plate-appearance card (see
  // nextStepBoundary), so the last visible entry is the one that just came
  // in. Skipped when a step count carries over from a PREVIOUS visit (mount
  // at stepCap > 1, e.g. returning to a half already mid-step) so the page
  // doesn't jump before the user has tapped anything this visit — but the
  // very first tap of a still-fully-sealed half (mount at stepCap === 1)
  // always scrolls: that tap is the only visible change on the page (the
  // card appears well below the floating bar the user just tapped), so
  // without this the tap looks like it did nothing. Compared against the RAW
  // `stepCap` prop, not `effectiveCap` — this is detecting the user's own tap,
  // which always arrives as the same raw value regardless of how far it gets
  // bundled forward for display.
  const lastEntryRef = useRef(null)
  const prevStepCapRef = useRef(stepCap)
  const isFirstRenderRef = useRef(true)
  useEffect(() => {
    const firstTapOfHalf = isFirstRenderRef.current && stepCap === 1
    isFirstRenderRef.current = false
    if (stepping && (stepCap !== prevStepCapRef.current || firstTapOfHalf)) {
      lastEntryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    prevStepCapRef.current = stepCap
  }, [stepping, stepCap])

  // Reports the pitcher actually on the mound as of what's visible right now
  // (the persistent "Now Pitching" card HalfInning renders above the seal) —
  // the last revealed pitching-substitution entry within the stepping window,
  // falling back to the half's starting pitcher (the first at-bat card's own
  // `pitcher`) when no substitution has been revealed yet. Bounded to
  // `effectiveCap`/`entries` exactly like every retroactive annotation in this
  // file, so it never reports a change the user hasn't stepped to yet.
  const pitcherWindow = stepping ? entries.slice(0, effectiveCap) : entries
  let currentPitcherId = null
  for (let i = pitcherWindow.length - 1; i >= 0; i--) {
    const e = pitcherWindow[i]
    if (e.kind === 'event' && e.eventType === 'pitching_substitution') {
      currentPitcherId = e.playerId
      break
    }
  }
  if (currentPitcherId == null) {
    currentPitcherId = pitcherWindow.find((e) => e.kind === 'atbat')?.pitcher?.id ?? null
  }
  useEffect(() => {
    onCurrentPitcher?.(currentPitcherId != null ? pitchingChangePitcher(feed, currentPitcherId) : null)
  }, [currentPitcherId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (entries.length === 0) return null
  const visibleEntries = stepping ? entries.slice(0, effectiveCap) : entries

  // Annotate each mound-visit note with the club's visits-remaining right after
  // it (see moundVisitRemainings) — the mound-visit events come back in
  // chronological order, matching the remainings list one-for-one.
  const mvRemaining = moundVisitRemainings(feed, inning, half, battingSide)
  let mvSeen = 0
  for (const e of entries) {
    if (e.kind === 'event' && e.eventType === 'mound_visit') {
      e.mvRemaining = mvRemaining[mvSeen] ?? null
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
        const isLast = i === visibleEntries.length - 1
        const scrollRef = isLast ? lastEntryRef : null

        let node
        if (entry.kind !== 'event') {
          node = (
            <AtBatCard
              entry={entry}
              calloutCtx={{ bundle: callouts, firstRun, firstPA, firstRispPA, battingSide, vsTeam, progress }}
              highlight={entry.playId ? highlightsMap?.get(entry.playId) : null}
            />
          )
        } else if (entry.eventType === 'pitching_substitution') {
          // A mid-inning pitching change renders as the same "now pitching" card
          // the stat slot shows for a between-halves change (see PitcherNotice),
          // headshot and all — falling back to the plain note only if the pitcher
          // can't be resolved.
          const pitcher = pitchingChangePitcher(feed, entry.playerId)
          node = pitcher ? (
            <PitcherNotice pitcher={pitcher} teamName={pitchingName} className="pitchernotice--pbp" />
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
              remaining={entry.mvRemaining}
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
            <FielderNotice fielder={fielder} teamName={pitchingName} className="pitchernotice--pbp" />
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
              segments={entry.segments}
            />
          )
        } else {
          node = <EventNote entry={entry} />
        }

        return (
          <div
            className="pbp__entry"
            ref={scrollRef}
            key={entry.kind === 'event' ? `event-${i}` : `${entry.batterId}-${i}`}
          >
            {node}
          </div>
        )
      })}
    </div>
  )
}

// Fallback icon for EventNote — only reached when a substitution's fielder/
// pitcher/runner can't be resolved from gameData.players (a thin feed), so
// these stay a plain note instead of the FielderNotice/PitcherNotice/
// PinchRunNotice card. Baserunning/misc events never fall back here — they
// always resolve to EventCard (see EVENT_CODES below).
const EVENT_ICONS = {
  mound_visit: '⏱',
  pitching_substitution: '🔄',
  defensive_substitution: '👥',
  defensive_switch: '🧤',
  ejection: '🚫',
  pinch_running: '🏃',
}

// The real scorer's shorthand for a baserunning/misc event with no plate
// appearance of its own — the same abbreviation a scorer pencils on paper,
// captioning EventCard instead of an emoji.
const EVENT_CODES = {
  stolen_base_2b: 'SB', stolen_base_3b: 'SB', stolen_base_home: 'SB',
  caught_stealing_2b: 'CS', caught_stealing_3b: 'CS', caught_stealing_home: 'CS',
  pickoff_1b: 'PO', pickoff_2b: 'PO', pickoff_3b: 'PO',
  pickoff_caught_stealing_2b: 'PO', pickoff_caught_stealing_3b: 'PO', pickoff_caught_stealing_home: 'PO',
  wild_pitch: 'WP', passed_ball: 'PB', balk: 'BK',
  // Not observed as a standalone top-level play in either sampled game (both
  // always nested inside a real plate appearance) — included for the same
  // reason every other NON_PA-adjacent code above is, so IF one ever does
  // surface on its own, it gets this card's real shorthand instead of
  // EventNote's generic fallback icon.
  runner_placed: 'RP', defensive_indiff: 'DI',
}

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
// competing for attention.
function MoundVisitBar({ team, teamId, remaining, allowed }) {
  const used = remaining != null && allowed != null ? Math.max(0, allowed - remaining) : null
  const label =
    used != null ? `${used} of ${allowed} mound visits used, ${remaining} left` : undefined
  return (
    <div className="pitchernotice pitchernotice--pbp pitchernotice--event pitchernotice--mv">
      <TeamLogo teamId={teamId} name={team} size={20} className="pitchernotice__teammark" />
      <span className="pitchernotice__label">Mound visit{team ? ` — ${team}` : ''}</span>
      <span className="pitchernotice__spacer" />
      {used != null && <UsagePips allowed={allowed} used={used} label={label} />}
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
function EventCard({ code, runnerId, segments }) {
  return (
    <div className="pitchernotice pitchernotice--pbp pitchernotice--event">
      <span className="pitchernotice__code">{code}</span>
      {runnerId != null && <PitcherPhoto personId={runnerId} />}
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

function AtBatCard({ entry, calloutCtx, highlight }) {
  const { batter, pitches, pitchDetails, batSide, rbi, code, calledLooking, codeKind, outNumber, outAt, outCode, descSegments, reached, scored, earned, legNotations, pinchRunners, baserunningNotes } = entry
  const [zoneOpen, setZoneOpen] = useState(false)
  const [highlightOpen, setHighlightOpen] = useState(false)
  const calloutNotes = buildCallouts(entry, calloutCtx)
  // The pitch-zone diagram only exists where the park tracked plate locations
  // (most MiLB parks don't). On a phone it opens in a modal from an icon button
  // tucked into the card's bottom-left whitespace; the desktop layout shows it
  // inline instead (the button is hidden ≥740, see .pbp__zonebtn).
  const hasZone = hasPitchLocations(pitchDetails)
  // A batter pinch-run for is crossed out on the card, with the pinch runner
  // penciled in beneath at the PR spot; the diamond gets a red PR by the base he
  // took over at (the last swap's base if a runner was himself pinch-run for).
  const replaced = pinchRunners && pinchRunners.length > 0
  const prBase = replaced ? pinchRunners[pinchRunners.length - 1].base : null
  return (
    <div className="pbp__atbat">
    <div className="pbp__card">
      <div className="pbp__main">
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
        {baserunningNotes?.map((note, i) => (
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
        <PitchLadder pitches={pitches} />
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

// Numbers Game #22-style ball/strike lanes beside the diamond: two thin
// vertical columns — a light "ball" lane and a shaded "strike" lane (strikes,
// fouls, and balls in play, the last shown as X). Each lane lists its pitches'
// 1-based numbers stacked from the TOP independently, so a strike on the 4th
// pitch sits at the top of the strike lane even if the first three were balls.
function PitchLadder({ pitches }) {
  const ladder = pitchLadder(pitches)
  if (ladder.length === 0) return null
  const balls = ladder.filter((p) => p.side === 'ball')
  const strikes = ladder.filter((p) => p.side === 'strike')
  const label = ladder
    .map((p) => (p.side === 'ball' ? `ball ${p.label}` : p.label === 'X' ? 'in play' : `strike ${p.label}`))
    .join(', ')
  return (
    <div className="pbp__ladder" role="img" aria-label={`Pitch sequence: ${label}`}>
      <div className="pbp__laddercol pbp__laddercol--ball">
        <span className="pbp__ladderhead">B</span>
        {balls.map((p, i) => (
          <span key={i} className="pbp__cell">
            {p.label}
          </span>
        ))}
      </div>
      <div className="pbp__laddercol pbp__laddercol--strike">
        <span className="pbp__ladderhead">S</span>
        {strikes.map((p, i) => (
          <span key={i} className="pbp__cell">
            {p.label}
          </span>
        ))}
      </div>
    </div>
  )
}
