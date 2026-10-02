import { useState } from 'react'
import { barLines, barState } from '../../../lib/scorecard/bar.js'
import { carryBoxes } from '../../../lib/scorecard/carry.js'
import { halfCards } from '../../../lib/scorecard/situation.js'
import { runnerMoves } from '../../../lib/scorecard/words.js'

// What the lens bar says, from the scorecard page's own clamped state
// (lib/scorecard/bar.js holds the rules and the spoiler footing). Returns null
// while lens mode is off.
//
// The runner moves diff TWO renders of the sheet, the same idea as the page's
// ink-in set: `prev` is the view as it stood before the newest box opened. It
// moves only when the number of open boxes does, so a poll that rebuilds the
// view with nothing new leaves line A as the last tap wrote it. State adjusted
// during render, as ScorecardPage's own ink-in diff does.
export function useLensBar({ on, view, side, stepInfo, flip, loading }) {
  const key = `${side}:${view?.grid?.slots?.reduce((n, s) => n + Object.keys(s.cells).length, 0)}`
  const [seen, setSeen] = useState({ view: null, key: '', prev: null })
  if (seen.view !== view) {
    setSeen({ view, key, prev: seen.key === key ? seen.prev : seen.view })
  }
  if (!on || !view || !stepInfo) return null

  const state = barState({ loading, stepInfo, flip, frontier: view.grid?.frontier })
  const inning = flip ? flip.inning : stepInfo.inning
  const cards = halfCards(view, inning)
  const moves =
    seen.prev?.teamId === view.teamId ? runnerMoves(halfCards(seen.prev, inning), cards) : []
  return {
    state,
    lines: barLines({
      state,
      view,
      stepInfo,
      flip,
      moves,
      lineupPosted: view.lineup.some((r) => r.name),
    }),
    batter: view.grid?.frontier ? (view.grid.frontier.batter?.last ?? '') : null,
    lastOpened: cards.at(-1)?.atBatIndex ?? null,
    // The boxes the carry strip holds; none at a handoff, where the frame is
    // on the leadoff box of the page the reader is about to turn to.
    carry: state === 'sealed' || state === 'edge' ? carryBoxes(view, inning, stepInfo.half) : [],
  }
}
