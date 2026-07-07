import { computeHalfInningFeed, pitchLadder } from '../api/playbyplay.js'
import { PlayDiamond } from './PlayDiamond.jsx'
import { PlayerLink } from './PlayerLink.jsx'

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
  const { batter, pitches, rbi, code, calledLooking, codeKind, outNumber, outAt, outCode, desc, reached, scored, legNotations } = entry
  return (
    <div className="pbp__card">
      <div className="pbp__main">
        <div className="pbp__top">
          <span className="pbp__batter">
            <PlayerLink id={batter.id}>
              {batter.last}
              {batter.first ? `, ${batter.first}` : ''}
            </PlayerLink>
            {batter.pos && <span className="pbp__pos">{batter.pos}</span>}
          </span>
          {rbi > 0 && <span className="pbp__rbi">{rbi} RBI</span>}
        </div>
        <div className="pbp__desc">{desc}</div>
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
          />
          {outNumber != null && (
            <span className="pbp__outcircle" aria-label={`Out ${outNumber} of the inning`}>
              {outNumber}
            </span>
          )}
        </div>
      </div>
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
