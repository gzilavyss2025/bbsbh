import { useState } from 'react'
import {
  computeHalfInningFeed,
  pitchLadder,
  hasPitchLocations,
  firstRunPlay,
  firstPAIndexByBatter,
  moundVisitRemainings,
  pitchingChangePitcher,
  defensiveChangeFielder,
  pinchRunningPlayers,
} from '../api/playbyplay.js'
import { buildCallouts, computeCalloutProgress } from '../api/callout-notes.js'
import { PlayDiamond } from './PlayDiamond.jsx'
import { CalloutNote } from './CalloutNote.jsx'
import { PlayerLink } from './PlayerLink.jsx'
import { PitcherNotice } from './PitcherNotice.jsx'
import { FielderNotice } from './FielderNotice.jsx'
import { PinchRunNotice } from './PinchRunNotice.jsx'
import { StrikeZone, PitchList, StrikeZoneGlyph, StrikeZoneModal } from './StrikeZone.jsx'
import { HighlightSheet } from './HighlightSheet.jsx'

// Renders the play-by-play feed for one half-inning: one card per plate
// appearance (pitch-dot sequence, scorebook-style out notation, RBI tag, and
// an out-sequence badge), interleaved with mound-visit / pitching-change
// notes, first at-bat first. This reads score-revealing data
// (computeHalfInningFeed), so — same rule as the rest of the half's stat
// grid — it must only be rendered from inside a SealBox's reveal function.
export function PlayByPlay({ feed, inning, half, battingSide, pitchingName, battingName, callouts, vsTeam, highlightsMap }) {
  const entries = computeHalfInningFeed(feed, inning, half, battingSide)
  if (entries.length === 0) return null

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
  // vs-team notes to his first card of the game; `progress` carries the
  // per-play in-game counts that keep a note's number current through the
  // play it sits on (never past it — see the two-tenses rule in
  // callout-notes.js).
  const firstRun = callouts ? firstRunPlay(feed) : null
  const firstPA = callouts ? firstPAIndexByBatter(feed) : null
  const progress = callouts ? computeCalloutProgress(feed) : null

  return (
    <div className="pbp">
      {entries.map((entry, i) => {
        if (entry.kind !== 'event') {
          return (
            <AtBatCard
              key={`${entry.batterId}-${i}`}
              entry={entry}
              calloutCtx={{ bundle: callouts, firstRun, firstPA, battingSide, vsTeam, progress }}
              highlight={entry.playId ? highlightsMap?.get(entry.playId) : null}
            />
          )
        }
        // A mid-inning pitching change renders as the same "now pitching" card
        // the stat slot shows for a between-halves change (see PitcherNotice),
        // headshot and all — falling back to the plain note only if the pitcher
        // can't be resolved.
        if (entry.eventType === 'pitching_substitution') {
          const pitcher = pitchingChangePitcher(feed, entry.playerId)
          return pitcher ? (
            <PitcherNotice
              key={`event-${i}`}
              pitcher={pitcher}
              teamName={pitchingName}
              className="pitchernotice--pbp"
            />
          ) : (
            <EventNote key={`event-${i}`} entry={entry} />
          )
        }
        // A mound visit is a momentary stoppage — a thin notification bar with
        // the club's visits-remaining, not a full note.
        if (entry.eventType === 'mound_visit') {
          return <MoundVisitBar key={`event-${i}`} team={pitchingName} remaining={entry.mvRemaining} />
        }
        // A defensive substitution (a fresh fielder entering) gets the same
        // headshot card as a pitching change. A defensive SWITCH (a player
        // already in the game moving positions) stays a plain EventNote below
        // — falls through with mound visits' non-entrant siblings.
        if (entry.eventType === 'defensive_substitution') {
          const fielder = defensiveChangeFielder(feed, entry.playerId, entry.position)
          return fielder ? (
            <FielderNotice
              key={`event-${i}`}
              fielder={fielder}
              teamName={pitchingName}
              className="pitchernotice--pbp"
            />
          ) : (
            <EventNote key={`event-${i}`} entry={entry} />
          )
        }
        // An ejection is a thin notification bar, same weight as a mound
        // visit — the description sentence already carries every detail
        // (who, by which umpire), so there's nothing else to add to a card.
        if (entry.eventType === 'ejection') {
          return <EjectionBar key={`event-${i}`} text={entry.text} />
        }
        // A pinch runner entering mid-flow gets the same headshot card as a
        // pitching/defensive change — on the BATTING team's side, since he's
        // an offensive substitution, not the fielding team the other cards
        // key off of.
        if (entry.eventType === 'pinch_running') {
          const { runner, replaced } = pinchRunningPlayers(feed, entry.pinchId, entry.replacedId)
          return runner ? (
            <PinchRunNotice
              key={`event-${i}`}
              runner={runner}
              replaced={replaced}
              teamName={battingName}
              className="pitchernotice--pbp"
            />
          ) : (
            <EventNote key={`event-${i}`} entry={entry} />
          )
        }
        return <EventNote key={`event-${i}`} entry={entry} />
      })}
    </div>
  )
}

const EVENT_ICONS = {
  mound_visit: '⏱',
  pitching_substitution: '🔄',
  defensive_substitution: '👥',
  defensive_switch: '🧤',
  ejection: '🚫',
  pinch_running: '🏃',
  // Baserunning events — used when one has no plate appearance to hang on and
  // renders as its own note (see computeHalfInningFeed's non-PA fallback).
  stolen_base_2b: '🏃', stolen_base_3b: '🏃', stolen_base_home: '🏃',
  caught_stealing_2b: '🏃', caught_stealing_3b: '🏃', caught_stealing_home: '🏃',
  pickoff_1b: '🏃', pickoff_2b: '🏃', pickoff_3b: '🏃',
  pickoff_caught_stealing_2b: '🏃', pickoff_caught_stealing_3b: '🏃', pickoff_caught_stealing_home: '🏃',
  wild_pitch: '⚾', passed_ball: '⚾', balk: '⚠️',
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

// A mound visit: a thin full-width strip between at-bat cards. The useful bit
// is how many visits the club has left after this one (MLB caps them — see
// moundVisitRemainings), so it rides on the right.
function MoundVisitBar({ team, remaining }) {
  return (
    <div className="mvbar">
      <span className="mvbar__icon" aria-hidden="true">
        ⏱
      </span>
      <span className="mvbar__label">Mound visit{team ? ` — ${team}` : ''}</span>
      {remaining != null && (
        <span className="mvbar__remaining">
          {remaining} {remaining === 1 ? 'visit' : 'visits'} left
        </span>
      )}
    </div>
  )
}

// An ejection: a thin full-width strip like a mound visit, but in the
// negative/warning accent — the description sentence already carries every
// detail worth showing (who, by which umpire), so there's nothing to add
// beyond an icon and the sentence itself.
function EjectionBar({ text }) {
  return (
    <div className="ejectbar">
      <span className="ejectbar__icon" aria-hidden="true">
        🚫
      </span>
      <span className="ejectbar__label">{text}</span>
    </div>
  )
}

function AtBatCard({ entry, calloutCtx, highlight }) {
  const { batter, pitches, pitchDetails, batSide, rbi, code, calledLooking, codeKind, outNumber, outAt, outCode, descSegments, reached, scored, legNotations, pinchRunners, baserunningNotes } = entry
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
            reading the prose above it (see HighlightSheet's spoiler note). */}
        {highlight && (
          <button
            type="button"
            className="pbp__hlbtn"
            onClick={() => setHighlightOpen(true)}
          >
            <span className="pbp__hlicon" aria-hidden="true">▶</span> Watch highlight
          </button>
        )}
      </div>
      <div className="pbp__side">
        <PitchLadder pitches={pitches} />
        <div className="pbp__play">
          {calledLooking ? (
            <span className="pbp__code pbp__klooking" aria-label="strikeout looking">
              K
            </span>
          ) : (
            code && <span className={`pbp__code pbp__code--${codeKind}`}>{code}</span>
          )}
          <PlayDiamond
            reached={reached}
            scored={scored}
            legNotations={legNotations}
            outAt={outAt}
            outCode={outCode}
            prBase={prBase}
          />
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
