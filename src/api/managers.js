import { teamFullName } from '../lib/teams.js'

// The manager detail page's data — one person's FULL coaching career (not
// just his managerial stints — e.g. Pat Murphy was Padres bench coach years
// before he became Brewers manager), read from a static same-origin file
// (public/data/manager-history.json) rather than computed live. Same
// build-time-fetch pattern as umpires.js: scripts/gen-manager-history.mjs
// sweeps every MLB team's /coaches endpoint season by season (too many calls
// to do on a page load) and re-indexes the result by personId; this module
// just reads the shaped result. See .scratch/manager-detail-page/plan.md for
// the design and the generator's own header for the shared-season caveat.
//
// A stint's job title ending in "manager" (Manager / Interim Manager) is the
// only kind that carries a win-loss `record` — every other title (Bench
// Coach, Pitching Coach, …) is coaching-only. A team-season shared by more
// than one manager with no hand-verified transition date on file carries
// `sharedSeason: true` and NO `record`, rather than a fabricated split (see
// scripts/manager-transitions-seed.json / manager-transitions-needs-research.json).
//
// Coaching data is MLB-only at the source (the /coaches endpoint), so
// teamFullName always resolves here (unlike most of this app's MiLB-aware
// helpers).

let cached = null

async function load() {
  if (cached) return cached
  try {
    const res = await fetch('/data/manager-history.json')
    if (!res.ok) throw new Error(`manager-history.json ${res.status}`)
    const data = await res.json()
    cached = { generatedAt: data.generatedAt ?? null, byPersonId: data.byPersonId ?? {} }
  } catch {
    cached = { generatedAt: null, byPersonId: {} }
  }
  return cached
}

// Same jobId convention as fetchManager (game.js) and the generator: a
// permanent skipper is 'MNGR', a fill-in 'NTRM' (Interim Manager) — matched
// by jobId, not a job-NAME match, since the coaches endpoint also has an
// 'Associate Manager' role (jobId 'ASSM') that isn't a second team manager.
const MANAGER_JOB_IDS = new Set(['MNGR', 'NTRM'])

// One person's whole coaching career, chronological (oldest first, as stored),
// each stint carrying its resolved team name and an `isManager` flag. Empty
// stints for a person with no coaching record on file (never held any MLB
// staff job 2000-present, or the file hasn't loaded).
export async function loadManagerHistory(personId) {
  const { byPersonId, generatedAt } = await load()
  const raw = byPersonId[personId] ?? []
  const stints = raw.map((s) => ({
    ...s,
    teamName: teamFullName(s.teamId) || '',
    isManager: MANAGER_JOB_IDS.has(s.jobId),
  }))
  return { stints, generatedAt }
}

// Just the record-bearing stints (Manager / Interim Manager) — the win-loss
// table. Bench Coach/Pitching Coach/etc. stints carry no record of their own,
// so they're excluded here; the full timeline (every role) is just `stints`
// itself, rendered with each entry's own `isManager` flag.
export function managerialStints(stints) {
  return (stints ?? []).filter((s) => s.isManager)
}

// Collapses consecutive same-team, same-interim-status manager seasons WITH a
// resolved record into one row spanning the run (e.g. 9 straight Brewers
// seasons -> one "2015-2023" line), summing the record — a much more readable
// table than one row per season. A season with no resolved record
// (`sharedSeason: true`, an in-season change nobody's hand-verified yet) is
// NEVER folded into a summed run (that would silently under/over-count a
// real record) — it always surfaces as its own single-season row with no W/L,
// for the caller to render as the "Shared season" caveat.
export function groupManagerialRecord(stints) {
  const mgr = managerialStints(stints)
    .slice()
    .sort((a, b) => a.season - b.season)
  const rows = []
  let g = null
  const flush = () => {
    if (g) rows.push(g)
    g = null
  }
  for (const s of mgr) {
    const interim = s.job !== 'Manager'
    if (s.sharedSeason || !s.record) {
      flush()
      rows.push({
        teamId: s.teamId,
        teamName: s.teamName,
        interim,
        startSeason: s.season,
        endSeason: s.season,
        w: null,
        l: null,
        sharedSeason: true,
      })
      continue
    }
    if (g && g.teamId === s.teamId && g.interim === interim && s.season === g.endSeason + 1) {
      g.endSeason = s.season
      g.w += s.record.w
      g.l += s.record.l
    } else {
      flush()
      g = {
        teamId: s.teamId,
        teamName: s.teamName,
        interim,
        startSeason: s.season,
        endSeason: s.season,
        w: s.record.w,
        l: s.record.l,
        sharedSeason: false,
      }
    }
  }
  flush()
  return rows
}

// The header's "current role" line: the most recent stint on file, if it's
// this calendar year's — else null, so the page falls back to "last managed"
// prose off the most recent MANAGERIAL stint instead.
export function currentStint(stints, season = new Date().getFullYear()) {
  const last = (stints ?? [])[stints.length - 1]
  return last && last.season === season ? last : null
}

// The most recent stint where this person actually managed (any season) —
// the "last managed {team}, {year}" fallback when he isn't in a current
// dugout, or is currently in a non-managerial role.
export function lastManagerialStint(stints) {
  const mgr = managerialStints(stints)
  return mgr.length ? mgr[mgr.length - 1] : null
}
