import { useState } from 'react'
import {
  computeHalfInningFeed,
  pitchLadder,
  hasPitchLocations,
  firstRunPlay,
  firstPAIndexByBatter,
} from '../api/playbyplay.js'
import { buildCallouts } from '../api/callout-notes.js'
import { PlayDiamond } from './PlayDiamond.jsx'
import { CalloutNote } from './CalloutNote.jsx'
import { PlayerLink } from './PlayerLink.jsx'
import { StrikeZone, PitchList, StrikeZoneGlyph, StrikeZoneModal } from './StrikeZone.jsx'

// Renders the play-by-play feed for one half-inning: one card per plate
// appearance (pitch-dot sequence, scorebook-style out notation, RBI tag, and
// an out-sequence badge), interleaved with mound-visit / pitching-change
// notes, first at-bat first. This reads score-revealing data
// (computeHalfInningFeed), so — same rule as the rest of the half's stat
// grid — it must only be rendered from inside a SealBox's reveal function.
export function PlayByPlay({ feed, inning, half, battingSide, callouts }) {
  const entries = computeHalfInningFeed(feed, inning, half, battingSide)
  if (entries.length === 0) return null

  // Season-context call-out plumbing (see api/callout-notes.js). Both derivations
  // read the whole-game feed but are reveal-only like everything here, and only
  // run when a bundle exists (MLB, generated date) — otherwise the cards render
  // exactly as before. `firstRun` marks the play that scored the game's first
  // run; `firstPA` gates each batter's streak note to his first card of the game.
  const firstRun = callouts ? firstRunPlay(feed) : null
  const firstPA = callouts ? firstPAIndexByBatter(feed) : null

  return (
    <div className="pbp">
      {entries.map((entry, i) =>
        entry.kind === 'event' ? (
          <EventNote key={`event-${i}`} entry={entry} />
        ) : (
          <AtBatCard
            key={`${entry.batterId}-${i}`}
            entry={entry}
            calloutCtx={{ bundle: callouts, firstRun, firstPA, battingSide }}
          />
        ),
      )}
    </div>
  )
}

const EVENT_ICONS = {
  mound_visit: '⏱',
  pitching_substitution: '🔄',
  defensive_substitution: '👥',
  defensive_switch: '🧤',
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

function AtBatCard({ entry, calloutCtx }) {
  const { batter, pitches, pitchDetails, rbi, code, calledLooking, codeKind, outNumber, outAt, outCode, descSegments, reached, scored, legNotations, pinchRunners, baserunningNotes } = entry
  const [zoneOpen, setZoneOpen] = useState(false)
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
          <StrikeZone pitchDetails={pitchDetails} className="strikezone--inline" />
        </div>
      )}
      {zoneOpen && hasZone && (
        <StrikeZoneModal
          pitchDetails={pitchDetails}
          batter={batter}
          pitcher={entry.pitcher?.last}
          onClose={() => setZoneOpen(false)}
        />
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
