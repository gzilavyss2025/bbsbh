import { teamFullName } from '../lib/teams.js'
import { shardKey100 } from '../lib/shardKey.js'

// The manager detail page's data — one person's FULL coaching career (not
// just his managerial stints — e.g. Pat Murphy was Padres bench coach years
// before he became Brewers manager), read from a static same-origin file
// (public/data/manager-history/{NN}.json, bucketed on `personId % 100` —
// shardKey100, the same join the rookie records and career WAR use) rather than
// computed live. The page asks about ONE man and his record is ~280 bytes; the
// league-wide file it replaced was 1.1 MB of everyone who has held an MLB staff
// job since 2000. Same
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

const shards = new Map() // bucket key -> { generatedAt, byPersonId }

async function load(personId) {
  const key = shardKey100(personId)
  if (!shards.has(key)) {
    shards.set(
      key,
      fetch(`/data/manager-history/${key}.json`)
        .then((r) => (r.ok ? r.json() : {}))
        .then((d) => ({ generatedAt: d.generatedAt ?? null, byPersonId: d.byPersonId ?? {} }))
        .catch(() => ({ generatedAt: null, byPersonId: {} })),
    )
  }
  return shards.get(key)
}

// Same jobId convention as fetchManager (game.js) and the generator: a
// permanent skipper is 'MNGR', a fill-in 'NTRM' (Interim Manager) — matched
// by jobId, not a job-NAME match, since the coaches endpoint also has an
// 'Associate Manager' role (jobId 'ASSM') that isn't a second team manager.
const MANAGER_JOB_IDS = new Set(['MNGR', 'NTRM'])

// The /coaches endpoint the generator sweeps returns one row per JERSEY NUMBER
// a person wore in a team-season, not one per job — so a skipper who changed
// numbers, or who wore #42 on Jackie Robinson Day, arrives two or three times
// under the same jobId. Nothing downstream carries a jersey number, so those
// rows are indistinguishable duplicates, and attachRecords only ever pins the
// win-loss record to ONE of them. Left alone they cost twice:
// groupManagerialRecord printed each recordless twin as a "Shared season"
// caveat for a season whose record is sitting on the very next row, AND the
// flush that caveat forces split a legitimate multi-year run in half (Rob
// Thomson's Phillies read 2023–24, then a phantom 2025, then 2025–26).
//
// gen-manager-history.mjs now collapses them at the source. This holds the
// same line for data already shipped — the static shards only rebuild on the
// nightly cron, and a reader that trusts its file is how the phantom rows
// reached the page in the first place. Same instinct as aggregateSplits
// deduping statsapi's repeated stat rows before it sums them
// (src/api/person/stats.js): the feed repeats itself, so the reader dedupes.
//
// A row carrying a `record` wins over a bare twin; otherwise the first wins.
// Order is preserved, so the caller's "as stored" chronology survives.
export function dedupeStints(raw) {
  const byKey = new Map()
  for (const s of raw ?? []) {
    const key = `${s.teamId}|${s.season}|${s.jobId ?? s.job}`
    const kept = byKey.get(key)
    if (!kept) byKey.set(key, s)
    else if (!kept.record && s.record) byKey.set(key, s)
  }
  return [...byKey.values()]
}

// One person's whole coaching career, chronological (oldest first, as stored),
// each stint carrying its resolved team name and an `isManager` flag. Empty
// stints for a person with no coaching record on file (never held any MLB
// staff job 2000-present, or the file hasn't loaded).
export async function loadManagerHistory(personId) {
  const { byPersonId, generatedAt } = await load(personId)
  const raw = dedupeStints(byPersonId[personId] ?? [])
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
    // By jobId, never by the job NAME — the same rule MANAGER_JOB_IDS states
    // above and fetchManager (game.js) follows. A name match reads as correct
    // and silently isn't: it makes every title that is not exactly 'Manager'
    // interim, which is the whole reason jobId is the key here.
    const interim = s.jobId === 'NTRM'
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

// The header's "current role" line: this calendar year's stint, if he holds
// one — else null, so the page falls back to "last managed" prose off the most
// recent MANAGERIAL stint instead.
//
// A person can hold more than one job in a season (192 such seasons on file):
// a bench coach named interim manager in July keeps BOTH rows, exactly the way
// the Mets' 2026 roster kept Carlos Mendoza's 'Manager' row beside Andy
// Green's 'Interim Manager' one. So the pick is by ROLE, not by position in
// the array — this used to take the last stored row, which handed the header
// whatever order /coaches happened to return (Boston's 2026 interim bench
// coach read as "First Base Coach"). Interim manager outranks manager for the
// reason fetchManager (game.js) already encodes and test/manager.test.js
// pins: an interim row means the permanent one beside it is stale. Any
// manager job outranks an assistant one; among assistants the last row wins,
// as before.
export function currentStint(stints, season = new Date().getFullYear()) {
  const held = (stints ?? []).filter((s) => s?.season === season)
  if (!held.length) return null
  return (
    held.find((s) => s.jobId === 'NTRM') ??
    held.find((s) => MANAGER_JOB_IDS.has(s.jobId)) ??
    held[held.length - 1]
  )
}

// The most recent stint where this person actually managed (any season) —
// the "last managed {team}, {year}" fallback when he isn't in a current
// dugout, or is currently in a non-managerial role.
export function lastManagerialStint(stints) {
  const mgr = managerialStints(stints)
  return mgr.length ? mgr[mgr.length - 1] : null
}
