// Pure: the numbers the wsSeriesOdds notes quote, from public/data/world-series/series.json
// (contract.md section 3). One row per fact, dated when the fact was settled, so
// lastBefore's strict date cut is the only gate. A tie counts for nobody.
import { lastBefore } from './lastBefore.js'

// Wins by club after each game, as [{ [club]: wins }] (index i = after game i + 1).
function walk(series) {
  const wins = {}
  return series.games.map((g) => {
    if (!g.tie) {
      const w = g.homeRuns > g.awayRuns ? g.home : g.away
      wins[w] = (wins[w] ?? 0) + 1
    }
    return { ...wins }
  })
}

function rowsOf(history) {
  const rows = []
  for (const s of history?.series ?? []) {
    const end = s.games.at(-1).date
    const after = walk(s)
    const decided = (i) => !s.games[i].tie
    const winOf = (g) => (g.homeRuns > g.awayRuns ? g.home : g.away)
    const base = { season: s.season, winsNeeded: s.winsNeeded, names: s.names }
    rows.push({ ...base, tag: 'final', date: end, clubs: s.clubs, winner: s.winner })
    if (decided(0)) rows.push({ ...base, tag: 'game1', date: end, won: winOf(s.games[0]) === s.winner })
    if (s.games.length > 1 && decided(0) && decided(1) && winOf(s.games[0]) === winOf(s.games[1])) {
      rows.push({ ...base, tag: 'lead20', date: end, won: winOf(s.games[0]) === s.winner })
    }
    const wn = s.winsNeeded
    const hit = after.findIndex((w) => Object.values(w).includes(wn - 1) && Object.values(w).includes(wn - 3) && Object.keys(w).length === 2)
    if (hit >= 0) {
      const trailer = Object.keys(after[hit]).find((c) => after[hit][c] === wn - 3)
      rows.push({ ...base, tag: 'trail31', date: end, winner: s.winner, won: Number(trailer) === s.winner })
    }
    // Winner-take-all: a decided game when both clubs already had winsNeeded - 1.
    s.games.forEach((g, i) => {
      const before = i ? after[i - 1] : {}
      const [a, h] = [before[g.away] ?? 0, before[g.home] ?? 0]
      if (!g.tie && a === wn - 1 && h === wn - 1) {
        rows.push({ ...base, tag: 'wta', date: g.date, homeWon: winOf(g) === g.home, neutral: s.season === 2020 })
      }
    })
  }
  return rows
}

// A club's nickname in the season of that row, or null (an older file has no names).
const nameIn = (row, club) => row?.names?.[club] ?? null

const record = (rows) => {
  const w = rows.filter((r) => r.won).length
  return { w, l: rows.length - w }
}

export function seriesOdds(history, before) {
  const rows = rowsOf(history)
  const at = (tag) => lastBefore(rows, { before, tag })
  const trail = at('trail31')
  const wta = at('wta')
  const home = wta.filter((r) => !r.neutral)
  let roadStreak = 0
  for (const r of home) {
    if (r.homeWon) break
    roadStreak += 1
  }
  const lastWin = trail.find((r) => r.won)
  return {
    // The Series length of the latest finished Series: what "a 3-1 lead" means now.
    winsNeeded: at('final')[0]?.winsNeeded ?? null,
    game1: record(at('game1')),
    lead20: record(at('lead20')),
    trail31: { ...record(trail), last: lastWin?.season ?? null, lastClub: lastWin?.winner ?? null, lastName: nameIn(lastWin, lastWin?.winner) },
    wta: {
      home: { w: home.filter((r) => r.homeWon).length, l: home.filter((r) => !r.homeWon).length },
      roadStreak,
      last: wta[0]?.season ?? null,
    },
  }
}

export function clubFacts(history, before, ...clubs) {
  const finals = lastBefore(rowsOf(history), { before, tag: 'final' })
  const lastRow = (c) => finals.find((r) => r.clubs.includes(c))
  const meeting = finals.find((r) => clubs.every((c) => r.clubs.includes(c)))
  const prev = Number(before.slice(0, 4)) - 1
  const champion = finals.find((r) => r.season === prev)?.winner
  return {
    champion: clubs.includes(champion) ? champion : null,
    lastMeeting: meeting?.season ?? null,
    meetingWinner: meeting?.winner ?? null,
    meetingWinnerName: nameIn(meeting, meeting?.winner),
    lastSeen: Object.fromEntries(clubs.map((c) => [c, lastRow(c)?.season ?? null])),
    lastOpponentName: Object.fromEntries(clubs.map((c) => [c, nameIn(lastRow(c), lastRow(c)?.clubs.find((x) => x !== c))])),
  }
}
