// Regenerates public/data/umpires/{personId}.json — for every umpire who has
// worked an MLB game this season, the list of games he's worked and which base
// he had (src/api/umpires.js just reads these files; the umpire detail page
// renders one). Keyed by MLB Stats API personId (umpires get real personIds,
// same id space as players).
//
// ONE FILE PER UMPIRE, not one file for the league. Every surface that reads
// this data reads a SINGLE umpire — the detail page and the lineup page's
// accuracy modal, both of which already know whose id they want. The league-wide
// file this replaced reached 3.2 MB by August (every game × four officials, and
// it grows all season), so the modal behind one tap on the lineup page paid for
// 145 umpires nobody had asked about. A shard is ~22 KB.
//
// The run is a FULL REBUILD, so it also deletes shards no longer in the season's
// schedule — otherwise last season's umpires would linger forever.
//
// This runs on a cron via .github/workflows/update-nightly-data.yml, NOT at request
// time. Building a season-wide, umpire-indexed view isn't something a page load
// can do cheaply: there's no "games by umpire" endpoint, so the only way to get
// it is a full-season schedule scan (one call — `/api/v1/schedule` accepts a
// season + gameType filter and returns EVERY game with its officials in one
// shot via `hydrate=officials,team`) followed by re-indexing thousands of
// (game, official) rows by umpire id client-side. That reshaping is cheap once
// fetched, but the source payload (the whole season's schedule) is too big to
// pull down on every umpire-page visit, so a nightly job does it once and
// writes a small static file. Mirrors scripts/gen-war.mjs's build-time-fetch
// pattern (see docs/data-enrichment.md §5).
//
// MLB (sportId 1) + AAA (sportId 11). AAA is included because the same umpires
// shuttle between the two levels (personIds are shared), so a call-up umpire's
// page should show his AAA games alongside his MLB ones — one extra
// season-schedule call per level, tagged with `level` on each game row. AA and
// below stay out: their officials data is thinner and, more to the point, AA
// parks carry no pitch-tracking so gen-umpire-accuracy.mjs can't score them.
// Game dates/assignments carry no score, so the file is spoiler-free.
// Run by hand: node scripts/gen-umpires.mjs
import { dirname, join } from 'node:path'
import { readdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { teamAbbr } from '../src/lib/teams.js'
import { getJson } from './lib/statsapi.mjs'
import { writeJsonAtomic } from './lib/io.js'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'data', 'umpires')
// Crew roles, mapped to short scorecard labels. Left/Right Field only appear in
// six-man crews (All-Star Game + postseason); a two- or three-man MiLB crew just
// omits the bases it doesn't staff. Any role not listed falls through to its raw
// officialType. (`gameType=R` below means LF/RF are absent from today's sweep —
// they'd show once postseason/exhibition games are included — but the labels are
// here so those rows render cleanly if that coverage is added.)
const UMP_LABELS = {
  'Home Plate': 'HP',
  'First Base': '1B',
  'Second Base': '2B',
  'Third Base': '3B',
  'Left Field': 'LF',
  'Right Field': 'RF',
}

const currentSeason = () => new Date().getUTCFullYear()

// The levels this file covers, most-senior first. A game row is tagged with the
// level's label so the umpire page can split MLB from AAA. See the header for
// why AA and below are excluded.
const LEVELS = [
  { sportId: 1, level: 'MLB' },
  { sportId: 11, level: 'AAA' },
]

const season = currentSeason()

const umpires = new Map()
let gamesSeen = 0
for (const { sportId, level } of LEVELS) {
  // Regular season (R) + postseason (F Wild Card / D Division / L Championship /
  // W World Series) + the All-Star Game (A) — the last two are where six-man
  // crews (with Left/Right Field) appear. Each row is tagged with its gameType.
  const data = await getJson(
    `/api/v1/schedule?sportId=${sportId}&season=${season}&gameType=R,F,D,L,W,A&hydrate=officials,team`,
  )
  for (const d of data.dates ?? []) {
    for (const g of d.games ?? []) {
      const state = g.status?.abstractGameState
      if (state !== 'Final') continue // only games that actually happened
      // A postponed-then-replayed game can be listed TWICE in this season-wide
      // response: once under its original calendar date (with a stale/incorrect
      // gameNumber) and once under the date it actually happened
      // (`officialDate`). Only the listing whose bucket matches its own
      // officialDate is the real one — the other is a schedule-API echo that
      // would otherwise double-count the game and, worse, collide on the same
      // (gamePk, gameNumber, role) key as the real listing when it also carries
      // a mislabeled gameNumber, confusing React's list reconciliation on the
      // umpire page. Verified against a live schedule pull: every affected
      // gamePk's officials are identical between the two listings, so dropping
      // the mismatched one loses no information.
      if (d.date !== g.officialDate) continue
      const officials = g.officials ?? []
      if (!officials.length) continue
      gamesSeen++
      const away = g.teams?.away?.team
      const home = g.teams?.home?.team
      const game = {
        gamePk: g.gamePk,
        date: g.officialDate ?? (g.gameDate ?? '').slice(0, 10),
        gameNumber: g.gameNumber ?? 1,
        level,
        gameType: g.gameType ?? 'R',
        awayId: away?.id ?? null,
        awayAbbr: teamAbbr(away),
        homeId: home?.id ?? null,
        homeAbbr: teamAbbr(home),
        venueId: g.venue?.id ?? null,
        venueName: g.venue?.name ?? '',
        // Final score's already in this same schedule payload (no extra call) —
        // lets the umpire page tally each team's record in games this umpire
        // worked, without a per-game feed fetch. isTie is the rare
        // suspended-and-not-resumed case; both isWinner flags are false then.
        awayScore: g.teams?.away?.score ?? null,
        homeScore: g.teams?.home?.score ?? null,
        awayIsWinner: g.teams?.away?.isWinner ?? null,
        homeIsWinner: g.teams?.home?.isWinner ?? null,
      }
      for (const o of officials) {
        const id = o.official?.id
        const name = o.official?.fullName
        const role = UMP_LABELS[o.officialType] ?? o.officialType
        if (!id || !role) continue
        if (!umpires.has(id)) umpires.set(id, { id, name, games: [] })
        umpires.get(id).games.push({ ...game, role })
      }
    }
  }
}

const generatedAt = new Date().toISOString()
const kept = new Set()
for (const [id, u] of umpires) {
  u.games.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  // Each shard carries the season + stamp of the run that wrote it, so a reader
  // needs one fetch, not a shard plus an index.
  await writeJsonAtomic(join(outDir, `${id}.json`), { generatedAt, season, ...u })
  kept.add(`${id}.json`)
}

// Sweep shards this run didn't write (an umpire who worked last season and not
// this one). A full rebuild owns the whole directory.
let swept = 0
for (const name of await readdir(outDir).catch(() => [])) {
  if (!name.endsWith('.json') || kept.has(name)) continue
  await rm(join(outDir, name))
  swept++
}

console.log(
  `wrote ${umpires.size} shards to ${outDir} (${gamesSeen} games, MLB + AAA)` +
    (swept ? `, swept ${swept} stale` : ''),
)
