// Regenerates public/data/career-matchups.json — for every upcoming matchup
// (MLB or MiLB), every batter/pitcher pair (one from EACH club, either
// direction) with real career plate-appearance history against each other,
// already shaped for the lineup page's CAREER MATCHUPS card
// (src/api/careerMatchups.js just reads this file).
//
// This runs on a cron via .github/workflows/update-nightly-data.yml, NOT at
// request time. The API's own vsPlayer/vsPlayerTotal endpoint
// (GET /api/v1/people/{batterId}/stats?stats=vsPlayerTotal&opposingPlayerId=
// {pitcherId}&group=hitting&sportId={n}) is the authoritative source, but it
// takes exactly ONE sportId per call and returns nothing for the wrong level
// (verified live: a call with no sportId silently defaults to MLB; a
// comma-list of sportIds is rejected outright) — so "did these two ever face
// each other, at ANY level" means one call per level the two players share,
// not one call per pair. For a full lineup vs. a full pitching staff that's
// up to ~9 batters × ~13 pitchers × 5 levels ≈ 585 calls for ONE matchup, far
// too heavy for a page load — the same cost shape gen-former-teammates.mjs
// exists for, and the same fix: precompute nightly, read a small static file
// live.
//
// The one thing that keeps this from being even heavier: a pair can only
// have shared history at a level BOTH players actually appeared at, so each
// player's career is first reduced to the set of levels he's played at as a
// batter (or pitcher) — a single year-by-year sweep, same shape as
// gen-former-teammates.mjs's buildPairSet but one stat group instead of two —
// and only the INTERSECTION of the two players' level-sets is ever queried
// against vsPlayerTotal. Most pairs share zero levels (a High-A reliever and
// a AAA veteran, say) and cost nothing beyond that one cheap per-player sweep.
//
// Nightly timing is also what keeps this spoiler-safe with no extra guard:
// vsPlayerTotal for the CURRENT season already reflects a game's plate
// appearances the moment they happen (verified live against a game in
// progress) — a live fetch of this data mid-game would leak whether/how
// tonight's batter and pitcher have already matched up before the user
// reveals that half. Because this only ever runs overnight, before that
// night's games are played, the file it writes can never contain a play from
// a game that hasn't happened yet.
//
// Run by hand: node scripts/gen-career-matchups.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'career-matchups.json')
const BASE = 'https://statsapi.mlb.com'

// Same window as gen-former-teammates.mjs — today + the next two days, so
// late-night and next-day browsing both find their game.
const WINDOW_DAYS = 2
const MILB_SPORT_IDS = [11, 12, 13, 14]
const MATCHUP_SPORT_IDS = [1, ...MILB_SPORT_IDS]
const SPORT_LABEL = { 1: 'MLB', 11: 'AAA', 12: 'AA', 13: 'A+', 14: 'A' }

const isoDay = (offset = 0) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

async function mapConcurrent(items, limit, mapper) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      try {
        results[i] = await mapper(items[i], i)
      } catch {
        results[i] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// --- schedule: the matchups to precompute (same shape as
// gen-former-teammates.mjs's fetchMatchups — kept as its own copy, same
// self-contained convention as gen-rehab.mjs mirroring person.js — EXCEPT
// keyed by the normalized (unordered) team pair rather than literal
// away-homeId, unlike that sibling: pairingsFor below always runs BOTH
// directions itself (away-bats-vs-home-pitches AND the reverse) in one pass,
// so which club the schedule happened to call "home" that day carries no
// information this generator needs. Keying on the literal away-homeId (as
// first written, and as gen-former-teammates.mjs still does — it uses the
// direction for `a`/`b` framing, which this script doesn't) meant a
// home-and-home flip within the window (the same two clubs hosting each
// other on different days) produced TWO entries that both normalized to the
// same output key later, so the second one silently redid — and wasted the
// API calls for — the exact same work as the first. Verified against a real
// full-league run before this fix: the truncation counter (incremented once
// per raw entry) came out higher than the final matchup count, the
// fingerprint of exactly this double-processing. ----------------------------
async function fetchMatchups() {
  const pairs = new Map()
  const teams = new Map()
  for (let d = 0; d <= WINDOW_DAYS; d++) {
    for (const sportId of MATCHUP_SPORT_IDS) {
      let data
      try {
        data = await getJson(`/api/v1/schedule?sportId=${sportId}&date=${isoDay(d)}&hydrate=team`)
      } catch {
        continue
      }
      for (const date of data.dates ?? []) {
        for (const g of date.games ?? []) {
          const a = g.teams?.away?.team
          const h = g.teams?.home?.team
          if (!a?.id || !h?.id) continue
          const key = a.id < h.id ? `${a.id}-${h.id}` : `${h.id}-${a.id}`
          if (!pairs.has(key)) pairs.set(key, { awayId: a.id, homeId: h.id })
          teams.set(a.id, true)
          teams.set(h.id, true)
        }
      }
    }
  }
  return { pairs: [...pairs.values()], teamIds: [...teams.keys()] }
}

// --- rosters: each club's active roster, split into batters vs pitchers -----
// The active-roster endpoint returns every pitcher as the plain "P"
// abbreviation (no SP/RP split) — same field gen-former-teammates.mjs reads.
// A two-way player (Ohtani-type) carries a non-"P" primary position and so is
// only ever queried as a batter here — a real but rare gap, not worth a
// special case for this card.
async function fetchActiveRoster(teamId) {
  try {
    const data = await getJson(`/api/v1/teams/${teamId}/roster?rosterType=active`)
    const entries = (data.roster ?? []).filter((r) => r.person?.id)
    return {
      batters: entries.filter((r) => r.position?.abbreviation !== 'P').map((r) => r.person.id),
      pitchers: entries.filter((r) => r.position?.abbreviation === 'P').map((r) => r.person.id),
    }
  } catch {
    return { batters: [], pitchers: [] }
  }
}

// --- per-player level history --------------------------------------------
// Which sportIds a player has ever recorded a stat line at, as a batter
// (group=hitting) or pitcher (group=pitching) — the intersection of a
// batter's and a pitcher's level-sets is exactly the set of levels a shared
// plate appearance could possibly have happened at, and it prunes the
// vsPlayerTotal fan-out from "every level" down to "only levels both players
// were ever actually at". One request per level (see header — a comma-list
// of sportIds 400s), so 5 requests per player, same order as
// gen-former-teammates.mjs's buildPairSet but one stat group instead of two.
async function fetchPlayerLevels(personId, group) {
  const levels = new Set()
  await Promise.all(
    MATCHUP_SPORT_IDS.map(async (sportId) => {
      const q = [`stats=yearByYear`, `group=${group}`]
      if (sportId !== 1) q.push(`sportId=${sportId}`)
      try {
        const data = await getJson(`/api/v1/people/${personId}/stats?${q.join('&')}`)
        const splits = data.stats?.[0]?.splits ?? []
        if (splits.some((s) => Number(s.stat?.gamesPlayed ?? 0) > 0)) levels.add(sportId)
      } catch {
        /* leave this level out — the pair just won't be checked against it */
      }
    }),
  )
  return levels
}

// --- the career total itself -----------------------------------------------
// Sums vsPlayerTotal across every level the two players share (see header),
// rather than trusting any single level's rate stats — a player can have
// history against the same opponent at more than one level (a AAA meeting
// AND, this year, an AA one). Counting stats sum cleanly; rate stats
// (avg/obp/slg) are recomputed from the summed counts once, not averaged.
// Levels are tracked by NAME only, not season — verified live that
// vsPlayerTotal's splits carry no `season` field (it's a true aggregate, not
// one row per year; only the separate, per-season `vsPlayer` type has that,
// and fetching both would double the request count for a cosmetic detail).
async function careerLine(batterId, pitcherId, levels) {
  const totals = { ab: 0, h: 0, hr: 0, bb: 0, hbp: 0, k: 0, pa: 0 }
  const byLevel = []
  for (const sportId of levels) {
    const q = [
      `stats=vsPlayerTotal`,
      `opposingPlayerId=${pitcherId}`,
      `group=hitting`,
      `sportId=${sportId}`,
    ]
    let data
    try {
      data = await getJson(`/api/v1/people/${batterId}/stats?${q.join('&')}`)
    } catch {
      continue
    }
    const splits = data.stats?.[0]?.splits ?? []
    let levelPa = 0
    for (const s of splits) {
      const st = s.stat ?? {}
      const pa = Number(st.plateAppearances ?? 0)
      if (pa <= 0) continue
      totals.ab += Number(st.atBats ?? 0)
      totals.h += Number(st.hits ?? 0)
      totals.hr += Number(st.homeRuns ?? 0)
      totals.bb += Number(st.baseOnBalls ?? 0) + Number(st.intentionalWalks ?? 0)
      totals.hbp += Number(st.hitByPitch ?? 0)
      totals.k += Number(st.strikeOuts ?? 0)
      totals.pa += pa
      levelPa += pa
    }
    if (levelPa > 0) byLevel.push(SPORT_LABEL[sportId] ?? String(sportId))
  }
  if (totals.pa === 0) return null
  return { ...totals, levels: byLevel.sort((x, y) => LEVEL_RANK(y) - LEVEL_RANK(x)) }
}

const LEVEL_ORDER = { MLB: 5, AAA: 4, AA: 3, 'A+': 2, A: 1 }
const LEVEL_RANK = (label) => LEVEL_ORDER[label] ?? 0

// --- names -------------------------------------------------------------------
async function fetchNames(personIds) {
  const names = new Map()
  const CHUNK = 100
  for (let i = 0; i < personIds.length; i += CHUNK) {
    const chunk = personIds.slice(i, i + CHUNK)
    try {
      const data = await getJson(`/api/v1/people?personIds=${chunk.join(',')}`)
      for (const p of data.people ?? []) {
        if (p.id) names.set(p.id, p.fullName ?? '')
      }
    } catch {
      /* leave those names blank; the card degrades to an empty string */
    }
  }
  return names
}

// --- one direction: every batter on `batterRoster` vs every pitcher on
// `pitcherRoster`, both from the same club pair (called twice per matchup,
// once each direction). `batterLevels`/`pitcherLevels` are the role-scoped
// personId -> Set(sportId) maps built in main, below. ------------------------
async function pairingsFor(
  batterRoster,
  pitcherRoster,
  batterTeamId,
  pitcherTeamId,
  batterLevels,
  pitcherLevels,
  names,
) {
  const jobs = []
  for (const batterId of batterRoster) {
    const bLevels = batterLevels.get(batterId)
    if (!bLevels || bLevels.size === 0) continue
    for (const pitcherId of pitcherRoster) {
      const pLevels = pitcherLevels.get(pitcherId)
      if (!pLevels || pLevels.size === 0) continue
      const shared = [...bLevels].filter((l) => pLevels.has(l))
      if (shared.length === 0) continue
      jobs.push({ batterId, pitcherId, shared })
    }
  }
  const results = await mapConcurrent(jobs, 8, (j) => careerLine(j.batterId, j.pitcherId, j.shared))
  const rows = []
  jobs.forEach((j, i) => {
    const line = results[i]
    if (!line) return
    rows.push({
      batter: { id: j.batterId, name: names.get(j.batterId) ?? '', teamId: batterTeamId },
      pitcher: { id: j.pitcherId, name: names.get(j.pitcherId) ?? '', teamId: pitcherTeamId },
      ...line,
    })
  })
  return rows
}

// Same-league MiLB rivals can play each other dozens of times a year, so a
// matchup between two clubs that have faced off for seasons can turn up
// hundreds of real pairs (verified: one AA divisional matchup alone produced
// 154). Capped to the most-faced pairs so the card stays readable — sorted by
// PA first, so what's cut is always the thinnest history, never the most
// meaningful.
const ROWS_PER_MATCHUP_CAP = 30

// --- main ---------------------------------------------------------------------
const { pairs, teamIds } = await fetchMatchups()

const rosterEntries = await mapConcurrent(teamIds, 8, (id) => fetchActiveRoster(id))
const rosterByTeam = new Map()
teamIds.forEach((id, i) => rosterByTeam.set(id, rosterEntries[i] ?? { batters: [], pitchers: [] }))

// Every player who could appear, either as a batter or a pitcher, computed
// once (a player on a club in several matchups isn't recomputed). A two-way
// player can land on both lists — his batting levels and pitching levels are
// genuinely different sweeps (group=hitting vs group=pitching), so both are
// fetched; it's just two ordinary players sharing one personId, not special-
// cased further.
const allBatterIds = new Set()
const allPitcherIds = new Set()
for (const { batters, pitchers } of rosterByTeam.values()) {
  batters.forEach((id) => allBatterIds.add(id))
  pitchers.forEach((id) => allPitcherIds.add(id))
}

const batterIdList = [...allBatterIds]
const batterLevelResults = await mapConcurrent(batterIdList, 8, (id) => fetchPlayerLevels(id, 'hitting'))
const batterLevels = new Map(batterIdList.map((id, i) => [id, batterLevelResults[i] ?? new Set()]))

const pitcherIdList = [...allPitcherIds]
const pitcherLevelResults = await mapConcurrent(pitcherIdList, 8, (id) => fetchPlayerLevels(id, 'pitching'))
const pitcherLevels = new Map(pitcherIdList.map((id, i) => [id, pitcherLevelResults[i] ?? new Set()]))

const names = await fetchNames([...allBatterIds, ...allPitcherIds])

const matchups = {}
let totalRows = 0
let truncatedMatchups = 0
for (const { awayId, homeId } of pairs) {
  const away = rosterByTeam.get(awayId) ?? { batters: [], pitchers: [] }
  const home = rosterByTeam.get(homeId) ?? { batters: [], pitchers: [] }
  const [awayBatsHomePitches, homeBatsAwayPitches] = await Promise.all([
    pairingsFor(away.batters, home.pitchers, awayId, homeId, batterLevels, pitcherLevels, names),
    pairingsFor(home.batters, away.pitchers, homeId, awayId, batterLevels, pitcherLevels, names),
  ])
  const allRows = [...awayBatsHomePitches, ...homeBatsAwayPitches].sort((x, y) => y.pa - x.pa)
  if (allRows.length === 0) continue
  if (allRows.length > ROWS_PER_MATCHUP_CAP) truncatedMatchups++
  const key = awayId < homeId ? `${awayId}-${homeId}` : `${homeId}-${awayId}`
  matchups[key] = allRows.slice(0, ROWS_PER_MATCHUP_CAP)
  totalRows += matchups[key].length
}

await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), matchups }))
console.log(
  `wrote ${out} (${Object.keys(matchups).length} matchups / ${totalRows} batter-pitcher pairs, ` +
    `${allBatterIds.size} batters, ${allPitcherIds.size} pitchers, ` +
    `${truncatedMatchups} matchups truncated to the top ${ROWS_PER_MATCHUP_CAP} by PA)`,
)
