// The series primer's ribbon head and chip, heading into the cutoff date
// (ADR-0087). The head is recordLine's words, except "Best of 7" before Game 1.
// The chip names the club one loss from going out: "MIL facing elimination".
// A winner-take-all game has no chip, because both clubs face elimination.
import { isDecidingGame, isElimination } from '../bracketDisplay.js'
import { bestOfLine, recordLine } from '../../../api/postseason/text.js'

export function seriesStatus(series) {
  const head = series.gamesPlayed === 0 ? bestOfLine(series) : recordLine(series)
  if (!isElimination(series) || isDecidingGame(series)) return { head, chip: null }
  const [a, b] = series.slots
  return { head, chip: `${(a.wins < b.wins ? a : b).club.abbreviation} facing elimination` }
}
