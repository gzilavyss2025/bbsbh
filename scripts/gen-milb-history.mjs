// Regenerates public/data/milb-history.json — the per-season parent-org (and
// club-name) history for every AAA/AA/A+/A affiliate, so a career-timeline stop
// shows the org a since-reassigned farm club belonged to AT THE TIME, not the
// one it reports today. See src/api/milbHistory.js for the reader.
//
// WHY THIS EXISTS AS A SCRIPT (the file used to be hand-typed): the file's
// original premise was "there's no live source for what org a farm club was
// with in 2011, so a human must research each one." That's only half true.
// statsapi's own season-scoped snapshot IS that source:
//
//   GET /api/v1/teams?sportId={11|12|13|14}&season={Y}
//
// returns, for that ONE season, every club at that level with its name,
// locationName, league, and — crucially — its parentOrgId/parentOrgName AS OF
// THAT SEASON. So the dataset is derivable: sweep 4 levels × N seasons, group
// by team id, and collapse consecutive equal seasons into eras. The app never
// calls statsapi for this at runtime — it reads the small same-origin static
// file this writes, same pattern as war.js.
//
// THE 2005 FLOOR — statsapi's own MiLB affiliate data is NOT trustworthy before
// ~2005: it mislabels/omits older affiliations (proven: it claims the Colorado
// Springs Sky Sox were a Cleveland farm club through 2003 when they were the
// Rockies' AAA club from the Rockies' 1993 inception; the KC AAA slot carries
// the Memphis Redbirds years before that franchise existed; Round Rock is tagged
// AAA while it was actually AA). EVERY duplicate-affiliate anomaly the detector
// finds is ≤2004. Emitting those bad eras would break this file's one invariant
// (an override can only make a resolution MORE correct, never less), so we sweep
// only START_YEAR..now, where statsapi is clean.
//
// THE SEED — the handful of pre-2005 eras a human already verified against
// Wikipedia/Baseball-Ref (Nashville's Reds/White Sox/Pirates run, the Sky Sox
// Cleveland→Rockies split, Huntsville's Brewers years + old name/logo, etc.)
// live in scripts/milb-history-seed.json and are merged on top of the sweep:
// the seed owns years < START_YEAR, statsapi owns years >= START_YEAR, and equal
// adjacent eras coalesce across the boundary. Seed eras flagged `uncertain` are
// skipped (the human wasn't sure — don't assert a guess). Per-club `note`s,
// per-era `note`/`logo`s, and the top-level `caveats` array are carried from the
// seed too. Re-running is idempotent because the seed, not the output, is the
// source of hand-authored data.
//
// Run by hand: node scripts/gen-milb-history.mjs
// (Not on a cron — affiliate history is near-immutable; re-run manually when
// you want the current season's new assignments folded in. See CLAUDE.md.)
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'milb-history.json')
const seedPath = join(here, 'milb-history-seed.json')

const API = 'https://statsapi.mlb.com/api/v1'
const START_YEAR = 2005 // statsapi's MiLB affiliate data is only clean from here on — see header
const END_YEAR = new Date().getFullYear()
// AAA / AA / A+ / A — the full-season affiliate levels (skip rookie/complex/DSL
// noise per the chosen scope). Matches src/lib/teams.js's sportId map.
const LEVELS = [11, 12, 13, 14]

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      if (i === tries - 1) throw new Error(`${url}: ${err.message}`)
      await new Promise((r) => setTimeout(r, 400 * (i + 1)))
    }
  }
}

// Run `jobs` (thunks returning promises) with a bounded concurrency pool.
async function pool(jobs, limit = 8) {
  const results = new Array(jobs.length)
  let next = 0
  async function worker() {
    while (next < jobs.length) {
      const i = next++
      results[i] = await jobs[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, worker))
  return results
}

// The 30 real MLB orgs — a MiLB club's parentOrgId must be one of these for the
// affiliation to count (drops Mexican League clubs, which statsapi classifies
// AAA in some seasons but whose parentOrgId isn't an MLB org).
async function mlbOrgIds() {
  const data = await getJson(`${API}/teams?sportId=1`)
  return new Set((data.teams ?? []).map((t) => t.id))
}

async function main() {
  const orgs = await mlbOrgIds()

  // Sweep every (level, season) once; one call yields that season's full
  // snapshot for that level. ~4 × 37 requests.
  const jobs = []
  for (const sportId of LEVELS) {
    for (let season = START_YEAR; season <= END_YEAR; season++) {
      jobs.push(async () => {
        const data = await getJson(`${API}/teams?sportId=${sportId}&season=${season}`)
        return { sportId, season, teams: data.teams ?? [] }
      })
    }
  }
  const snapshots = await pool(jobs, 8)

  // Group into per-club season records, keeping only MLB-org-affiliated clubs.
  const byClub = new Map() // id -> [{season, sportId, name, city, league, orgId, orgName}]
  for (const { sportId, season, teams } of snapshots) {
    for (const t of teams) {
      if (!orgs.has(t.parentOrgId)) continue
      if (!byClub.has(t.id)) byClub.set(t.id, [])
      byClub.get(t.id).push({
        season,
        sportId,
        name: t.name ?? '',
        city: t.locationName ?? '',
        league: t.league?.name ?? '',
        orgId: t.parentOrgId,
        orgName: t.parentOrgName ?? '',
      })
    }
  }

  // Collapse a season-sorted record list into eras keyed by `keyFn`; each era
  // spans [firstSeason, lastSeason] of a consecutive run of equal keys.
  function toEras(recs, keyFn, build) {
    const sorted = [...recs].sort((a, b) => a.season - b.season)
    const eras = []
    for (const r of sorted) {
      const key = keyFn(r)
      const last = eras[eras.length - 1]
      if (last && last._key === key) {
        last.years[1] = r.season
      } else {
        eras.push({ _key: key, years: [r.season, r.season], _rec: r })
      }
    }
    return eras.map(({ _rec, years }) => build(_rec, years))
  }

  // Merge the seed's hand-authored data with the statsapi-derived eras:
  //  1. annotate — copy a seed era's `note`/`logo` onto the overlapping same-key
  //     auto era (so 2005+ annotations like San Antonio's "Triple-A only" note
  //     ride along even though statsapi owns that year).
  //  2. deep history — statsapi owns years >= START_YEAR, so pull in seed eras
  //     that reach BELOW the floor (clamped to <= START_YEAR-1), skipping any
  //     flagged `uncertain` (the human wasn't sure — don't assert a guess).
  //  3. coalesce — equal adjacent eras merge, so a seed era abutting an auto era
  //     of the same parent/name becomes one continuous span across the boundary.
  function merge(autoEras, seedEras, keyOf) {
    const seeds = seedEras ?? []
    const annotated = autoEras.map((era) => {
      const s = seeds.find(
        (p) => keyOf(p) === keyOf(era) && p.years[0] <= era.years[1] && p.years[1] >= era.years[0],
      )
      if (!s) return era
      const out = { ...era }
      for (const k of ['note', 'logo']) if (s[k] != null) out[k] = s[k]
      return out
    })
    const deep = seeds
      .filter((e) => !e.uncertain && e.years[0] < START_YEAR)
      .map((e) => ({ ...e, years: [e.years[0], Math.min(e.years[1], START_YEAR - 1)] }))
      .filter((e) => e.years[0] <= e.years[1])
    const all = [...deep, ...annotated].sort((a, b) => a.years[0] - b.years[0])
    const coalesced = []
    for (const era of all) {
      const last = coalesced[coalesced.length - 1]
      if (last && keyOf(last) === keyOf(era)) {
        last.years[1] = Math.max(last.years[1], era.years[1])
        for (const k of ['note', 'logo']) if (era[k] != null && last[k] == null) last[k] = era[k]
      } else {
        coalesced.push({ ...era, years: [...era.years] })
      }
    }
    return coalesced
  }

  // Hand-authored data comes from the seed, never the (regenerated) output.
  let seed = { clubs: {}, caveats: [] }
  try {
    seed = JSON.parse(await readFile(seedPath, 'utf8'))
  } catch {
    /* no seed — statsapi-only run */
  }
  const seedClubs = seed.clubs ?? {}

  const clubs = {}
  for (const id of new Set([...byClub.keys(), ...Object.keys(seedClubs).map(Number)])) {
    const recs = byClub.get(id) ?? []
    const seedClub = seedClubs[String(id)] ?? {}
    const latest = recs.length
      ? [...recs].sort((a, b) => b.season - a.season)[0]
      : { name: seedClub.currentName, sportId: seedClub.sportId }

    const parentHistory = merge(
      toEras(
        recs,
        (r) => r.orgId,
        (r, years) => ({ years, parentOrgId: r.orgId, parentOrgName: r.orgName }),
      ),
      seedClub.parentHistory,
      (e) => e.parentOrgId,
    )
    const nameHistory = merge(
      toEras(
        recs,
        (r) => r.name,
        (r, years) => ({ name: r.name, city: r.city, league: r.league, years }),
      ),
      seedClub.nameHistory,
      (e) => e.name, // name-only: a club keeping its name across a city-string
      // reformat ("Huntsville" vs "Huntsville, AL") is one era, not two
    )

    // Only worth recording when the naive current-season lookup could mislabel:
    // the club changed org at least once, or changed its own name at least once.
    if (parentHistory.length <= 1 && nameHistory.length <= 1) continue

    const club = {
      currentName: latest.name,
      sportId: latest.sportId,
      active: recs.some((r) => r.season === END_YEAR),
    }
    if (seedClub.note) club.note = seedClub.note
    if (parentHistory.length > 1) club.parentHistory = parentHistory
    if (nameHistory.length > 1) club.nameHistory = nameHistory
    clubs[String(id)] = club
  }

  const sortedClubs = {}
  for (const id of Object.keys(clubs).sort((a, b) => Number(a) - Number(b))) {
    sortedClubs[id] = clubs[id]
  }

  const file = {
    _hint:
      'GENERATED by scripts/gen-milb-history.mjs (NOT hand-typed anymore). Re-run that script to ' +
      'refresh. Hand-authored data — per-club/era `note`s, era `logo`s, verified pre-' +
      `${START_YEAR} eras, and the top-level \`caveats\` — lives in scripts/milb-history-seed.json ` +
      'and is merged in each run, so edit the SEED, not this file (edits here are overwritten). ' +
      'See src/api/milbHistory.js for the reader and docs/milb-historical-logos.md for the logo manifest.',
    generator: 'scripts/gen-milb-history.mjs',
    generatedAt: new Date().toISOString(),
    coverage: { seasons: [START_YEAR, END_YEAR], sportIds: LEVELS },
    method:
      'Eras from ' + START_YEAR + ' on are derived from statsapi’s own season-scoped snapshot, ' +
      'GET /api/v1/teams?sportId={11|12|13|14}&season={Y}, which reports each club’s ' +
      'name/locationName/league and parentOrgId/parentOrgName AS OF THAT SEASON; consecutive seasons ' +
      'with an equal parent (or name) collapse into one [startYear, endYear] era. This is the ground ' +
      'truth the app’s live lookups (src/api/team.js) miss — those only fetch the CURRENT season and ' +
      'would mislabel a past stint. Pre-' + START_YEAR + ' eras come from the hand-verified seed ' +
      '(statsapi’s own affiliate data is unreliable before then; see the generator header).',
    scope:
      `All 30 MLB orgs’ AAA/AA/A+/A affiliates (sportIds ${LEVELS.join(', ')}), seasons ` +
      `${START_YEAR}–${END_YEAR} from statsapi plus hand-verified pre-${START_YEAR} eras from the ` +
      'seed. A club is included only if its parent org OR its own name changed at least once (a club ' +
      'that never changed either is omitted — the live current-season lookup already resolves it ' +
      'correctly). Rookie/complex/DSL levels are out of scope; a (teamId, year) with no matching era ' +
      'below falls through to the live lookup, unchanged — safe by construction.',
    caveats: seed.caveats ?? [],
    clubs: sortedClubs,
  }

  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify(file, null, 2) + '\n')
  console.log(
    `wrote ${out}: ${Object.keys(sortedClubs).length} clubs, seasons ${START_YEAR}-${END_YEAR}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
