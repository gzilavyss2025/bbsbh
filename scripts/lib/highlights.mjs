// Shared per-game processing for the two highlights generators —
// gen-highlights.mjs (nightly, trailing window) and gen-highlights-backfill.mjs
// (hand-run, whole season). The two differ ONLY in how they source their target
// games; everything from "fetch this game's content" to "write the team files"
// is identical and lives here, per the gen-rookies.mjs / gen-rookies-backfill.mjs
// pairing convention (which duplicates its helpers — this pair doesn't, because
// the shared body is the filtering policy itself and two copies of THAT is
// exactly how a rail and its generator drift apart).
//
// See .scratch/highlights-cascade/PRD.md and issues/01-data-layer.md.

import { readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJsonOr, writeJsonAtomic } from './io.js'
import {
  classifyHighlight,
  fetchHighlights,
  highlightPlaybacks,
  highlightPoster,
  isEligibleForPositiveFilter,
} from '../../src/api/highlights.js'

const here = dirname(fileURLToPath(import.meta.url))
export const OUT_DIR = join(here, '..', '..', 'public', 'data', 'highlights')
const BLOCKLIST_PATH = join(here, '..', 'highlight-blocklist.json')

// Hand-maintained one-off drops (scripts/highlight-blocklist.json). Accepts
// either the documented `{ _hint, blocked: [...] }` object or a bare array, so
// a maintainer who trims the file down to a plain list doesn't break the run.
export async function loadBlocklist() {
  const raw = await readJsonOr(BLOCKLIST_PATH, { blocked: [] })
  const entries = Array.isArray(raw) ? raw : (raw.blocked ?? [])
  return new Set(entries.map((e) => e?.clipId ?? e?.guid).filter(Boolean))
}

// One game's surviving clips, already classified and filtered. Returns [] for
// any game with no content (every non-MLB game, and an MLB game MLB simply
// hasn't clipped) — never throws, so one bad game can't abort a sweep.
//
// ORDER MATTERS: eligibility (the abs/challenge + non-play-content gate) runs
// BEFORE the blocklist, and both run before anything is filed under a team, so
// the shipped JSON only ever holds clips already past every filter. Readers
// stay dumb.
export async function clipsForGame(gamePk, blocklist) {
  return clipsFromItems(await fetchHighlights(gamePk), blocklist)
}

// One game's content, read TWICE from a single fetch: the per-play clips for
// the team files, and the condensed cut for the day index. Both generators'
// sweeps already pay for this request — asking the same endpoint again for the
// condensed game would double a nightly sweep's traffic for one extra object
// per game. `clipsForGame` above stays as-is for the backfill, which doesn't
// build day files.
export async function sweepGame(gamePk, blocklist) {
  const items = await fetchHighlights(gamePk)
  return { clips: clipsFromItems(items, blocklist), condensed: condensedEntry(items) }
}

// The condensed game as the day index stores it: enough to render the card's
// poster AND play it with no live fetch at all, which is the entire point of
// precomputing this. `playbacks` is already resolved to `{hls, mp4}` here, the
// shape highlightPlaybacks accepts back on the read side (see its header), so
// the reader stays dumb.
//
// `title` is safe to store and to render: a condensed cut's title is
// "Condensed Game: NYM@CLE - 8/4/26" — structural, no score in it, unlike the
// per-play titles above and unlike the RECAP's ("...fuels Mets' 6-2 win"),
// which is why the recap is not in this file.
export function condensedEntry(items) {
  const item = (items ?? []).find((i) =>
    (i?.keywordsAll ?? []).some((k) => k.type === 'taxonomy' && k.value === 'condensed-game'),
  )
  if (!item) return null
  const playbacks = highlightPlaybacks(item)
  if (!playbacks.hls && !playbacks.mp4) return null
  return {
    id: item.id ?? null,
    title: item.title || item.headline || null,
    duration: item.duration ?? null,
    poster: highlightPoster(item),
    playbacks,
  }
}

function clipsFromItems(items, blocklist) {
  const out = []
  for (const item of items) {
    const c = classifyHighlight(item)
    if (!isEligibleForPositiveFilter(c)) continue
    if (!c.clipId || blocklist.has(c.clipId)) continue
    // A clip with no team tag can't be filed anywhere (24 of 1,150 in the live
    // sweep — charity segments, a stray game-ending catch). Dropped, not guessed.
    if (!c.teamId) continue
    out.push({
      clipId: c.clipId,
      guid: c.guid,
      playerId: c.playerId,
      teamId: c.teamId,
      category: c.category,
      significance: c.significance,
      // `title || headline` mirrors what the shipped box-score sheet already
      // shows (HighlightSheet.jsx). The raw item's `description` is
      // deliberately NOT stored: it narrates the score ("extending the
      // Brewers' lead to 4-2"), and no rail asked for it.
      title: item.title || item.headline || null,
      duration: item.duration ?? null,
      poster: highlightPoster(item),
      playbacks: highlightPlaybacks(item),
    })
  }
  return out
}

// Merge one game's row into a team's list, deduped by gamePk (a Final game's
// clips are immutable, so a re-run overwrites with identical content), newest
// first — same shape as gen-umpire-accuracy.mjs's upsertGame.
export function upsertGame(games, row) {
  const byPk = new Map(games.map((g) => [g.gamePk, g]))
  byPk.set(row.gamePk, row)
  return [...byPk.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

// File a run's clips under the team each one was TAGGED TO — never under the
// game's two participating clubs. That's what makes a mid-season trade fall out
// correctly for free: a clip stays filed under whichever club the player was on
// when it aired. Returns Map<teamId, gameRow[]>.
export function fileByTeam(games) {
  const byTeam = new Map()
  for (const { gamePk, date, clips } of games) {
    const perTeam = new Map()
    for (const clip of clips) {
      if (!perTeam.has(clip.teamId)) perTeam.set(clip.teamId, [])
      // teamId is the filing key, not a per-clip field worth repeating 50 times.
      const { teamId, ...rest } = clip
      perTeam.get(teamId).push(rest)
    }
    for (const [teamId, list] of perTeam) {
      if (!byTeam.has(teamId)) byTeam.set(teamId, [])
      byTeam.get(teamId).push({ gamePk, date, clips: list })
    }
  }
  return byTeam
}

// Merge this run's rows into the existing per-team files and write them back.
// Only the teams this run actually touched are read or rewritten.
//
// readJsonOr rethrows anything but ENOENT, so a corrupt committed team file
// ABORTS that team's write rather than silently rebuilding from just this run's
// window and dropping the season's accumulated history (scripts/lib/io.js's
// whole reason for existing).
export async function writeTeamFiles(byTeam, { generatedAt }) {
  let added = 0
  let teams = 0
  for (const [teamId, rows] of byTeam) {
    const path = join(OUT_DIR, `${teamId}.json`)
    const prev = await readJsonOr(path, { teamId, games: [] })
    let games = prev.games ?? []
    const before = games.length
    for (const row of rows) games = upsertGame(games, row)
    added += games.length - before
    await writeJsonAtomic(path, { teamId, generatedAt, games })
    teams++
  }
  return { added, teams }
}

// The per-DAY condensed-game index: public/data/highlights/day/<MMDDYYYY>.json,
// one file per slate date, `{ gamePk: condensedEntry }`. Read by the home
// slate's revealed result cards (src/api/gamehighlights.js), which need a
// poster for every game on the day and cannot afford the live alternative —
// `content` is 430 KB per game and doesn't honor `?fields=`, so 16 cards would
// parse ~6.9 MB. This file is ~7 KB for a full slate.
//
// MMDDYYYY, matching public/data/callouts/ — the same per-slate-date file
// convention, keyed the way the app's own routes spell a date.
//
// MERGED into whatever the file already holds, not rewritten over it. The
// nightly job sweeps a whole date at once and so would be safe either way, but
// the BACKFILL is not: it only fetches games missing an entry, so a date where
// one game was previously missed would be rebuilt from that single game and
// the other fifteen would vanish. Merging makes a partial sweep additive, the
// same append-only guarantee the team files have, and a Final game's condensed
// cut is immutable so a re-swept entry overwrites itself with equal content.
export async function writeDayFiles(byDate, { generatedAt }) {
  let days = 0
  let entries = 0
  for (const [date, games] of byDate) {
    if (!Object.keys(games).length) continue
    const path = join(OUT_DIR, 'day', `${urlDateFor(date)}.json`)
    const prev = await readJsonOr(path, { date, games: {} })
    const merged = { ...(prev.games ?? {}), ...games }
    await writeJsonAtomic(path, { date, generatedAt, games: merged })
    days++
    entries += Object.keys(games).length
  }
  return { days, entries }
}

// Every gamePk that already has a day-index entry — the backfill's "don't
// re-fetch what's done" guard for THIS output, which is a different question
// from ingestedGamePks below: that one answers "are this game's clips filed",
// and a game can easily be done there and missing here (every game swept
// before day files existed is). A game needs fetching if EITHER is missing.
//
// An absent directory (no day file written yet) is an empty set, not an error.
export async function dayIndexedGamePks() {
  const seen = new Set()
  let files = []
  try {
    files = (await readdir(join(OUT_DIR, 'day'))).filter((f) => /^\d{8}\.json$/.test(f))
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
    return seen
  }
  for (const file of files) {
    const data = await readJsonOr(join(OUT_DIR, 'day', file), { games: {} })
    for (const gamePk of Object.keys(data.games ?? {})) seen.add(Number(gamePk))
  }
  return seen
}

// "2026-07-07" -> "07072026", the form the app's routes and the callouts files
// both use.
function urlDateFor(isoDate) {
  const [y, m, d] = isoDate.split('-')
  return `${m}${d}${y}`
}

// Every gamePk already on file, across every team file that exists — the
// backfill's "don't re-sweep what's already done" guard. An absent directory
// (genuine first run) is an empty set, not an error.
export async function ingestedGamePks() {
  const seen = new Set()
  let files = []
  try {
    files = (await readdir(OUT_DIR)).filter((f) => /^\d+\.json$/.test(f))
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
    return seen
  }
  for (const file of files) {
    const prev = await readJsonOr(join(OUT_DIR, file), { games: [] })
    for (const g of prev.games ?? []) seen.add(g.gamePk)
  }
  return seen
}
