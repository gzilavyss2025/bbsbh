// The primer's small bracket: the two LCS feed the World Series. Three boxes,
// AL first, and one connector per LCS (ADR-0087, 2026-10-08 addendum). Reads
// only the derived bracket (docs/api/postseason.md), which already heads into
// the cutoff, so nothing here can hold today's result.
import { recordLine } from '../../../api/postseason/text.js'

// A foot line: the score when decided, today's game, or "Heading in" once both
// clubs are known. A World Series still waiting on a club has no foot.
function footOf(series) {
  if (series.decided) return recordLine(series)
  if (series.playsOnCutoff) return `Today · Game ${series.cutoffGame.gameNumber}`
  return series.slots.every((slot) => slot.club) ? 'Heading in' : ''
}

function boxOf(name, series) {
  return {
    name,
    winsNeeded: series.winsNeeded,
    decided: series.decided,
    today: series.playsOnCutoff,
    foot: footOf(series),
    // A slot with no club stays `club: null`: the box draws a blank line.
    rows: series.slots.map((slot) => ({
      club: slot.club,
      wins: slot.wins,
      eliminated: Boolean(slot.club && series.eliminated?.id === slot.club.id),
    })),
  }
}

export function bracketNow(bracket) {
  const al = bracket?.leagues?.AL?.lcs
  const nl = bracket?.leagues?.NL?.lcs
  const ws = bracket?.worldSeries
  if (!al || !nl || !ws) return null
  return {
    boxes: [boxOf('ALCS', al), boxOf('NLCS', nl), boxOf('World Series', ws)],
    links: [
      { league: 'AL', inked: al.decided },
      { league: 'NL', inked: nl.decided },
    ],
  }
}
