// One-off, reproducible archive for the unlisted first-scorebook retrospective.
// Resolves the handwritten game list against MLB Stats API, then freezes the
// box-score and win-probability facts the page needs into one small static file.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { contextNeutralPoints, gameScore as pitcherGameScore } from '../src/api/performanceScore.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = `${ROOT}/public/data/first-scorebook.json`
const SCORE_FILE = `${ROOT}/public/data/game-score.json`
const API = 'https://statsapi.mlb.com'
const SEASON = 2026

const ENTRIES = [
  ['2026-05-18', 'Brewers', 9, 'Cubs', 3],
  ['2026-05-19', 'Brewers', 5, 'Cubs', 2],
  ['2026-05-20', 'Brewers', 5, 'Cubs', 0],
  ['2026-05-21', 'Columbus Clingstones', 4, 'Pensacola Blue Wahoos', 3],
  ['2026-05-22', 'Brewers', 5, 'Dodgers', 1],
  ['2026-05-23', 'Dodgers', 11, 'Brewers', 3],
  ['2026-05-26', 'Braves', 7, 'Red Sox', 6],
  ['2026-05-30', 'Cubs', 6, 'Cardinals', 1],
  ['2026-05-31', 'Brewers', 2, 'Astros', 0],
  ['2026-06-05', 'Brewers', 9, 'Rockies', 7],
  ['2026-06-06', 'Brewers', 7, 'Rockies', 1],
  ['2026-06-08', 'Brewers', 15, 'Athletics', 14],
  ['2026-06-10', 'Athletics', 4, 'Brewers', 3],
  ['2026-06-11', 'Mets', 5, 'Cardinals', 4],
  ['2026-06-12', 'Brewers', 6, 'Phillies', 0],
  ['2026-06-13', 'Phillies', 9, 'Brewers', 8],
  ['2026-06-14', 'Rangers', 6, 'Red Sox', 4],
  ['2026-06-16', 'Brewers', 2, 'Guardians', 1],
  ['2026-06-17', 'Brewers', 9, 'Guardians', 4],
  ['2026-06-18', 'Royals', 14, 'Cardinals', 6],
  ['2026-06-20', 'Braves', 4, 'Brewers', 3],
  ['2026-06-21', 'Brewers', 9, 'Braves', 4],
  ['2026-06-22', 'Brewers', 2, 'Reds', 1],
  ['2026-06-23', 'Brewers', 2, 'Reds', 0],
  ['2026-06-24', 'Brewers', 6, 'Reds', 5],
  ['2026-06-26', 'Brewers', 6, 'Cubs', 2],
  ['2026-06-27', 'Cubs', 8, 'Brewers', 2],
  ['2026-06-29', 'Brewers', 5, 'Reds', 3],
  ['2026-06-30', 'Brewers', 7, 'Reds', 2],
  ['2026-07-01', 'Brewers', 4, 'Reds', 2],
  ['2026-07-03', 'Brewers', 7, 'Diamondbacks', 4],
  ['2026-07-04', 'Diamondbacks', 4, 'Brewers', 3],
  ['2026-07-05', 'Brewers', 3, 'Diamondbacks', 2],
  ['2026-07-06', 'Brewers', 4, 'Cardinals', 3],
  ['2026-07-07', 'Brewers', 10, 'Cardinals', 2],
  ['2026-07-09', 'Brewers', 8, 'Cardinals', 4],
  ['2026-07-11', 'Pirates', 7, 'Brewers', 6],
  ['2026-07-11', 'Pirates', 3, 'Brewers', 2],
  ['2026-07-12', 'Rangers', 6, 'Astros', 5],
]

const tidy = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const teamMatches = (actual, wanted) => {
  const a = tidy(actual)
  const w = tidy(wanted)
  return a.includes(w) || w.includes(a) || (w === 'athletics' && a.includes('athletics'))
}
const fetchJson = async (path) => {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res.json()
}
const addStats = (into, stats) => {
  for (const [key, value] of Object.entries(stats ?? {})) {
    if (typeof value === 'number') into[key] = (into[key] ?? 0) + value
  }
}
const ipOuts = (ip) => {
  const [whole, part] = String(ip ?? '0.0').split('.')
  return (Number(whole) || 0) * 3 + (Number(part) || 0)
}
const lineForBatter = (s) => {
  const extras = []
  if (s.homeRuns) extras.push(`${s.homeRuns} HR`)
  if (s.doubles) extras.push(`${s.doubles} 2B`)
  if (s.triples) extras.push(`${s.triples} 3B`)
  if (s.rbi) extras.push(`${s.rbi} RBI`)
  if (s.runs) extras.push(`${s.runs} R`)
  if (s.stolenBases) extras.push(`${s.stolenBases} SB`)
  return `${s.hits ?? 0}-for-${s.atBats ?? 0}${extras.length ? `, ${extras.join(', ')}` : ''}`
}
const lineForPitcher = (s) => `${s.inningsPitched ?? '0.0'} IP, ${s.hits ?? 0} H, ${s.runs ?? 0} R, ${s.baseOnBalls ?? 0} BB, ${s.strikeOuts ?? 0} K`

// Bounded-concurrency map — statsapi starts failing a large chunk of requests
// once a few hundred are in flight at once, so a plain Promise.all(items.map)
// over a full season's worth of boxscore fetches isn't reliable.
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
  return results
}

// League-wide Game Score context for the book's pitching nuggets: every 2026
// MLB starting pitcher's Bill James Game Score, so a start in the scorebook
// can be placed against the whole season rather than just the other 31 in
// the book. Boxscore-only (not the full live feed) keeps ~1,500 fetches fast.
async function fetchLeagueStarterGameScores() {
  const asOf = new Date().toISOString().slice(0, 10)
  const schedule = await fetchJson(`/api/v1/schedule?sportId=1&startDate=${SEASON}-01-01&endDate=${asOf}&gameType=R`)
  const gamePks = (schedule.dates ?? [])
    .flatMap((d) => d.games ?? [])
    .filter((g) => g.status?.abstractGameState === 'Final')
    .map((g) => g.gamePk)
  const boxscores = await mapLimit(gamePks, 40, (gamePk) => fetchJson(`/api/v1/game/${gamePk}/boxscore`).catch(() => null))
  const scores = []
  for (const box of boxscores) {
    if (!box) continue
    for (const side of ['away', 'home']) {
      const starter = Object.values(box.teams?.[side]?.players ?? {}).find((bp) => bp.stats?.pitching?.gamesStarted === 1)
      if (starter) scores.push(Math.round(pitcherGameScore(starter.stats.pitching)))
    }
  }
  scores.sort((a, b) => a - b)
  return { season: SEASON, asOf, count: scores.length, scores }
}

async function main() {
  const localScores = JSON.parse(await readFile(SCORE_FILE, 'utf8')).scores ?? {}
  const dates = [...new Set(ENTRIES.map(([date]) => date))]
  const schedule = new Map()
  for (const date of dates) {
    const data = await fetchJson(`/api/v1/schedule?sportIds=1,12&date=${date}&hydrate=team,linescore`)
    schedule.set(date, (data.dates ?? []).flatMap((d) => d.games ?? []))
  }

  const resolved = ENTRIES.map(([date, winner, winnerScore, loser, loserScore]) => {
    const games = schedule.get(date) ?? []
    const match = games.find((g) => {
      const away = g.teams?.away
      const home = g.teams?.home
      const namesFit =
        (teamMatches(away?.team?.name, winner) && teamMatches(home?.team?.name, loser)) ||
        (teamMatches(home?.team?.name, winner) && teamMatches(away?.team?.name, loser))
      return namesFit && [away?.score, home?.score].includes(winnerScore) && [away?.score, home?.score].includes(loserScore)
    })
    if (!match) throw new Error(`Could not resolve ${date}: ${winner} ${winnerScore}, ${loser} ${loserScore}`)
    return { date, winner, winnerScore, loser, loserScore, gamePk: match.gamePk }
  })

  const [feeds, winProbs, leagueStarterGameScores] = await Promise.all([
    Promise.all(resolved.map((g) => fetchJson(`/api/v1.1/game/${g.gamePk}/feed/live`))),
    Promise.all(resolved.map((g) => fetchJson(`/api/v1/game/${g.gamePk}/winProbability`).catch(() => []))),
    fetchLeagueStarterGameScores(),
  ])
  const playerTotals = new Map()
  const performances = []
  const moments = []
  const teamRecords = new Map()
  const brewersStarts = []

  const games = resolved.map((listed, index) => {
    const feed = feeds[index]
    const gd = feed.gameData
    const box = feed.liveData.boxscore
    const line = feed.liveData.linescore
    const away = gd.teams.away
    const home = gd.teams.home
    const awayRuns = line.teams.away.runs
    const homeRuns = line.teams.home.runs
    const winnerId = awayRuns > homeRuns ? away.id : home.id
    for (const team of [away, home]) {
      const rec = teamRecords.get(team.id) ?? { id: team.id, name: team.clubName ?? team.name, abbreviation: team.abbreviation, wins: 0, losses: 0, games: 0 }
      rec.games += 1
      rec[team.id === winnerId ? 'wins' : 'losses'] += 1
      teamRecords.set(team.id, rec)
    }

    for (const side of ['away', 'home']) {
      const team = gd.teams[side]
      for (const bp of Object.values(box.teams[side].players ?? {})) {
        const batting = bp.stats?.batting ?? {}
        const pitching = bp.stats?.pitching ?? {}
        const appearedBatting = (batting.plateAppearances ?? 0) > 0
        const appearedPitching = (pitching.battersFaced ?? 0) > 0
        if (!appearedBatting && !appearedPitching) continue
        const id = bp.person.id
        const total = playerTotals.get(id) ?? { id, name: bp.person.fullName, teamId: team.id, team: team.abbreviation, games: new Set(), batting: {}, pitching: {} }
        total.games.add(listed.gamePk)
        addStats(total.batting, batting)
        addStats(total.pitching, pitching)
        if (appearedPitching) total.pitching._outs = (total.pitching._outs ?? 0) + ipOuts(pitching.inningsPitched)
        playerTotals.set(id, total)
        const score = contextNeutralPoints(bp.stats)
        if (appearedBatting) performances.push({ type: 'batting', score, gamePk: listed.gamePk, date: listed.date, name: bp.person.fullName, playerId: id, team: team.abbreviation, teamId: team.id, line: lineForBatter(batting) })
        if (appearedPitching) performances.push({ type: 'pitching', score, gamePk: listed.gamePk, date: listed.date, name: bp.person.fullName, playerId: id, team: team.abbreviation, teamId: team.id, line: lineForPitcher(pitching), pitcherGameScore: pitcherGameScore(pitching) })
      }
    }

    for (const side of ['away', 'home']) {
      const team = gd.teams[side]
      if (team.id !== 158) continue
      const starter = Object.values(box.teams[side].players ?? {}).find((bp) => bp.stats?.pitching?.gamesStarted === 1)
      if (!starter) continue
      const s = starter.stats.pitching
      const oppSide = side === 'away' ? 'home' : 'away'
      const opponent = gd.teams[oppSide]
      const teamRuns = side === 'away' ? awayRuns : homeRuns
      const oppRuns = side === 'away' ? homeRuns : awayRuns
      const decisionWinnerId = feed.liveData.decisions?.winner?.id
      const decisionLoserId = feed.liveData.decisions?.loser?.id
      const decision = starter.person.id === decisionWinnerId ? 'W' : starter.person.id === decisionLoserId ? 'L' : 'ND'
      brewersStarts.push({
        playerId: starter.person.id,
        name: starter.person.fullName,
        gamePk: listed.gamePk,
        date: listed.date,
        opponent: opponent.clubName ?? opponent.name,
        opponentId: opponent.id,
        opponentAbbr: opponent.abbreviation,
        ip: s.inningsPitched ?? '0.0',
        outs: ipOuts(s.inningsPitched),
        h: s.hits ?? 0,
        r: s.runs ?? 0,
        er: s.earnedRuns ?? 0,
        bb: s.baseOnBalls ?? 0,
        k: s.strikeOuts ?? 0,
        hr: s.homeRuns ?? 0,
        decision,
        teamRuns,
        oppRuns,
        teamWin: winnerId === 158,
        gameScore: pitcherGameScore(s),
        completeGame: (s.completeGames ?? 0) > 0,
        shutout: (s.shutouts ?? 0) > 0,
      })
    }

    const wp = winProbs[index] ?? []
    let prior = 50
    for (const play of wp) {
      const current = play.homeTeamWinProbability
      if (typeof current !== 'number') continue
      const swing = Math.abs(current - prior)
      if (swing >= 18 || (play.about?.isScoringPlay && (play.about?.inning ?? 0) >= 8)) {
        moments.push({ gamePk: listed.gamePk, date: listed.date, inning: play.about?.inning, half: play.about?.isTopInning ? 'Top' : 'Bottom', swing, description: play.result?.description ?? '', homeTeam: home.abbreviation })
      }
      prior = current
    }

    return {
      gamePk: listed.gamePk,
      date: listed.date,
      gameNumber: gd.game?.gameNumber ?? 1,
      sportId: away.sport?.id,
      venue: gd.venue?.name ?? '',
      innings: line.currentInning,
      away: { id: away.id, name: away.clubName ?? away.name, abbreviation: away.abbreviation, runs: awayRuns, hits: line.teams.away.hits, errors: line.teams.away.errors },
      home: { id: home.id, name: home.clubName ?? home.name, abbreviation: home.abbreviation, runs: homeRuns, hits: line.teams.home.hits, errors: line.teams.home.errors },
      winnerId,
      gameScore: localScores[listed.gamePk]?.score ?? null,
      decisions: {
        winner: feed.liveData.decisions?.winner?.fullName ?? '',
        loser: feed.liveData.decisions?.loser?.fullName ?? '',
        save: feed.liveData.decisions?.save?.fullName ?? '',
      },
    }
  })

  const players = [...playerTotals.values()].map((p) => {
    if (p.pitching._outs) {
      p.pitching.inningsPitched = `${Math.floor(p.pitching._outs / 3)}.${p.pitching._outs % 3}`
    }
    return { ...p, games: p.games.size }
  })
  const battingLeaders = players.filter((p) => (p.batting.atBats ?? 0) > 0).map((p) => ({ ...p, average: p.batting.hits / p.batting.atBats, ops: ((p.batting.hits + p.batting.baseOnBalls + p.batting.hitByPitch) / (p.batting.atBats + p.batting.baseOnBalls + p.batting.hitByPitch + p.batting.sacFlies)) + ((p.batting.hits + p.batting.doubles + 2 * p.batting.triples + 3 * p.batting.homeRuns) / p.batting.atBats) })).sort((a, b) => (b.batting.hits ?? 0) - (a.batting.hits ?? 0))
  const pitchingLeaders = players.filter((p) => (p.pitching._outs ?? 0) > 0).sort((a, b) => (b.pitching.strikeOuts ?? 0) - (a.pitching.strikeOuts ?? 0))
  const totalRuns = games.reduce((n, g) => n + g.away.runs + g.home.runs, 0)
  const teamRows = [...teamRecords.values()].sort((a, b) => b.games - a.games || b.wins - a.wins)
  const brewers = teamRows.find((t) => t.id === 158)
  const output = {
    generatedAt: new Date().toISOString(),
    title: 'My First Scorebook',
    subtitle: '39 games, scored by hand',
    dateRange: [games[0].date, games.at(-1).date],
    summary: {
      games: games.length,
      mlbGames: games.filter((g) => g.sportId === 1).length,
      milbGames: games.filter((g) => g.sportId !== 1).length,
      innings: games.reduce((n, g) => n + g.innings, 0),
      runs: totalRuns,
      averageRuns: totalRuns / games.length,
      oneRunGames: games.filter((g) => Math.abs(g.away.runs - g.home.runs) === 1).length,
      shutouts: games.filter((g) => g.away.runs === 0 || g.home.runs === 0).length,
      extraInningGames: games.filter((g) => g.innings > 9).length,
      brewers,
    },
    teamRecords: teamRows,
    games: games.sort((a, b) => a.date.localeCompare(b.date)),
    excitingGames: [...games].filter((g) => g.gameScore != null).sort((a, b) => b.gameScore - a.gameScore).slice(0, 8),
    performances: performances.sort((a, b) => b.score - a.score).slice(0, 16),
    moments: moments.filter((m) => m.description).sort((a, b) => b.swing - a.swing).slice(0, 12),
    battingLeaders: battingLeaders.slice(0, 12),
    pitchingLeaders: pitchingLeaders.slice(0, 12),
    brewersStarts: brewersStarts.sort((a, b) => a.date.localeCompare(b.date)),
    leagueStarterGameScores,
  }
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, `${JSON.stringify(output)}\n`)
  console.log(`Wrote ${OUT}: ${games.length} games, ${players.length} players, ${leagueStarterGameScores.count} league starts scored`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
