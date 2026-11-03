// A club-season's games for manager records, and the date a mid-season change
// fell on (#2761). gen-manager-history.mjs tallies records from teamSeasonGames;
// scripts/research/find-manager-split.mjs uses findSplit to turn a cited
// source's outgoing W-L into a seed transitionDate. The running record reaches
// a given W-L at exactly one game (each game adds one to W+L), so the answer is
// never a guess: either one clean date, or a status saying why a person has to
// look.

// A /schedule?teamId=…&gameType=R response -> [{ date, won }], Final games with
// a winner only, in schedule order (a doubleheader's games share a date). A
// suspended game that was resumed is listed twice under one gamePk (Brewers
// 1975, gamePk 168575), so each gamePk counts once.
export function teamSeasonGames(schedule, teamId) {
  const seen = new Set()
  const out = []
  for (const g of (schedule.dates ?? []).flatMap((d) => d.games ?? [])) {
    if (g.status?.abstractGameState !== 'Final') continue
    const mySide = g.teams?.home?.team?.id === teamId ? g.teams?.home : g.teams?.away
    // A Postponed listing is also 'Final', with no winner, under the same gamePk
    // as the game played later (Brewers 2002, gamePk 11244): drop it before the
    // gamePk is marked seen, or the played game is the one dropped.
    if (typeof mySide?.isWinner !== 'boolean') continue
    if (g.gamePk != null) {
      if (seen.has(g.gamePk)) continue
      seen.add(g.gamePk)
    }
    out.push({ date: g.officialDate ?? (g.gameDate ?? '').slice(0, 10), won: mySide.isWinner })
  }
  return out
}

const tally = (games) => {
  const w = games.filter((g) => g.won).length
  return { w, l: games.length - w }
}

// games: teamSeasonGames output. out/inc: { w, l }; inc is optional.
export function findSplit(games, out, inc = null) {
  let w = 0
  let l = 0
  for (let i = 0; i < games.length; i++) {
    if (games[i].won) w++
    else l++
    if (w !== out.w || l !== out.l) continue
    const next = games[i + 1]
    if (!next) return { status: 'no-games-after', out: { w, l } }
    // The change fell between the two games of a doubleheader: a date split
    // would hand both games to one manager.
    if (next.date === games[i].date) return { status: 'doubleheader', date: next.date, out: { w, l } }
    const transitionDate = next.date
    // The generator splits by date, not by position: a game listed out of date
    // order would land on the other side there.
    const before = tally(games.filter((g) => g.date < transitionDate))
    if (before.w !== w || before.l !== l) return { status: 'date-order', transitionDate, out: before }
    const incoming = tally(games.filter((g) => g.date >= transitionDate))
    if (inc && (incoming.w !== inc.w || incoming.l !== inc.l)) {
      return { status: 'incoming-mismatch', transitionDate, out: { w, l }, incoming }
    }
    return { status: 'ok', transitionDate, out: { w, l }, incoming }
  }
  return { status: 'no-match', season: { w, l } }
}

// Two queue managers [{ id, name }] and the outgoing manager's name (or a part
// of it) -> the seed's two ids, or null when the name doesn't pick out exactly
// one of exactly two managers.
export function pickManagers(managers, outgoingName) {
  if (managers.length !== 2) return null
  const needle = outgoingName.toLowerCase()
  const hits = managers.filter((m) => m.name.toLowerCase().includes(needle))
  if (hits.length !== 1) return null
  const other = managers.find((m) => m !== hits[0])
  return { outgoingManagerId: hits[0].id, incomingManagerId: other.id }
}

// '7-18' -> { w: 7, l: 18 }, or null.
export function parseRecord(s) {
  const m = /^(\d+)-(\d+)$/.exec(s ?? '')
  return m ? { w: Number(m[1]), l: Number(m[2]) } : null
}
