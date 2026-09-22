// Regenerates public/data/nine-keys.json — the Nine Keys report's whole data
// set: every World Series champion since 2000 scored against nine measures,
// and the clubs currently holding a postseason place scored the same way.
//
// THE QUESTION THE PAGE ASKS. Allan Lichtman predicts presidencies with
// thirteen true-or-false keys and one rule: the party in power loses if six
// come up false. Point that structure at a baseball season and the same shape
// works — but only as a COUNT, never as a checklist. The champions sitting at
// the limit reached it by different routes (as this is written, the 2014
// Giants on rotation, on-base and power; the 2003 Marlins on runs, bullpen
// and power), so a screen demanding every key pass is broken by whichever of
// them it meets first, while a count admits both. The page states which clubs
// are at the limit and what they share by reading the rows, never from a
// sentence written here — a regenerate can move both.
//
// This is also why the file stores RANKS rather than pass/fail: the page can
// redraw the line, and a reader can see how close a club was to the bar.
//
// ONE FITTED NUMBER, DELIBERATELY. Every key is scored at the SAME bar — top
// 15 of 30, the top half of the league, within that key's own season. Nothing
// is tuned per measure. The only value fitted to the champions is the limit,
// and it is not a constant: it is the worst any champion has done, read off
// the rows on every run. A new champion who fails one more key moves the
// limit with him, so the page's rule can never be contradicted by the table
// under it.
//
// HOW MUCH THE LIMIT RESTS ON ONE SEASON. A leave-one-out check on a maximum
// proves little: when two champions share the worst count, removing either
// leaves the other, so every champion "passes" by construction. The file
// instead says how many champions sit at the limit, and — when one sits there
// alone — what the limit would be without it.
//
// WHY WITHIN-SEASON RANKS AND NOT RAW NUMBERS. A 4.10 ERA was ordinary in
// 2000 and very good in 2014. Run environments move enough over 26 seasons
// that any absolute floor would read the era rather than the club. A rank
// among that season's 30 clubs is era-proof by construction, and it is also
// what a reader can check against a leader board.
//
// THE SABERMETRICS CALL NEEDS playerPool=ALL. Without it the endpoint
// silently returns only qualified players, which drops every bench bat and
// most of a bullpen — a club's WAR total then reads 20-40% low, and the
// "talent" key ranks nonsense. There is no error and no empty response to
// catch; the numbers are just quietly wrong. Verified against 2026: 747
// hitters and 861 pitchers with the flag, a small fraction of that without.
//
// A TEAM'S BULLPEN ERA HAS ONE CLEAN SOURCE. `stats=statSplits` with
// `sitCodes=rp` (and `sp` for the rotation) returns 30 rows carrying a real
// split ERA, back to 2000. Save percentage was tried first and says something
// different and wrong: the 2019 Nationals converted saves at a middling rate
// while carrying the 29th-best bullpen ERA in baseball (5.68), and they won
// the World Series. The split is the measure; the save is not.
//
// 2020 IS IN, AND SETS NO FLOOR. A 60-game season with a 16-club field is a
// different animal, and dropping it is the easy call. It stays because the
// 2020 Dodgers ranked first or second in nearly everything and fail no key —
// they cannot move the limit in either direction, so including them costs the
// rule nothing and costs the reader one less exception to remember. The file
// flags the season so the page can mark the row.
//
// A SCHEDULED POSTSEASON GAME IS NOT A RESULT. statsapi puts the coming
// bracket on the schedule as placeholder games well before the regular season
// ends. This generator therefore never reads the current field off the
// schedule. The field comes from one of three places, best first:
//   1. public/data/postseason-history.json, built from played games. That
//      file is committed by hand, so it lags the end of a season.
//   2. Once the regular season is over, the standings' own `clinched` flag,
//      which marks exactly the twelve clubs that qualified. This covers the
//      weeks between the last regular-season game and the next hand run of
//      gen-postseason-history, and applies MLB's tiebreakers for free.
//   3. While the season is still being played, the Wild Card board's own
//      shaping (shapeWildCard in src/api/standings.js), imported rather than
//      copied: the three division leaders by the standings' `divisionLeader`
//      flag, then every club ranked 3rd or better for the wild card. A tie
//      for the last place keeps both clubs, as the app's board does.
//
// FINISHED SEASONS ARE CACHED. The Talent key needs one sabermetrics query
// per club and group (see seasonInputs), so a full rebuild is about 1,800
// requests. A season whose regular season is over and whose field is settled
// cannot change, so its raw inputs are kept in scripts/data/nine-keys-
// seasons.json and the nightly run fetches only the season still in play.
// `--refresh` ignores the cache and fetches every season again.
//
// Run: node scripts/gen-nine-keys.mjs [--refresh]
// Writes: public/data/nine-keys.json, scripts/data/nine-keys-seasons.json
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mapConcurrent } from './lib/concurrency.mjs'
import { shapeWildCard } from '../src/api/standings.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const API = 'https://statsapi.mlb.com/api/v1'
const CACHE_PATH = join(REPO_ROOT, 'scripts', 'data', 'nine-keys-seasons.json')

export const FIRST_SEASON = 2000
export const BAR = 15 // top 15 of 30 passes a key
const FIELD_SIZE = 12 // clubs in the postseason, 2022 on

// A MISSING NUMBER MUST NOT BECOME A GOOD ONE. Five of the nine keys read
// better-is-lower and so are negated, and `-null` is `-0` — a finite value
// that sorts ahead of every real one. A club with no starter split would
// therefore rank FIRST on rotation rather than failing the key. Likewise
// `null / games` is 0, which quietly ranks worst. These two helpers make an
// absent input stay absent all the way to the ranker, which drops it and
// fails the key. Both cases are covered in test/nine-keys.test.js.
const neg = (v) => (v == null ? null : -v)
const per = (a, b) => (a == null || !b ? null : a / b)

// Each key: how to read it off a club's season, and which direction is good.
// `pick` returns a number where HIGHER is always better, so ranking is one
// sort for all nine — or null when the club has nothing to score.
export const KEYS = [
  { id: 'offense', label: 'Runs', note: 'runs scored per game', pick: (t) => per(t.runsScored, t.games) },
  { id: 'prevent', label: 'Runs against', note: 'runs allowed per game', pick: (t) => neg(per(t.runsAllowed, t.games)) },
  { id: 'rotation', label: 'Rotation', note: "starting pitchers' ERA", pick: (t) => neg(t.spERA) },
  { id: 'bullpen', label: 'Bullpen', note: "relief pitchers' ERA", pick: (t) => neg(t.rpERA) },
  { id: 'onbase', label: 'On base', note: 'team on-base percentage', pick: (t) => t.obp ?? null },
  { id: 'power', label: 'Power', note: 'home runs per plate appearance', pick: (t) => per(t.hr, t.pa) },
  { id: 'contact', label: 'Contact', note: 'how rarely the lineup strikes out', pick: (t) => neg(per(t.batSO, t.pa)) },
  { id: 'whip', label: 'WHIP', note: 'baserunners allowed per inning', pick: (t) => neg(t.whip) },
  { id: 'talent', label: 'Talent', note: 'wins above replacement, whole roster', pick: (t) => t.war ?? null },
]

const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v))

async function getJSON(url) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status}`)
      return await res.json()
    } catch (err) {
      if (attempt === 3) throw new Error(`${url} failed: ${err.message}`)
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)))
    }
  }
  return null
}

// Talent WAR per club, from one sabermetrics response per club and group.
//
// A TRADED PLAYER'S WAR MUST BE SPLIT BY STINT, and the bulk leader board
// cannot do it. Without a `teamId`, the endpoint returns ONE row per player:
// the season total, filed under his LAST club (2024: Jazz Chisholm, one row,
// Yankees, 4.05 WAR, his Marlins months included). Summing that would hand
// every deadline buyer its new players' whole seasons, and take the same WAR
// away from every seller. With `teamId`, the rows are that club's stints only
// (Chisholm: 1.79 for Miami, 2.26 for New York). So each response is summed
// to the club it was ASKED for; a row naming some other club is ignored.
export function warByTeam(responses) {
  const war = new Map()
  for (const { teamId, splits } of responses) {
    for (const split of splits ?? []) {
      if (split.team?.id != null && split.team.id !== teamId) continue
      const value = Number(split.stat?.war)
      if (Number.isNaN(value)) continue
      war.set(teamId, (war.get(teamId) ?? 0) + value)
    }
  }
  return war
}

// mapConcurrent turns a failed item into null. For this report a missing
// season or club is a wrong number, not a gap, so any null fails the run.
async function mapAll(items, limit, mapper, what) {
  const results = await mapConcurrent(items, limit, mapper)
  const missing = results.filter((r) => r == null).length
  if (missing) throw new Error(`${missing} of ${items.length} ${what} failed to load`)
  return results
}

// One season's 30 clubs, every raw input the nine keys need. Returns the raw
// standings records too: the projected field is shaped from them.
async function seasonInputs(year) {
  const [standings, hitting, pitching, sp, rp] = await Promise.all([
    getJSON(`${API}/standings?leagueId=103,104&season=${year}&standingsTypes=regularSeason`),
    getJSON(`${API}/teams/stats?season=${year}&sportId=1&stats=season&group=hitting&gameType=R`),
    getJSON(`${API}/teams/stats?season=${year}&sportId=1&stats=season&group=pitching&gameType=R`),
    getJSON(`${API}/teams/stats?season=${year}&sportId=1&stats=statSplits&group=pitching&sitCodes=sp&gameType=R`),
    getJSON(`${API}/teams/stats?season=${year}&sportId=1&stats=statSplits&group=pitching&sitCodes=rp&gameType=R`),
  ])

  const clubs = new Map()
  const put = (teamId, patch) => {
    const key = String(teamId)
    clubs.set(key, Object.assign(clubs.get(key) || { teamId: Number(teamId) }, patch))
  }

  const records = standings?.records ?? []
  for (const record of records) {
    for (const row of record.teamRecords ?? []) {
      put(row.team.id, {
        name: row.team.name,
        wins: row.wins,
        losses: row.losses,
        games: (row.wins ?? 0) + (row.losses ?? 0),
        clinched: row.clinched === true,
      })
    }
  }

  for (const split of hitting?.stats?.[0]?.splits ?? []) {
    put(split.team.id, {
      runsScored: num(split.stat.runs),
      hr: num(split.stat.homeRuns),
      obp: num(split.stat.obp),
      pa: num(split.stat.plateAppearances),
      batSO: num(split.stat.strikeOuts),
    })
  }
  for (const split of pitching?.stats?.[0]?.splits ?? []) {
    put(split.team.id, { runsAllowed: num(split.stat.runs), whip: num(split.stat.whip) })
  }
  for (const split of sp?.stats?.[0]?.splits ?? []) put(split.team.id, { spERA: num(split.stat.era) })
  for (const split of rp?.stats?.[0]?.splits ?? []) put(split.team.id, { rpERA: num(split.stat.era) })

  const played = [...clubs.values()].filter((c) => c.games > 0)
  const queries = played.flatMap((c) => ['hitting', 'pitching'].map((group) => ({ teamId: c.teamId, group })))
  const responses = await mapAll(
    queries,
    6,
    async ({ teamId, group }) => {
      const json = await getJSON(
        `${API}/stats?stats=sabermetrics&group=${group}&season=${year}&sportId=1&playerPool=ALL&limit=4000&teamId=${teamId}`,
      )
      return { teamId, splits: json?.stats?.[0]?.splits ?? [] }
    },
    `${year} WAR queries`,
  )
  for (const [teamId, value] of warByTeam(responses)) put(teamId, { war: Math.round(value * 1000) / 1000 })

  return { clubs: played, records }
}

// Rank 1..30 on every key, then count the failures.
//
// TIES SHARE THE BETTER RANK, and this is not a detail. Several of these
// measures are published rounded — WHIP to two decimals, OBP to three — so
// exact ties are common, and a tie landing across the 15/16 line decides a
// key on nothing but sort order. The 2013 Red Sox are the case that found
// this: their 1.30 WHIP ties three other clubs straddling the bar, and a
// plain index-based rank flipped them between failing two keys and three,
// which moved the whole file's champion distribution. Standard competition
// ranking (equal values take the best rank available, the next distinct
// value skips ahead) makes the answer deterministic and never fails a club
// for a coin flip. It can let slightly more than 15 clubs clear a key in a
// season with a tie at the bar; that is the intended trade.
export function scoreSeason(clubs) {
  const ranks = new Map()
  for (const key of KEYS) {
    const ordered = clubs
      .map((c) => ({ teamId: c.teamId, value: key.pick(c) }))
      .filter((r) => r.value != null && Number.isFinite(r.value))
      .sort((a, b) => b.value - a.value)
    let previousValue = null
    let previousRank = 0
    ordered.forEach((row, i) => {
      const rank = previousValue != null && row.value === previousValue ? previousRank : i + 1
      previousValue = row.value
      previousRank = rank
      if (!ranks.has(row.teamId)) ranks.set(row.teamId, {})
      ranks.get(row.teamId)[key.id] = rank
    })
  }
  const scored = new Map()
  for (const club of clubs) {
    const r = ranks.get(club.teamId) ?? {}
    const failed = KEYS.filter((k) => r[k.id] == null || r[k.id] > BAR).map((k) => k.id)
    scored.set(club.teamId, { ranks: r, failed })
  }
  return scored
}

// Who holds a postseason place while the season is still being played: the
// app's own Wild Card board, fed the raw standings records. Division leaders
// come from the standings' `divisionLeader` flag, and the wild cards are every
// club the board ranks 3rd or better — so a tie for the last place keeps both
// clubs rather than letting array order pick one. It is read from the
// standings on purpose; the schedule carries placeholder games for a bracket
// nobody has played.
export function projectField(records) {
  return shapeWildCard(records).flatMap((league) => [
    ...league.leaders.map((t) => t.id),
    ...league.wildcard.filter((t) => t.inWildCard).map((t) => t.id),
  ])
}

// Which clubs a season's field holds, and whether that is final. `history` is
// the played bracket, when postseason-history.json has the season; otherwise
// a finished regular season names its field through the `clinched` flag, and
// only a season still being played falls back to the projection.
export function seasonField({ clubs, records, history, regularSeasonOver }) {
  if (history) return { ids: history, final: true }
  const clinched = clubs.filter((c) => c.clinched).map((c) => c.teamId)
  if (regularSeasonOver && clinched.length === FIELD_SIZE) return { ids: clinched, final: true }
  return { ids: projectField(records ?? []), final: false }
}

// How far a club got, 0 (missed October) to 5 (won the World Series). Read
// off the bracket rather than from a seed or an era rule, so a format change
// needs no edit here. Rung 2 — won a round without reaching the LCS — only
// exists from 2012, when the Wild Card round became a separate series; it is
// structurally empty before that, which is correct rather than a gap.
export function ladderFor(season) {
  const rounds = new Map()
  for (const round of season.rounds ?? []) {
    for (const series of round.series ?? []) {
      for (const side of [series.teamA, series.teamB]) {
        if (!rounds.has(side.teamId)) rounds.set(side.teamId, new Set())
        rounds.get(side.teamId).add(round.key)
      }
    }
  }
  const out = new Map()
  for (const [teamId, seen] of rounds) {
    if (teamId === season.championTeamId) out.set(teamId, 5)
    else if (seen.has('worldseries')) out.set(teamId, 4)
    else if (seen.has('lcs')) out.set(teamId, 3)
    else if (seen.has('division')) out.set(teamId, seen.has('wildcard') ? 2 : 1)
    else out.set(teamId, 1)
  }
  return out
}

// A tiny seeded generator, so the placebo figure is reproducible and a
// regenerate does not churn the file with a new random number every run.
function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

// Everything the page states about how well the rule holds up. Computed here,
// from the same ranked data the tables are drawn from, so a figure on the page
// can never drift from the file underneath it. Only completed seasons count —
// a season still being played has no outcome to score against.
function validation(seasonScores, championOf, fieldOf, history, limit) {
  const seasons = seasonScores.filter((s) => championOf.has(s.year))
  const failsOf = (year, teamId) => seasonScores.find((s) => s.year === year)?.scored.get(teamId)?.failed.length

  const reject = (line) => {
    let october = 0
    let octoberTotal = 0
    let all = 0
    let allTotal = 0
    for (const { year, scored } of seasons) {
      const field = new Set(fieldOf.get(year) ?? [])
      for (const [teamId, s] of scored) {
        allTotal += 1
        if (s.failed.length > line) all += 1
        if (field.has(teamId)) {
          octoberTotal += 1
          if (s.failed.length > line) october += 1
        }
      }
    }
    return {
      october: octoberTotal ? (100 * october) / octoberTotal : 0,
      all: allTotal ? (100 * all) / allTotal : 0,
    }
  }

  const championFails = seasons.map(({ year }) => failsOf(year, championOf.get(year)))
  const thresholds = []
  for (let line = 0; line <= KEYS.length; line += 1) {
    const r = reject(line)
    thresholds.push({
      limit: line,
      championsPassing: championFails.filter((f) => f <= line).length,
      championTotal: championFails.length,
      rejectsOctober: Math.round(r.october * 10) / 10,
      rejectsAll: Math.round(r.all * 10) / 10,
    })
  }

  // How much the limit rests on one season. When two or more champions share
  // the worst count, no single one sets it; when one sits there alone, say
  // what the limit would be without it.
  const atLimit = championFails.filter((f) => f === limit).length
  const others = championFails.filter((f) => f !== limit)
  const limitSupport = {
    atLimit,
    of: championFails.length,
    withoutLoneWorst: atLimit === 1 ? Math.max(0, ...others) : null,
  }

  // Mean keys failed by how far a club got. Nothing in the rule was fitted to
  // any outcome except winning, so this is out-of-target.
  const buckets = new Map()
  for (const season of history.seasons ?? []) {
    const scored = seasonScores.find((s) => s.year === season.year)?.scored
    if (!scored) continue
    const ladder = ladderFor(season)
    for (const [teamId, s] of scored) {
      const rung = ladder.get(teamId) ?? 0
      if (!buckets.has(rung)) buckets.set(rung, [])
      buckets.get(rung).push(s.failed.length)
    }
  }
  const ladder = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rung, values]) => ({
      rung,
      clubs: values.length,
      meanFailed: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
    }))

  // Placebo: build the same screen from a random October club per season,
  // thousands of times, and see how often it filters as hard as the real one.
  const REPS = 3000
  const random = seededRandom(20260922)
  const real = reject(limit).october
  let asStrong = 0
  for (let rep = 0; rep < REPS; rep += 1) {
    let limit = 0
    for (const { year } of seasons) {
      const field = fieldOf.get(year) ?? []
      const pick = field[Math.floor(random() * field.length)]
      const f = failsOf(year, pick)
      if (f != null && f > limit) limit = f
    }
    if (reject(limit).october >= real) asStrong += 1
  }

  return {
    thresholds,
    ladder,
    limitSupport,
    placebo: { reps: REPS, p: Math.round((asStrong / REPS) * 1000) / 1000 },
  }
}

// A played bracket's clubs, per season, from postseason-history.json.
function fieldsFromHistory(history) {
  const fieldOf = new Map()
  for (const season of history.seasons ?? []) {
    const ids = new Set()
    for (const round of season.rounds ?? []) {
      for (const series of round.series ?? []) {
        ids.add(series.teamA.teamId)
        ids.add(series.teamB.teamId)
      }
    }
    fieldOf.set(season.year, [...ids])
  }
  return fieldOf
}

const rowOf = (club, s) => ({
  teamId: club.teamId,
  name: club.name,
  wins: club.wins,
  losses: club.losses,
  ranks: s.ranks,
  failed: s.failed,
})

// Everything the file says, from the raw seasons and the played brackets. No
// fetching here, so the whole report can be built from fixtures in a test.
// `seasons` is oldest first: [{ year, clubs, records?, regularSeasonOver }].
export function buildReport(seasons, history) {
  const championOf = new Map((history.seasons ?? []).map((s) => [s.year, s.championTeamId]))
  const fieldOf = fieldsFromHistory(history)

  const champions = []
  const seasonScores = []
  let current = null
  for (const { year, clubs, records, regularSeasonOver } of seasons) {
    const scored = scoreSeason(clubs)
    const byId = new Map(clubs.map((c) => [c.teamId, c]))
    seasonScores.push({ year, scored })

    const championId = championOf.get(year)
    if (championId != null && scored.has(championId)) {
      const club = byId.get(championId)
      champions.push({
        year,
        ...rowOf(club, scored.get(championId)),
        shortSeason: club.games < 100,
      })
    }

    // Every season overwrites this, so it ends up holding the newest one.
    const { ids, final } = seasonField({ clubs, records, history: fieldOf.get(year), regularSeasonOver })
    current = {
      season: year,
      complete: final,
      teams: ids
        .filter((id) => scored.has(id))
        .map((id) => rowOf(byId.get(id), scored.get(id)))
        .sort((a, b) => a.failed.length - b.failed.length || a.ranks.offense - b.ranks.offense),
    }
  }

  champions.sort((a, b) => b.year - a.year)
  const distribution = {}
  for (const c of champions) distribution[c.failed.length] = (distribution[c.failed.length] ?? 0) + 1
  // The rule's one fitted number, read off the rows every run.
  const limit = champions.reduce((m, c) => Math.max(m, c.failed.length), 0)

  return {
    bar: BAR,
    limit,
    firstSeason: seasons[0]?.year ?? FIRST_SEASON,
    keys: KEYS.map(({ id, label, note }) => ({ id, label, note })),
    distribution,
    champions,
    current,
    ...validation(seasonScores, championOf, fieldOf, history, limit),
  }
}

function readCache() {
  if (!existsSync(CACHE_PATH)) return {}
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf8')).seasons ?? {}
  } catch {
    return {}
  }
}

async function main() {
  const refresh = process.argv.includes('--refresh')
  const history = JSON.parse(
    readFileSync(join(REPO_ROOT, 'public', 'data', 'postseason-history.json'), 'utf8'),
  )
  const fieldOf = fieldsFromHistory(history)
  const cache = refresh ? {} : readCache()

  // statsapi lists NEXT season in `seasons/all` as soon as its schedule is
  // drafted — a run on 2026-09-22 saw 2027, a season with no games and no
  // clubs. So this is only the upper bound to probe; the season the page
  // actually reports on is the last one that came back with real clubs.
  const seasonMeta = await getJSON(`${API}/seasons/all?sportId=1`)
  const endOf = new Map((seasonMeta?.seasons ?? []).map((s) => [Number(s.seasonId), s.regularSeasonEndDate]))
  const newest = Math.max(FIRST_SEASON, ...endOf.keys())
  const today = new Date().toISOString().slice(0, 10)

  const years = []
  for (let year = FIRST_SEASON; year <= newest; year += 1) years.push(year)
  const fetched = await mapAll(
    years.filter((year) => !cache[year]),
    3,
    async (year) => ({ year, ...(await seasonInputs(year)) }),
    'seasons',
  )
  const fresh = new Map(fetched.map((f) => [f.year, f]))

  const seasons = []
  const nextCache = {}
  for (const year of years) {
    const hit = fresh.get(year)
    const clubs = cache[year] ?? hit.clubs
    if (clubs.length < 20) {
      console.error(`  ${year}: no season played yet, stopping`)
      break
    }
    const regularSeasonOver = Boolean(endOf.get(year)) && endOf.get(year) < today
    const season = { year, clubs, records: hit?.records, regularSeasonOver }
    seasons.push(season)
    // Cache a season only once nothing about it can move: its regular season
    // is over and its field is known without the standings records.
    const settled = seasonField({ clubs, history: fieldOf.get(year), regularSeasonOver }).final
    if (regularSeasonOver && settled) nextCache[year] = clubs
    console.error(`  ${year}: ${clubs.length} clubs${cache[year] ? ' (cached)' : ''}`)
  }

  const report = buildReport(seasons, history)
  const path = join(REPO_ROOT, 'public', 'data', 'nine-keys.json')
  writeFileSync(path, `${JSON.stringify({ generatedAt: new Date().toISOString(), ...report })}\n`)
  writeFileSync(
    CACHE_PATH,
    `${JSON.stringify({
      note: 'GENERATED by scripts/gen-nine-keys.mjs: raw inputs for finished seasons. Delete it, or run with --refresh, to fetch every season again.',
      seasons: nextCache,
    })}\n`,
  )
  console.error(
    `wrote nine-keys.json — ${report.champions.length} champions, limit ${report.limit}, ${report.current?.teams.length ?? 0} clubs in the ${report.current?.season} field`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
