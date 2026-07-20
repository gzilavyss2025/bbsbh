import { useState } from 'react'
import { Headshot } from './Headshot.jsx'

// Show only the first handful up front and let a button reveal the rest —
// same FormerTeammates/InsightsCard pattern (TeamInfo.jsx, BoxScore.jsx) as
// every other capped-list-with-more section on the page.
const MARGIN_NOTES_SHOWN = 5

// Margin Notes: the ranked digest of the most-impactful in-progress pitcher
// facts, spanning every pitcher who's appeared so far this game (see
// api/pitcher-callouts.js's buildMarginNotes). Same card-grid dress as the
// pre-half strip (PreHalfCallouts.jsx) — a headshot, the pitcher's name, and
// a star-marked sentence — since notes here span multiple pitchers and need
// the same per-card attribution the old Pitchers-table row implied for free.
// `notes` is already sorted (and deduped) by the caller; renders nothing when
// empty (no bundle, or nothing yet qualifies).
export function MarginNotes({ notes, feed, bundle }) {
  const [showAll, setShowAll] = useState(false)
  if (!notes || notes.length === 0) return null
  const shown = showAll ? notes : notes.slice(0, MARGIN_NOTES_SHOWN)
  const hidden = notes.length - shown.length
  return (
    <section className="marginnotes">
      <h3 className="marginnotes__title">Margin Notes</h3>
      <div className="marginnotes__grid">
        {shown.map((n) => {
          const teamId = n.side ? bundle?.[n.side]?.teamId ?? null : null
          // gameData.players is roster identity, spoiler-free — same read
          // PreHalfCallouts' card uses.
          const personName =
            n.personId != null ? feed?.gameData?.players?.[`ID${n.personId}`]?.fullName ?? '' : ''
          return (
            <div className="marginnotes__card" key={n.dedupeKey ?? n.text}>
              <span className="marginnotes__avatar">
                <Headshot personId={n.personId} name={personName} teamId={teamId} className="marginnotes__shot" />
              </span>
              <span className="marginnotes__body">
                {personName && <span className="marginnotes__who">{personName}</span>}
                <span className="marginnotes__text">
                  <span className="marginnotes__mark" aria-hidden="true">★</span>
                  {n.text}
                </span>
              </span>
            </div>
          )
        })}
      </div>
      {hidden > 0 && (
        <button type="button" className="marginnotes__more" onClick={() => setShowAll(true)}>
          Show {hidden} more margin {hidden === 1 ? 'note' : 'notes'}
        </button>
      )}
    </section>
  )
}
