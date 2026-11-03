// The pure half of scripts/research/find-manager-split.mjs (#2761): given a club's
// regular-season games in schedule order and the outgoing manager's W-L from a
// cited source, find the date the incoming manager took over. The running
// record reaches a given W-L at exactly one game (each game adds one to W+L),
// so the answer is never a guess: either one clean date, or a status saying
// why a person has to look.

// games: [{ date: 'YYYY-MM-DD', won: boolean }], in schedule order (a
// doubleheader's games share a date). out/inc: { w, l }; inc is optional.
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
    const rest = games.slice(i + 1)
    const rw = rest.filter((g) => g.won).length
    const incoming = { w: rw, l: rest.length - rw }
    if (inc && (incoming.w !== inc.w || incoming.l !== inc.l)) {
      return { status: 'incoming-mismatch', transitionDate: next.date, out: { w, l }, incoming }
    }
    return { status: 'ok', transitionDate: next.date, out: { w, l }, incoming }
  }
  return { status: 'no-match', season: { w, l } }
}

// '7-18' -> { w: 7, l: 18 }, or null.
export function parseRecord(s) {
  const m = /^(\d+)-(\d+)$/.exec(s ?? '')
  return m ? { w: Number(m[1]), l: Number(m[2]) } : null
}
