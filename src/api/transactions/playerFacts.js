// PLAYER FACTS — the background a wire story's player brings with him: age,
// the season's line by club, the career line, every big-league club he has
// played for, how he reached the club he is with, and his contract. Read for
// the offseason ledger's fact lines (transactions/templates.js decides which
// facts a move shows). Spoiler-free: season and career stats, never a score.
//
// One /people call carries all of it: the stats hydrate, plus the transactions
// hydrate for how he joined. The contract is the nightly Cot's join
// (api/person/contracts.js). Field paths checked on Codi Heuer (676051) and
// Luis Robert Jr. (673357), 2026-11-02.
import { getJson } from '../statsapi.js'
import { fetchPlayerContract } from '../person/contracts.js'
import { fetchTopProspects } from '../prospects.js'
import { FULL_SEASON } from './templates.js'

const HYDRATE = 'transactions,draft,stats(group=[hitting,pitching],type=[yearByYear,career],sportId=1)'
// The moves that bring a player to a club, and the words for each.
const ARRIVALS = { TR: 'trade', SFA: 'free agent', SGN: 'signing', CLW: 'waiver claim', DR: 'draft', PUR: 'purchase', R5: 'Rule 5 draft' }

// The line a reader expects for the position: a pitcher's ERA, a hitter's average.
function shapeLine(stat, pitcher) {
  if (!stat) return null
  return pitcher
    ? {
        games: stat.gamesPitched ?? stat.gamesPlayed ?? 0,
        starts: stat.gamesStarted ?? 0,
        era: stat.era ?? null,
        ip: stat.inningsPitched ?? null,
        k: stat.strikeOuts ?? 0,
        whip: stat.whip ?? null,
        saves: stat.saves ?? 0,
      }
    : {
        games: stat.gamesPlayed ?? 0,
        pa: stat.plateAppearances ?? 0,
        avg: stat.avg ?? null,
        obp: stat.obp ?? null,
        slg: stat.slg ?? null,
        hr: stat.homeRuns ?? 0,
        rbi: stat.rbi ?? 0,
      }
}

// The raw /people record, its contract row and the season the move speaks
// for, shaped into the facts the templates read. Pure, so it is tested on
// captured records (test/wire-templates.test.js).
// The levels a minor-league line names, by the feed's sport abbreviation.
const LEVELS = { AAA: 'Triple-A', AA: 'Double-A', 'A+': 'High-A', A: 'Single-A', ROK: 'rookie ball' }

// His season in the minors, from the milb_all stats read: the whole season
// (the read's own "Minors" total row), the levels he pitched or hit at,
// lowest first, and the club when there was only one.
const LEVEL_ORDER = ['rookie ball', 'Single-A', 'High-A', 'Double-A', 'Triple-A']
export function shapeMinors(splits, pitcher) {
  const rows = (splits ?? []).filter((s) => s.team?.id)
  if (!rows.length) return null
  // Team-less rows are a subtotal per level plus one "Minors" total; a
  // one-level season has only its level's.
  const loose = (splits ?? []).filter((s) => !s.team)
  const total = loose.find((s) => s.sport?.abbreviation === 'Minors') ?? (loose.length === 1 ? loose[0] : rows[0])
  const levels = [...new Set(rows.map((s) => LEVELS[s.sport?.abbreviation]).filter(Boolean))].sort(
    (a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b),
  )
  return {
    team: rows.length === 1 ? rows[0].team.name : null,
    level: levels.length ? levels : ['the minors'],
    line: shapeLine(total.stat, pitcher),
  }
}

// His rank on the weekly prospect lists: MLB's top 100, else his club's own
// list. The club is the one that ranked him, which on a trade is the club that
// gave him up.
const arrivalOf = (t) => ({ how: ARRIVALS[t.typeCode], date: t.date, teamId: t.toTeam.id, fromTeamId: t.fromTeam?.id ?? null })

export function prospectOf(snapshot, playerId) {
  const top = (snapshot?.players ?? []).find((p) => p.playerId === playerId)
  if (top) return { rank: top.rank, teamId: null }
  const org = (snapshot?.orgProspects ?? []).find((p) => p.playerId === playerId)
  return org ? { rank: org.orgRank, teamId: org.teamId } : null
}

export function shapeFacts(person, { contract = null, season, teamId = null, minors = null, prospects = null } = {}) {
  if (!person) return null
  const pitcher = person.primaryPosition?.code === '1'
  const group = pitcher ? 'pitching' : 'hitting'
  const stats = (person.stats ?? []).filter((s) => s.group?.displayName === group)
  const yearly = (stats.find((s) => s.type?.displayName === 'yearByYear')?.splits ?? [])
    .filter((s) => s.sport?.id == null || s.sport.id === 1)
  const career = stats.find((s) => s.type?.displayName === 'career')?.splits?.[0]?.stat

  // A season split across clubs has one row per club and a combined row with
  // no team; a one-club season has only the club's row.
  const clubRows = yearly.filter((s) => s.team?.id)
  const thisSeason = clubRows.filter((s) => Number(s.season) === season)
  const combined = yearly.find((s) => Number(s.season) === season && !s.team) ?? thisSeason[0]

  const clubs = []
  for (const row of [...clubRows].sort((a, b) => Number(a.season) - Number(b.season))) {
    const last = clubs[clubs.length - 1]
    const year = Number(row.season)
    if (last?.teamId === row.team.id) last.to = year
    else clubs.push({ teamId: row.team.id, name: row.team.name, from: year, to: year })
  }

  // Every season's whole line: the combined row for a split season, else the club's.
  const years = [...new Set(clubRows.map((s) => Number(s.season)))]
    .sort((a, b) => a - b)
    .map((year) => {
      const rows = yearly.filter((s) => Number(s.season) === year)
      const row = rows.find((s) => !s.team) ?? rows[0]
      return { season: year, line: shapeLine(row.stat, pitcher) }
    })

  const moves = person.transactions ?? []
  // An injured-list stint in the season: the 60-day list says he lost most of it.
  const ilMoves = moves.filter(
    (t) => t.typeCode === 'SC' && /placed/i.test(t.description ?? '') && /injured list/i.test(t.description ?? '') && t.date?.startsWith(String(season)),
  )
  const injured = ilMoves.some((t) => /60-day/i.test(t.description)) ? 'long' : ilMoves.length ? 'some' : null

  // The latest move that brought him to the club he is with now.
  const current = teamId ?? [...moves].reverse().find((t) => t.toTeam?.id)?.toTeam?.id ?? null
  const arrival = [...moves]
    .reverse()
    .find((t) => ARRIVALS[t.typeCode] && t.toTeam?.id === current)

  return {
    id: person.id,
    name: person.fullName,
    lastName: person.useLastName ?? person.lastName ?? null,
    age: person.currentAge ?? null,
    pitcher,
    debut: person.mlbDebutDate ?? null,
    season,
    seasonLine: combined ? shapeLine(combined.stat, pitcher) : null,
    seasonClubs: thisSeason.length > 1 ? thisSeason.map((s) => ({ teamId: s.team.id, line: shapeLine(s.stat, pitcher) })) : [],
    careerLine: career ? shapeLine(career, pitcher) : null,
    minors: minors ? shapeMinors(minors, pitcher) : null,
    prospect: prospectOf(prospects, person.id),
    draft: person.drafts?.[0]?.team?.id
      ? { teamId: person.drafts[0].team.id, year: Number(person.drafts[0].year), round: person.drafts[0].pickRound ?? null, school: person.drafts[0].school?.name ?? null }
      : null,
    // Every club season, newest first, for the sheet's table.
    rows: [...clubRows]
      .sort((a, b) => Number(b.season) - Number(a.season))
      .map((s) => ({ season: Number(s.season), teamId: s.team.id, line: shapeLine(s.stat, pitcher) })),
    seasons: years.length,
    years,
    injured,
    clubs,
    arrival: arrival ? arrivalOf(arrival) : null,
    // Every arrival, oldest first: a quick second move ("two days after
    // Milwaukee got him from Cleveland") reads the one before.
    arrivals: moves.filter((t) => ARRIVALS[t.typeCode] && t.toTeam?.id).map(arrivalOf),
    contract: contract
      ? { terms: contract.terms ?? null, club: contract.clubAbbrev ?? null, season: contract.season ?? null, options: contract.options?.remaining ?? null }
      : null,
  }
}

// The season a move speaks for: the one just finished, until spring training.
export function factSeason(isoDate) {
  const [y, m] = isoDate.split('-').map(Number)
  return m < 3 ? y - 1 : y
}

// One player's facts, read once per session. A failed read is null, and the
// card simply shows no fact line.
const cache = new Map()
export function fetchPlayerFacts(personId, { season, teamId = null } = {}) {
  const key = `${personId}|${season}|${teamId}`
  if (!cache.has(key)) {
    cache.set(
      key,
      Promise.all([getJson(`/api/v1/people/${personId}?hydrate=${HYDRATE}`), fetchPlayerContract(personId), fetchTopProspects()])
        .then(async ([data, contract, prospects]) => {
          const person = data?.people?.[0]
          const facts = shapeFacts(person, { contract, season, teamId, prospects })
          // A thin big-league season (or none): one more read for where he
          // spent the rest of it.
          const full = facts?.seasonLine && facts.seasonLine.games >= (facts.pitcher ? FULL_SEASON.pitcher : FULL_SEASON.hitter)
          if (!facts || full) return facts
          const group = facts.pitcher ? 'pitching' : 'hitting'
          const milb = await getJson(`/api/v1/people/${personId}/stats?stats=season&group=${group}&season=${season}&leagueListId=milb_all`).catch(() => null)
          return shapeFacts(person, { contract, season, teamId, prospects, minors: milb?.stats?.flatMap((x) => x.splits ?? []) })
        })
        .catch(() => {
          cache.delete(key)
          return null
        }),
    )
  }
  return cache.get(key)
}

// The sheet's other two views, read only when one is first chosen: every
// minor-league season by club (milb_all), or every postseason by club
// (gameType=P), each with its own career total. Rows match `facts.rows`.
const MILB_LEVELS = { AAA: 'AAA', AA: 'AA', 'A(Adv)': 'A+', 'A(Full)': 'A', 'A+': 'A+', A: 'A', ROK: 'ROK' }
export function shapeScopeRows(yearly, career, pitcher) {
  const rows = (yearly ?? [])
    .filter((s) => s.team?.id)
    .sort((a, b) => Number(b.season) - Number(a.season))
    .map((s) => ({
      season: Number(s.season),
      teamId: s.team.id,
      level: MILB_LEVELS[s.sport?.abbreviation] ?? null,
      line: shapeLine(s.stat, pitcher),
    }))
  return { rows, total: career ? shapeLine(career, pitcher) : null }
}

const SCOPE_QUERY = { milb: 'leagueListId=milb_all', post: 'gameType=P' }
const scopeCache = new Map()
export function fetchScopeRows(personId, scope, pitcher) {
  const key = `${personId}|${scope}`
  if (!scopeCache.has(key)) {
    const group = pitcher ? 'pitching' : 'hitting'
    const base = `/api/v1/people/${personId}/stats?group=${group}&${SCOPE_QUERY[scope]}`
    const splits = (data) => (data?.stats ?? []).flatMap((x) => x.splits ?? [])
    scopeCache.set(
      key,
      Promise.all([getJson(`${base}&stats=yearByYear`), getJson(`${base}&stats=career`)])
        .then(([yearly, career]) => shapeScopeRows(splits(yearly), splits(career).find((s) => !s.team)?.stat, pitcher))
        .catch(() => {
          scopeCache.delete(key)
          return { rows: [], total: null }
        }),
    )
  }
  return scopeCache.get(key)
}
