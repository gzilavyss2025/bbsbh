// Builds the team-success outcome ladder: for every MLB team, every season
// 2000-2025, how far that team's postseason run went. This is the foundation
// dataset every Contender Diary factor spike (payroll, roster age, trades,
// injuries, star-player concentration, ...) joins against — it answers
// nothing about WHY a team advanced, only HOW FAR each team got.
//
// SOURCE: public/data/postseason-history.json alone. No new statsapi pull.
// That file already carries, per season, every postseason participant's
// 1-6 seed (see its own generator header for how seed is derived from each
// league's `divisionChamp` standings flag). Verified live against the file's
// own committed data (2000-2025): a team's seed is 1-3 in EVERY MLB
// postseason format between 2000 and 2025 if and only if it won its
// division — pre-2012 (4 teams/league, 1 wild card), 2012-2021 (5/league, 2
// wild cards), 2022+ (6/league, 3 wild cards). There have always been
// exactly 3 divisions per league in this window, so "seed <= 3" is a safe,
// format-independent stand-in for the standings' own `divisionChamp` flag —
// no separate standings pull needed. A team NOT in the file for a season
// missed the postseason outright, and no division winner has ever missed the
// postseason (division champion has guaranteed a berth since divisional play
// began), so "not in the bracket" and "did not win the division" always
// agree — the ladder needs no separate "missed but somehow won the
// division" case.
//
// THE LADDER (0-5) is the nested "how far" axis — F implies E implies D
// implies C implies A, so a single ordinal number carries all of them:
//   0  did not make the postseason
//   1  made the postseason (A), lost the very first series it played
//   2  won at least one round (C) but did not reach the LCS — only
//      possible 2012+, where the Wild Card round is a separate series from
//      the Division Series (pre-2012 winning the only round WAS reaching
//      the LCS, so rung 2 is structurally empty before 2012 — expected, not
//      a bug)
//   3  reached the LCS (D), lost it
//   4  reached the World Series (E), lost it
//   5  won the World Series (F)
// `wonDivision` (B) is stored SEPARATELY, not as a rung — a Wild Card team
// can out-advance a division winner (2014 Royals, 2002 Angels), so B does
// not nest inside the 0-5 axis the way A/C/D/E/F do. Treat it as its own
// binary covariate.
//
// EXPANSION-FREE WINDOW: all 30 current franchise ids have existed, at
// their CURRENT team id, for this entire span (last expansion 1998); a
// relocation (Montreal->Washington, still 120; Oakland->Sacramento, still
// 133) never changes the id, so ALL_MLB_TEAM_IDS below needs no per-season
// membership logic. Hardcoded here rather than imported from
// src/lib/teams.js on purpose — this is a self-contained research script,
// same convention as the homegrown-dependence spike's own scripts.
//
// 2020 is flagged `shortSeason: true` (60 games, expanded 16-team field) —
// left IN the ladder rather than dropped, but any factor spike that assumes
// a normal 162-game season or a normal-size bracket must account for it
// explicitly. See docs/team-success-research.md, "The 2020 problem."
//
// Run: node .scratch/team-success/build-outcome-ladder.mjs
// Writes: .scratch/team-success/outcome-ladder.json
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..', '..')

const ALL_MLB_TEAM_IDS = [
  108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 133,
  134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 158,
]

function eraFor(year) {
  if (year <= 2011) return 'pre-wildcard-game' // straight to Division Series, 1 WC/league
  if (year === 2020) return 'pandemic-expanded' // 60 games, 8 teams/league
  if (year <= 2019) return 'wildcard-game' // 1-game WC, 2 WC/league
  if (year === 2021) return 'wildcard-game' // last year of the 1-game format
  return 'expanded-3wc' // 2022+, best-of-3 WC round, 3 WC/league
}

function buildSeasonEntry(season) {
  const byTeam = new Map()
  for (const round of season.rounds) {
    for (const series of round.series) {
      for (const side of [series.teamA, series.teamB]) {
        const won = series.winnerTeamId === side.teamId
        const existing = byTeam.get(side.teamId)
        const roundKey = round.key
        if (!existing) {
          byTeam.set(side.teamId, { seed: side.seed, rounds: [{ roundKey, won }] })
        } else {
          existing.rounds.push({ roundKey, won })
        }
      }
    }
  }

  const teams = {}
  for (const teamId of ALL_MLB_TEAM_IDS) {
    const entry = byTeam.get(teamId)
    if (!entry) {
      teams[teamId] = {
        madePostseason: false,
        seed: null,
        wonDivision: false,
        furthestRound: null,
        ladder: 0,
      }
      continue
    }
    const roundKeys = entry.rounds.map((r) => r.roundKey)
    const wonKeys = new Set(entry.rounds.filter((r) => r.won).map((r) => r.roundKey))
    const madeLCS = roundKeys.includes('lcs')
    const madeWS = roundKeys.includes('worldseries')
    const wonWS = wonKeys.has('worldseries')
    const wonAnyRound = wonKeys.size > 0
    const furthestRound = madeWS ? 'worldseries' : madeLCS ? 'lcs' : roundKeys.includes('division') ? 'division' : 'wildcard'

    let ladder = 1 // made the postseason
    if (wonAnyRound) ladder = 2
    if (madeLCS) ladder = 3
    if (madeWS) ladder = 4
    if (wonWS) ladder = 5

    teams[teamId] = {
      madePostseason: true,
      seed: entry.seed,
      wonDivision: entry.seed <= 3,
      furthestRound,
      wonAnyRound,
      ladder,
    }
  }
  return teams
}

function main() {
  const raw = JSON.parse(
    readFileSync(join(REPO_ROOT, 'public', 'data', 'postseason-history.json'), 'utf8'),
  )
  const seasons = raw.seasons
    .slice()
    .sort((a, b) => a.year - b.year)
    .map((season) => ({
      year: season.year,
      era: eraFor(season.year),
      shortSeason: season.year === 2020,
      championTeamId: season.championTeamId,
      teams: buildSeasonEntry(season),
    }))

  const out = {
    generatedAt: new Date().toISOString(),
    source: 'public/data/postseason-history.json',
    ladderKey: {
      0: 'missed the postseason',
      1: 'made the postseason, lost its first series',
      2: 'won at least one round, did not reach the LCS',
      3: 'reached the LCS, lost it',
      4: 'reached the World Series, lost it',
      5: 'won the World Series',
    },
    seasons,
  }
  writeFileSync(
    join(__dirname, 'outcome-ladder.json'),
    JSON.stringify(out, null, 2) + '\n',
  )
  const rungCounts = [0, 0, 0, 0, 0, 0]
  for (const s of seasons) for (const t of Object.values(s.teams)) rungCounts[t.ladder] += 1
  console.log(`Wrote ${seasons.length} seasons x ${ALL_MLB_TEAM_IDS.length} teams.`)
  console.log('Rung counts (0-5):', rungCounts)
}

main()
