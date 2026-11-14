// The /research store reader (#2234). The store lives in Vercel Blob, outside git
// (Gary, 2026-11-02): `research/v1/index.json` names the months on file, and each
// month is one shard (`research/v1/{season}/{MM}.json`, layout in shard.js).
// scripts/research/gen-research-store.mjs writes and uploads both.
//
// BASE URL. `VITE_RESEARCH_STORE` overrides it (a local fixture in dev); otherwise the
// public Blob folder. The page loads a season at a time (loadSeason); filters.js seasonsFor
// says which.
//
// SPOILER CLASSIFICATION: spoiler-free. The store holds only games dated before the
// day it was built; the page drops games on or after `?d=` (filters.js `matcher`).

import { decodePlateAppearances } from './shard.js'

export const STORE_BASE = import.meta.env?.VITE_RESEARCH_STORE || 'https://p6soal2x5kpgb0ll.public.blob.vercel-storage.com/research/v1/'

// The index is read once a visit. Shards are not memoised as JSON: twelve seasons of raw
// shards would not fit a phone. A season is decoded once and kept (seasonCache) until the
// page frees it (dropSeason): "Last time" frees each season it found nothing in.
let indexP = null
async function getJson(path, signal) {
  const r = await fetch(`${STORE_BASE}${path}`, { signal })
  if (!r.ok) throw new Error(`research store HTTP ${r.status}`)
  return r.json()
}

// index: { v, built, seasons: { '2026': { months: { '04': { through, pitches, pas, events } } } } }
// `events` ({ event: n }) is absent on a month built before 2026-11-13.
export function fetchIndex() {
  indexP ??= getJson('index.json').catch((e) => {
    indexP = null
    throw e
  })
  return indexP
}

// The seasons with plays on file, oldest first.
export const seasonsOnFile = (index) =>
  Object.keys(index.seasons).map(Number).filter((s) => Object.values(index.seasons[s].months).some((m) => m.pas > 0)).sort((a, b) => a - b)

// A season's result counts, or null if any month has none on file.
export function seasonEvents(index, season) {
  const months = Object.values(index.seasons[season]?.months ?? {})
  if (!months.length || months.some((m) => !m.events)) return null
  const out = {}
  for (const m of months) for (const [ev, n] of Object.entries(m.events)) out[ev] = (out[ev] ?? 0) + n
  return out
}

const seasonCache = new Map()
// One season's plate appearances, oldest first, plus its people names. onMonth(loaded,
// total). Each season's fetches have their own AbortController, so two queries can share
// a season in flight, and dropSeason (Stop, or a search done with it) aborts and frees it.
export function loadSeason(index, season, { onMonth = () => {} } = {}) {
  if (!seasonCache.has(season)) {
    const ctrl = new AbortController()
    const paths = Object.keys(index.seasons[season]?.months ?? {}).sort().map((m) => `${season}/${m}.json`)
    let loaded = 0
    onMonth(0, paths.length)
    const promise = Promise.all(paths.map((path) => getJson(path, ctrl.signal).then((shard) => {
      onMonth(++loaded, paths.length)
      return { pas: decodePlateAppearances(shard), people: shard.people }
    }))).then((parts) => ({ pas: parts.flatMap((x) => x.pas), people: Object.assign({}, ...parts.map((x) => x.people)) }))
    seasonCache.set(season, { promise, ctrl })
    promise.catch(() => seasonCache.get(season)?.promise === promise && seasonCache.delete(season))
  }
  return seasonCache.get(season).promise
}
export function dropSeason(season) {
  seasonCache.get(season)?.ctrl.abort()
  seasonCache.delete(season)
}
// Free every season but `keep` (an array).
export function dropSeasonsExcept(keep) {
  for (const s of [...seasonCache.keys()]) if (!keep.includes(s)) dropSeason(s)
}

// The coverage line's facts over `seasons` (default: all on file): first and last
// season, the newest game date, and the pitches on file.
export function coverage(index, seasons = Object.keys(index.seasons).map(Number)) {
  const sorted = [...seasons].sort((a, b) => a - b)
  const months = sorted.flatMap((s) => Object.values(index.seasons[s]?.months ?? {}))
  const through = months.map((m) => m.through).sort().at(-1) ?? null
  const pitches = months.reduce((n, m) => n + (m.pitches ?? 0), 0)
  return { first: sorted[0] ?? null, last: sorted.at(-1) ?? null, through, pitches }
}
