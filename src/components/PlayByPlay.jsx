import { Fragment } from 'react'
import { computeHalfInningFeed, pitchLadder } from '../api/playbyplay.js'
import { PlayDiamond } from './PlayDiamond.jsx'

// Renders the play-by-play feed for one half-inning: one card per plate
// appearance (pitch-dot sequence, scorebook-style out notation, RBI tag, and
// an out-sequence badge), interleaved with mound-visit / pitching-change
// notes, first at-bat first. This reads score-revealing data
// (computeHalfInningFeed), so — same rule as the rest of the half's stat
// grid — it must only be rendered from inside a SealBox's reveal function.
export function PlayByPlay({ feed, inning, half, battingSide }) {
  const entries = computeHalfInningFeed(feed, inning, half, battingSide)
  if (entries.length === 0) return null

  return (
    <div className="pbp">
      {entries.map((entry, i) =>
        entry.kind === 'event' ? (
          <EventNote key={`event-${i}`} entry={entry} />
        ) : (
          <AtBatCard key={`${entry.batterId}-${i}`} entry={entry} />
        ),
      )}
    </div>
  )
}

function EventNote({ entry }) {
  return (
    <div className="pbp__note">
      <span className="pbp__noteicon" aria-hidden="true">
        {entry.eventType === 'mound_visit' ? '⏱' : '🔄'}
      </span>
      {entry.text}
    </div>
  )
}

function AtBatCard({ entry }) {
  const { batter, pitches, rbi, out, outNumber, desc, basesAfter, hitLocation } = entry
  return (
    <div className="pbp__card">
      <div className="pbp__main">
        <div className="pbp__top">
          <span className="pbp__batter">
            {batter.last}
            {batter.first ? `, ${batter.first}` : ''}
            {batter.pos && <span className="pbp__pos">{batter.pos}</span>}
          </span>
          {rbi > 0 && <span className="pbp__rbi">{rbi} RBI</span>}
        </div>
        <div className="pbp__desc">
          {desc}
          {out?.notation && <span className="pbp__notation">{out.notation}</span>}
          {out?.calledLooking && (
            <span className="pbp__notation pbp__klooking" aria-label="strikeout looking">
              K
            </span>
          )}
        </div>
      </div>
      <div className="pbp__side">
        {outNumber != null && (
          <span className="pbp__outdot" aria-label={`Out ${outNumber} of the inning`}>
            {outNumber}
          </span>
        )}
        <PitchLadder pitches={pitches} />
        <PlayDiamond bases={basesAfter} hit={hitLocation} size={100} />
      </div>
    </div>
  )
}

// Two stacked columns of the at-bat's pitch sequence: each pitch on its own
// row, its 1-based number sitting in the cream "ball" column or the dark
// "strike" column (a ball put in play shows as X). One side of every row is
// blank, so the numbers step down the two columns in the order thrown.
function PitchLadder({ pitches }) {
  const ladder = pitchLadder(pitches)
  if (ladder.length === 0) return null
  const label = ladder
    .map((p) => (p.side === 'ball' ? `ball ${p.label}` : p.label === 'X' ? 'in play' : `strike ${p.label}`))
    .join(', ')
  return (
    <div className="pbp__ladder" role="img" aria-label={`Pitch sequence: ${label}`}>
      <span className="pbp__ladderhead">B</span>
      <span className="pbp__ladderhead">S</span>
      {ladder.map((p, i) => (
        <Fragment key={i}>
          <span className={`pbp__cell pbp__cell--ball${p.side === 'ball' ? ' is-filled' : ''}`}>
            {p.side === 'ball' ? p.label : ''}
          </span>
          <span className={`pbp__cell pbp__cell--strike${p.side === 'strike' ? ' is-filled' : ''}`}>
            {p.side === 'strike' ? p.label : ''}
          </span>
        </Fragment>
      ))}
    </div>
  )
}
