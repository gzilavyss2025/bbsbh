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
const EMPTY = {
  wp: '', wpId: null, wpNote: '',
  lp: '', lpId: null, lpNote: '',
  sv: '', svId: null, svNote: '',
}

// SURNAME ONLY, the way a scorer writes a pitcher onto this sheet and the way
// the pitcher table above it already does ("Gasser, Robert" -> "Gasser"). The
// line has room for a first name and is worse for carrying one: three decisions
// read as three names, and it is the surname that identifies the man on a
// scorecard. Read off the feed's own name parts rather than split from the full
// name, so "Jr." and two-part surnames survive; the split is the fallback for a
// lean feed that carries no player record for him.
function surname(feed, person) {
  if (!person) return ''
  const rec = feed?.gameData?.players?.[`ID${person.id}`]
  const known = rec?.useLastName || rec?.lastName
  if (known) return known
  const full = person.fullName ?? ''
  return full.slice(full.lastIndexOf(' ') + 1) || full
}

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

// The three lines, each a surname and its figure — plus the man's id, so the
// screen can hang his hover card off the name like every other player name on
// the sheet. A missing figure degrades to '' rather than to a zero, and the
// screen builds the parentheses only around a figure that exists, so an unknown
// record prints a bare name and never an empty pair of brackets.
export function decisionLines(feed, done) {
  if (!done) return { ...EMPTY }
  const d = feed?.liveData?.decisions ?? {}
  return {
    wp: surname(feed, d.winner),
    wpId: d.winner?.id ?? null,
    wpNote: d.winner ? record(feed, d.winner) : '',
    lp: surname(feed, d.loser),
    lpId: d.loser?.id ?? null,
    lpNote: d.loser ? record(feed, d.loser) : '',
    sv: surname(feed, d.save),
    svId: d.save?.id ?? null,
    svNote: d.save ? saves(feed, d.save) : '',
  }
}
