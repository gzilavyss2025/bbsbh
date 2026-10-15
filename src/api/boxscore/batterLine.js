import { computeBatterLine, preGameAvg } from '../boxscore.js'

// The line a due-up card prints under a batter: "H-AB" once he has an at-bat
// (or a hit) in the revealed halves, else his average entering the game
// (".228"), else "—" when the record has no such player. One rule for focus
// mode's two due-up cards (DueUpConsole, DueUpNextCard). Same cutoff footing as
// computeBatterLine: `revealedThrough` is the hard boundary.
export function batterLineText(feed, side, id, revealedThrough) {
  const box = feed?.liveData?.boxscore?.teams?.[side]?.players?.[`ID${id}`]
  if (!box) return '—'
  const { hits, atBats } = computeBatterLine(feed, id, revealedThrough)
  if (atBats > 0 || hits > 0) return `${hits}-${atBats}`
  return preGameAvg(box)
}
