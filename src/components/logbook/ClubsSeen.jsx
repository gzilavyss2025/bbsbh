import { useMemo } from 'react'
import { StampSheet } from './StampSheet.jsx'

// The league, laid out under the book: the clubs and the ballparks you have
// stamped a game of, drawn as two panes of postage stamps, at whichever level
// you ask for.
//
// IT IS NOT A CHECKLIST, and the copy here is the only thing keeping it from
// becoming one (docs/game-log.md §3 — the Game Log has no completion state
// and nothing to finish). So: no "n of 30", no bar filling up, no praise for
// reaching the end. It says how many clubs are in your book and shows you
// which — the same thing the retrospective says in words, said in marks.
//
// THE STAMP ART IS SHARED WITH THE RETROSPECTIVE'S MILESTONE SHELF; THE
// SCORING IS NOT. Both surfaces render components/logbook/StampSheet.jsx over
// the same computed collections. The shelf passes `counts`, which turns on the
// "n of 30" line, the completed-set ring and the one-shot completion beat.
// This surface must never pass it — that single prop is where the rule above
// is enforced, so read that component's header before adding a prop here.
//
// NO SPOILER SURFACE. A club's logo says you sat with that club, and a park's
// photograph says where, never how the game came out, so nothing here is
// gated: this reads the same stamps the page around it already draws, and
// takes only the two team ids off each one.
//
// `factsByPk` is the resolved game facts from api/logbook.js, which is where a
// stamp's two clubs live — the local stamp record itself deliberately holds no
// club (src/lib/stamps.js). A stamp whose facts haven't resolved (offline, or a
// failed batch) simply doesn't colour anything in, the same degrade the grid
// below this makes.

export function ClubsSeen({ stamps = [], factsByPk = {} }) {
  // The lede's own number, counted across EVERY level rather than the one on
  // screen: "clubs in your book" is a fact about the book, not about whichever
  // pane you are looking at. Deliberately not "n of 30" — it has no
  // denominator, which is exactly what keeps it out of checklist territory.
  const count = useMemo(() => {
    const ids = new Set()
    for (const entry of stamps) {
      const game = factsByPk[entry.gamePk]
      if (!game) continue
      if (game.away?.id != null) ids.add(game.away.id)
      if (game.home?.id != null) ids.add(game.home.id)
    }
    return ids.size
  }, [stamps, factsByPk])

  return (
    <section className="clubsseen" aria-labelledby="clubsseen-title">
      <h2 className="clubsseen__title" id="clubsseen-title">
        Clubs you’ve seen
      </h2>
      <p className="clubsseen__lede">
        {count === 0
          ? 'Every club in the league. The ones you stamp a game of come up in their own colours.'
          : `${count} ${count === 1 ? 'club has' : 'clubs have'} turned up in your book.`}
      </p>
      <StampSheet stamps={stamps} factsByPk={factsByPk} />
    </section>
  )
}
