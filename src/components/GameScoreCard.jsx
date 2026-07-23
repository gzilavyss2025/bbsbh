import { useState } from 'react'
import { fetchGameScores, gameScoreIndex } from '../api/gameScore.js'
import { fetchSchedule } from '../api/schedule.js'
import { ordinal } from '../api/person.js'
import { TIER_LABELS } from '../lib/statTiers.js'
import { beeswarmRows, sampleForDisplay } from '../lib/beeswarm.js'
import { useAsync } from '../hooks/useAsync.js'
import { GameScoreModal } from './GameScoreModal.jsx'

// Interchangeable per-tier commentary on how much drama the game actually
// had, in the same spirit as TeamScoreCard's Season Grade/Last 10 storyline
// pools — several options per tier so the card doesn't repeat the same line
// for every game that lands in a tier, picked deterministically (see
// gamePhraseIndex below) rather than shown at random on every render.
const DRAMA_PHRASES = {
  elite: [
    'One of the best games of the night',
    'Every half inning had something on the line',
    'The kind of night that earns a recap',
    'Tension from the first pitch to the last',
    'A game worth re-living, pitch by pitch',
  ],
  good: [
    'A genuinely entertaining nine innings',
    'Plenty of moments worth marking down',
    'More drama than the average night',
    'Held its shape as a good watch',
    'A solid one to have scored',
  ],
  average: [
    'A fairly ordinary night at the park',
    'Nothing dramatic, nothing wasted either',
    'About as eventful as most nights',
    'A middle-of-the-pack night for drama',
    'Steady, unremarkable baseball',
  ],
  below: [
    'A quiet night, drama-wise',
    'Short on moments worth marking down',
    'Not much tension to speak of',
    'One of the calmer nights on the slate',
    'Light on drama from start to finish',
  ],
}

// A completed game's score never changes, so — unlike TeamScoreCard's daily
// reshuffle — this picks once per gamePk and stays that way forever.
// FNV-1a-style hash, same technique as the Season Grade/Last 10 picker.
function gamePhraseIndex(gamePk, length) {
  let hash = 0x811c9dc5
  const key = String(gamePk)
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return Math.abs(hash) % length
}

function dramaPhrase(tier, gamePk) {
  const options = DRAMA_PHRASES[tier] ?? DRAMA_PHRASES.average
  return options[gamePhraseIndex(gamePk, options.length)]
}

// Where tonight's game landed among the day's other games at the same level,
// visually matching the Team Page's Season Grade card (TeamScoreCard) — a
// hero score over a dot-plot rail of the pool, with this game marked as the
// larger navy dot. Reuses that card's `.team-score` CSS wholesale (same
// section, grade-hero, and track classes) so the two "how good/exciting was
// this" cards read as one family, just scoped to a game instead of a
// team-season.
//
// SPOILER RULE: not a new exposure. Game Score is the one score-derived
// number the app renders outside a SealBox (ADR-0015) — its safety comes
// from the value itself colliding across many game shapes, not from where
// it's shown. This card only ever mounts inside BoxScore's already-sealed
// reveal render, same footing as everything else there.
//
// Scoped to this game's own DATE + level (a day's schedule, same sportId)
// rather than the whole game-score.json pool — "how did tonight's game
// compare to the rest of tonight's slate," not the whole season. The day's
// schedule (spoiler-free — dates/gamePks carry no score) resolves the small
// set of gamePks that pool gets filtered down to.
export function GameScoreCard({ feed }) {
  const [showHow, setShowHow] = useState(false)
  const gamePk = feed?.gamePk
  const sportId = feed?.gameData?.teams?.home?.sport?.id ?? feed?.gameData?.teams?.away?.sport?.id
  const dateStr = feed?.gameData?.datetime?.officialDate

  const scoresAsync = useAsync(() => fetchGameScores(), [])
  const scheduleAsync = useAsync(
    () => (dateStr && sportId != null ? fetchSchedule(dateStr, sportId, 'team') : Promise.resolve([])),
    [dateStr, sportId],
  )
  const raw = scoresAsync.data
  const daySchedule = scheduleAsync.data

  if (!raw || !daySchedule || gamePk == null || sportId == null) return null

  const dayGamePks = new Set(daySchedule.map((g) => String(g.gamePk)))
  const pool = {}
  for (const [pk, v] of Object.entries(raw)) {
    if (v?.sportId === sportId && dayGamePks.has(String(pk))) pool[pk] = v
  }
  const index = gameScoreIndex(pool)
  const rankIdx = index.ranked.findIndex((r) => String(r.gamePk) === String(gamePk))
  // Not yet scored — too recent for the 10-minute cron, or a fetch failure.
  // Same silent degrade as the slate card's own gameScoreFor(...) === null.
  if (rankIdx === -1) return null
  const mine = index.ranked[rankIdx]

  return (
    <section className="team-score" aria-label="Game Score">
      {/* No date here — the box score's own title (and the masthead above
          it) already carry this game's date; TeamScoreCard, the other
          .team-score consumer, still needs its own (no adjacent masthead on
          the Team Page), so the date stays a per-caller choice rather than
          baked into the shared head markup. */}
      <div className="team-score__head">
        <span className="team-score__head-title">
          Game Score
          {/* Plain text, outside the button, so the middot separator reads
              visually gold like the link beside it without itself being part
              of the clickable/underlined target — only "How this is
              calculated" opens the modal. */}
          <span className="team-score__howsep" aria-hidden="true"> · </span>
          <button
            type="button"
            className="team-score__howlink team-score__howlink--inline"
            onClick={() => setShowHow(true)}
          >
            How this is calculated
          </button>
        </span>
      </div>

      <div className="team-score__grade">
        <div className="team-score__grade-button team-score__grade-button--static">
          <span className="team-score__grade-copy">
            <strong>{TIER_LABELS[mine.tier]}</strong>
            <span>{dramaPhrase(mine.tier, gamePk)}</span>
          </span>
          <span className="team-score__grade-result">
            <span className="team-score__rank">{ordinal(rankIdx + 1)} of {index.n}</span>
            <span className="team-score__grade-score">
              {mine.score.toFixed(1)}<small>/10</small>
            </span>
          </span>
        </div>
        <GameScoreTrack ranked={index.ranked} gamePk={gamePk} />
      </div>

      {showHow && <GameScoreModal thresholds={index.thresholds} onClose={() => setShowHow(false)} />}
    </section>
  )
}

// A day's slate is usually small (a dozen-ish MLB games), so this rarely
// samples anything away — but a combined day (postseason doubleheaders,
// a "same level" pool spanning several rounds) could still exceed a
// fixed-height rail dot-for-dot, so cap it the same way TeamScoreCard never
// has to (its pool is a fixed 30 teams). See sampleForDisplay.
const TRACK_SAMPLE_SIZE = 36

// The rail itself: a representative sample of other scored games at this
// level as small anonymous dots, tonight's game as the larger navy marker —
// same visual language as TeamScoreCard's LeagueTrack, minus the hover
// tooltip (there's no per-game identity worth naming here without an extra
// fetch per dot, and the point is the shape of the distribution, not which
// game is which).
function GameScoreTrack({ ranked, gamePk }) {
  const pool = sampleForDisplay(ranked.filter((r) => String(r.gamePk) !== String(gamePk)), TRACK_SAMPLE_SIZE)
  const others = beeswarmRows(pool)
  const mine = ranked.find((r) => String(r.gamePk) === String(gamePk))

  return (
    <div className="team-score__track">
      <div className="team-score__track-base" />
      <div className="team-score__track-mid" />
      {others.map((r) => (
        <span
          key={r.gamePk}
          className="team-score__dot"
          style={{ left: `${(r.score / 10) * 100}%`, top: `calc(17px + ${r.rowOffset}px)` }}
          aria-hidden="true"
        />
      ))}
      {mine && (
        <span
          className="team-score__dot team-score__dot--us"
          style={{ left: `${(mine.score / 10) * 100}%` }}
          aria-label={`This game: ${mine.score.toFixed(1)}`}
        />
      )}
    </div>
  )
}
