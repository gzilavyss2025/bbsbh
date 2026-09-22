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
// is tuned per measure. The only value fitted to the champions is the limit
// of three, and it is simply the worst any champion has done. Fitting nine
// separate thresholds instead would admit the same champions and would not
// survive leave-one-out; this does, 26 times out of 26.
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
// schedule; it reads the standings and applies the format (three division
// winners plus three wild cards per league). For completed seasons it reads
// the actual participants out of public/data/postseason-history.json, which
// is built from played games.
//
// Run: node scripts/gen-nine-keys.mjs
// Writes: public/data/nine-keys.json
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

export const FIRST_SEASON = 2000
export const BAR = 15 // top 15 of 30 passes a key
export const LIMIT = 3 // no champion since 2000 has failed more than this
const AL = 103
const NL = 104

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

// One season's 30 clubs, every raw input the nine keys need.
async function seasonInputs(year) {
  const base = 'https://statsapi.mlb.com/api/v1'
  const [standings, hitting, pitching, sp, rp, warBat, warPit] = await Promise.all([
    getJSON(`${base}/standings?leagueId=${AL},${NL}&season=${year}&standingsTypes=regularSeason`),
    getJSON(`${base}/teams/stats?season=${year}&sportId=1&stats=season&group=hitting&gameType=R`),
    getJSON(`${base}/teams/stats?season=${year}&sportId=1&stats=season&group=pitching&gameType=R`),
    getJSON(`${base}/teams/stats?season=${year}&sportId=1&stats=statSplits&group=pitching&sitCodes=sp&gameType=R`),
    getJSON(`${base}/teams/stats?season=${year}&sportId=1&stats=statSplits&group=pitching&sitCodes=rp&gameType=R`),
    getJSON(`${base}/stats?stats=sabermetrics&group=hitting&season=${year}&sportId=1&playerPool=ALL&limit=4000`),
    getJSON(`${base}/stats?stats=sabermetrics&group=pitching&season=${year}&sportId=1&playerPool=ALL&limit=4000`),
  ])

  const clubs = new Map()
  const put = (teamId, patch) => {
    const key = String(teamId)
    clubs.set(key, Object.assign(clubs.get(key) || { teamId: Number(teamId) }, patch))
  }

  for (const record of standings?.records ?? []) {
    for (const row of record.teamRecords ?? []) {
      put(row.team.id, {
        name: row.team.name,
        wins: row.wins,
        losses: row.losses,
        games: (row.wins ?? 0) + (row.losses ?? 0),
        winPct: num(row.winningPercentage),
        leagueId: record.league?.id ?? null,
        divisionId: record.division?.id ?? null,
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

  // WAR is a player-level feed; sum it per club. A player traded mid-season
  // appears once per club he played for, each row carrying that stint's WAR,
  // so a plain sum attributes each stint to the club that got it.
  const war = new Map()
  for (const source of [warBat, warPit]) {
    for (const split of source?.stats?.[0]?.splits ?? []) {
      const teamId = split.team?.id
      const value = Number(split.stat?.war)
      if (!teamId || Number.isNaN(value)) continue
      war.set(teamId, (war.get(teamId) ?? 0) + value)
    }
  }
  for (const [teamId, value] of war) put(teamId, { war: value })

  return [...clubs.values()].filter((c) => c.games > 0)
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

// Who holds a postseason place right now: three division leaders per league,
// then the next three by winning percentage. This is the 2022+ format. It is
// read from the standings on purpose — the schedule carries placeholder games
// for a bracket nobody has played.
export function projectField(clubs) {
  const field = []
  for (const leagueId of [AL, NL]) {
    const inLeague = clubs.filter((c) => c.leagueId === leagueId)
    const byDivision = new Map()
    for (const club of inLeague) {
      const current = byDivision.get(club.divisionId)
      if (!current || club.winPct > current.winPct) byDivision.set(club.divisionId, club)
    }
    const leaders = [...byDivision.values()]
    const leaderIds = new Set(leaders.map((c) => c.teamId))
    const wildCards = inLeague
      .filter((c) => !leaderIds.has(c.teamId))
      .sort((a, b) => b.winPct - a.winPct)
      .slice(0, 3)
    field.push(...leaders, ...wildCards)
  }
  return field.map((c) => c.teamId)
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
function validation(seasonScores, championOf, fieldOf, history) {
  const seasons = seasonScores.filter((s) => championOf.has(s.year))
  const failsOf = (year, teamId) => seasonScores.find((s) => s.year === year)?.scored.get(teamId)?.failed.length

  const reject = (limit) => {
    let october = 0
    let octoberTotal = 0
    let all = 0
    let allTotal = 0
    for (const { year, scored } of seasons) {
      const field = new Set(fieldOf.get(year) ?? [])
      for (const [teamId, s] of scored) {
        allTotal += 1
        if (s.failed.length > limit) all += 1
        if (field.has(teamId)) {
          octoberTotal += 1
          if (s.failed.length > limit) october += 1
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
  for (let limit = 0; limit <= KEYS.length; limit += 1) {
    const r = reject(limit)
    thresholds.push({
      limit,
      championsPassing: championFails.filter((f) => f <= limit).length,
      championTotal: championFails.length,
      rejectsOctober: Math.round(r.october * 10) / 10,
      rejectsAll: Math.round(r.all * 10) / 10,
    })
  }

  // Leave-one-out: rebuild the limit from every champion but one, then check
  // the one left out. This is what separates a rule from a curve fit.
  let leaveOneOut = 0
  for (let i = 0; i < championFails.length; i += 1) {
    const others = championFails.filter((_, j) => j !== i)
    if (championFails[i] <= Math.max(...others)) leaveOneOut += 1
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
  const real = reject(LIMIT).october
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
    leaveOneOut: { passed: leaveOneOut, of: championFails.length },
    placebo: { reps: REPS, p: Math.round((asStrong / REPS) * 1000) / 1000 },
  }
}

async function main() {
  const history = JSON.parse(
    readFileSync(join(REPO_ROOT, 'public', 'data', 'postseason-history.json'), 'utf8'),
  )
  const championOf = new Map()
  const fieldOf = new Map()
  for (const season of history.seasons ?? []) {
    championOf.set(season.year, season.championTeamId)
    const ids = new Set()
    for (const round of season.rounds ?? []) {
      for (const series of round.series ?? []) {
        ids.add(series.teamA.teamId)
        ids.add(series.teamB.teamId)
      }
    }
    fieldOf.set(season.year, [...ids])
  }

  // statsapi lists NEXT season in `seasons/all` as soon as its schedule is
  // drafted — a run on 2026-09-22 saw 2027, a season with no games and no
  // clubs. So this is only the upper bound to probe; the season the page
  // actually reports on is the last one that came back with real clubs.
  const seasonMeta = await getJSON('https://statsapi.mlb.com/api/v1/seasons/all?sportId=1')
  const newest = (seasonMeta?.seasons ?? []).reduce(
    (best, s) => (Number(s.seasonId) > best ? Number(s.seasonId) : best),
    FIRST_SEASON,
  )

  const champions = []
  const seasonScores = []
  let currentField = null

  for (let year = FIRST_SEASON; year <= newest; year += 1) {
    const clubs = await seasonInputs(year)
    if (clubs.length < 20) {
      console.error(`  ${year}: no season played yet, stopping`)
      break
    }
    const scored = scoreSeason(clubs)
    const byId = new Map(clubs.map((c) => [c.teamId, c]))
    seasonScores.push({ year, scored })

    const championId = championOf.get(year)
    if (championId != null && scored.has(championId)) {
      const club = byId.get(championId)
      const s = scored.get(championId)
      champions.push({
        year,
        teamId: championId,
        name: club.name,
        wins: club.wins,
        losses: club.losses,
        shortSeason: club.games < 100,
        ranks: s.ranks,
        failed: s.failed,
      })
    }

    // Every season with data overwrites this, so it ends up holding the most
    // recent one that was actually played.
    {
      const complete = championOf.has(year)
      const ids = complete ? fieldOf.get(year) : projectField(clubs)
      currentField = {
        season: year,
        complete,
        teams: ids
          .filter((id) => scored.has(id))
          .map((id) => {
            const club = byId.get(id)
            const s = scored.get(id)
            return {
              teamId: id,
              name: club.name,
              wins: club.wins,
              losses: club.losses,
              ranks: s.ranks,
              failed: s.failed,
            }
          })
          .sort((a, b) => a.failed.length - b.failed.length || a.ranks.offense - b.ranks.offense),
      }
    }
    console.error(`  ${year}: ${clubs.length} clubs${championId ? ', champion scored' : ''}`)
  }

  champions.sort((a, b) => b.year - a.year)

  const distribution = {}
  for (const c of champions) distribution[c.failed.length] = (distribution[c.failed.length] ?? 0) + 1
  const worst = champions.reduce((m, c) => Math.max(m, c.failed.length), 0)
  if (worst !== LIMIT) {
    console.error(`  NOTE: worst champion now fails ${worst}, file's limit says ${LIMIT}`)
  }

  const out = {
    generatedAt: new Date().toISOString(),
    bar: BAR,
    limit: LIMIT,
    firstSeason: FIRST_SEASON,
    keys: KEYS.map(({ id, label, note }) => ({ id, label, note })),
    distribution,
    champions,
    current: currentField,
    ...validation(seasonScores, championOf, fieldOf, history),
  }
  const path = join(REPO_ROOT, 'public', 'data', 'nine-keys.json')
  writeFileSync(path, `${JSON.stringify(out)}\n`)
  console.error(
    `wrote nine-keys.json — ${champions.length} champions, ${currentField?.teams.length ?? 0} clubs in the ${currentField?.season} field`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
