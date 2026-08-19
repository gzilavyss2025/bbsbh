// Positional pay rank for the player page's Contract card — the "18th of 209"
// beside a starting pitcher's deal. Computed nightly by
// scripts/fever/gen-player-contracts.mjs and stored on each shard record as
// `payRank`; the card hides the line when it is null.
//
// A generator file is a top-level script: importing one RUNS it. The math
// lives here so test/contract-pay-rank.test.js can import it (the
// lib/roster.mjs convention).
//
// FIVE JUDGEMENT CALLS ARE BAKED IN HERE. None of them are arithmetic, and
// each one changes what the card asserts about a player. Read before editing.
//
// 1. PITCHERS SPLIT INTO SP AND RP. statsapi's primaryPosition returns a flat
//    'P' for every pitcher, so the split is derived from the season's
//    gamesStarted share (STARTER_SHARE). Ranking a $24M starter against 532
//    middle relievers is not a comparison anyone wants; "of 209" is. A pitcher
//    with no appearances at all this season falls back to his CAREER share,
//    and a pitcher with neither gets NO rank rather than a guessed pool — an
//    injured starter silently filed under relievers is the failure mode this
//    avoids. The threshold is 40%, not half: a swingman splitting his season
//    between the rotation and the pen is paid out of the starter market, not
//    the reliever one. At 50% Erick Fedde — 155 career starts in 192 games —
//    landed in the reliever pool on a 12-of-27 season, which is the wrong
//    comparison for his contract.
//
// 6. TWO-WAY PLAYERS ARE RANKED IN BOTH POOLS. 'TWP' is a pool of one, and
//    Shohei Ohtani carries the most discussed contract in the sport — a blank
//    rank there is the most visible hole this table could have. Ranking him
//    against ONE pool is a choice with no right answer, so he is ranked in
//    both: as a hitter (DH, where he bats on the days he does not pitch) and
//    as a pitcher (SP/RP by the same start-share rule). The hitting rank is
//    primary because his deal is priced as a position player's; the pitching
//    rank rides along in `also`. He is a real member of both pools, so he
//    counts toward both denominators — that is the honest reading, not a
//    double count.
//
// 2. OUTFIELDERS ARE ONE POOL. primaryPosition is sticky and corner
//    assignments move constantly, so LF/CF/RF would rank a player by a tag
//    that often lags where he actually plays. It also gives the handful of
//    players carrying a generic 'OF' somewhere to go.
//
// 3. ESTIMATED SALARIES ARE RANKED. 59% of the feed is an arbitration or
//    pre-arb projection. Excluding them would leave no rank at all for the
//    group where "he is on the minimum" is the most interesting form of the
//    fact. The card's own Estimated chip carries the caveat.
//
// 4. SUB-MINIMUM FIGURES ARE NORMALISED, NOT DROPPED. 44% of the feed carries
//    a PRORATED part-season figure rather than an annual salary — a continuous
//    smear from $14,625 up to the minimum, 543 of them pre-arb. Those players
//    are on a minimum-rate deal that was prorated by service days, so ranking
//    uses max(salary, minimum): everyone keeps a rank, and a September call-up
//    lands tied at the bottom instead of reading as the worst-paid player in
//    baseball. `onMinimum` marks that band so the card can say so in words
//    rather than quoting a rank the tie cannot support.
//
// 5. A SEASON WITH NO KNOWN MINIMUM RANKS NOBODY. LEAGUE_MINIMUM_USD is a CBA
//    figure, not something the feed carries, so it cannot be derived without
//    guessing. An unknown season returns no ranks and the card falls back to
//    hiding the line — the same graceful degradation every MiLB selector uses.

// League minimum salary by season (2022–2026 CBA, Article VI). Add the next
// season's figure here BEFORE that season's first nightly run, or every rank
// silently disappears — see judgement call 5.
export const LEAGUE_MINIMUM_USD = {
  2025: 760000,
  2026: 780000,
}

// A pool below this size is not ranked. Two-way players (TWP) are a pool of
// one, and "1st of 1" is noise, not a fact.
export const MIN_POOL = 10

// Share of appearances that must be starts for a pitcher to be a starter.
// See judgement call 1 for why this is not half.
const STARTER_SHARE = 0.4

const OUTFIELD = new Set(['LF', 'CF', 'RF', 'OF'])

// The season splits a /people stats hydrate returns are not one row per
// player: a player traded mid-season gets one COMBINED row (carrying
// numTeams) plus one row per club. Taking the largest gamesPlayed picks the
// combined row in that shape and the only row in the ordinary one, without
// special-casing either — summing would double-count the combined row.
export function largestSplit(splits) {
  let best = null
  for (const split of splits ?? []) {
    const games = Number(split?.stat?.gamesPlayed)
    if (!Number.isFinite(games)) continue
    if (!best || games > best.games) {
      best = { games, starts: Number(split?.stat?.gamesStarted) || 0 }
    }
  }
  return best
}

// The pitcher's own pool, by his share of starts — see judgement call 1.
function pitcherGroup(meta) {
  const line = (meta.season?.games ?? 0) > 0 ? meta.season : meta.career
  if (!line || !(line.games > 0)) return null
  return line.starts / line.games >= STARTER_SHARE ? 'SP' : 'RP'
}

// meta: { position, season: {games, starts} | null, career: {games, starts} | null }
// Returns every pool the player belongs to, most representative first. Usually
// one; a two-way player holds two (judgement call 6). Empty when he cannot be
// placed at all — see judgement calls 1 and 2.
export function positionGroups(meta) {
  const position = meta?.position
  if (!position) return []
  if (position === 'TWP') {
    const arm = pitcherGroup(meta)
    return arm ? ['DH', arm] : ['DH']
  }
  if (position !== 'P') return [OUTFIELD.has(position) ? 'OF' : position]
  const arm = pitcherGroup(meta)
  return arm ? [arm] : []
}

// The single pool a player is most representatively in, or null.
export function positionGroup(meta) {
  return positionGroups(meta)[0] ?? null
}

// The salary a rank is computed from: a prorated part-season figure is lifted
// to the league minimum, which is the rate that player is actually on. See
// judgement call 4. Returns null when there is no usable salary.
export function rankingSalaryUsd(salaryUsd, minimumUsd) {
  if (!Number.isFinite(salaryUsd) || !Number.isFinite(minimumUsd)) return null
  return Math.max(salaryUsd, minimumUsd)
}

// records: { [playerId]: contractRecord }
// metaById: Map<string, meta> as accepted by positionGroup
// Returns Map<string, payRank>, absent for any player who cannot be ranked.
export function computePayRanks(records, metaById, season) {
  const minimumUsd = LEAGUE_MINIMUM_USD[season]
  const ranks = new Map()
  if (!Number.isFinite(minimumUsd)) return ranks

  const pools = new Map()
  const groupsById = new Map()
  for (const [playerId, record] of Object.entries(records ?? {})) {
    const id = String(playerId)
    const groups = positionGroups(metaById?.get(id))
    if (!groups.length) continue
    const salary = rankingSalaryUsd(record?.salaryUsd, minimumUsd)
    if (salary == null) continue
    groupsById.set(id, groups)
    for (const pos of groups) {
      if (!pools.has(pos)) pools.set(pos, [])
      pools.get(pos).push({ playerId: id, salary })
    }
  }

  const byPlayer = new Map()
  for (const [pos, members] of pools) {
    if (members.length < MIN_POOL) continue
    // Highest paid first, then by id so a tie band is emitted in a stable
    // order run to run rather than however Object.entries happened to walk.
    members.sort((a, b) => b.salary - a.salary || a.playerId.localeCompare(b.playerId))

    const of = members.length
    for (let i = 0; i < of; i++) {
      const { playerId, salary } = members[i]
      // Standard competition ranking: everyone in a tie band shares the
      // FIRST rank of the band, and the band's width is skipped after it.
      let rank = i + 1
      while (rank > 1 && members[rank - 2].salary === salary) rank--
      const below = members.filter((m) => m.salary < salary).length
      if (!byPlayer.has(playerId)) byPlayer.set(playerId, new Map())
      byPlayer.get(playerId).set(pos, {
        pos,
        rank,
        of,
        tied: members.some((m, j) => j !== i && m.salary === salary),
        onMinimum: salary === minimumUsd,
        // Where the dot sits on the card's rank strip: the share of the pool
        // paid strictly less. 1 is the best-paid player in the pool.
        fractionBelow: of > 1 ? Number((below / (of - 1)).toFixed(4)) : 1,
      })
    }
  }

  // Emit in the player's own group order, so `payRank` is the pool he is most
  // representatively in and `also` carries the rest. A group whose pool fell
  // under MIN_POOL simply is not there.
  for (const [playerId, groups] of groupsById) {
    const found = groups.map((pos) => byPlayer.get(playerId)?.get(pos)).filter(Boolean)
    if (!found.length) continue
    const [primary, ...also] = found
    ranks.set(playerId, also.length ? { ...primary, also } : primary)
  }
  return ranks
}
