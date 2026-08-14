// The pure decisions behind gen-milb-alumni.mjs, split out so they can be
// unit-tested — a generator file is a top-level script, so importing one RUNS
// it (see scripts/CLAUDE.md). The generator keeps the IO: reading war.json and
// the war-history shards, walking statsapi for a player's minor-league stints,
// writing the shards. Everything below is a function of its arguments.

// Career WAR for every player the two WAR files know about, filtered to the
// ones still active and ranked highest first.
//
// `live` is war.json (this season, still moving); `shards` is the list of
// war-history files (every completed season). A player's career total is the
// sum of both, across bat AND pit — a two-way player earns both, and a pitcher
// who takes plate appearances has a bat line that is part of his value.
//
// ACTIVE is defined as "present in the live file", not by a roster lookup: the
// FanGraphs leaderboards war.json is built from carry only players who have
// actually appeared this season, so a retired great falls out on his own and a
// September call-up appears the day he plays.
export function careerWarRanking(live, shards, { poolSize = Infinity } = {}) {
  const total = new Map()
  const add = (id, w) => {
    if (typeof w === 'number' && Number.isFinite(w)) total.set(id, (total.get(id) ?? 0) + w)
  }
  for (const group of ['bat', 'pit']) {
    for (const [id, w] of Object.entries(live?.[group] ?? {})) add(id, w)
  }
  for (const shard of shards ?? []) {
    for (const group of ['bat', 'pit']) {
      for (const [id, seasons] of Object.entries(shard?.[group] ?? {})) {
        for (const w of Object.values(seasons ?? {})) add(id, w)
      }
    }
  }
  const active = new Set([...Object.keys(live?.bat ?? {}), ...Object.keys(live?.pit ?? {})])
  return [...total]
    .filter(([id]) => active.has(id))
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, poolSize)
    .map(([id, war]) => ({ id, war: Math.round(war * 10) / 10 }))
}

// Whether this player's minor-league stints must be re-walked tonight.
//
// A finished bus-league career never changes, so most of the pool is scanned
// once and then read from cache. Re-scan when he is new to the cache, when the
// cache entry predates this season (so every player is refreshed once a year),
// or when he was in the minors recently enough that this season could still add
// to it. Everyone else — the established big leaguer whose last option was
// years ago — is skipped, which is the great majority after the first run.
export function needsScan(entry, season) {
  if (!entry || entry.scanned !== season) return true
  const lasts = Object.values(entry.stints ?? {}).map((s) => s?.last ?? 0)
  return lasts.length === 0 || Math.max(...lasts) >= season - 1
}

// Invert player → clubs into club → players: each current affiliate's alumni,
// ranked by career WAR, capped at `cardSize`.
//
// `ranked` must already be WAR-descending (careerWarRanking's output is), so
// each club's list inherits that order and this only trims it.
//
// THE GAMES FLOOR IS THE POINT. `minGames` is what separates a player who came
// through this club from one who spent a weekend here on a rehab assignment.
// Both are literally "a minor-league stint"; only one is the club's story. With
// no floor, Nashville's top three alumni by career WAR are three-game cameos
// (Yelich 2021, Sonny Gray 2017, Semien 2017) ranked above Matt Chapman (67 G)
// and Matt Olson (210 G). Games are summed across every season a player spent
// with the club, so three separate short call-ups can still add up to a stint.
export function alumniByTeam(ranked, scans, affiliateIds, { minGames = 20, cardSize = 6 } = {}) {
  const byTeam = {}
  for (const { id, war } of ranked) {
    for (const [teamId, stint] of Object.entries(scans?.[id]?.stints ?? {})) {
      if (!affiliateIds.has(String(teamId))) continue
      if ((stint?.g ?? 0) < minGames) continue
      const list = (byTeam[teamId] ??= [])
      if (list.length < cardSize) {
        list.push({ id, war, g: stint.g, first: stint.first, last: stint.last })
      }
    }
  }
  return byTeam
}
