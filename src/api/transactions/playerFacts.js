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
import { CALLS, FULL_SEASON } from './templates.js'
import { isMlbTeamId } from '../../lib/teams.js'
import { shiftDays } from '../../lib/time/standingsDates.js'

const HYDRATE = 'transactions,draft,stats(group=[hitting,pitching],type=[yearByYear,career],sportId=1)'
// The moves that bring a player to a club, and the words for each.
// ACQ, OBT, PUR and CP are one event: a player bought from outside affiliated ball.
const ARRIVALS = { TR: 'trade', SFA: 'free agent', SGN: 'signing', CLW: 'waiver claim', DR: 'draft', PUR: 'purchase', ACQ: 'purchase', OBT: 'purchase', CP: 'purchase', R5: 'Rule 5 draft' }

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
const arrivalOf = (t, name) => ({
  how: ARRIVALS[t.typeCode],
  date: t.date,
  teamId: t.toTeam.id,
  fromTeamId: t.fromTeam?.id ?? null,
  fromName: t.fromTeam?.name ?? null,
  tradedFor: ARRIVALS[t.typeCode] === 'trade' ? tradedFor(t.description, t.person?.fullName ?? name) : null,
})

// The other side of a trade, out of the row's own description: "White Sox
// traded RHP Lucas Giolito and RHP Reynaldo López to Los Angeles Angels for
// C Edgar Quero and LHP Ky Bush." read for Bush is "Lucas Giolito and Reynaldo
// López". Positions drop; "cash" and "a player to be named later" stay.
export function tradedFor(description, name) {
  const m = (description ?? '').match(/\btraded (.+?) to .+? for (.+?)\.?$/)
  if (!m || !name) return null
  const [, sent, got] = m
  const side = got.includes(name) ? sent : sent.includes(name) ? got : null
  if (!side) return null
  return side.replace(/\b(?:[LR]HP|C|1B|2B|3B|SS|LF|CF|RF|OF|IF|DH|P|UT)\s+(?=\p{Lu})/gu, '').trim() || null
}

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
    (t) => bigLeagueIl(t) && /placed|transferred/i.test(t.description ?? '') && /injured list/i.test(t.description ?? '') && t.date?.startsWith(String(season)),
  )
  const injured = ilMoves.some((t) => /60-day/i.test(t.description)) ? 'long' : ilMoves.length ? 'some' : null
  // Each stint this season: placed (from the effective date, which a
  // retroactive placement sets back), the feed's own injury note, and the day
  // he came off. A transfer to the 60-day list stays inside its stint.
  // Every season's stints are read; this season's are `stints`, the earlier
  // ones `pastStints`, for a first trip's history.
  const allStints = []
  for (const t of moves.filter((m) => m.date && m.date.slice(0, 4) <= String(season))) {
    if (!bigLeagueIl(t)) continue
    if (/placed/i.test(t.description)) {
      // A placement while a stint is still open is the same stint filed again,
      // as a traded player's new club does (Rutschman, Aug. 3, 2026), or a
      // transfer to the 60-day list. One left open from an earlier season is
      // not: the feed never closed it.
      const open = allStints.find((x) => !x.to && x.from.slice(0, 4) === t.date.slice(0, 4))
      if (open) {
        open.filings.push(t.date)
        continue
      }
      const injury = (t.description.match(/injured list(?: retroactive to [^.]+)?\.\s*(.+)/i)?.[1] ?? '').trim().replace(/\.$/, '')
      allStints.push({ from: t.effectiveDate ?? t.date, filings: [t.date], injury: injury || null, to: null, club: t.toTeam?.id ?? null })
    } else if (/transferred/i.test(t.description)) {
      // A move to the 60-day list: the stint already open, filed again.
      allStints.findLast((x) => !x.to)?.filings.push(t.date)
    } else if (/activated/i.test(t.description)) {
      const open = [...allStints].reverse().find((x) => !x.to)
      if (open) open.to = t.date
    }
  }
  const stints = allStints.filter((x) => x.filings[0].startsWith(String(season)))
  const pastStints = allStints.filter((x) => x.filings[0].slice(0, 4) < String(season))

  // The latest move that brought him to the club he is with now.
  const current = teamId ?? [...moves].reverse().find((t) => t.toTeam?.id)?.toTeam?.id ?? null
  const arrival = [...moves]
    .reverse()
    .find((t) => ARRIVALS[t.typeCode] && t.toTeam?.id === current)

  // His big-league trips this season, oldest first: a recall or selected
  // contract takes him up, an option sends him down. A trip that opens on an
  // option was the opening-day roster's, and has no day up.
  const calls = []
  for (const t of moves.filter((m) => m.date?.startsWith(String(season)))) {
    if ((t.typeCode === 'CU' || t.typeCode === 'SE') && isMlbTeamId(t.toTeam?.id)) calls.push({ up: t.date, down: null })
    else if (t.typeCode === 'OPT' && isMlbTeamId(t.fromTeam?.id)) {
      const open = calls.at(-1)
      if (open && !open.down) open.down = t.date
      else calls.push({ up: null, down: t.date })
    }
  }

  const signed = [...(person.drafts ?? [])].sort((a, b) => Number(a.year) - Number(b.year)).at(-1)

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
    // The draft he signed out of: the latest, since a pick who went back to
    // school is drafted again.
    draft: signed?.team?.id
      ? { teamId: signed.team.id, year: Number(signed.year), round: signed.pickRound ?? null, pick: signed.pickNumber ?? null, school: signed.school?.name ?? null }
      : null,
    // Every club season, newest first, for the sheet's table.
    rows: newestFirst(clubRows)
      .map((s) => ({ season: Number(s.season), teamId: s.team.id, line: shapeLine(s.stat, pitcher) })),
    seasons: years.length,
    years,
    injured,
    stints,
    pastStints,
    calls,
    clubs,
    clubTotals: clubTotals(clubRows, clubs, pitcher),
    arrival: arrival ? arrivalOf(arrival, person.fullName) : null,
    // Every arrival, oldest first: a quick second move ("two days after
    // Milwaukee got him from Cleveland") reads the one before.
    arrivals: moves.filter((t) => ARRIVALS[t.typeCode] && t.toTeam?.id).map((t) => arrivalOf(t, person.fullName)),
    contract: shapeContract(contract),
  }
}

function shapeContract(contract) {
  return contract
    ? { terms: contract.terms ?? null, club: contract.clubAbbrev ?? null, season: contract.season ?? null, options: contract.options?.remaining ?? null }
    : null
}

// A settled day's facts are kept without the contract (both stores), so the
// contract is read fresh: a December extension shows on a September move.
export function withoutContract(facts) {
  const rest = { ...facts }
  delete rest.contract
  return rest
}
async function withContract(personId, facts) {
  return facts && { ...facts, contract: shapeContract(await fetchPlayerContract(personId).catch(() => null)) }
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
// The players he was traded for, by name, with their ids: that day's trade
// rows carry every player in the deal, so the note can link each one.
async function withTradeIds(facts) {
  const a = facts?.arrival
  if (!a?.tradedFor) return facts
  const day = await getJson(`/api/v1/transactions?startDate=${a.date}&endDate=${a.date}`).catch(() => null)
  const tradeIds = {}
  for (const t of day?.transactions ?? []) {
    if (t.typeCode === 'TR' && t.person?.id && a.tradedFor.includes(t.person.fullName)) tradeIds[t.person.fullName] = t.person.id
  }
  return { ...facts, tradeIds }
}

// A level's words from the sheet's abbreviation: 'AA' is "Double-A".
const LEVEL_WORDS = Object.fromEntries(Object.values(LEVELS).map(([words, abbr]) => [abbr, words]))

// His last minor-league season before the year he arrived from outside
// affiliated ball: his rows run on past it once he plays for his new club.
export function lastAffiliated(rows, arrivedOn) {
  const year = Number(arrivedOn?.slice(0, 4))
  const row = rows.find((r) => r.season < year)
  return row ? { season: row.season, level: LEVEL_WORDS[row.level] ?? null } : null
}

// What one subject of a move asks fetchPlayerFacts for. Each player's own
// template decides what more he reads: an injured-list move, the stint and his
// line before it; a trade, his line up to the deal; a call, his line around it;
// an arrival, his last affiliated season. The club that made the move is the one
// he joined, even when the move sends him to a farm club. Shared by the wire
// (WireFacts.jsx) and the nightly pre-build (scripts/gen-wire-facts.mjs), so
// both ask the same question and land on the same key.
export function factRequest(story, date, { playerId, template }) {
  return [
    Number(playerId),
    {
      season: factSeason(date),
      teamId: story.teamId,
      asOf: date,
      ilMove: template.startsWith('il-') ? date : null,
      tradeMove: template === 'trade' ? date : null,
      callMove: CALLS.has(template) ? { kind: template, date } : null,
      arrival: template === 'arrival',
    },
  ]
}

// His lines and age as they stood the day before `asOf`. byDateRange over many
// years answers one split per club plus the total, which carries no team
// (person 547180 through 2026-04-30: PHI 889, WSH 927, total 1,816 games).
export async function asOfFacts(personId, person, facts, asOf) {
  const until = shiftDays(asOf, -1)
  const group = facts.pitcher ? 'pitching' : 'hitting'
  const range = (from) =>
    getJson(`/api/v1/people/${personId}/stats?stats=byDateRange&group=${group}&sportId=1&startDate=${from}&endDate=${until}`)
      .then((r) => {
        const splits = r?.stats?.[0]?.splits ?? []
        return (splits.find((x) => !x.team) ?? splits[0])?.stat ?? null
      })
      .catch(() => null)
  const [seasonStat, careerStat] = await Promise.all([range(`${facts.season}-01-01`), range('1876-01-01')])
  const born = person?.birthDate
  const age = born ? Math.floor((Date.parse(asOf) - Date.parse(born)) / (365.2425 * 864e5)) : facts.age
  return {
    age,
    // A move inside the season it reads: its line is a season SO FAR.
    midSeason: asOf.startsWith(String(facts.season)) && asOf.slice(5, 7) < '10',
    seasonLine: seasonStat ? shapeLine(seasonStat, facts.pitcher) : null,
    seasonClubs: [],
    // No line before the move (a first call-up, or a failed read) is no line:
    // the current career would carry games played after it.
    careerLine: careerStat ? shapeLine(careerStat, facts.pitcher) : null,
    // A move after its season (a November non-tender) keeps that season's row.
    rows: (facts.rows ?? []).filter((r) => (asOf.slice(5, 7) >= '10' ? r.season <= facts.season : r.season < facts.season)),
  }
}

// His minor-league season to the day before `asOf`, one level at a time:
// byDateRange takes one sportId per call and names no sport on its splits, so
// each level's are tagged here for shapeMinors. A pitcher traded April 14 with
// all 26 of his Triple-A games still to come (person 658551) shows none.
const MILB_SPORTS = [[11, 'AAA'], [12, 'AA'], [13, 'A+'], [14, 'A']]
async function minorsAsOf(personId, group, season, asOf) {
  const until = shiftDays(asOf, -1)
  const levels = await Promise.all(
    MILB_SPORTS.map(([sportId, abbreviation]) =>
      getJson(`/api/v1/people/${personId}/stats?stats=byDateRange&group=${group}&sportId=${sportId}&startDate=${season}-01-01&endDate=${until}`)
        .then((r) => (r?.stats?.[0]?.splits ?? []).map((x) => ({ ...x, sport: { abbreviation } })))
        .catch(() => []),
    ),
  )
  return levels.flat()
}

// `callMove` ({ kind, date }: a recall, option or selected contract) adds his
// minor-league line up to a call, or his big-league line over the stint an
// option ends. `arrival` (an arrival from outside affiliated ball) adds his
// last season in affiliated ball.
// `asOf` (the move's date) dates the rest: his season and career lines run to
// the day before it, his age is his age that day, and the sheet's table stops at
// that season — so an April move never carries a September line (Gary, 2026-11-03).
//
// A move from a day already over reads facts that can no longer change, so its
// answer is kept in this browser (localStorage, FACTS_STORE) and a return visit
// reads it with no request at all. Today's moves always read live.
const FACTS_STORE = 'bbsbh:wirefacts:v2:'
const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, the reader's own day
function readStored(key) {
  try {
    const raw = localStorage.getItem(FACTS_STORE + key)
    return raw ? JSON.parse(raw).f ?? null : null
  } catch {
    return null
  }
}
// Each entry carries its move's day (`d`). When storage is full, the oldest half
// of these entries goes and the write is tried once more, so this store can never
// crowd out the reveal marks (`bbsbh:reveal:`) that share the origin's quota.
function writeStored(key, facts, asOf) {
  const value = JSON.stringify({ d: asOf, f: withoutContract(facts) })
  try {
    localStorage.setItem(FACTS_STORE + key, value)
  } catch {
    try {
      evictOldest()
      localStorage.setItem(FACTS_STORE + key, value)
    } catch {
      // Blocked storage: the note still shows, it is only read again next time.
    }
  }
}
function evictOldest() {
  const mine = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    // An older key version is dead weight: the first to go.
    if (k?.startsWith('bbsbh:wirefacts:') && !k.startsWith(FACTS_STORE)) {
      mine.push(['', k])
      continue
    }
    if (!k?.startsWith(FACTS_STORE)) continue
    let d = ''
    try {
      d = JSON.parse(localStorage.getItem(k))?.d ?? ''
    } catch {
      // unreadable: oldest
    }
    mine.push([d, k])
  }
  mine.sort((a, b) => (a[0] < b[0] ? -1 : 1))
  for (const [, k] of mine.slice(0, Math.max(1, Math.ceil(mine.length / 2)))) localStorage.removeItem(k)
}
// One move's facts, keyed the same in the browser and in the nightly file.
export function factKey(personId, { season, teamId = null, ilMove = null, tradeMove = null, callMove = null, arrival = false, asOf = null }) {
  return `${personId}|${season}|${teamId}|${ilMove}|${tradeMove}|${callMove?.kind}|${callMove?.date}|${arrival}|${asOf}`
}

// public/data/wire-facts/{date}.json (scripts/gen-wire-facts.mjs): every
// move's facts for one past day, built the night after. One read per day, kept
// for the visit; a day outside the file's window answers 404 and reads live.
const days = new Map()
const unbuilt = new Set()
function prebuiltDay(date) {
  if (!days.has(date)) {
    days.set(
      date,
      fetch(`/data/wire-facts/${date}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    )
  }
  return days.get(date)
}

export function fetchPlayerFacts(personId, { season, teamId = null, ilMove = null, tradeMove = null, callMove = null, arrival = false, asOf = null } = {}) {
  const key = factKey(personId, { season, teamId, ilMove, tradeMove, callMove, arrival, asOf })
  const settled = asOf != null && asOf < today()
  if (!cache.has(key) && settled) {
    const stored = readStored(key)
    if (stored) cache.set(key, withContract(personId, stored))
  }
  // Then the night's pre-built file for the move's day, before any live read.
  if (!cache.has(key) && settled && !unbuilt.has(key)) {
    cache.set(
      key,
      prebuiltDay(asOf).then((day) => {
        if (day?.[key]) {
          writeStored(key, day[key], asOf)
          return withContract(personId, day[key])
        }
        cache.delete(key)
        unbuilt.add(key) // read live once; never ask the file for it again
        return fetchPlayerFacts(personId, { season, teamId, ilMove, tradeMove, callMove, arrival, asOf })
      }),
    )
    return cache.get(key)
  }
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
          // A trade: his line up to the day before it, for the club he left,
          // so the note reads as it did the day of the deal.
          const deal = tradeMove && facts?.arrivals.find((a) => a.how === 'trade' && near(a.date, tradeMove))
          if (deal?.fromTeamId && tradeMove.startsWith(String(season))) {
            const group = facts.pitcher ? 'pitching' : 'hitting'
            const range = await getJson(
              `/api/v1/people/${personId}/stats?stats=byDateRange&group=${group}&sportId=1&startDate=${season}-03-01&endDate=${shiftDays(tradeMove, -1)}`,
            ).catch(() => null)
            const stat = range?.stats?.[0]?.splits?.[0]?.stat
            if (stat) facts.trade = { line: shapeLine(stat, facts.pitcher), fromTeamId: deal.fromTeamId, toTeamId: deal.teamId }
          }
          if (facts && asOf) Object.assign(facts, await asOfFacts(personId, person, facts, asOf))
          if (facts && callMove) Object.assign(facts, await callFacts(personId, facts, callMove, teamId))
          if (facts && arrival) {
            const { rows } = await fetchScopeRows(personId, 'milb', facts.pitcher)
            facts.affiliated = lastAffiliated(rows, facts.arrival?.date)
          }
          // A thin big-league season (or none): one more read for where he
          // spent the rest of it.
          const full = facts?.seasonLine && facts.seasonLine.games >= (facts.pitcher ? FULL_SEASON.pitcher : FULL_SEASON.hitter)
          if (!facts || full) return facts
          const group = facts.pitcher ? 'pitching' : 'hitting'
          const milb = (yr) => getJson(`/api/v1/people/${personId}/stats?stats=season&group=${group}&season=${yr}&leagueListId=milb_all`).catch(() => null).then((r) => r?.stats?.flatMap((x) => x.splits ?? []))
          // The season before, too: a big leaguer stuck in Triple-A is judged
          // on his last two years there. Read alongside this season's.
          const [minors, prev] = await Promise.all([asOf ? minorsAsOf(personId, group, season, asOf) : milb(season), milb(Number(season) - 1)])
          const withMinors = shapeFacts(person, { contract, season, teamId, prospects, minors })
          withMinors.minorsPrev = shapeMinors(prev, facts.pitcher)
          const extra = ['midSeason', 'seasonLine', 'seasonClubs', 'careerLine', 'age', 'rows', 'stint', 'beforeLine', 'trade', 'callLine', 'stintLine', 'callMlbLine', 'seasonToDate', 'lastGame', 'affiliated', 'extraMan']
          return { ...withMinors, ...Object.fromEntries(extra.map((k) => [k, facts[k]])) }
        })
        .then(withTradeIds)
        .then((facts) => {
          if (facts && settled) writeStored(key, facts, asOf)
          return facts
        })
        .catch(() => {
          cache.delete(key)
          return null
        }),
    )
  }
  return cache.get(key)
}

// A call's line: up, his minor-league line before it; down, his big-league
// line over the stint the option ends (from the day he came up).
async function callFacts(personId, facts, { kind, date }, teamId) {
  const group = facts.pitcher ? 'pitching' : 'hitting'
  // A trip of a day or less, back down by the next day, that opened on the
  // club's doubleheader or special-event day. A call-up that stays is not the
  // extra man.
  const trip = facts.calls.find((c) => (c.up && near(c.up, date)) || (c.down && near(c.down, date)))
  const short = trip?.up && trip.down && Date.parse(trip.down) - Date.parse(trip.up) <= 86_400_000
  if (short && teamId) {
    const day = await getJson(`/api/v1/schedule?sportId=1&teamId=${teamId}&date=${trip.up}&hydrate=team(venue)`).catch(() => null)
    const games = day?.dates?.[0]?.games ?? []
    if (games.length > 1) return { extraMan: { event: null } }
    // A special event is played away from the home club's park, and the game
    // carries its name ("MLB Little League Classic in Williamsport, PA"). Home
    // openers, heritage days and makeups carry a name too, at home.
    const g = games[0]
    if (g?.description && g.venue?.id !== g.teams?.home?.team?.venue?.id) return { extraMan: { event: g.description.trim() } }
  }
  const range = (scope, from, to) =>
    getJson(`/api/v1/people/${personId}/stats?stats=byDateRange&group=${group}&${scope}&startDate=${from}&endDate=${to}`)
      .then((d) => (d?.stats ?? []).flatMap((x) => x.splits ?? []))
      .catch(() => [])
  if (kind !== 'option') {
    // His big-league games before the call too, for a player shuttling up and down.
    const [milb, mlb] = await Promise.all([
      range('leagueListId=milb_all', `${facts.season}-03-01`, shiftDays(date, -1)),
      range('sportId=1', `${facts.season}-03-01`, shiftDays(date, -1)),
    ])
    return { callLine: shapeMinors(milb, facts.pitcher), callMlbLine: shapeLine(mlb.find((s) => !s.team)?.stat ?? mlb[0]?.stat, facts.pitcher) }
  }
  const down = facts.calls.find((c) => c.down && near(c.down, date))
  const before = shiftDays(date, -1)
  // His last big-league game and his season to the day before the move, for
  // the send-down's note (templates.js, lastGameSentence).
  const [splits, season, log] = await Promise.all([
    range('sportId=1', down?.up ?? `${facts.season}-03-01`, before),
    down?.up ? range('sportId=1', `${facts.season}-03-01`, before) : null,
    getJson(`/api/v1/people/${personId}/stats?stats=gameLog&group=${group}&season=${facts.season}&sportId=1`)
      .then((d) => (d?.stats ?? []).flatMap((x) => x.splits ?? []))
      .catch(() => []),
  ])
  const total = (rows) => shapeLine(rows.find((s) => !s.team)?.stat ?? rows[0]?.stat, facts.pitcher)
  const stintLine = total(splits)
  return { stintLine, seasonToDate: season ? total(season) : stintLine, lastGame: lastGameOf(log, date, facts.pitcher, teamId) }
}

// His line with each club over his latest stint there, summed from the season
// rows (a cash deal's note: Easton McGee's 2025-26 with the Brewers).
function clubTotals(clubRows, clubs, pitcher) {
  const out = {}
  for (const c of clubs) {
    const rows = clubRows.filter((r) => r.team.id === c.teamId && Number(r.season) >= c.from && Number(r.season) <= c.to)
    const sum = (f) => rows.reduce((n, r) => n + f(r.stat ?? {}), 0)
    const games = sum((t) => (pitcher ? t.gamesPitched : t.gamesPlayed) ?? 0)
    if (pitcher) {
      const outs = sum((t) => { const [w, f = 0] = String(t.inningsPitched ?? '0').split('.').map(Number); return w * 3 + f })
      const er = sum((t) => t.earnedRuns ?? 0)
      out[c.teamId] = { games, era: outs ? ((er * 27) / outs).toFixed(2) : null, ip: `${Math.floor(outs / 3)}.${outs % 3}` }
    } else {
      const ab = sum((t) => t.atBats ?? 0)
      out[c.teamId] = { games, avg: ab ? (sum((t) => t.hits ?? 0) / ab).toFixed(3).replace(/^0/, '') : null, hr: sum((t) => t.homeRuns ?? 0) }
    }
  }
  return out
}

// Club seasons newest first, and within a season his latest club first: the
// feed lists a season's clubs in the order he played for them (Jonathan
// Ornelas, 2026: Athletics, then Brewers), so that order is reversed.
function newestFirst(rows) {
  return rows
    .map((s, i) => ({ s, i }))
    .sort((a, b) => Number(b.s.season) - Number(a.s.season) || b.i - a.i)
    .map(({ s }) => s)
}

// His last game-log row before `date`, cut to what the note says of it.
// Verified on Brandon Sproat's 2026 log (687075): each split carries `date`,
// `opponent.id` and the game's own `stat`.
// `teamId`, when given, keeps only his games for the club that sent him down: a
// player traded in and optioned at once has no last game for it to tell.
export function lastGameOf(splits, date, pitcher, teamId = null) {
  const g = (splits ?? []).filter((s) => s.date && s.date < date).at(-1)
  if (teamId && g?.team?.id !== teamId) return null
  if (!g?.stat) return null
  const line = pitcher
    ? { ip: g.stat.inningsPitched, er: g.stat.earnedRuns ?? 0 }
    : { ab: g.stat.atBats ?? 0, h: g.stat.hits ?? 0, hr: g.stat.homeRuns ?? 0 }
  return { date: g.date, oppId: g.opponent?.id ?? null, line }
}

// The sheet's other two views, read only when one is first chosen: every
// minor-league season by club (milb_all), or every postseason by club
// (gameType=P), each with its own career total. Rows match `facts.rows`.
// `career` is the career read's splits: for milb_all a subtotal per level and
// one "Minors" row, the total; for the postseason a single team-less row.
export function shapeScopeRows(yearly, career, pitcher) {
  const clubbed = (yearly ?? []).filter((s) => s.team?.id)
  const rows = newestFirst(clubbed)
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
