// Issue #1099 — does a Triple-A club keep the hitters its scatter would draw?
//
// The team hub's challenge card draws one dot a man over the men who cleared
// 200 plate appearances FOR THAT CLUB (absExposure.js `clubChallengeBoard`
// floors the per-club rows, not the season fold). So the population to measure
// churn on is exactly that: qualified per club, not qualified per season.
//
// THE TEST. Of the men a club qualified, how many both played for it in the
// opening stretch and were still playing for it in the closing one. MLB is the
// control. The question is how much worse Triple-A is, not whether it moves.
//
// PRESENCE IS A PLATE APPEARANCE, NOT A ROSTER ROW. The dots are made of plate
// appearances, so a man on the injured list through April did not supply any
// and is not part of "this club's hitters" in April. Roster membership would
// count him and measure a different thing.
//
// TWO WINDOW DEFINITIONS, because the answer must not be an artifact of where
// the lines are drawn:
//   calendar — the level's own opening day to 30 April, and 1 September to the
//              last day played. This is the issue's own wording.
//   thirty   — the first 30 days of the level's regular season against the last
//              30 days played. Season position rather than calendar, because
//              Triple-A opens two days later and closes a week earlier.
//
// Writes churn.json (gitignored, rebuilds in about four minutes) and prints
// every figure quoted in research.md §"Whether Triple-A is worth drawing".

import { writeFile } from 'node:fs/promises'

const SEASON = 2026
const MIN_PLATE_APPEARANCES = 200 // src/api/around-the-game/absExposure.js
const TODAY = process.env.CHURN_TODAY ?? new Date().toISOString().slice(0, 10)

const LEVELS = [
  [1, 'MLB'],
  [11, 'AAA'],
]

const iso = (d) => d.toISOString().slice(0, 10)
const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return iso(d)
}
const min = (a, b) => (a < b ? a : b)

async function getJson(url) {
  let last
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      return await res.json()
    } catch (err) {
      last = err
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
  throw last
}

// A window's hydrate, cut to one sport so a Triple-A club's promoted man does
// not bring his major-league plate appearances back with him.
const windowUrl = (teamId, sportId, start, end, withSeason) =>
  `https://statsapi.mlb.com/api/v1/teams/${teamId}/roster?rosterType=fullSeason&season=${SEASON}` +
  `&hydrate=person(stats(type=[${withSeason ? 'season,' : ''}byDateRange],group=hitting,` +
  `startDate=${start},endDate=${end},season=${SEASON},sportId=${sportId}))`

// statsapi returns each byDateRange split TWICE under this hydrate — the same
// team and the same line, duplicated. Dedupe on team id; a plain length check
// would report every man as multi-club.
function teamsIn(person, typeName) {
  const splits = (person?.stats ?? []).find((g) => g.type?.displayName === typeName)?.splits ?? []
  const out = new Map()
  for (const s of splits) {
    const id = s.team?.id
    if (id == null) continue
    out.set(id, Math.max(out.get(id) ?? 0, s.stat?.plateAppearances ?? 0))
  }
  return out
}

const report = { season: SEASON, asOf: TODAY, floor: MIN_PLATE_APPEARANCES, levels: {} }

for (const [sportId, level] of LEVELS) {
  const seasons = await getJson(
    `https://statsapi.mlb.com/api/v1/seasons?sportId=${sportId}&season=${SEASON}`,
  )
  const s = seasons.seasons?.[0] ?? {}
  const opened = s.regularSeasonStartDate
  const lastPlayed = min(s.regularSeasonEndDate, TODAY)

  const windows = {
    calendar: {
      early: [opened, `${SEASON}-04-30`],
      late: [`${SEASON}-09-01`, lastPlayed],
    },
    thirty: {
      early: [opened, addDays(opened, 29)],
      late: [addDays(lastPlayed, -29), lastPlayed],
    },
  }

  const { teams } = await getJson(
    `https://statsapi.mlb.com/api/v1/teams?sportId=${sportId}&season=${SEASON}`,
  )
  console.log(`\n${level}: ${teams.length} clubs, opened ${opened}, last played ${lastPlayed}`)
  for (const [name, w] of Object.entries(windows)) {
    console.log(`  ${name}: early ${w.early.join('..')}  late ${w.late.join('..')}`)
  }

  const clubs = []
  let foreignSplits = 0
  for (const team of teams) {
    // One call per window. The first also carries the season line, which is
    // what the 200-plate-appearance floor is applied to.
    const seen = {}
    let qualified = null
    for (const [name, w] of Object.entries(windows)) {
      for (const half of ['early', 'late']) {
        const first = qualified === null
        const roster = await getJson(
          windowUrl(team.id, sportId, w[half][0], w[half][1], first),
        )
        if (first) {
          qualified = new Map()
          for (const p of roster.roster ?? []) {
            const pa = teamsIn(p.person, 'season').get(team.id) ?? 0
            if (pa >= MIN_PLATE_APPEARANCES) qualified.set(p.person.id, { name: p.person.fullName, pa })
          }
        }
        const present = new Set()
        for (const p of roster.roster ?? []) {
          const byTeam = teamsIn(p.person, 'byDateRange')
          for (const id of byTeam.keys()) if (id !== team.id) foreignSplits++
          if ((byTeam.get(team.id) ?? 0) > 0) present.add(p.person.id)
        }
        seen[`${name}:${half}`] = present
      }
    }

    const club = { teamId: team.id, name: team.name, qualified: qualified.size, men: [] }
    for (const [playerId, info] of qualified) {
      club.men.push({
        playerId,
        name: info.name,
        pa: info.pa,
        calendarEarly: seen['calendar:early'].has(playerId),
        calendarLate: seen['calendar:late'].has(playerId),
        thirtyEarly: seen['thirty:early'].has(playerId),
        thirtyLate: seen['thirty:late'].has(playerId),
      })
    }
    for (const def of ['calendar', 'thirty']) {
      const key = def === 'calendar' ? ['calendarEarly', 'calendarLate'] : ['thirtyEarly', 'thirtyLate']
      club[def] = {
        both: club.men.filter((m) => m[key[0]] && m[key[1]]).length,
        early: club.men.filter((m) => m[key[0]]).length,
        late: club.men.filter((m) => m[key[1]]).length,
      }
    }
    clubs.push(club)
    process.stdout.write('.')
  }
  console.log('')
  report.levels[level] = { opened, lastPlayed, windows, clubs, foreignSplits }
}

await writeFile('.scratch/abs-reports/churn.json', JSON.stringify(report, null, 1))

// ---------------------------------------------------------------------------
// The figures.
// ---------------------------------------------------------------------------

const pct = (n, d) => (d > 0 ? ((n / d) * 100).toFixed(1) : '—')
const median = (xs) => {
  const v = [...xs].sort((a, b) => a - b)
  if (!v.length) return null
  const i = (v.length - 1) / 2
  return Number.isInteger(i) ? v[i] : (v[Math.floor(i)] + v[Math.ceil(i)]) / 2
}

for (const def of ['calendar', 'thirty']) {
  console.log(`\n=== RETENTION, ${def} windows ===`)
  console.log('level  clubs  qualified  kept  pooled%  median club%  worst club%  best club%')
  for (const [, level] of LEVELS) {
    const clubs = report.levels[level].clubs
    const q = clubs.reduce((a, c) => a + c.qualified, 0)
    const both = clubs.reduce((a, c) => a + c[def].both, 0)
    const rates = clubs.filter((c) => c.qualified > 0).map((c) => (c[def].both / c.qualified) * 100)
    console.log(
      `${level.padEnd(6)} ${String(clubs.length).padStart(5)} ${String(q).padStart(10)}` +
        ` ${String(both).padStart(5)} ${pct(both, q).padStart(8)}` +
        ` ${median(rates).toFixed(1).padStart(13)} ${Math.min(...rates).toFixed(1).padStart(12)}` +
        ` ${Math.max(...rates).toFixed(1).padStart(11)}`,
    )
  }
}

console.log('\n=== QUALIFIED MEN PER CLUB ===')
for (const [, level] of LEVELS) {
  const clubs = report.levels[level].clubs
  const q = clubs.map((c) => c.qualified)
  console.log(
    `${level.padEnd(6)} total ${q.reduce((a, b) => a + b, 0)}` +
      `  median ${median(q)}  min ${Math.min(...q)}  max ${Math.max(...q)}` +
      `  clubs under 8: ${q.filter((x) => x < 8).length}`,
  )
}

console.log('\n=== WHERE THE LOSS IS, calendar windows ===')
for (const [, level] of LEVELS) {
  const clubs = report.levels[level].clubs
  const q = clubs.reduce((a, c) => a + c.qualified, 0)
  const early = clubs.reduce((a, c) => a + c.calendar.early, 0)
  const late = clubs.reduce((a, c) => a + c.calendar.late, 0)
  const both = clubs.reduce((a, c) => a + c.calendar.both, 0)
  console.log(
    `${level.padEnd(6)} qualified ${q}  there in April ${early} (${pct(early, q)}%)` +
      `  there in September ${late} (${pct(late, q)}%)  both ${both} (${pct(both, q)}%)`,
  )
}

console.log('\n=== THE THREE WORST AND THREE BEST CLUBS, calendar ===')
for (const [, level] of LEVELS) {
  const ranked = report.levels[level].clubs
    .filter((c) => c.qualified > 0)
    .map((c) => ({ name: c.name, q: c.qualified, r: (c.calendar.both / c.qualified) * 100 }))
    .sort((a, b) => a.r - b.r)
  const line = (c) => `${c.name} ${c.r.toFixed(0)}% of ${c.q}`
  console.log(`${level}  worst: ${ranked.slice(0, 3).map(line).join(' | ')}`)
  console.log(`${' '.repeat(level.length)}  best:  ${ranked.slice(-3).reverse().map(line).join(' | ')}`)
}

for (const [, level] of LEVELS) {
  console.log(`\n${level} splits carrying another club: ${report.levels[level].foreignSplits}`)
}

// ---------------------------------------------------------------------------
// WHERE THE MISSING MEN WENT — churn measured is not churn explained.
//
// A Triple-A club that loses half its qualified hitters by September has not
// necessarily lost them to nothing. Sweep every major-league club's September
// window once and ask how many of the absent men were in the majors instead.
// The answer decides whether the gap reads as "the affiliate is a turnstile"
// or as "the affiliate graduated its best hitters", which are the same number
// and a different sentence.
// ---------------------------------------------------------------------------

const aaa = report.levels.AAA
const [lateStart, lateEnd] = aaa.windows.calendar.late
const majors = await getJson(
  `https://statsapi.mlb.com/api/v1/teams?sportId=1&season=${SEASON}`,
)
const inMajorsLate = new Set()
for (const team of majors.teams) {
  const roster = await getJson(windowUrl(team.id, 1, lateStart, lateEnd, false))
  for (const p of roster.roster ?? []) {
    for (const pa of teamsIn(p.person, 'byDateRange').values()) if (pa > 0) inMajorsLate.add(p.person.id)
  }
  process.stdout.write('.')
}
console.log('')

const absent = aaa.clubs.flatMap((c) => c.men.filter((m) => !m.calendarLate))
const promoted = absent.filter((m) => inMajorsLate.has(m.playerId))
console.log('\n=== WHERE THE MISSING TRIPLE-A MEN WENT, September ===')
console.log(
  `absent from their club in September: ${absent.length} of ${aaa.clubs.reduce((a, c) => a + c.qualified, 0)}` +
    `  |  in the majors instead: ${promoted.length} (${pct(promoted.length, absent.length)}%)` +
    `  |  elsewhere or not playing: ${absent.length - promoted.length}`,
)
report.aaaAbsent = { total: absent.length, inMajors: promoted.length }
await writeFile('.scratch/abs-reports/churn.json', JSON.stringify(report, null, 1))
