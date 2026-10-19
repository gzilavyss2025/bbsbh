// The World Series scouting report's regular-season meetings (#2316). Pure: it picks
// from schedule rows and reads nothing else.
//
// THE CUTOFF is the day before the slate date (ADR-0087, ADR-0088): a row dated on
// the slate date or later never comes back, whatever the caller handed in. The slate
// date is the one the page already holds (`slateToday`, ADR-0117), not a clock read here.
// A row must have an official date, so an undated row is dropped, not guessed.

// rows: schedule games as the API sends them (gamePk, gameType, officialDate,
// status.abstractGameState, teams.{away,home}.team.id). Oldest first.
export function selectMeetings(rows, { clubA, clubB, slateDate }) {
  if (clubA === clubB) return []
  const clubs = new Set([clubA, clubB])
  return (rows ?? [])
    .filter(
      (g) =>
        g?.gameType === 'R' &&
        g.status?.abstractGameState === 'Final' &&
        g.officialDate < slateDate &&
        clubs.has(g.teams?.away?.team?.id) &&
        clubs.has(g.teams?.home?.team?.id),
    )
    .sort((a, b) => a.officialDate.localeCompare(b.officialDate) || a.gamePk - b.gamePk)
}
