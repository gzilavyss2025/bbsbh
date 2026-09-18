// Regenerates public/data/youngest-regulars/{11,12,13,14}.json — how old a
// minor league's regulars were, for the notebook note on the four levels'
// offseason home page (issue #1078, step 4 of #1038).
//
// WHY AGE, AND NOT A LEADERBOARD. The obvious note at a farm level is a rate
// board — the patient hitters, the fewest strikeouts — and it is the one note
// that cannot be written honestly there. Every such board needs a playing-time
// floor, and a floor at a SINGLE level selects for the players nobody promoted:
// the best hitter in the Midwest League in May is in Double-A by July with 180
// plate appearances, and a 250-PA board has quietly dropped him. So the board
// would rank the league's best seasons and be a list of who stayed.
//
// Age carries no such bias. The floor still decides who is on the page, and the
// note SAYS so — but the thing being measured is not the thing the floor
// selects on, so the note is true as written. (research.md §7, and the trap
// #1078 records at the top.)
//
// THREE LEAGUES, NEVER THE LEVEL. A level is three leagues that play different
// schedules in different places, and "compare within one league and year" is
// research.md §7's first rule. The level's file therefore holds three notes and
// the page picks between them; no number in this file is ever computed across
// two leagues.
//
// FOUR SMALL CALLS PER LEVEL. `/stats?leagueId=` is the same roster-independent
// season-stats endpoint the leader boards already use (src/api/statsLevels.js),
// scoped to one league — everyone who took a plate appearance there, promoted
// or released, which is exactly the population the note is about. Birth dates
// come back for the regulars in one `/people` batch. Nothing here is a sweep.
//
// SPOILER-FREE: a season aggregate and a date of birth. No game, no date, no
// result. Season stat lines have always opened live (ADR-0034).
//
// Run by hand: node scripts/gen-youngest-regulars.mjs [--level=13] [--season=2026]
// Nightly: .github/workflows/update-nightly-data.yml
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJsonOr, writeJsonAtomic } from './lib/io.js'
import { getJson } from './lib/statsapi.mjs'
import { levelOffseasonPhase } from '../src/lib/time/seasonPhase.js'
import {
  ageOnJune30,
  averageAge,
  combineByPlayer,
  sortByAge,
} from './lib/youngest-regulars.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'public', 'data')
const outDir = join(dataDir, 'youngest-regulars')

const LEVEL_SPORT_IDS = [11, 12, 13, 14]

// A REGULAR — 250 plate appearances in the one league, research.md §7's floor
// for a season profile. At a 132-game level that is about 60 games, so it keeps
// the September call-up and the rehab cameo off a note about who played a
// season somewhere. Measured against the Midwest League's 2026: 105 regulars
// out of 323 hitters.
const REGULAR_PA = 250
// Below this the league average is an average of almost nobody, and the note
// would be comparing a player to a handful of team-mates. research.md §7 sets
// 20 as the floor for any claim about a player's standing in a population; a
// league under it ships no note rather than a thin one.
const MIN_REGULARS = 20
// How many of the youngest each league ships. The card shows three and opens to
// the rest, and nobody reads past twenty names.
const LIST_SIZE = 20
// statsapi's /people batch limit is generous; this keeps a URL short enough to
// never be the thing that fails.
const PEOPLE_BATCH = 100

const args = process.argv.slice(2)
const onlyLevel = Number(args.find((a) => a.startsWith('--level='))?.split('=')[1]) || null
const onlySeason = Number(args.find((a) => a.startsWith('--season='))?.split('=')[1]) || null

const today = new Date().toISOString().slice(0, 10)

// The level's own leagues — the only reading of a minor-league season ADR-0079
// allows, and the list the three notes are built from.
async function leagueRows(sportId, season) {
  try {
    const data = await getJson(
      `/api/v1/league?sportId=${sportId}&season=${season}` +
        `&fields=leagues,id,name,nameShort,abbreviation,seasonDateInfo,` +
        `regularSeasonStartDate,seasonEndDate,offseasonStartDate`,
    )
    return (data.leagues ?? []).map((league) => ({
      leagueId: league.id,
      name: league.name ?? '',
      abbr: league.abbreviation ?? '',
      ...(league.seasonDateInfo ?? {}),
    }))
  } catch {
    return []
  }
}

async function leagueHitters(leagueId, season) {
  try {
    const data = await getJson(
      `/api/v1/stats?stats=season&group=hitting&season=${season}&leagueId=${leagueId}` +
        `&playerPool=all&limit=5000&fields=stats,splits,player,id,fullName,team,name,stat,plateAppearances`,
    )
    return data.stats?.[0]?.splits ?? []
  } catch {
    return []
  }
}

// Birth dates for a set of people, in batches. A player whose row comes back
// without one is dropped from the note rather than given a guessed age —
// there is no average to fall back on that would not be a fabrication.
async function birthDates(ids) {
  const out = new Map()
  for (let i = 0; i < ids.length; i += PEOPLE_BATCH) {
    const batch = ids.slice(i, i + PEOPLE_BATCH)
    try {
      const data = await getJson(
        `/api/v1/people?personIds=${batch.join(',')}&fields=people,id,birthDate`,
      )
      for (const person of data.people ?? []) {
        if (person?.id && person?.birthDate) out.set(person.id, person.birthDate)
      }
    } catch {
      // A failed batch leaves those players without an age; they drop out
      // below, and the next nightly run picks them up.
    }
  }
  return out
}

// The club a row names is the farm club he played for; the ORG is who a reader
// recognises. Same join gen-minors-leaders.mjs makes, off the same file.
async function orgIndex() {
  const { bySportId } = await readJsonOr(join(dataDir, 'teams.json'), {})
  const byId = new Map(
    Object.values(bySportId ?? {})
      .flat()
      .map((team) => [team.id, team]),
  )
  return (teamId) => {
    const team = byId.get(teamId)
    if (!team) return { orgId: null, orgName: '' }
    const parent = team.parentOrgId ? byId.get(team.parentOrgId) : null
    return { orgId: team.parentOrgId ?? null, orgName: parent?.name ?? team.parentOrgName ?? '' }
  }
}

async function buildLeague(league, season, orgFor) {
  const splits = await leagueHitters(league.leagueId, season)
  const combined = combineByPlayer(splits)
  const regulars = combined.filter((p) => p.pa >= REGULAR_PA)
  if (regulars.length < MIN_REGULARS) {
    console.log(
      `    ${league.name}: ${regulars.length} regulars of ${combined.length} hitters — below ${MIN_REGULARS}, no note`,
    )
    return null
  }

  const born = await birthDates(regulars.map((p) => p.id))
  const aged = regulars
    .map((p) => ({ ...p, age: ageOnJune30(born.get(p.id), season) }))
    .filter((p) => Number.isFinite(p.age))
  if (aged.length < MIN_REGULARS) {
    console.log(`    ${league.name}: only ${aged.length} regulars carry a birth date — no note`)
    return null
  }

  const youngest = sortByAge(aged)
    .slice(0, LIST_SIZE)
    .map((p) => {
      const { orgId, orgName } = orgFor(p.teamId)
      return {
        id: p.id,
        name: p.name,
        teamId: p.teamId,
        teamName: p.teamName,
        orgId,
        orgName,
        pa: p.pa,
        age: p.age,
      }
    })

  // Which big-league organisations have a club in this league — the one field
  // that lets the page open on the reader's OWN league rather than on an
  // arbitrary one. Taken off every club that fielded a hitter, not off the
  // twenty names above, so a reader whose affiliate produced no young regular
  // still lands where they belong.
  const orgIds = [
    ...new Set(
      splits
        .map((split) => orgFor(split?.team?.id).orgId)
        .filter((id) => Number.isFinite(id)),
    ),
  ].sort((a, b) => a - b)

  console.log(
    `    ${league.name}: ${aged.length} regulars, average ${averageAge(aged)}, youngest ${youngest[0]?.age}`,
  )
  return {
    leagueId: league.leagueId,
    name: league.name,
    abbr: league.abbr,
    regulars: aged.length,
    hitters: combined.length,
    averageAge: averageAge(aged),
    orgIds,
    players: youngest,
  }
}

async function buildLevel(sportId, orgFor) {
  const year = Number(today.slice(0, 4))
  const rows = await leagueRows(sportId, year)
  // The season the offseason page will be naming. Not `year` on its own: from
  // January the page still names the season that finished last September, and a
  // file that rolled over to an empty new year would take the note off the page
  // until April (#1122, the same trap gen-minors-leaders.mjs was fixed for).
  const season = onlySeason ?? levelOffseasonPhase(today, rows)?.seasonEnded ?? year

  console.log(`  sportId ${sportId}: ${season}`)
  const leagues = []
  for (const league of rows) {
    const note = await buildLeague(league, season, orgFor)
    if (note) leagues.push(note)
  }
  if (leagues.length === 0) {
    console.log(`  sportId ${sportId}: no league produced a note — keeping the file as it is`)
    return null
  }
  return {
    sportId,
    season,
    generatedAt: new Date().toISOString(),
    regularPa: REGULAR_PA,
    leagues,
  }
}

// Rewrite only when something other than the timestamp moved — the churn
// lesson gen-contracts-shards.mjs learned.
async function writeIfChanged(path, next) {
  const prev = await readJsonOr(path, null)
  const strip = (doc) => JSON.stringify({ ...doc, generatedAt: null })
  if (prev && strip(prev) === strip(next)) return false
  await writeJsonAtomic(path, next)
  return true
}

const orgFor = await orgIndex()
const levels = onlyLevel ? [onlyLevel] : LEVEL_SPORT_IDS

console.log(`Youngest regulars (${today})`)
for (const sportId of levels) {
  const doc = await buildLevel(sportId, orgFor)
  if (!doc) continue
  const changed = await writeIfChanged(join(outDir, `${sportId}.json`), doc)
  console.log(`  sportId ${sportId}: ${doc.leagues.length} leagues${changed ? '' : ' (unchanged)'}`)
}
console.log('Done.')
