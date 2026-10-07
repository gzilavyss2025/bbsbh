// Group the shown notes by their subject (personId, falling back to the note
// itself for a subject-less note) — a card per PLAYER, not per note, so a
// pitcher with several qualifying notes (e.g. a home/road split AND a labor
// warning) reads as one headshot with a stacked list of star-marked lines,
// rather than the same face repeated once per fact. A group's position in
// the digest is its FIRST note's rank (buildMarginNotes' score order), so the
// overall ranking still reads top-to-bottom the same as before grouping —
// only the later, lower-ranked notes for an already-seen player fold inline
// instead of opening a new card further down.
//
// `hasSubject` is false for a note that names no one player: a matchup or
// arsenal note (a hitter AGAINST an arm — api/matchup/) or a team-level one.
// Its card must draw no avatar. A <Headshot> with no personId, no name and no
// team has nothing to look up, so it can only ever land on the "?" monogram.
export function groupNotesBySubject(shown) {
  const groups = []
  const bySubject = new Map()
  for (const n of shown) {
    const key = n.personId ?? n.dedupeKey ?? n.text
    let g = bySubject.get(key)
    if (!g) {
      g = { key, personId: n.personId, side: n.side, hasSubject: n.personId != null, notes: [] }
      bySubject.set(key, g)
      groups.push(g)
    }
    g.notes.push(n)
  }
  return groups
}
