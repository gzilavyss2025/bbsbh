// The umpire detail page's data — for a given umpire, every MLB game he's
// worked this season plus which base he had — read from a static same-origin
// file (public/data/umpires.json) rather than computed live.
//
// There's no "games by umpire" endpoint, so getting this list means scanning
// the whole season's schedule and re-indexing by umpire id — too much to fetch
// on every umpire-page visit, so scripts/gen-umpires.mjs does it on a cron (see
// .github/workflows/update-nightly-data.yml) and this module just reads the shaped
// result. Same build-time-fetch pattern as war.js/rehab.js (see
// docs/data-enrichment.md §5). Game dates/assignments carry no score, so the
// file is spoiler-free like the rest of the roster-move surfaces.
//
// A companion public/data/umpire-accuracy.json (scripts/gen-umpire-accuracy.mjs,
// same cron) adds each plate umpire's season called-pitch accuracy + a compact
// zone-tendency breakdown. It's an APPEND-ONLY per-game archive keyed by the
// same personId; loadUmpire() merges it in for the accuracy card + per-row
// figures, and umpireAccuracySummary() serves the one-line fact the lineup
// page's Umpires card shows for tonight's plate ump. Accuracy is a count of
// ball/strike JUDGMENTS — no runs/hits/outcome — so it's spoiler-free on the
// same footing as the game log (see the plan's spoiler audit,
// .scratch/umpire-accuracy/plan.md §4).
//
// MLB-only for now, like war.js — a MiLB umpire simply won't be found.
// Degrades to null before the file exists or on any failure.
let cached = null
let accuracyCached = null
let indexCached = null

// A plate umpire needs at least this many scored games before we rank him among
// his peers — below it a hot/cold handful of games would swing the ordering
// wildly. Tunable; a plate ump reaches it within the first few weeks of work.
const MIN_RANK_GAMES = 5

async function load() {
  if (cached) return cached
  try {
    const res = await fetch('/data/umpires.json')
    if (!res.ok) throw new Error(`umpires.json ${res.status}`)
    const data = await res.json()
    cached = { season: data.season ?? null, generatedAt: data.generatedAt ?? null, umpires: data.umpires ?? {} }
  } catch {
    cached = { season: null, generatedAt: null, umpires: {} }
  }
  return cached
}

async function loadAccuracy() {
  if (accuracyCached) return accuracyCached
  try {
    const res = await fetch('/data/umpire-accuracy.json')
    if (!res.ok) throw new Error(`umpire-accuracy.json ${res.status}`)
    const data = await res.json()
    accuracyCached = { season: data.season ?? null, umpires: data.umpires ?? {} }
  } catch {
    accuracyCached = { season: null, umpires: {} }
  }
  return accuracyCached
}

// One pass over the whole accuracy file (memoized) that both surfaces need:
//   • rankById — each qualifying umpire's { rank, total } in season plate
//     accuracy, best first. Only umpires with >= MIN_RANK_GAMES scored games
//     qualify; everyone else has no rank (the surfaces then omit it).
//   • leagueShare — the league-wide distribution of MISSED calls across the
//     3×3 zone grid, normalized to shares. It's the "typical umpire" baseline
//     the zone map compares each umpire against (a cell where he misses a
//     bigger share than the league is where he's worse than average).
async function accuracyIndex() {
  if (indexCached) return indexCached
  const { umpires } = await loadAccuracy()
  const all = Object.values(umpires)

  const qualified = all
    .filter((u) => u.season?.called && u.season.accuracy != null && (u.season.games ?? 0) >= MIN_RANK_GAMES)
    .sort((a, b) => b.season.accuracy - a.season.accuracy)
  const rankById = new Map()
  qualified.forEach((u, i) => rankById.set(String(u.id), { rank: i + 1, total: qualified.length }))

  const leagueMiss = Array(9).fill(0)
  for (const u of all) {
    const cm = u.season?.cellMiss
    if (!cm) continue
    for (let i = 0; i < 9; i++) leagueMiss[i] += cm[i] ?? 0
  }
  const missTotal = leagueMiss.reduce((a, b) => a + b, 0)
  const leagueShare = leagueMiss.map((m) => (missTotal ? m / missTotal : 0))

  indexCached = { rankById, leagueShare }
  return indexCached
}

// Shape a season aggregate's 3×3 cell tallies into what the zone map draws: per
// cell, the umpire's called-STRIKE rate (his perceived zone — how often he
// rings a pitch up there) and `over`, how much of his misses cluster in that
// cell above the league baseline (> 0 = he's worse there than a typical ump).
// Returns null for rows predating the cell schema (no grid to draw).
export function umpireZoneCells(season, leagueShare) {
  if (!season?.cellCalled) return null
  const missTotal = (season.cellMiss ?? []).reduce((a, b) => a + b, 0)
  return season.cellCalled.map((called, i) => {
    const strikes = season.cellStrikeCall?.[i] ?? 0
    const miss = season.cellMiss?.[i] ?? 0
    const umpShare = missTotal ? miss / missTotal : 0
    return {
      called,
      miss,
      strikeRate: called ? strikes / called : null,
      over: umpShare - (leagueShare?.[i] ?? 0),
    }
  })
}

// Turn a season aggregate into a short tendency phrase for the UI. A plate ump
// with a strong lean either squeezes (calls strikes as balls — a tight zone) or
// expands it (calls balls as strikes — a generous zone); the dominant miss
// region names where. Returns null when there aren't enough missed calls to say
// anything meaningful (a nearly perfect game has no signal).
const REGION_WORDS = { high: 'up', low: 'low', inside: 'inside', outside: 'outside' }

export function accuracyTendency(season) {
  if (!season) return null
  const misses = (season.expanded ?? 0) + (season.squeezed ?? 0)
  if (misses < 5) return null
  const regions = [
    ['high', season.high ?? 0],
    ['low', season.low ?? 0],
    ['inside', season.inside ?? 0],
    ['outside', season.outside ?? 0],
  ]
  const [topRegion, topCount] = regions.sort((a, b) => b[1] - a[1])[0]
  const where = topCount > 0 ? REGION_WORDS[topRegion] : null
  const tight = (season.squeezed ?? 0) >= (season.expanded ?? 0)
  if (tight) return where ? `squeezes the ${where} zone` : 'tight zone'
  return where ? `generous ${where}` : 'generous zone'
}

// The full accuracy record for one umpire ({ season, byGamePk }) or null.
function accuracyFor(umpires, id) {
  const a = umpires[id]
  if (!a?.season || !a.season.called) return null
  const byGamePk = {}
  for (const g of a.games ?? []) byGamePk[g.gamePk] = g
  return { season: a.season, byGamePk }
}

// { id, name, games, season, generatedAt, accuracy, rank, zoneCells } for one
// umpire, or null if he hasn't worked a game this season (or the file failed to
// load). `accuracy` is null when he has no plate-accuracy data (MiLB, or no
// scored games yet); `rank` ({ rank, total }) is null when he's below the
// ranking floor; `zoneCells` is null when his rows predate the cell schema.
export async function loadUmpire(id) {
  const [{ umpires, season, generatedAt }, acc, idx] = await Promise.all([load(), loadAccuracy(), accuracyIndex()])
  const u = umpires[id]
  if (!u) return null
  const accuracy = accuracyFor(acc.umpires, id)
  return {
    ...u,
    season,
    generatedAt,
    accuracy,
    rank: idx.rankById.get(String(id)) ?? null,
    zoneCells: accuracy ? umpireZoneCells(accuracy.season, idx.leagueShare) : null,
  }
}

// Just the one-line fact for tonight's plate ump — { season, accuracy,
// tendency, rank, total } — or null when there's no accuracy data for this
// umpire (MiLB games, or the file hasn't caught up). `rank`/`total` are null
// when he's below the ranking floor. Keeps TeamInfo from needing the whole
// game list.
export async function umpireAccuracySummary(id) {
  if (id == null) return null
  const [acc, idx] = await Promise.all([loadAccuracy(), accuracyIndex()])
  const rec = accuracyFor(acc.umpires, id)
  if (!rec) return null
  const rank = idx.rankById.get(String(id)) ?? null
  return {
    season: acc.season,
    accuracy: rec.season.accuracy,
    tendency: accuracyTendency(rec.season),
    rank: rank?.rank ?? null,
    total: rank?.total ?? null,
  }
}
