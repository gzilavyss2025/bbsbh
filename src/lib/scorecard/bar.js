// THE LENS BAR'S CHOICE OF STATE AND WORDS (#724, ADR-0092) — pure.
//
// Four states, one at a time: `loading`, `handoff` (a half ended: the next tap
// turns the page), `edge` (the cursor is at the feed's edge of a half still
// being played: nothing to open yet) and `sealed` (the next at-bat can open).
//
// SPOILER FOOTING. Every function takes the scorecard page's clamped `view`
// and `stepInfo`, never the feed, and the words come only from boxes already
// open (words.js, situation.js). The one name that is not on an open box is the
// frontier batter's (`view.grid.frontier.batter`): who comes up is a pre-pitch
// fact, as the lineup is (ADR-0003). Before a tap, state and text depend on
// where the reader stands, never on how the sealed at-bat ends (ADR-0046).
// The totals show only in `handoff`, which exists only once the half has
// committed (G8, ADR-0055).

import { halfCards, halfLabel, halfTotals, situation, situationText, totalsText } from './situation.js'
import { movesText, playWords } from './words.js'

// The tap lock (G6, ADR-0046): a constant after every reveal and every turn.
// It never reads what the tap did, so no result can shorten or lengthen it.
export const LOCK_MS = 700
export const tapLocked = (now, lastAt, ms = LOCK_MS) => lastAt != null && now - lastAt < ms

// `frontier` is the clamped view's `grid.frontier`: the next at-bat, if the feed
// has one, and whether it is still in progress (`live`).
export function barState({ loading, stepInfo, flip, frontier = null }) {
  if (loading) return 'loading'
  if (!stepInfo) return null
  if (flip) return 'handoff'
  // G10 / ADR-0055: the cursor has met the end of what the feed holds, the
  // half is not over, and no FINISHED at-bat waits there. A finished at-bat at
  // the feed's end (the third out before the next half starts) is a seal like
  // any other: holding it back would also make the wait's length tell how it
  // ended. A finished half never reads as the edge.
  const atEnd = stepInfo.nextCount >= stepInfo.total && !stepInfo.halfOver
  return atEnd && (frontier == null || frontier.live) ? 'edge' : 'sealed'
}

const named = (b) => (b?.last ? `${b.jersey ? `#${b.jersey} ` : ''}${b.last}` : '')

// { lineA, situation, label } for one state. `moves` is runnerMoves for the
// newest box; `lineupPosted` is false in a minor-league game with no lineup.
// For `edge`, lineA is '' and the caller builds it with liveLine, because that
// line carries a clock.
export function barLines({ state, view, stepInfo, flip, moves, lineupPosted = true }) {
  if (state === 'loading') return { lineA: '', situation: '', label: 'Loading' }
  if (state === 'handoff') {
    const over = { inning: flip.inning, half: stepInfo.half === 'bottom' ? 'top' : 'bottom' }
    return {
      lineA: `${halfLabel(over)} is over. Rule it off.`,
      situation: totalsText(halfTotals(view, over.inning, over.half)),
      label: `Turn to ${flip.label}`,
    }
  }
  const now = situationText(situation(view, stepInfo.inning, stepInfo.half))
  if (state === 'edge') return { lineA: '', situation: now, label: 'Waiting for the play' }

  const batter = view?.grid?.frontier?.batter
  const label = batter?.last ? `Unwrap ${named(batter)}` : 'Unwrap the next at-bat'
  const words = playWords(halfCards(view, stepInfo.inning).at(-1))
  const lineA = words
    ? `${words.text} ${movesText(moves)}`.trim()
    : batter?.last
      ? `Leading off: ${named(batter)}.`
      : lineupPosted
        ? ''
        : 'Lineup not posted yet. Names fill in as they bat.'
  return { lineA, situation: now, label }
}

// The live edge's line A. A look under five seconds ago is "just now": the
// reader pressed Refresh and nothing came. `name` is '' for a batter with no
// name (minor league) and null when the feed holds no next at-bat at all.
export function liveLine(name, now, checkedAt) {
  const who = name == null ? 'Waiting for the next batter' : name ? `${name} is batting` : 'A batter is up'
  if (checkedAt == null) return who
  const s = Math.max(0, Math.round((now - checkedAt) / 1000))
  if (s < 5) return 'Checked just now · nothing new yet'
  return `${who} · checked ${s < 60 ? `${s} s` : `${Math.floor(s / 60)} min`} ago`
}
