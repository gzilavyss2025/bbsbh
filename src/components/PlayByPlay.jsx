import { computeHalfInningFeed, pitchDotCategory } from '../api/playbyplay.js'
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

// Spoken word for each pitch-dot category (see pitchDotCategory).
const PITCH_WORDS = {
  called: 'called strike',
  whiff: 'whiff',
  foul: 'foul',
  inplay: 'in play',
  ball: 'ball',
}

function AtBatCard({ entry }) {
  const { batter, pitches, rbi, out, outNumber, hitText, basesAfter, hitLocation } = entry
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
        {pitches.length > 0 && (
          // The dots are color-only, so the row itself carries the sequence as
          // its accessible name ("ball, called strike, whiff…").
          <div
            className="pbp__pitchrow"
            role="img"
            aria-label={`Pitches: ${pitches
              .map((code) => PITCH_WORDS[pitchDotCategory(code)])
              .join(', ')}`}
          >
            {pitches.map((code, i) => (
              <span
                key={i}
                className={`pbp__dot pbp__dot--${pitchDotCategory(code)}`}
                aria-hidden="true"
              />
            ))}
          </div>
        )}
        <div className="pbp__desc">
          {out ? (
            <>
              {out.label}
              {out.calledLooking ? (
                <>
                  {', '}
                  <span className="pbp__klooking" aria-label="strikeout looking">
                    K
                  </span>
                </>
              ) : out.notation ? (
                `, ${out.notation}`
              ) : null}
            </>
          ) : (
            hitText
          )}
        </div>
      </div>
      <div className="pbp__side">
        {outNumber != null && (
          <span className="pbp__outdot" aria-label={`Out ${outNumber} of the inning`}>
            {outNumber}
          </span>
        )}
        <PlayDiamond bases={basesAfter} hit={hitLocation} size={100} />
      </div>
    </div>
  )
}
