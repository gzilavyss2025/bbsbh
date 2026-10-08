// The primer's small bracket: the two LCS feed the World Series. Three boxes,
// AL first, and one connector per LCS (ADR-0087, 2026-10-08 addendum). Reads
// only the derived bracket (docs/api/postseason.md), which already heads into
// the cutoff, so nothing here can hold today's result.
import { recordLine, roundTitle } from '../../../api/postseason/text.js'
import { feederSeries } from '../bracketDisplay.js'

// A foot line: the score when decided, today's game, or "Heading in" once both
// clubs are known. A World Series still waiting on a club has no foot.
function footOf(series) {
  if (series.decided) return recordLine(series)
  if (series.playsOnCutoff) return `Today · Game ${series.cutoffGame.gameNumber}`
  return series.slots.every((slot) => slot.club) ? 'Heading in' : ''
}

function boxOf(name, series, bracket) {
  return {
    name,
    league: series.league,
    winsNeeded: series.winsNeeded,
    decided: series.decided,
    today: series.playsOnCutoff,
    foot: footOf(series),
    // A slot with no club stays `club: null`: the box draws a blank line.
    rows: series.slots.map((slot) => ({
      club: slot.club,
      wins: slot.wins,
      eliminated: Boolean(slot.club && series.eliminated?.id === slot.club.id),
      // The series a blank slot waits on, for its screen-reader label.
      feeder: !slot.club && feederSeries(bracket, slot.from) ? roundTitle(feederSeries(bracket, slot.from)) : null,
    })),
  }
}

export function bracketNow(bracket) {
  const al = bracket?.leagues?.AL?.lcs
  const nl = bracket?.leagues?.NL?.lcs
  const ws = bracket?.worldSeries
  if (!al || !nl || !ws) return null
  return {
    boxes: [boxOf('ALCS', al, bracket), boxOf('NLCS', nl, bracket), boxOf('World Series', ws, bracket)],
    links: [
      { league: 'AL', inked: al.decided },
      { league: 'NL', inked: nl.decided },
    ],
  }
}

// The small bracket on a Wild Card or Division Series day: the round being played
// (AL series first, then NL) and the round it feeds, one connector per series to
// the box its winner goes to. `round` is 'wildcard' or 'division'. `null` when
// the bracket cannot say where a series goes.
//   -> { from: Box[], to: Box[], links: [{ from, to, inked }] }  (indexes into from/to)
export function roundFeed(bracket, round) {
  const from = ['AL', 'NL'].flatMap((league) => bracket?.leagues?.[league]?.[round] ?? [])
  const to = [...new Set(from.map((s) => s.feeds))].map((key) => feederSeries(bracket, key))
  if (!from.length || to.some((s) => !s)) return null
  return {
    from: from.map((s) => boxOf(roundTitle(s), s, bracket)),
    to: to.map((s) => boxOf(roundTitle(s), s, bracket)),
    links: from.map((s) => ({ from: from.indexOf(s), to: to.findIndex((t) => t.key === s.feeds), inked: s.decided })),
  }
}
