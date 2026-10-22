// The Awards History page's data — who won each major MLB award (MVP, Cy
// Young, Rookie of the Year, Silver Slugger, Gold Glove, Platinum Glove,
// Reliever of the Year, Comeback Player, Hank Aaron, Roberto Clemente,
// All-MLB First/Second Team, World Series MVP, LCS MVP) over the last several seasons, read from a
// static same-origin file (public/data/awards-history.json) rather than
// computed live.
//
// scripts/gen-awards-history.mjs builds it: a hand-run full regenerate, plus a
// `--nightly` run from October to February that folds in the season in play
// (#2510). This module just reads it. Same build-time-fetch pattern as milestones.js/rehab.js (see
// docs/data-enrichment.md §5). Historical award winners carry no individual
// game's score — same footing as the (ungated) League Leaders/WAR/Milestone
// Watch pages — so this file needs no spoiler cutoff.
//
// The season in play is also read live — see "this season" below. That half is not
// cached: an award announced mid-session should show on the next visit.
//
// Degrades to an empty list before the file exists or on any failure — a
// friendly empty state, not a broken page. The file read is cached in memory for
// the session (staticJson); a new night's file arrives on the next load.

import { staticJson } from './staticJson.js'
import { getJson } from './statsapi.js'
import { MAJOR_AWARDS } from './person/awards.js'
import { teamFullName } from '../lib/teams.js'

export const loadAwardsHistory = staticJson('/data/awards-history.json', {
  shape: (d) => ({
    seasons: d.seasons ?? [],
    families: d.families ?? [],
    generatedAt: d.generatedAt ?? null,
  }),
  fallback: { seasons: [], families: [], generatedAt: null },
})

// ---------------------------------------------------------------- this season
// The "This season" block: the current season's winners, read LIVE from
// GET /api/v1/awards/{id}/recipients?season=YYYY as MLB announces them (#2510).
// Checked 2026-10-22: the API has NO finalists endpoint (/finalists and
// /winners 404), so the block shows winners only. An award not yet announced
// answers HTTP 404 ("Object not found"), not an empty 200 — so a 404 is the
// ordinary "pending" state and any other failure is a real error. Same
// open-surface footing as the static history: an award is not a game result.

// Hardware only, no All-Star selections — the same filter gen-awards-history.mjs applies.
export const SEASON_AWARDS = Object.entries(MAJOR_AWARDS).filter(([id]) => id !== 'ALAS' && id !== 'NLAS')

// The awards run from the LCS MVPs in mid-October to the last honors in December.
// Inference: January and February still belong to the season just ended (the
// stragglers have slipped to mid-December at the latest); March through September
// is a season in progress with nothing to announce, so the block stays away.
export function awardsSeasonInPlay(now = new Date()) {
  const month = now.getMonth()
  if (month >= 9) return now.getFullYear()
  if (month <= 1) return now.getFullYear() - 1
  return null
}

export function leagueOf(awardId) {
  if (awardId.startsWith('AL')) return 'AL'
  if (awardId.startsWith('NL')) return 'NL'
  return null
}

export function recipientsOf(awardId, data) {
  return (data.awards ?? [])
    .filter((a) => a.player?.id)
    .map((a) => ({
      league: leagueOf(awardId),
      playerId: a.player.id,
      name: a.player.nameFirstLast || '',
      teamId: a.team?.id ?? null,
      teamName: teamFullName(a.team?.id) || '',
      position: a.player.primaryPosition?.abbreviation || '',
    }))
}

// One award id -> { status: 'announced' | 'pending' | 'error', recipients }.
export async function fetchSeasonAward(awardId, season, get = getJson) {
  try {
    const data = await get(`/api/v1/awards/${awardId}/recipients?season=${season}`)
    const recipients = recipientsOf(awardId, data)
    return recipients.length ? { status: 'announced', recipients } : { status: 'pending', recipients: [] }
  } catch (err) {
    // getJson throws `MLB API 404 for <path>` — the API's way of saying "not announced".
    if (/^MLB API 404\b/.test(err?.message ?? '')) return { status: 'pending', recipients: [] }
    return { status: 'error', recipients: [] }
  }
}

// Every hardware award for one season, grouped into the same labelled families
// (ALMVP + NLMVP -> "MVP") in MAJOR_AWARDS' own order. One failed call degrades
// that cell only, never the block.
export async function loadSeasonAwards(season, get = getJson) {
  const families = new Map()
  for (const [id, label] of SEASON_AWARDS) {
    if (!families.has(label)) families.set(label, { key: label, label, awards: [] })
    families.get(label).awards.push({ id, league: leagueOf(id) })
  }
  await Promise.all(
    [...families.values()].flatMap((f) =>
      f.awards.map(async (a) => Object.assign(a, await fetchSeasonAward(a.id, season, get))),
    ),
  )
  return [...families.values()]
}
