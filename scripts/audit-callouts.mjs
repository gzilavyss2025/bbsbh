#!/usr/bin/env node
// audit-callouts.mjs — a DEVELOPER tool. Not a product surface, not a CI gate,
// and it writes nothing the app reads. It answers the one question the callout
// rubric (docs/callouts.md) cannot answer on its own: across real games, which
// families actually reach a reader, and which are dead letters.
//
// HOW IT MEASURES. The committed nightly bundles under
// public/data/callouts/<MMDDYYYY>/<gamePk>.json name real, completed games. For
// each one this fetches that game's final feed and replays all five callout
// surfaces through the app's OWN builders — nothing is re-implemented, so a
// number here is a number the app would have produced.
//
// REVEAL POSITION IS HONEST, and must stay that way. Every half replays at the
// reader position the app renders that half at:
//   pre-half, entering (inning, half): revealedThrough = halfIndex(inning, half) - 1
//   between,  leaving  (inning, half): revealedThrough = halfIndex(inning, half)
// which is exactly the `halfIndex(next) <= revealedThrough + 1` equality both
// surfaces assume (ADR-0014). Never pass a blanket Infinity: that measures a
// surface the app never draws. The box-score roll-up runs once per game at full
// reveal, which is where it lives — behind the box score's seal.
//
// WHAT IT MAY NOT CLAIM. Two surfaces truncate inside their own builder
// (buildPreHalfCallouts slices to PREHALF_MAX, buildBetweenInnings to CARD_MAX),
// so this script only ever sees their SURVIVORS. Those rows are post-cap and
// their cap column reads "post-cap": the count answers "does a reader ever see
// this family here", never "how often was it cut". Margin Notes and the roll-up
// return the full ranked list (their caps live in the components), so those two
// carry real cap-survival numbers.
//
// A family whose data the bundle cannot carry — the MLB-only career and
// standings families on a MiLB bundle, bullpenThin outside workload.json's
// freshness window — counts as INELIGIBLE, never as a non-fire. A 0% fire rate
// over an ineligible sample is a lie about the family.
//
// Usage:
//   node scripts/audit-callouts.mjs --since=2026-08-09 --until=2026-08-17
//   node scripts/audit-callouts.mjs --date=2026-08-12 --limit=20
//   node scripts/audit-callouts.mjs --bundle-only          # no network
// Report: .scratch/callout-audit/report.json (gitignored) plus a table on stdout.

import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseArgs } from './lib/args.mjs'
import { mapConcurrent } from './lib/concurrency.mjs'
import { readJsonOr, writeJsonAtomic } from './lib/io.js'
import { getJson } from './lib/statsapi.mjs'

import { halfIndex } from '../src/api/select.js'
import { buildCallouts, computeCalloutProgress, computeGameCalloutNotes } from '../src/api/callout-notes.js'
import { buildPreHalfCallouts } from '../src/api/prehalf-callouts.js'
import { buildBetweenInnings } from '../src/api/between-innings.js'
import { buildMarginNotes } from '../src/api/pitcher-callouts.js'
// Reveal-only in the app's sense (ADR-0001) — a rule about render top-level,
// and this is a terminal script with no DOM. Used only to rebuild the pitch
// call codes a play card's marathonAb note reads.
import { pitchCardInfo } from '../src/api/playbyplay/pitchInfo.js'
// The same three per-game derivations PlayByPlay.jsx threads into every card:
// without them the firstPA-gated families (risp, platoon, vsTeam, the streaks)
// and the progress-fed ones (veloPeak, the leader counts) never fire at all,
// and the play-card surface reads far deader than it is.
import {
  firstRunPlay, firstPAIndexByBatter, firstRispPAIndexByBatter,
  BASERUNNING_NOTE_EVENT_TYPES, runnerLastName,
} from '../src/api/playbyplay.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const BUNDLE_DIR = join(ROOT, 'public', 'data', 'callouts')
const OUT = join(ROOT, '.scratch', 'callout-audit', 'report.json')

// The two component-side caps, mirrored here (MarginNotes.jsx and BoxScore.jsx
// own the originals). The two builder-side caps are deliberately NOT mirrored —
// a builder that truncates itself is measured post-cap, see the header.
const MARGIN_NOTES_SHOWN = 5
const INSIGHTS_SHOWN = 6
const CAPS = { marginNotes: MARGIN_NOTES_SHOWN, rollup: INSIGHTS_SHOWN }

// workload.json describes "now", so bullpenThin/penFatigue/laboring only mean
// anything within this many days of its asOf — the window InningViewer applies.
const WORKLOAD_FRESH_DAYS = 3

const SURFACES = ['playCard', 'preHalf', 'betweenInnings', 'marginNotes', 'rollup']
// Surfaces whose builder truncates before returning: their instances are post-cap.
const POST_CAP = new Set(['preHalf', 'betweenInnings'])

// Every family the note builders can emit, so a family that fires zero times
// still gets a row — naming those is the point of the tool. Keep in step with
// docs/callouts.md's rubric table.
const KNOWN_KINDS = [
  'leader', 'homerRec', 'onBaseRiding', 'onBaseExtended', 'onBaseEnded', 'sbStreak',
  'risp', 'platoon', 'marathonAb', 'veloPeak', 'foulSpoiler', 'birthday', 'birthdayStats',
  'vsTeam', 'scoringFirst', 'oppScoringFirst', 'starterRec', 'dayOfWeek', 'leadAfterLive',
  'tiedAfterLive', 'scorelessThrough', 'bothScoreless', 'inningRunDiff', 'tto', 'ttoPitches',
  'foulVolume', 'pitchPace', 'bullpenThin', 'leadReversal', 'leadHeld', 'tiedAfter',
  'runsScored', 'runsAllowed', 'comeback', 'oneRun', 'extraInnings',
  'laboring', 'veloVariety', 'veloDecay', 'penFatigue', 'workload', 'backToBack',
  'leverage', 'centuryClub', 'tenK', 'scorelessStreak', 'sixIp', 'homeAway',
  'cgShutout', 'recentAppearances',
]

const hasAny = (o) => Boolean(o) && Object.keys(o).length > 0
const teamRec = (b, key) => Boolean(b?.teamRecords?.away?.[key] || b?.teamRecords?.home?.[key])
const starterHas = (b, key) => Object.values(b?.starterRecords ?? {}).some((r) => r && r[key] != null)
const streakHas = (b, key) => Object.values(b?.streaks ?? {}).some((s) => s && s[key] != null)

// Does this game carry the DATA a family needs? Nothing here asks whether the
// game STATE ever arose (who led, whether the batter reached) — that is what the
// fire rate measures. A false here means ineligible, not a miss.
const DATA_GATES = {
  leader: (b) => hasAny(b.leaders) || hasAny(b.pitcherLeaders),
  homerRec: (b) => hasAny(b.homerRecords),
  onBaseRiding: (b) => streakHas(b, 'onBase'),
  onBaseExtended: (b) => streakHas(b, 'onBase'),
  onBaseEnded: (b) => streakHas(b, 'onBase'),
  sbStreak: (b) => streakHas(b, 'stolenBase'),
  risp: (b) => hasAny(b.situational),
  platoon: (b) => hasAny(b.situational),
  marathonAb: (b, c) => c.hasPitchCodes,
  veloPeak: (b, c) => c.hasPitchData && starterHas(b, 'centuryClub'),
  foulSpoiler: (b) => hasAny(b.foulSpoilers),
  birthday: (b) => (b.birthdays ?? []).length > 0,
  birthdayStats: (b) => hasAny(b.birthdayStats),
  vsTeam: (b, c) => c.hasVsTeam && hasAny(b.hitterLines),
  scoringFirst: (b) => teamRec(b, 'scoringFirst'),
  oppScoringFirst: (b) => teamRec(b, 'opponentScoringFirst'),
  starterRec: (b) => starterHas(b, 'teamStarts'),
  dayOfWeek: (b) => teamRec(b, 'dayOfWeek'),
  leadAfterLive: (b) => teamRec(b, 'leadAfterFull'),
  leadHeld: (b) => teamRec(b, 'leadAfterFull'),
  leadReversal: (b) => teamRec(b, 'leadAfter'),
  tiedAfterLive: (b) => teamRec(b, 'tiedAfterFull'),
  tiedAfter: (b) => teamRec(b, 'tiedAfterFull'),
  scorelessThrough: (b) => teamRec(b, 'scorelessThroughFull'),
  bothScoreless: (b) => teamRec(b, 'bothScorelessThroughFull'),
  inningRunDiff: (b) => teamRec(b, 'inningRuns'),
  // The plain trip fact needs nothing from the bundle — only the feed — so it
  // is eligible in every game. Its richer season-split wording, and ttoPitches
  // outright, need the playLog split (`starterRecords[pid].tto`).
  tto: () => true,
  ttoPitches: (b) => starterHas(b, 'tto'),
  foulVolume: (b) => Boolean(b.foulRate),
  pitchPace: (b) => starterHas(b, 'pitchPace'),
  bullpenThin: (b, c) => c.workloadFresh,
  penFatigue: (b, c) => c.workloadFresh,
  laboring: (b, c) => c.workloadFresh,
  runsScored: (b) => teamRec(b, 'runsScored'),
  runsAllowed: (b) => teamRec(b, 'runsAllowedByInning'),
  comeback: (b) => teamRec(b, 'comeback'),
  oneRun: (b) => teamRec(b, 'oneRun'),
  extraInnings: (b) => teamRec(b, 'extraInning'),
  veloVariety: (b, c) => c.hasPitchData,
  veloDecay: (b, c) => c.hasPitchData,
  workload: (b) => starterHas(b, 'recentPitches') && Boolean(b.bullpen?.avgPitches),
  backToBack: (b) => starterHas(b, 'backToBack') || starterHas(b, 'pitchedYesterday'),
  leverage: (b) => starterHas(b, 'leverage'),
  centuryClub: (b) => starterHas(b, 'centuryClub'),
  tenK: (b) => starterHas(b, 'tenK'),
  scorelessStreak: (b) => starterHas(b, 'scorelessStreak'),
  sixIp: (b) => starterHas(b, 'sixIp'),
  homeAway: (b) => starterHas(b, 'homeAway'),
  cgShutout: (b) => starterHas(b, 'cgShutout'),
  recentAppearances: (b) => starterHas(b, 'recentAppearances'),
}

// --- bundle discovery ---------------------------------------------------------

const isoOfDir = (name) => `${name.slice(4, 8)}-${name.slice(0, 2)}-${name.slice(2, 4)}`
const dayDiff = (a, b) => Math.abs(new Date(`${a}T00:00:00Z`) - new Date(`${b}T00:00:00Z`)) / 86400000

async function listBundles({ since, until }) {
  const dirs = (await readdir(BUNDLE_DIR).catch(() => []))
    .filter((d) => /^\d{8}$/.test(d))
    .map((d) => ({ dir: d, iso: isoOfDir(d) }))
    .filter((d) => (!since || d.iso >= since) && (!until || d.iso <= until))
    .sort((a, b) => a.iso.localeCompare(b.iso))
  const out = []
  for (const d of dirs) {
    for (const f of await readdir(join(BUNDLE_DIR, d.dir)).catch(() => [])) {
      if (!f.endsWith('.json')) continue
      out.push({ iso: d.iso, gamePk: Number(f.slice(0, -5)), path: join(BUNDLE_DIR, d.dir, f) })
    }
  }
  return out
}

// --- per-game replay ----------------------------------------------------------

function gameContext(feed, workload, vsTeam) {
  const events = (feed?.liveData?.plays?.allPlays ?? []).flatMap((p) => p.playEvents ?? [])
  const officialDate = feed?.gameData?.datetime?.officialDate ?? null
  const fresh = Boolean(
    officialDate && workload?.asOf && dayDiff(officialDate, workload.asOf) <= WORKLOAD_FRESH_DAYS,
  )
  return {
    hasPitchCodes: events.some((e) => e.details?.call?.code),
    hasPitchData: events.some((e) => e.pitchData?.startSpeed != null),
    hasVsTeam: hasAny(vsTeam?.players),
    workloadFresh: fresh,
    gameDate: fresh ? officialDate : null,
  }
}

// The halves the game actually played, in order.
function halvesOf(feed) {
  const seen = new Map()
  for (const p of feed?.liveData?.plays?.allPlays ?? []) {
    const inning = p.about?.inning
    const half = p.about?.halfInning
    if (inning == null || !half) continue
    seen.set(halfIndex(inning, half), { inning, half })
  }
  return [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)
}

// The minimal entry shape buildCallouts reads, built from a raw play exactly as
// callout-notes/rollup.js builds it — plus the pitch call codes the play card
// holds and the roll-up does not (marathonAb reads them).
function entryOf(feed, play) {
  const pid = play.matchup?.pitcher?.id
  const person = pid != null ? feed?.gameData?.players?.[`ID${pid}`] ?? {} : {}
  return {
    eventType: play.result?.eventType ?? null,
    batterId: play.matchup?.batter?.id,
    atBatIndex: play.about?.atBatIndex ?? null,
    pitcher: pid != null
      ? { id: pid, last: person.lastName ?? '', hand: person.pitchHand?.code ?? '' }
      : null,
    pitches: pitchCardInfo(feed, play).pitches,
    // The steal families read this list, so a thinner one would silently
    // report sbStreak dead on the play cards. Same shape rollup.js builds.
    baserunningNotes: (play.playEvents ?? [])
      .filter((e) => !e.isPitch && BASERUNNING_NOTE_EVENT_TYPES.has(e.details?.eventType))
      .map((e) => ({
        eventType: e.details.eventType,
        runnerId: e.player?.id ?? null,
        runnerLast: runnerLastName(feed, e.player?.id ?? null),
      })),
  }
}

// Group a roll-up note list the way InsightsCard does (one card per person or
// club), so cap survival measures the cards the reader really sees.
function rollupGroupRanks(notes) {
  const rank = new Map()
  const keyOf = (n) => (n.personId != null ? `p:${n.personId}` : `t:${n.teamId}`)
  for (const n of notes) if (!rank.has(keyOf(n))) rank.set(keyOf(n), rank.size)
  return notes.map((n) => rank.get(keyOf(n)))
}

// One game -> a flat list of measured instances plus per-surface counters.
// `rank` is null on a surface whose builder already truncated.
function replayGame(feed, bundle, ctx, workload, vsTeam) {
  const instances = []
  const opportunities = Object.fromEntries(SURFACES.map((s) => [s, 0]))
  const empty = Object.fromEntries(SURFACES.map((s) => [s, 0]))
  const push = (surface, notes, ranked) => {
    opportunities[surface] += 1
    if (!notes.length) empty[surface] += 1
    notes.forEach((n, i) => {
      if (!n?.kind) return
      instances.push({ surface, kind: n.kind, score: n.score ?? 0, rank: ranked ? ranked[i] : null })
    })
  }

  const teamNames = { away: bundle.away?.name ?? '', home: bundle.home?.name ?? '' }
  const extras = { workload, gameDate: ctx.gameDate }
  const cardCtx = {
    bundle,
    vsTeam,
    firstRun: firstRunPlay(feed),
    firstPA: firstPAIndexByBatter(feed),
    firstRispPA: firstRispPAIndexByBatter(feed),
    progress: computeCalloutProgress(feed),
  }

  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const battingSide = play.about?.halfInning === 'top' ? 'away' : 'home'
    const notes = buildCallouts(entryOf(feed, play), { ...cardCtx, battingSide })
    push('playCard', notes, notes.map((_, i) => i))
  }

  for (const { inning, half } of halvesOf(feed)) {
    const entering = halfIndex(inning, half) - 1
    const leaving = halfIndex(inning, half)
    push('preHalf', buildPreHalfCallouts({
      feed, bundle, inning, half, revealedThrough: entering, workload, gameDate: ctx.gameDate,
    }), null)

    const margin = buildMarginNotes(feed, leaving, bundle, teamNames, extras)
    push('marginNotes', margin, margin.map((_, i) => i))
    push('betweenInnings', buildBetweenInnings({
      feed, bundle, marginNotes: margin, inning, half,
      revealedThrough: leaving, workload, gameDate: ctx.gameDate,
    }), null)
  }

  const roll = computeGameCalloutNotes(feed, bundle, vsTeam)
  push('rollup', roll, rollupGroupRanks(roll))
  return { instances, opportunities, empty }
}

// --- vs-team splits, read off disk --------------------------------------------

const shardCache = new Map()
async function vsTeamFor(bundle) {
  const players = {}
  for (const id of [bundle.away?.teamId, bundle.home?.teamId].filter(Boolean)) {
    if (!shardCache.has(id)) {
      const path = join(ROOT, 'public', 'data', 'vs-team-splits', `${id}.json`)
      shardCache.set(id, await readJsonOr(path, null))
    }
    Object.assign(players, shardCache.get(id)?.players ?? {})
  }
  return { players }
}

// --- aggregation and reporting ------------------------------------------------

const blankRow = (kind, surface) => ({
  kind, surface, gamesFired: 0, instances: 0, surfaced: 0, ranks: [], scores: [], levels: {},
})

function summarize(rows, eligible, opportunities, empties, games) {
  const out = []
  for (const row of rows.values()) {
    const s = [...row.scores].sort((a, b) => a - b)
    const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]
    const elig = eligible.get(row.kind) ?? 0
    const cap = CAPS[row.surface] ?? null
    out.push({
      kind: row.kind,
      surface: row.surface,
      postCapOnly: POST_CAP.has(row.surface),
      gamesEligible: elig,
      gamesFired: row.gamesFired,
      fireRate: elig ? Math.round((row.gamesFired / elig) * 1000) / 10 : null,
      instances: row.instances,
      opportunities: opportunities[row.surface] ?? 0,
      score: s.length ? { min: s[0], p25: q(0.25), median: q(0.5), p75: q(0.75), max: s[s.length - 1] } : null,
      cap,
      survivedCap: cap ? row.surfaced : null,
      cutByCap: cap ? row.instances - row.surfaced : null,
      medianRank: cap && row.ranks.length
        ? [...row.ranks].sort((a, b) => a - b)[Math.floor(row.ranks.length / 2)]
        : null,
      levels: row.levels,
    })
  }
  out.sort((a, b) => a.kind.localeCompare(b.kind) || SURFACES.indexOf(a.surface) - SURFACES.indexOf(b.surface))
  return { games, rows: out, opportunities, emptySurfaces: empties }
}

const pad = (v, w, right = false) => {
  const s = v == null ? '-' : String(v)
  return right ? s.padStart(w) : s.padEnd(w)
}

function printTable(report) {
  const head = ['family', 'surface', 'elig', 'fired', 'fire%', 'inst', 'med', 'min', 'max', 'cap kept']
  const w = [19, 15, 5, 6, 6, 7, 4, 4, 4, 10]
  console.log(`\n${head.map((h, i) => pad(h, w[i])).join(' ')}`)
  console.log(w.map((n) => '-'.repeat(n)).join(' '))
  for (const r of report.rows) {
    if (!r.instances) continue
    const cap = r.cap ? `${r.survivedCap}/${r.instances}` : r.postCapOnly ? 'post-cap' : 'uncapped'
    console.log([
      pad(r.kind, w[0]), pad(r.surface, w[1]), pad(r.gamesEligible, w[2], true),
      pad(r.gamesFired, w[3], true), pad(r.fireRate == null ? null : `${r.fireRate}%`, w[4], true),
      pad(r.instances, w[5], true), pad(r.score?.median, w[6], true), pad(r.score?.min, w[7], true),
      pad(r.score?.max, w[8], true), pad(cap, w[9], true),
    ].join(' '))
  }
}

function deadFamilies(report, eligible) {
  const fired = new Set(report.rows.filter((r) => r.instances > 0).map((r) => r.kind))
  const dead = KNOWN_KINDS.filter((k) => !fired.has(k) && (eligible.get(k) ?? 0) > 0)
  const untested = KNOWN_KINDS.filter((k) => !fired.has(k) && !(eligible.get(k) ?? 0))
  console.log(`\nNEVER FIRED, though the data was on hand (${dead.length}):`)
  for (const k of dead) console.log(`  ${pad(k, 19)} eligible in ${eligible.get(k)} games, 0 instances`)
  if (!dead.length) console.log('  (none)')
  console.log(`\nNOT MEASURABLE here — no eligible game in the sample (${untested.length}):`)
  console.log(untested.length ? `  ${untested.join(', ')}` : '  (none)')
  return { dead, untested }
}

async function bundleOnly(bundles, workload) {
  // No network and no game state: this can only say the bundle CARRIES the data
  // a family's precompute gate wants. An upper bound, never a fire rate.
  const counts = Object.fromEntries(KNOWN_KINDS.map((k) => [k, 0]))
  let seen = 0
  for (const b of bundles) {
    const bundle = await readJsonOr(b.path, null)
    if (!bundle) continue
    seen += 1
    const ctx = {
      hasPitchCodes: false,
      hasPitchData: false,
      hasVsTeam: true,
      workloadFresh: Boolean(workload?.asOf) && dayDiff(b.iso, workload.asOf) <= WORKLOAD_FRESH_DAYS,
      gameDate: null,
    }
    for (const k of KNOWN_KINDS) if (DATA_GATES[k]?.(bundle, ctx)) counts[k] += 1
  }
  console.log('\ngateEligible — bundles carrying the family data (UPPER BOUND, not a fire rate)')
  for (const k of KNOWN_KINDS) console.log(`  ${pad(k, 19)} ${pad(counts[k], 5, true)} / ${seen}`)
  await writeJsonAtomic(OUT, { mode: 'bundle-only', bundlesSeen: seen, gateEligible: counts }, 2)
  console.log(`\nJSON: ${OUT}`)
}

// --- main ---------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const since = args.date || args.since || null
  const until = args.date || args.until || null
  const limit = Number(args.limit) || Infinity
  const concurrency = Number(args.concurrency) || 6

  let bundles = await listBundles({ since, until })
  if (bundles.length > limit) bundles = bundles.slice(0, limit)
  if (!bundles.length) {
    console.error('No committed bundles in that range — public/data/callouts holds the nightly window only.')
    process.exitCode = 1
    return
  }
  const workload = await readJsonOr(join(ROOT, 'public', 'data', 'workload.json'), null)
  console.log(`${bundles.length} bundled games, ${bundles[0].iso} .. ${bundles[bundles.length - 1].iso}`)
  if (args['bundle-only']) return bundleOnly(bundles, workload)

  const rows = new Map()
  const rowFor = (kind, surface) => {
    const key = `${surface}|${kind}`
    if (!rows.has(key)) rows.set(key, blankRow(kind, surface))
    return rows.get(key)
  }
  const eligible = new Map()
  const opportunities = Object.fromEntries(SURFACES.map((s) => [s, 0]))
  const empties = Object.fromEntries(SURFACES.map((s) => [s, 0]))
  let games = 0
  let failed = 0

  await mapConcurrent(bundles, concurrency, async (b) => {
    const bundle = await readJsonOr(b.path, null)
    if (!bundle) return null
    let feed
    let replay
    const vsTeam = await vsTeamFor(bundle)
    let ctx
    try {
      feed = await getJson(`/api/v1.1/game/${b.gamePk}/feed/live`)
      ctx = gameContext(feed, workload, vsTeam)
      replay = replayGame(feed, bundle, ctx, workload, vsTeam)
    } catch (err) {
      failed += 1
      console.error(`  ${b.gamePk}: ${err.message}`)
      return null
    }
    games += 1
    const level = bundle.sportId === 1 ? 'MLB' : `sport${bundle.sportId}`
    for (const s of SURFACES) {
      opportunities[s] += replay.opportunities[s]
      empties[s] += replay.empty[s]
    }
    for (const k of KNOWN_KINDS) {
      if (DATA_GATES[k]?.(bundle, ctx)) eligible.set(k, (eligible.get(k) ?? 0) + 1)
    }
    const firedHere = new Set()
    for (const inst of replay.instances) {
      const row = rowFor(inst.kind, inst.surface)
      row.instances += 1
      row.scores.push(inst.score)
      row.levels[level] = (row.levels[level] ?? 0) + 1
      if (inst.rank != null) {
        row.ranks.push(inst.rank)
        if (!CAPS[inst.surface] || inst.rank < CAPS[inst.surface]) row.surfaced += 1
      }
      const key = `${inst.surface}|${inst.kind}`
      if (!firedHere.has(key)) {
        firedHere.add(key)
        row.gamesFired += 1
      }
    }
    return null
  })

  const report = summarize(rows, eligible, opportunities, empties, games)
  report.failedGames = failed
  printTable(report)
  const { dead, untested } = deadFamilies(report, eligible)
  report.neverFired = dead
  report.notMeasurable = untested
  await writeJsonAtomic(OUT, report, 2)
  console.log(`\n${games} games replayed, ${failed} failed. JSON: ${OUT}`)
  return null
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
