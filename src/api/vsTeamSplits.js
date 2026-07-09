// The player page's SPLITS VS TEAM card data — for each MLB player, his career
// regular-season line against every club he's faced plus the last meeting's stat
// line — read from a static same-origin file (public/data/vs-team-splits.json)
// rather than computed live.
//
// Building it can't be done cheaply on a page load: the API's vs-team split
// types carry no game granularity, so getting BOTH the career totals AND the
// most-recent meeting's line means sweeping a player's whole MLB game log season
// by season (one request per season) — dozens per veteran. Past game logs are
// immutable, so scripts/gen-vs-team-splits.mjs precomputes it on a cron (see
// .github/workflows/update-vs-team-splits.yml) and this module just reads it.
// Same build-time-fetch pattern as war.js / former-teammates.js (see
// docs/data-enrichment.md §5).
//
// Spoiler note: the player page is a spoiler-FREE surface (it shows open game
// logs and season splits), so career-vs-club totals belong here just like the
// "Season splits" card. The one score-revealing element is the last-game line —
// a specific past game's result — so the card gates it against the page's `asOf`
// cutoff the same way the game log does (see SplitsVsTeam.jsx), never surfacing
// a meeting on or after the day of a game you're actively scoring.
//
// Degrades to null before the file exists or on any failure — the card simply
// doesn't render. Cached in-memory for the session (the file changes once a day).
let cached

export async function fetchVsTeamSplits() {
  if (cached !== undefined) return cached
  try {
    const res = await fetch('/data/vs-team-splits.json')
    if (!res.ok) throw new Error(`vs-team-splits.json ${res.status}`)
    cached = await res.json()
  } catch {
    cached = null
  }
  return cached
}

// The SPLITS VS TEAM view model for one player, or null when he isn't in the
// file (a non-MLB player, or one who's dropped off every active roster). Shapes:
//   { group, teamId,                                  // the player's own club
//     preselectId,                                    // opponent to open on
//     teams: [{ id, abbr, name, has }] }              // strip, own club dropped
// The per-opponent stat rows stay in `byOpp` for the component to read on select.
export function vsTeamSplitsFor(data, personId) {
  const player = data?.players?.[personId]
  if (!player || !player.vs) return null
  const teams = data.teams ?? []
  const byOpp = player.vs

  // The selectable strip: every MLB club except the player's own, each flagged
  // with whether he has any career meetings (drives the grayed-out treatment).
  const strip = teams
    .filter((t) => t.id !== player.teamId)
    .map((t) => ({ id: t.id, abbr: t.abbr, name: t.name, has: Boolean(byOpp[String(t.id)]) }))

  // Pre-select his club's next opponent when it's a club he's faced; otherwise
  // fall back to the most-faced club he has data for, so the card never opens
  // empty when there's anything to show.
  const nextId = data.nextOpponent?.[String(player.teamId)] ?? null
  let preselectId = nextId
  if (!preselectId || !byOpp[String(preselectId)]) {
    const faced = strip.filter((t) => t.has)
    preselectId = faced.length
      ? faced.reduce((best, t) =>
          (byOpp[String(t.id)]?.car?.g ?? 0) > (byOpp[String(best.id)]?.car?.g ?? 0) ? t : best,
        ).id
      : strip[0]?.id ?? null
  }

  return { group: player.group, teamId: player.teamId, preselectId, teams: strip, byOpp }
}
