// Shared pitcher-game-log tally for gen-callouts.mjs's starterRecords family
// (see that file's pitcherEnrich). Pulled out for the same reason
// dedupeRosterEntries lives in roster.mjs: a generator is a top-level script —
// importing one RUNS it — so a helper worth unit-testing can't stay inline.
//
// A pitcher who changes clubs mid-season (traded, optioned, recalled) keeps
// his whole season's rows in one gameLog — the API doesn't split it by team.
// `rows` here is newest-first splits from that gameLog; every TEAM-attributed
// tally (home/road decision split, the 6+ IP record, the all-starts record)
// must count only the starts he actually made for `teamId`, the club he's
// currently rostered with — otherwise a new club inherits a rival's record
// (regression: Brandon Sproat's Nashville Sounds debut showed "Nashville
// Sounds are 5-5 in his road starts" — a Milwaukee Brewers record, mislabeled
// under the club he'd only just joined). `tenK` stays season-wide: it's a
// personal count, never attributed to a club by name in the note text.
export function tallyStarterRecord(rows, teamId) {
  let homeW = 0, homeL = 0, awayW = 0, awayL = 0
  let sixIpW = 0, sixIpL = 0
  let tenK = 0
  for (const s of rows ?? []) {
    const st = s.stat ?? {}
    if (Number(st.gamesStarted) === 0) continue // relief outing — not a "start" for any of these
    if (Number(st.strikeOuts) >= 10) tenK++
    if (s.team?.id !== teamId) continue
    const won = s.isWin === true
    if (s.isHome) won ? homeW++ : homeL++
    else won ? awayW++ : awayL++
    const [whole, frac = '0'] = String(st.inningsPitched ?? '0').split('.')
    const outs = (Number(whole) || 0) * 3 + (Number(frac[0]) || 0)
    if (outs >= 18) won ? sixIpW++ : sixIpL++
  }
  return { homeW, homeL, awayW, awayL, sixIpW, sixIpL, tenK }
}
