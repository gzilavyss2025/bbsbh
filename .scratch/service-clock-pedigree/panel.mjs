// Panel: the service-clock cohort joined to MLB Pipeline's own historical Top
// Prospects lists, so the promotion calendar can be read at TRUE pedigree grain.
//
// The parent spike (docs/service-time-debut-clock.md) shipped a null and named
// one limit it could not remove: a practice confined to a handful of men a year
// needs a real prospect ranking, and it ran a borrowed proxy instead. The rank
// file .scratch/top-prospects-history/rows.json now supplies the real thing:
// 1,448 ranked player-seasons 2009-2024 on NATIVE mlb ids, so the join needs no
// crosswalk and no name matching.
//
// ONE ROW PER MLB DEBUT with a wire roster-add, 2009-2025. The analysis unit is
// the first-time roster addition; `inBase` marks the rows the model uses.
//
// THREE TRAPS THIS PANEL IS BUILT AROUND.
//
// 1. ABSENT IS NOT UNRANKED. Men are ranked BEFORE they debut and the file
//    starts in 2009, so a 2009 debutant was listed in 2007 or 2008, which the
//    file does not hold. The ranking-window groups are REUSED from
//    .scratch/prospect-value/panel.mjs rather than re-derived, and the copy is
//    verified row by row against that panel's own output below.
// 2. DEPTH IS NOT 100 EVERY YEAR. 2009-2011 are top-50 lists and 2020/2021 stop
//    at 99. Depth is read per season from seasons.json. A top-30 or top-10 cut
//    is comparable in every year; a "ranked at all" cut is not.
// 3. RANK KNOWN AT PROMOTION TIME. MLB Pipeline publishes a season's list
//    before that season opens, so a rank in season d is known to a club
//    promoting in April of d. A rank in d+1 is not. `peakRankLE` uses only
//    seasons at or before the debut season and is the panel's primary measure;
//    `peakRankAny` carries the whole window for sensitivity.
//
// Rebuild: node .scratch/service-clock-pedigree/panel.mjs
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const j = async (p) => JSON.parse(await readFile(p, 'utf8'))

const debuts = await j(join(here, '..', 'service-clock', 'panel.json'))
// rows.json/seasons.json now also carry 2005-2008 from a SECOND publication,
// Baseball America (#946), alongside 2009-2024 from MLB Pipeline. This panel's
// windowStatus is REUSED verbatim from prospect-value/panel.mjs, which is
// pinned to MLB Pipeline rows only -- both reads here are pinned the same way
// so the two panels' AVAILABLE/DEPTH sets, and therefore their windowStatus
// per player, stay identical (the row-by-row check at the end of this file
// depends on it). seasons.json's pre-#946 entries carry no `source` field at
// all, so "MLB Pipeline only" reads as "not tagged baseball-america".
const rankRows = (await j(join(here, '..', 'top-prospects-history', 'rows.json'))).filter(
  (r) => r.source === 'mlb-pipeline',
)
// allRankSeasons keeps every entry (needed below to still report 2005-2008 as
// unavailable to MLB Pipeline); rankSeasons is the MLB-Pipeline-only view
// AVAILABLE/DEPTH are built from.
const allRankSeasons = await j(join(here, '..', 'top-prospects-history', 'seasons.json'))
const rankSeasons = allRankSeasons.filter((s) => s.source !== 'baseball-america')
const valuePanel = await j(join(here, '..', 'prospect-value', 'panel.json'))

// --- depth, read from the coverage file, never assumed ----------------------

const AVAILABLE = new Set()
const DEPTH = new Map()
for (const s of rankSeasons) {
  if (s.status !== 'ok') continue
  AVAILABLE.add(s.season)
  DEPTH.set(s.season, s.depth)
}
const DEEP = new Set([...AVAILABLE].filter((y) => DEPTH.get(y) >= 99))
// From allRankSeasons, not the MLB-Pipeline-only rankSeasons above: a
// Baseball-America-sourced season is still MLB-Pipeline-unavailable, so it
// belongs here even though its own `status` now reads 'ok'.
const UNAVAILABLE = allRankSeasons
  .filter((s) => s.status !== 'ok' || s.source === 'baseball-america')
  .map((s) => s.season)

// --- the ranking window, copied verbatim from prospect-value/panel.mjs ------

// LAG_BEFORE/LAG_AFTER and computeWindow() are that panel's, not a second
// derivation. The copy is asserted against its output at the end of this file:
// every player in both panels must carry the same windowStatus.
const LAG_AFTER = 1
const LAG_BEFORE = 4

function windowSeasons(debutYear) {
  const out = []
  for (let y = debutYear - LAG_BEFORE; y <= debutYear + LAG_AFTER; y++) out.push(y)
  return out
}

function computeWindow(debutYear) {
  if (debutYear == null) return 'no-debut'
  const w = windowSeasons(debutYear)
  if (w.some((y) => !AVAILABLE.has(y))) return 'censored'
  if (w.some((y) => !DEEP.has(y))) return 'observed-shallow'
  return 'observed-deep'
}

// --- ranks per player -------------------------------------------------------

const byPlayer = new Map()
for (const r of rankRows) {
  if (!byPlayer.has(r.mlbId)) byPlayer.set(r.mlbId, [])
  byPlayer.get(r.mlbId).push({ season: r.season, rank: r.rank, depth: DEPTH.get(r.season) })
}
for (const v of byPlayer.values()) v.sort((a, b) => a.season - b.season)

// --- rows -------------------------------------------------------------------

const MAX_DAY = 45 // the parent spike's window: the first 45 days of a season

const panel = []
for (const d of debuts) {
  if (d.debutSeason < 2009) continue
  const ranks = byPlayer.get(d.id) ?? []
  const le = ranks.filter((r) => r.season <= d.debutSeason)
  const inBase =
    !d.excludedSeason &&
    d.addSeasonDay != null &&
    d.addSeasonDay >= 1 &&
    d.addSeasonDay <= MAX_DAY &&
    d.clubId != null
  panel.push({
    mlbId: d.id,
    name: d.name,
    debutSeason: d.debutSeason,
    excludedSeason: d.excludedSeason,
    isPitcher: d.isPitcher,
    ageAtDebut: d.ageAtDebut,
    draftTier: d.draftTier,
    awardTier: d.awardTier,
    inProspectCohort: d.inProspectCohort,
    // timing, straight from the parent panel — the anchor is its league opener
    rosterAddDate: d.rosterAddDate,
    addSeasonDay: d.addSeasonDay,
    addRelDay: d.addRelDay,
    clubId: d.clubId,
    ilSameGroup21: d.ilSameGroup21,
    preLineDays: d.preLineDays,
    inBase,
    // pedigree
    windowStatus: computeWindow(d.debutSeason),
    inRankFile: ranks.length > 0,
    nRankSeasons: ranks.length,
    rankSeasons: ranks,
    peakRankLE: le.length ? Math.min(...le.map((r) => r.rank)) : null,
    peakRankAny: ranks.length ? Math.min(...ranks.map((r) => r.rank)) : null,
    firstRankSeason: ranks.length ? ranks[0].season : null,
    rankInDebutSeason: ranks.find((r) => r.season === d.debutSeason)?.rank ?? null,
  })
}

// --- assertions -------------------------------------------------------------

// 1. The window copy is faithful. Every player carried by BOTH this panel and
//    prospect-value's must land in the same group.
const valueWindow = new Map(valuePanel.map((r) => [r.mlbId, r.windowStatus]))
let compared = 0
for (const r of panel) {
  const theirs = valueWindow.get(r.mlbId)
  if (theirs == null) continue
  compared++
  if (theirs !== r.windowStatus) {
    throw new Error(`window group disagrees with prospect-value for ${r.mlbId}: ${r.windowStatus} vs ${theirs}`)
  }
}
if (compared < 1000) throw new Error(`only ${compared} players cross-checked against prospect-value`)

// 2. The window still catches the ranked men it was measured on, exactly as
//    prospect-value asserts. A rebuilt rank file cannot move this in silence.
let inWindow = 0
let withDebut = 0
const debutYearById = new Map(panel.map((r) => [r.mlbId, r.debutSeason]))
for (const [id, ranks] of byPlayer) {
  const dy = debutYearById.get(id)
  if (dy == null) continue
  withDebut++
  if (ranks.some((r) => dy - r.season <= LAG_BEFORE && dy - r.season >= -LAG_AFTER)) inWindow++
}
const capture = inWindow / withDebut
if (capture < 0.95) throw new Error(`ranking window now catches only ${(100 * capture).toFixed(1)}% of ranked debutants`)

// 3. The base cohort must reproduce the parent spike's 834 exactly. If it does
//    not, this panel is not testing the same thing the null was measured on.
const base = panel.filter((r) => r.inBase)
if (base.length !== 834) throw new Error(`base is ${base.length}, not the parent spike's 834`)

const counts = (rows2, label) => {
  const o = { label, n: rows2.length, postLine: rows2.filter((r) => r.addRelDay >= 1).length }
  o.preLine = o.n - o.postLine
  o.seasons = [...new Set(rows2.map((r) => r.debutSeason))].sort()
  return o
}
const OBS = new Set(['observed-deep', 'observed-shallow'])
const grains = [
  counts(
    base.filter((r) => r.windowStatus === 'observed-deep' && r.peakRankLE != null && r.peakRankLE <= 100),
    'top-100 / observed-deep',
  ),
  counts(base.filter((r) => OBS.has(r.windowStatus) && r.peakRankLE != null && r.peakRankLE <= 30), 'top-30 / observed'),
  counts(base.filter((r) => OBS.has(r.windowStatus) && r.peakRankLE != null && r.peakRankLE <= 10), 'top-10 / observed'),
  counts(base.filter((r) => r.peakRankLE != null && r.peakRankLE <= 30), 'top-30 / all seasons (extended)'),
  counts(base.filter((r) => r.peakRankLE != null && r.peakRankLE <= 10), 'top-10 / all seasons (extended)'),
]

const windowCounts = {}
for (const r of base) windowCounts[r.windowStatus] = (windowCounts[r.windowStatus] ?? 0) + 1

const meta = {
  builtAt: new Date().toISOString(),
  rows: panel.length,
  base: base.length,
  maxDay: MAX_DAY,
  rankFile: {
    rows: rankRows.length,
    players: byPlayer.size,
    available: [...AVAILABLE].sort((a, b) => a - b),
    unavailable: UNAVAILABLE,
    depths: Object.fromEntries([...DEPTH].sort((a, b) => a[0] - b[0])),
    shallowSeasons: [...AVAILABLE].filter((y) => !DEEP.has(y)).sort((a, b) => a - b),
  },
  rankingWindow: { lagBefore: LAG_BEFORE, lagAfter: LAG_AFTER, captureRate: capture, rankedWithDebut: withDebut },
  windowGroupsCrossChecked: compared,
  baseWindowGroups: windowCounts,
  grains,
}

await writeFile(join(here, 'panel.json'), JSON.stringify(panel, null, 1))
await writeFile(join(here, 'panel-meta.json'), JSON.stringify(meta, null, 1))
console.log(
  JSON.stringify(
    {
      rows: panel.length,
      base: base.length,
      windowGroupsCrossChecked: compared,
      capturePct: Number((100 * capture).toFixed(1)),
      baseWindowGroups: windowCounts,
    },
    null,
    1,
  ),
)
for (const g of grains) {
  console.log(
    `  ${g.label.padEnd(34)} n=${String(g.n).padStart(3)}  post-line ${String(g.postLine).padStart(3)}  pre-line ${String(g.preLine).padStart(3)}  seasons ${g.seasons.length}`,
  )
}
