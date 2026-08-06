// The lineup page's card data — for the game being staged, how each batter on
// a club has fared in his career against the OPPOSING club's probable starting
// pitcher, at any level the two have shared — read from a static same-origin
// file (public/data/career-matchups.json) rather than computed live.
//
// Building it can't be done spoiler-cheaply on a page load. Checking one
// batter/pitcher pair's history needs one statsapi call per level they might
// have crossed paths at (the API takes exactly one sportId per call), so a
// lineup against one starter is a couple of dozen calls. It's also
// spoiler-sensitive in a way former-teammates/vs-team-splits aren't: the
// underlying stat updates live as tonight's plate appearances happen, so
// fetching it mid-game could leak whether/how tonight's batter and pitcher
// have already matched up. scripts/gen-career-matchups.mjs precomputes it on
// the nightly cron (.github/workflows/update-nightly-data.yml) — which, running
// before that night's games, can never see a play that hasn't happened yet —
// and this module just reads the result. Same build-time-fetch pattern as
// former-teammates.js (see docs/data-enrichment.md §5). Rosters and past-season
// career totals carry no score, so the file itself is spoiler-free like the
// rest of the lineup-page surfaces.
//
// Keyed by gamePk, not by team pair: a three-game series is the same two clubs
// on three nights behind three different starters, and a doubleheader is two in
// one day — the team-pair key this file used before could represent neither.
//
// Degrades to an empty map before the file exists or on any failure — the card
// simply doesn't render. Cached in-memory for the session since the file only
// changes once a day.
let cached = null

export async function loadCareerMatchups() {
  if (cached) return cached
  try {
    const res = await fetch('/data/career-matchups.json')
    if (!res.ok) throw new Error(`career-matchups.json ${res.status}`)
    const data = await res.json()
    cached = { matchups: data.matchups ?? {}, generatedAt: data.generatedAt ?? null }
  } catch {
    cached = { matchups: {}, generatedAt: null }
  }
  return cached
}

// One club's batters against the starter they're about to face, for the game
// being staged, or null when there's nothing to show (no file yet, a game
// whose probables hadn't posted when the cron ran, or a lineup with no career
// history against this arm — a debut start, most often). Shape:
//   { pitcher: { id, name },
//     batters: [{ id, name, ab, h, hr, bb, hbp, k, pa, levels: ['AA', …] }] }
// Already sorted deepest-history-first by the generator; the page renders the
// list as given.
export function starterMatchupsFor(data, gamePk, battingTeamId) {
  if (!gamePk || !battingTeamId) return null
  const side = data?.matchups?.[String(gamePk)]?.sides?.[String(battingTeamId)]
  if (!side || !Array.isArray(side.batters) || side.batters.length === 0) return null
  return side
}

// "2-for-7, 1 HR, 3 K — AA, A+" — scorebook shorthand first (the thing a paper
// scorer already writes), extras only when they're nonzero so a plain 0-for-2
// doesn't carry three redundant zero badges, levels last so a pair who's only
// ever faced off at tonight's own level (the common case, and the only case at
// MLB) doesn't repeat what the card's own context already implies — only a pair
// with history at ANOTHER level too keeps the full list, tonight's level
// included, so a reader can see how much of the sample carries over.
export function matchupLine(r, levelLabel) {
  const parts = [`${r.h}-for-${r.ab}`]
  if (r.hr > 0) parts.push(`${r.hr} HR`)
  if (r.bb > 0) parts.push(`${r.bb} BB`)
  if (r.k > 0) parts.push(`${r.k} K`)
  const stat = parts.join(', ')
  const onlyTonightsLevel = r.levels.length === 1 && r.levels[0] === levelLabel
  return r.levels.length > 0 && !onlyTonightsLevel ? `${stat} — ${r.levels.join(', ')}` : stat
}
