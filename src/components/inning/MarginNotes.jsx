import { memo, useState } from 'react'
import { Headshot } from '../player/Headshot.jsx'

// Show only the first handful up front and let a button reveal the rest —
// same FormerTeammates/InsightsCard pattern (TeamInfo.jsx, BoxScore.jsx) as
// every other capped-list-with-more section on the page.
const MARGIN_NOTES_SHOWN = 5

// Group the shown notes by their subject (personId, falling back to the note
// itself for a subject-less note) — a card per PLAYER, not per note, so a
// pitcher with several qualifying notes (e.g. a home/road split AND a labor
// warning) reads as one headshot with a stacked list of star-marked lines,
// rather than the same face repeated once per fact. A group's position in
// the digest is its FIRST note's rank (buildMarginNotes' score order), so the
// overall ranking still reads top-to-bottom the same as before grouping —
// only the later, lower-ranked notes for an already-seen player fold inline
// instead of opening a new card further down.
function groupNotesBySubject(shown) {
  const groups = []
  const bySubject = new Map()
  for (const n of shown) {
    const key = n.personId ?? n.dedupeKey ?? n.text
    let g = bySubject.get(key)
    if (!g) {
      g = { key, personId: n.personId, side: n.side, notes: [] }
      bySubject.set(key, g)
      groups.push(g)
    }
    g.notes.push(n)
  }
  return groups
}

// Margin Notes: the ranked digest of the most-impactful in-progress pitcher
// facts, spanning every pitcher who's appeared so far this game (see
// api/pitcher-callouts.js's buildMarginNotes). Same card-grid dress as the
// pre-half strip (PreHalfCallouts.jsx) — a headshot, the pitcher's name, and
// a star-marked sentence — since notes here span multiple pitchers and need
// the same per-card attribution the old Pitchers-table row implied for free.
// `notes` is already sorted (and deduped) by the caller; renders nothing when
// empty (no bundle, or nothing yet qualifies).
// Memoized: `notes` is already a memoized digest in InningViewer, so this whole
// card can sit out any re-render the feed and the reveal mark didn't cause.
export const MarginNotes = memo(function MarginNotes({ notes, feed, bundle }) {
  const [showAll, setShowAll] = useState(false)
  if (!notes || notes.length === 0) return null
  const shown = showAll ? notes : notes.slice(0, MARGIN_NOTES_SHOWN)
  const hidden = notes.length - shown.length
  const groups = groupNotesBySubject(shown)
  return (
    <section className="marginnotes">
      <h3 className="marginnotes__title">Margin Notes</h3>
      <div className="marginnotes__grid">
        {groups.map((g) => {
          const teamId = g.side ? bundle?.[g.side]?.teamId ?? null : null
          // gameData.players is roster identity, spoiler-free — same read
          // PreHalfCallouts' card uses.
          const personName =
            g.personId != null ? feed?.gameData?.players?.[`ID${g.personId}`]?.fullName ?? '' : ''
          return (
            <div className="marginnotes__card" key={g.key}>
              <span className="marginnotes__avatar">
                <Headshot personId={g.personId} name={personName} teamId={teamId} className="marginnotes__shot" />
              </span>
              <span className="marginnotes__body">
                {personName && <span className="marginnotes__who">{personName}</span>}
                {g.notes.map((n) => (
                  <span className="marginnotes__text" key={n.dedupeKey ?? n.text}>
                    <span className="marginnotes__mark" aria-hidden="true">★</span>
                    {n.text}
                  </span>
                ))}
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
})
