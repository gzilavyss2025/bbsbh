// The #22 sheet's three decision lines — WP, LP, SV — each written the way a
// box score writes them: the pitcher's name, then his figure in parentheses.
// Split off scorecardGame.js at the file cap (ADR-0038).
//
// SPOILER FOOTING: reveal-gated, and the gate is the CALLER's. `done` is
// scorecardScoreboard's own "the game is Final AND every played half is at or
// under `through`" — the same flag the FINAL block waits on — and this returns
// nothing but empty strings until it is true. Nothing here decides for itself
// whether the game may be told; it is handed that answer. Which pitcher won is
// as score-revealing as the score, so it sits behind exactly the same gate.
//
// Field paths verified against two real games:
//  • gamePk 823035 (2026-07-07 MIL@STL g2) — liveData.decisions carries
//    winner/loser/save as { id, fullName }, and is absent until the game is
//    Final. That feed's trimmed test fixture keeps no boxscore seasonStats, so
//    it is also the case that proves a missing line degrades to a bare name.
//  • gamePk 823747 (2026-08-20 SEA@MIL) — the parentheticals themselves:
//    winner 694477 -> seasonStats.pitching { wins: 7, losses: 4 } reads "7-4",
//    save 656730 -> { saves: 23 } reads "23". Season stats on a boxscore
//    player INCLUDE tonight's game, so the figure reads the way it will read
//    in the morning paper.
const EMPTY = { wp: '', wpNote: '', lp: '', lpNote: '', sv: '', svNote: '' }

// A pitcher's season pitching line off the boxscore. He is on exactly one of
// the two clubs and the caller has no reason to know which, so both are tried.
function seasonPitching(feed, person) {
  if (person?.id == null) return null
  const key = `ID${person.id}`
  const teams = feed?.liveData?.boxscore?.teams ?? {}
  const box = teams.away?.players?.[key] ?? teams.home?.players?.[key]
  return box?.seasonStats?.pitching ?? null
}

// "7-4", and only when BOTH halves are really there. A 0-0 record is a
// legitimate record — a pitcher can win his first decision of the year — so
// the guard is on the fields existing, never on them being truthy.
function record(feed, person) {
  const st = seasonPitching(feed, person)
  if (!st || st.wins == null || st.losses == null) return ''
  return `${st.wins}-${st.losses}`
}

function saves(feed, person) {
  const st = seasonPitching(feed, person)
  return st?.saves == null ? '' : String(st.saves)
}

// The three lines. A missing figure degrades to '' rather than to a zero, and
// the screen builds the parentheses only around a figure that exists — so an
// unknown record prints a bare name, never an empty pair of brackets.
export function decisionLines(feed, done) {
  if (!done) return { ...EMPTY }
  const d = feed?.liveData?.decisions ?? {}
  return {
    wp: d.winner?.fullName ?? '',
    wpNote: d.winner ? record(feed, d.winner) : '',
    lp: d.loser?.fullName ?? '',
    lpNote: d.loser ? record(feed, d.loser) : '',
    sv: d.save?.fullName ?? '',
    svNote: d.save ? saves(feed, d.save) : '',
  }
}
