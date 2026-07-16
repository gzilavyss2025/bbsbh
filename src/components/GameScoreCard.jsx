import { useState } from 'react'
import { fetchGameScores, gameScoreIndex } from '../api/gameScore.js'
import { fetchSchedule } from '../api/schedule.js'
import { ordinal } from '../api/person.js'
import { TIER_LABELS } from '../lib/statTiers.js'
import { beeswarmRows, sampleForDisplay } from '../lib/beeswarm.js'
import { useAsync } from '../hooks/useAsync.js'
import { GameScoreModal } from './GameScoreModal.jsx'

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
        <span>Game Score</span>
      </div>

      <div className="team-score__grade">
        <div className="team-score__grade-button team-score__grade-button--static">
          <span className="team-score__grade-copy">
            <span className="team-score__grade-kicker">Game Score</span>
            <strong>{TIER_LABELS[mine.tier]}</strong>
            <span>How exciting the game was to watch</span>
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

      <button type="button" className="team-score__howlink" onClick={() => setShowHow(true)}>
        How this is calculated
      </button>

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
