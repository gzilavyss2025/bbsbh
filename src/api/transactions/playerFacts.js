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
import { isMlbTeamId } from '../../lib/teams.js'
import { shiftDays } from '../../lib/time/standingsDates.js'

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

// The minor-league levels by the feed's sport abbreviation, as a sentence
// names them and as the sheet's table marks them. Older seasons write High-A
// and Single-A as 'A(Adv)' and 'A(Full)'.
const LEVELS = {
  AAA: ['Triple-A', 'AAA'],
  AA: ['Double-A', 'AA'],
  'A+': ['High-A', 'A+'],
  'A(Adv)': ['High-A', 'A+'],
  A: ['Single-A', 'A'],
  'A(Full)': ['Single-A', 'A'],
  ROK: ['rookie ball', 'ROK'],
}

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
  const levels = [...new Set(rows.map((s) => LEVELS[s.sport?.abbreviation]?.[0]).filter(Boolean))].sort(
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

// The raw /people record, its contract row and the season the move speaks
// for, shaped into the facts the templates read. Pure, so it is tested on
// captured records (test/wire-templates.test.js).
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

  // Oldest first: the feed's row order is not stable, and every lookup below
  // (the latest arrival, the stint before this one) reads by position.
  const moves = [...(person.transactions ?? [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  // An injured-list stint in the season: the 60-day list says he lost most of it.
  // A farm club's own injured list ("Syracuse Mets placed RHP X on the 7-day
  // injured list") is not a big-league stint; the row's club is its toTeam.
  const bigLeagueIl = (t) =>
    t.typeCode === 'SC' && /injured list/i.test(t.description ?? '') && (t.toTeam?.id == null || isMlbTeamId(t.toTeam.id))
  const ilMoves = moves.filter(
    (t) => bigLeagueIl(t) && /placed/i.test(t.description ?? '') && /injured list/i.test(t.description ?? '') && t.date?.startsWith(String(season)),
  )
  const injured = ilMoves.some((t) => /60-day/i.test(t.description)) ? 'long' : ilMoves.length ? 'some' : null
  // Each stint this season: placed (from the effective date, which a
  // retroactive placement sets back), the feed's own injury note, and the day
  // he came off. A transfer to the 60-day list stays inside its stint.
  const stints = []
  for (const t of moves.filter((m) => m.date?.startsWith(String(season)))) {
    if (!bigLeagueIl(t)) continue
    if (/placed/i.test(t.description)) {
      // A placement while a stint is still open is the same stint filed again,
      // as a traded player's new club does (Rutschman, Aug. 3, 2026).
      const open = stints.find((x) => !x.to)
      if (open) {
        open.filings.push(t.date)
        continue
      }
      const injury = (t.description.match(/injured list(?: retroactive to [^.]+)?\.\s*(.+)/i)?.[1] ?? '').trim().replace(/\.$/, '')
      stints.push({ from: t.effectiveDate ?? t.date, filings: [t.date], injury: injury || null, to: null })
    } else if (/activated/i.test(t.description)) {
      const open = [...stints].reverse().find((x) => !x.to)
      if (open) open.to = t.date
    }
  }

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
    stints,
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
// `ilMove` (an injured-list move's date) adds the stint it is about and his
// line up to it.
const near = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) <= 86_400_000
export function fetchPlayerFacts(personId, { season, teamId = null, ilMove = null } = {}) {
  const key = `${personId}|${season}|${teamId}|${ilMove}`
  if (!cache.has(key)) {
    cache.set(
      key,
      Promise.all([getJson(`/api/v1/people/${personId}?hydrate=${HYDRATE}`), fetchPlayerContract(personId), fetchTopProspects()])
        .then(async ([data, contract, prospects]) => {
          const person = data?.people?.[0]
          const facts = shapeFacts(person, { contract, season, teamId, prospects })
          // An injured-list move: his line up to the stint it is about (the
          // placement filed that day, or the stint he came off that day).
          const stint = ilMove && facts?.stints.find((x) => x.filings.some((d) => near(d, ilMove)) || (x.to && near(x.to, ilMove)))
          const until = stint ? shiftDays(stint.from, -1) : null
          if (stint) facts.stint = stint
          if (facts && until) {
            const group = facts.pitcher ? 'pitching' : 'hitting'
            const range = await getJson(
              `/api/v1/people/${personId}/stats?stats=byDateRange&group=${group}&sportId=1&startDate=${season}-03-01&endDate=${until}`,
            ).catch(() => null)
            const stat = range?.stats?.[0]?.splits?.[0]?.stat
            facts.beforeLine = stat ? shapeLine(stat, facts.pitcher) : null
          }
          // A thin big-league season (or none): one more read for where he
          // spent the rest of it.
          const full = facts?.seasonLine && facts.seasonLine.games >= (facts.pitcher ? FULL_SEASON.pitcher : FULL_SEASON.hitter)
          if (!facts || full) return facts
          const group = facts.pitcher ? 'pitching' : 'hitting'
          const milb = await getJson(`/api/v1/people/${personId}/stats?stats=season&group=${group}&season=${season}&leagueListId=milb_all`).catch(() => null)
          const withMinors = shapeFacts(person, { contract, season, teamId, prospects, minors: milb?.stats?.flatMap((x) => x.splits ?? []) })
          return { ...withMinors, stint: facts.stint, beforeLine: facts.beforeLine }
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
// `career` is the career read's splits: for milb_all a subtotal per level and
// one "Minors" row, the total; for the postseason a single team-less row.
export function shapeScopeRows(yearly, career, pitcher) {
  const rows = (yearly ?? [])
    .filter((s) => s.team?.id)
    .sort((a, b) => Number(b.season) - Number(a.season))
    .map((s) => ({
      season: Number(s.season),
      teamId: s.team.id,
      level: LEVELS[s.sport?.abbreviation]?.[1] ?? null,
      line: shapeLine(s.stat, pitcher),
    }))
  const loose = (career ?? []).filter((s) => !s.team)
  const total = loose.find((s) => s.sport?.abbreviation === 'Minors') ?? (loose.length === 1 ? loose[0] : null)
  return { rows, total: total ? shapeLine(total.stat, pitcher) : null }
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
        .then(([yearly, career]) => shapeScopeRows(splits(yearly), splits(career), pitcher))
        .catch(() => {
          scopeCache.delete(key)
          return { rows: [], total: null }
        }),
    )
  }
  return scopeCache.get(key)
}
