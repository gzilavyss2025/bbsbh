// A club-season's games for manager records, and the date a mid-season change
// fell on (#2761). gen-manager-history.mjs tallies records from teamSeasonGames;
// scripts/research/find-manager-split.mjs uses findSplit to turn a cited
// source's outgoing W-L into a seed transitionDate. The running record reaches
// a given W-L at exactly one game (each game adds one to W+L), so the answer is
// never a guess: either one clean date, or a status saying why a person has to
// look.

// A seed entry -> [{ managerId, from, to }] in game order; `from` is inclusive and
// `to` exclusive (null = open). An entry is `transitions: [{ date, outgoingManagerId,
// incomingManagerId }]`, or the single-change shorthand { transitionDate,
// outgoingManagerId, incomingManagerId } (one transition). An entry with neither,
// `{ teamId, season, noRecord: [id] }`, credits the whole season to the one feed
// manager (`feedIds`) not in `noRecord`; `noRecord` ids get no record.
export function seedSegments(entry, feedIds = []) {
  if (!entry.transitions && !entry.transitionDate) {
    return [{ managerId: feedIds.find((id) => !entry.noRecord?.includes(id)), from: null, to: null }]
  }
  const ts = entry.transitions ?? [{ date: entry.transitionDate, ...entry }]
  return [
    { managerId: ts[0].outgoingManagerId, from: null, to: ts[0].date },
    ...ts.map((t, i) => ({ managerId: t.incomingManagerId, from: t.date, to: ts[i + 1]?.date ?? null })),
  ]
}

// games + seedSegments output -> Map managerId -> { record, transitionDate }. A
// manager with two segments (a return stint) gets the SUM of them; transitionDate
// stays the first segment's: the date they took over, or for the season's first
// manager the date they left.
export function segmentRecords(games, segments) {
  const out = new Map()
  for (const { managerId, from, to } of segments) {
    const t = tally(games.filter((g) => (from === null || g.date >= from) && (to === null || g.date < to)))
    const prev = out.get(managerId)
    out.set(managerId, prev
      ? { ...prev, record: { w: prev.record.w + t.w, l: prev.record.l + t.l } }
      : { record: t, transitionDate: from ?? to })
  }
  return out
}

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

// Every manager's { w, l } in order -> the change date between each pair. Each
// date comes from findSplit on the games left after the last change; the last
// manager's record must match what remains. A failure is findSplit's status plus
// `at`, the 0-based manager whose record did not hold.
export function findSplits(games, records) {
  const dates = []
  let rest = games
  for (let k = 0; k < records.length - 1; k++) {
    const r = findSplit(rest, records[k], k === records.length - 2 ? records[k + 1] : null)
    if (r.status !== 'ok') return { ...r, at: k }
    dates.push(r.transitionDate)
    rest = rest.filter((x) => x.date >= r.transitionDate)
  }
  return { status: 'ok', dates }
}

// Order A, B, A: A's combined record `a` and B's record `b` -> the two change
// dates, where B's games (from the first date up to, not including, the second)
// are `b` and A's two stretches add up to `a`. Several pairs can fit; then
// { status: 'ambiguous', candidates } and the caller must not pick one.
export function findReturn(games, a, b) {
  const dates = [...new Set(games.map((g) => g.date))].sort()
  // before[k] = tally of games dated before dates[k]
  const before = dates.map((d) => tally(games.filter((g) => g.date < d)))
  const all = tally(games)
  const candidates = []
  // A needs a game on each side, so the first date is never a change date.
  for (let i = 1; i < dates.length; i++) {
    for (let j = i + 1; j < dates.length; j++) {
      if (before[j].w - before[i].w !== b.w || before[j].l - before[i].l !== b.l) continue
      if (all.w - b.w === a.w && all.l - b.l === a.l) candidates.push([dates[i], dates[j]])
    }
  }
  if (candidates.length === 0) return { status: 'no-match', season: all }
  if (candidates.length > 1) return { status: 'ambiguous', candidates }
  return { status: 'ok', dates: candidates[0] }
}

// Queue managers [{ id, name }] and the names a source lists, in order -> the
// ids in that order (an id repeats for a return stint), or { status }:
// 'count-mismatch' (the names do not cover every queue manager), 'name-not-matched'
// (a name picks out zero or several).
export function pickOrder(managers, names) {
  const plain = (x) => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const ids = []
  for (const n of names) {
    const hits = managers.filter((m) => plain(m.name).includes(plain(n)))
    if (hits.length !== 1) return { status: 'name-not-matched' }
    ids.push(hits[0].id)
  }
  return new Set(ids).size === managers.length ? { ids } : { status: 'count-mismatch' }
}

// Two queue managers [{ id, name }] and the outgoing manager's name (or a part
// of it) -> the seed's two ids, or null when the name doesn't pick out exactly
// one of exactly two managers.
export function pickManagers(managers, outgoingName) {
  if (managers.length !== 2) return null
  const plain = (x) => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const needle = plain(outgoingName)
  const hits = managers.filter((m) => plain(m.name).includes(needle))
  if (hits.length !== 1) return null
  const other = managers.find((m) => m !== hits[0])
  return { outgoingManagerId: hits[0].id, incomingManagerId: other.id }
}

// '7-18' -> { w: 7, l: 18 }, or null.
export function parseRecord(s) {
  const m = /^(\d+)-(\d+)$/.exec(s ?? '')
  return m ? { w: Number(m[1]), l: Number(m[2]) } : null
}

// (personId:teamId:season) -> that person's MANAGER-job stint, for attaching a record. Indexing
// every stint let a later coach stint of the same season (a bench or hitting coach who then took
// over) overwrite the manager one, so the record landed on the coach row and the franchise ledger
// and manager page, which read manager jobs only, showed no W-L (#2958).
export function managerStintIndex(byPersonId, managerJobIds) {
  const index = new Map()
  for (const [personId, stints] of byPersonId) {
    for (const stint of stints) {
      if (managerJobIds.has(stint.jobId)) index.set(`${personId}:${stint.teamId}:${stint.season}`, stint)
    }
  }
  return index
}

// A person with two manager-job stints in one club-season (a bench coach named interim carries
// 'MNGR' and 'NTRM') keeps the one holding the record (else the first); the bare twin would
// read as a shared season with no W-L on the manager page (#2958 review). Mutates byPersonId.
export function collapseManagerStints(byPersonId, managerJobIds) {
  for (const [personId, stints] of byPersonId) {
    const keep = new Map()
    for (const s of stints) {
      if (!managerJobIds.has(s.jobId)) continue
      const k = `${s.teamId}:${s.season}`
      const prev = keep.get(k)
      if (!prev || (!prev.record && s.record)) keep.set(k, s)
    }
    byPersonId.set(personId, stints.filter((s) => !managerJobIds.has(s.jobId) || keep.get(`${s.teamId}:${s.season}`) === s))
  }
}
