import { tierForZ, meanAndSd, leanTierForZ } from '../lib/statTiers.js'

// The umpire detail page's data — for a given umpire, every MLB and AAA game
// he's worked this season plus which base he had — read from a static
// same-origin file (public/data/umpires.json) rather than computed live.
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
// TWO FILES, ONE SOURCE. The accuracy archive keeps every scored game row of
// the season and grows all year (~2 MB by August), but only the umpire DETAIL
// page draws the game log. The lineup page, the box score, and the rankings
// table need season aggregates alone, so the same generator run also writes
// public/data/umpire-accuracy-summary.json — the same records minus `games`,
// about 6% of the size. loadAccuracySummary() reads it, loadAccuracy() reads
// the archive, and only the surfaces that show a game log pay for one.
//
// LEVELS: MLB + AAA (the two levels with the pitch tracking accuracy needs).
// The two are kept STRICTLY SEPARATE, never blended: they run different regimes
// (AAA uses the ABS challenge system) and rank against different peer pools, so
// the accuracy file carries a per-level aggregate (`season` = MLB, `seasonAAA`)
// and each game row a `level` tag. loadUmpire() returns MLB accuracy/rank/
// zoneCells plus a parallel `*AAA` triplet, each ranked + zone-baselined against
// its own level via a per-level accuracyIndex(). The lineup summary + rankings
// page stay MLB-only (they front an MLB game). A MiLB umpire below AAA, or one
// with no data, degrades to null before the file exists or on any failure.
let cached = null
let accuracyCached = null
let summaryCached = null
// accuracyIndex is memoized per level ('MLB' | 'AAA') — the two levels rank
// against separate pools and have separate zone-map baselines, so each gets its
// own index. An index built from the summary file carries no `leanById` (the
// lean reads per-game rows), so it is tagged `hasLean: false` and a later call
// that needs the lean rebuilds it from the archive and replaces it.
const indexCached = new Map()

// A plate umpire needs at least this many scored games before we rank him among
// his peers — below it a hot/cold handful of games would swing the ordering
// wildly. Tunable; a plate ump reaches it within the first few weeks of work.
const MIN_RANK_GAMES = 5

// --- the Umpire Tendencies card's figures --------------------------------------
// A cell must carry this much MORE of the umpire's misses than the league
// baseline before the "area to watch" phrase will name it. Same constant, and
// the same reasoning, as UmpireAccuracyModal's OVER_FLOOR, which decides
// whether the zone map OUTLINES a cell — deliberately shared so the phrase can
// only ever name a cell the map beside it has actually flagged. Below it is
// noise, not a tendency.
const WATCH_OVER_FLOOR = 0.02
// …and he needs this many missed calls in total before any of it means
// anything. Mirrors accuracyTendency's own floor.
const WATCH_MIN_MISSES = 5
// One batter side must carry this much more of its own misses in a region than
// the other before the phrase names a hand. Bacchus is the case this exists
// for: his LOW misses split 33.0% / 32.8% across hands (no story at all) while
// his OUTSIDE misses run 14.8% / 7.7%. Without the gate, a region gets a hand
// bolted onto it and the card publishes a finding that isn't there.
const WATCH_HAND_MARGIN = 0.05

// Row-major 3x3, matching gen-umpire-accuracy.mjs's cellIndex exactly: rows run
// high -> middle -> low, columns run outside -> middle -> inside, both oriented
// to the BATTER. Spelled out as nine phrases rather than composed from row and
// column words because "middle/middle" and the two bare-column cells don't read
// naturally when assembled mechanically.
const CELL_PHRASE = [
  'Up and outside',
  'Up in the zone',
  'Up and inside',
  'Outside',
  'Over the middle',
  'Inside',
  'Low and outside',
  'Low in the zone',
  'Low and inside',
]
// Which of the four flat miss REGIONS each cell belongs to, for the handedness
// clause — the L/R split is tallied by region (missL/missR), not per cell, so a
// cell has to resolve to one. A corner cell answers to its column (inside /
// outside reads more naturally than up / low there); the centre column answers
// to its row; the true middle has no region and so never takes a hand.
const CELL_REGION = ['outside', 'high', 'inside', 'outside', null, 'inside', 'outside', 'low', 'inside']

// Net runs handed to HITTERS per game — the pitcher/hitter lean the Tendencies
// card's scale plots. Positive means his missed calls have handed runs to the
// batting team.
//
// Derived at READ time from the per-game signed favor rows (favorAway +
// favorHome, the run-expectancy swing each missed call handed whoever was
// batting), because the season aggregate only keeps favorMagnitude — the
// UNSIGNED total, which answers a different question and is what the card's
// "run impact" tile shows. Do not confuse the two; they are 1.55 and 0.43 for
// the same umpire.
//
// Restricted to one level's regular-season rows, the same split the aggregates
// use: a different level is a different regime and a different peer pool.
export function umpireLeanFor(games, season, level = 'MLB') {
  let net = 0
  let n = 0
  for (const g of games ?? []) {
    if ((g.level ?? 'MLB') !== level) continue
    if ((g.gameType ?? 'R') !== 'R') continue
    if (g.favorAway == null || g.favorHome == null) continue
    net += g.favorAway + g.favorHome
    n++
  }
  if (n) return { lean: net / n, source: 'favor', games: n }

  // Fallback for a file built before gen-run-expectancy.mjs was ever run, when
  // no row carries favor at all. The raw zone lean, NEGATED so the sign
  // convention still points at hitters: a generous zone (expanded > squeezed)
  // helps PITCHERS. It correlates at -0.86 with the favor figure across the
  // qualifying pool but is NOT the same number — it counts every miss equally
  // where favor weights by leverage — so callers carry `source` rather than
  // implying they're interchangeable. Whole-pool by nature: the table either
  // exists or it doesn't, so a pool never mixes the two sources and the
  // z-scores below stay comparable.
  if (!season?.called) return null
  return {
    lean: -((season.expanded - season.squeezed) / season.called),
    source: 'zone',
    games: season.games ?? 0,
  }
}

// Where this umpire misses most, relative to the league — the card's "area to
// watch" phrase, plus the hand it belongs to when one side is clearly worse.
//
// Derived from the SAME 3x3 league-relative grid the zone map draws, and that
// is the whole point of the function: accuracyTendency() answers a similar
// question off the four flat edge tallies and, on real data, disagrees. For
// Erich Bacchus it picks "low" on a nine-call margin out of 213 misses while
// the grid's heaviest flags are up-and-outside and up-and-inside. A phrase
// printed beside a picture that contradicts it is worse than no phrase, so
// this reads the picture.
//
// Returns null rather than reaching for a weaker signal when there's nothing
// to say. A card that says nothing is correct; one that invents a tendency
// is not.
export function umpireWatchArea(season, leagueShare) {
  const cells = umpireZoneCells(season, leagueShare)
  if (!cells) return null
  if ((season.expanded ?? 0) + (season.squeezed ?? 0) < WATCH_MIN_MISSES) return null

  let best = -1
  cells.forEach((c, i) => {
    if (best < 0 || c.over > cells[best].over) best = i
  })
  if (best < 0 || cells[best].over < WATCH_OVER_FLOOR) return null

  return {
    cell: best,
    over: cells[best].over,
    phrase: CELL_PHRASE[best],
    hand: watchHand(season, CELL_REGION[best]),
  }
}

// 'L' | 'R' | null — which batter side carries a clearly larger share of its
// own misses in this region. Null when the split is even, when the region has
// no handedness story to tell (the middle cell), or when the rows predate
// missL/missR.
function watchHand(season, region) {
  if (!region || !season?.missL || !season?.missR) return null
  const totalL = Object.values(season.missL).reduce((a, b) => a + b, 0)
  const totalR = Object.values(season.missR).reduce((a, b) => a + b, 0)
  if (!totalL || !totalR) return null
  const shareL = (season.missL[region] ?? 0) / totalL
  const shareR = (season.missR[region] ?? 0) / totalR
  if (Math.abs(shareL - shareR) < WATCH_HAND_MARGIN) return null
  return shareL > shareR ? 'L' : 'R'
}

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

// The aggregates-only companion. Falls back to the full archive when the file
// is missing — a deploy that lands before the nightly cron has written it once
// still serves the right numbers, just at the old weight.
async function loadAccuracySummary() {
  if (summaryCached) return summaryCached
  if (accuracyCached) return accuracyCached
  try {
    const res = await fetch('/data/umpire-accuracy-summary.json')
    if (!res.ok) throw new Error(`umpire-accuracy-summary.json ${res.status}`)
    const data = await res.json()
    summaryCached = { season: data.season ?? null, umpires: data.umpires ?? {} }
    return summaryCached
  } catch {
    return loadAccuracy()
  }
}

// A umpire's season aggregate for a given level. MLB is the top-level `season`
// (back-compat with the pre-AAA file shape); AAA is `seasonAAA`, null when he
// has no AAA plate games.
function seasonForLevel(u, level) {
  return level === 'AAA' ? u.seasonAAA : u.season
}

// One pass over the whole accuracy file (memoized per level) that the surfaces
// need. `level` selects which per-level aggregate to rank on ('MLB' | 'AAA'):
//   • rankById — each qualifying umpire's { rank, total, tier, accuracy, games,
//     name, tendency } in season plate accuracy, best first. Only umpires with
//     >= MIN_RANK_GAMES scored games qualify; everyone else has no rank (the
//     surfaces then omit it).
//   • ranked — the same entries as a plain array, already sorted best-first,
//     for the Umpire Rankings page's table (rankById exists for the O(1)
//     per-umpire lookups the other surfaces need; ranked is the same data
//     shaped for "show me everyone").
//   • mean / sd — the qualifying pool's season accuracy, population stats
//     (tierForZ buckets off these). The four tiers shown as a pill beside a
//     plate umpire's name are standard deviations from this mean rather than an
//     even split, because real season accuracy across ~90 plate umpires clusters
//     in a band a few points wide — a neat 1/3-1/3-1/3 split would put umpires a
//     fraction of a point apart in different tiers. lib/statTiers.js holds the
//     shared bucket definition (Game Score rankings use it too) and the
//     "Elite"/"Below Average" = 1 SD rationale.
//   • leagueShare — the league-wide distribution of MISSED calls across the
//     3×3 zone grid, normalized to shares. It's the "typical umpire" baseline
//     the zone map compares each umpire against (a cell where he misses a
//     bigger share than the league is where he's worse than average).
//   • leanById — the pitcher/hitter lean, which reads each umpire's GAME ROWS
//     and so needs the full archive. Callers that show it pass `withLean`;
//     everyone else takes the aggregates-only file and gets an empty map.
//
// Every other figure above reads season aggregates ONLY, and the summary file
// carries those aggregates byte-for-byte as the archive does, so both sources
// produce the same ranks, tiers, mean/sd and baselines. test/umpire-accuracy-
// summary.test.js pins that.
async function accuracyIndex(level = 'MLB', { withLean = false } = {}) {
  const memo = indexCached.get(level)
  if (memo && (memo.hasLean || !withLean)) return memo
  const { umpires } = withLean ? await loadAccuracy() : await loadAccuracySummary()
  // A per-level view where each umpire's `season` is that level's aggregate, so
  // the ranking/baseline logic below reads `u.season` unchanged. Umpires with no
  // aggregate at this level (e.g. never worked AAA) drop out.
  const all = Object.values(umpires)
    .map((u) => ({ id: u.id, name: u.name, season: seasonForLevel(u, level), games: u.games ?? [] }))
    .filter((u) => u.season)

  const qualified = all
    .filter((u) => u.season?.called && u.season.accuracy != null && (u.season.games ?? 0) >= MIN_RANK_GAMES)
    .sort((a, b) => b.season.accuracy - a.season.accuracy)

  const { mean, sd, n } = meanAndSd(qualified.map((u) => u.season.accuracy))

  const rankById = new Map()
  const ranked = qualified.map((u, i) => {
    const z = sd ? (u.season.accuracy - mean) / sd : 0
    const entry = {
      id: u.id,
      name: u.name,
      rank: i + 1,
      total: n,
      accuracy: u.season.accuracy,
      games: u.season.games,
      tendency: accuracyTendency(u.season),
      tier: tierForZ(z),
    }
    rankById.set(String(u.id), entry)
    return entry
  })

  const leagueMiss = Array(9).fill(0)
  for (const u of all) {
    const cm = u.season?.cellMiss
    if (!cm) continue
    for (let i = 0; i < 9; i++) leagueMiss[i] += cm[i] ?? 0
  }
  const missTotal = leagueMiss.reduce((a, b) => a + b, 0)
  const leagueShare = leagueMiss.map((m) => (missTotal ? m / missTotal : 0))

  // The pitcher/hitter lean, z-scored against this same qualifying pool. It
  // rides accuracyIndex's one pass rather than taking a pass of its own, and it
  // uses the SAME pool `rankById` uses — two definitions of "qualifies" is how
  // a tier pill and a scale start disagreeing about the same umpire.
  // Skipped outright without the archive, never computed from empty rows:
  // umpireLeanFor falls back to a zone lean when no row carries favor, so an
  // absent game list would read as a real (and wrong) answer instead of none.
  const leanRaw = []
  for (const u of withLean ? qualified : []) {
    const l = umpireLeanFor(u.games, u.season, level)
    if (l) leanRaw.push({ id: u.id, ...l })
  }
  const { mean: leanMean, sd: leanSd } = meanAndSd(leanRaw.map((l) => l.lean))
  const leanById = new Map()
  for (const l of leanRaw) {
    const z = leanSd ? (l.lean - leanMean) / leanSd : 0
    leanById.set(String(l.id), {
      lean: l.lean,
      z,
      tier: leanTierForZ(z),
      source: l.source,
      leagueMean: leanMean,
      leagueSd: leanSd,
    })
  }

  // League ABS-challenge baseline, for the card's asterisked footnote. Pooled
  // over every game row at this level (Σ overturned / Σ challenges), the same
  // shape as leagueShare above — a mean of per-umpire rates would let a man
  // with three challenges pull it as hard as one with eighty. Null until the
  // challenge schema has been swept in.
  let chSum = 0
  let ovSum = 0
  let chGames = 0
  for (const u of all) {
    if (u.season.challenges == null) continue
    chSum += u.season.challenges
    ovSum += u.season.challengesOverturned ?? 0
    chGames += u.season.challengeGames ?? 0
  }
  const leagueChallenges = chSum
    ? { perGame: chGames ? chSum / chGames : null, overturnRate: ovSum / chSum }
    : null

  const index = {
    rankById,
    ranked,
    mean,
    sd,
    leagueShare,
    leanById,
    leanMean,
    leanSd,
    leagueChallenges,
    hasLean: withLean,
  }
  indexCached.set(level, index)
  return index
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

// The full accuracy record for one umpire at a level ({ season, byGamePk }) or
// null. `byGamePk` holds only that level's game rows (a row predating the level
// tag is treated as MLB, matching the generator).
function accuracyFor(umpires, id, level = 'MLB') {
  const a = umpires[id]
  const season = a && seasonForLevel(a, level)
  if (!season || !season.called) return null
  const byGamePk = {}
  for (const g of a.games ?? []) {
    if ((g.level ?? 'MLB') === level) byGamePk[g.gamePk] = g
  }
  return { season, byGamePk }
}

// { id, name, games, season, generatedAt, accuracy, rank, zoneCells } for one
// umpire, or null if he hasn't worked a game this season (or the file failed to
// load). `accuracy` is null when he has no plate-accuracy data (MiLB, or no
// scored games yet); `rank` ({ rank, total, tier, ... }) is null when he's
// below the ranking floor; `zoneCells` is null when his rows predate the cell
// schema. The `*AAA` triplet mirrors all three for the umpire's AAA plate work
// (call-up umpires who also work Triple-A), each ranked/baselined against the
// AAA pool — null throughout when he has no AAA plate games.
export async function loadUmpire(id) {
  const [{ umpires, season, generatedAt }, acc, idxMlb, idxAaa] = await Promise.all([
    load(),
    loadAccuracy(),
    accuracyIndex('MLB', { withLean: true }),
    accuracyIndex('AAA', { withLean: true }),
  ])
  const u = umpires[id]
  if (!u) return null
  const accuracy = accuracyFor(acc.umpires, id, 'MLB')
  const accuracyAAA = accuracyFor(acc.umpires, id, 'AAA')
  // Postseason plate work is aggregated separately and NEVER ranked (a
  // different-stakes, small sample): its zone map is drawn against the MLB
  // regular-season baseline for reference. Null unless he has scored playoff
  // plate games. The All-Star Game feeds no aggregate, so it isn't here — only
  // its per-game figure shows, via the game log.
  const seasonPost = acc.umpires[id]?.seasonPost
  const accuracyPost = seasonPost?.called ? { season: seasonPost } : null
  return {
    ...u,
    season,
    generatedAt,
    accuracy,
    rank: idxMlb.rankById.get(String(id)) ?? null,
    zoneCells: accuracy ? umpireZoneCells(accuracy.season, idxMlb.leagueShare) : null,
    accuracyAAA,
    rankAAA: idxAaa.rankById.get(String(id)) ?? null,
    zoneCellsAAA: accuracyAAA ? umpireZoneCells(accuracyAAA.season, idxAaa.leagueShare) : null,
    accuracyPost,
    zoneCellsPost: accuracyPost ? umpireZoneCells(accuracyPost.season, idxMlb.leagueShare) : null,
    // --- the Umpire Tendencies card, MLB only (see UmpireTendencies.jsx) ---
    // `lean` is null below the ranking floor: the scale is a position within a
    // pool, so an umpire who isn't ranked against that pool has no position on
    // it. `watchArea` and `challenges` stand alone and survive that.
    lean: idxMlb.leanById.get(String(id)) ?? null,
    watchArea: accuracy ? umpireWatchArea(accuracy.season, idxMlb.leagueShare) : null,
    challenges: challengesFor(accuracy?.season),
    leagueChallenges: idxMlb.leagueChallenges,
  }
}

// The ABS challenge pair for the card's two tiles, or null on a row set swept
// before the challenge schema shipped. Absence, never zero — a game nobody
// challenged and a game nobody counted are different facts (see
// gen-umpire-accuracy.mjs's aggregate()). `challengeGames`, not `games`, is the
// denominator: they are only equal once every row has been re-swept.
function challengesFor(season) {
  if (!season || season.challenges == null) return null
  return {
    perGame: season.challengesPerGame ?? null,
    overturnRate: season.overturnRate ?? null,
    total: season.challenges,
    overturned: season.challengesOverturned ?? 0,
    games: season.challengeGames ?? null,
  }
}

// Just the one-line fact for tonight's plate ump — { season, accuracy,
// tendency, rank, total, tier, consistency, favorPerGame } — or null when
// there's no accuracy data for this umpire (MiLB games, or the file hasn't
// caught up). `rank`/`total`/`tier` are null when he's below the ranking
// floor; `consistency`/`favorPerGame` are null on the same degrade as the
// season aggregate itself (see gen-umpire-accuracy.mjs's aggregate()) — a
// thin-sample umpire or a run before gen-run-expectancy.mjs has been built.
// Keeps TeamInfo from needing the whole game list.
export async function umpireAccuracySummary(id) {
  if (id == null) return null
  const [acc, idx] = await Promise.all([loadAccuracySummary(), accuracyIndex()])
  const rec = accuracyFor(acc.umpires, id)
  if (!rec) return null
  const rank = idx.rankById.get(String(id)) ?? null
  return {
    season: acc.season,
    accuracy: rec.season.accuracy,
    tendency: accuracyTendency(rec.season),
    rank: rank?.rank ?? null,
    total: rank?.total ?? null,
    tier: rank?.tier ?? null,
    consistency: rec.season.consistency ?? null,
    favorPerGame: rec.season.favorPerGame ?? null,
  }
}

// The full home-plate umpire rankings table — every qualifying plate umpire
// this season (>= MIN_RANK_GAMES scored games), ranked by accuracy, with the
// statistical tier his accuracy falls into. Reuses accuracyIndex()'s single
// pass, so the table can never disagree with a single umpire's own rank/tier.
export async function loadUmpireRankings() {
  const [acc, idx] = await Promise.all([loadAccuracySummary(), accuracyIndex()])
  return { season: acc.season, mean: idx.mean, sd: idx.sd, ranked: idx.ranked }
}
