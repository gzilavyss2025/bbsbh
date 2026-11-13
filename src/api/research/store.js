// The /research store reader (#2234). The store lives in Vercel Blob, outside git
// (Gary, 2026-11-02): `research/v1/index.json` names the months on file, and each
// month is one shard (`research/v1/{season}/{MM}.json`, layout in shard.js).
// scripts/research/gen-research-store.mjs writes and uploads both.
//
// BASE URL. `VITE_RESEARCH_STORE` overrides it (a local fixture in dev); otherwise the
// public Blob folder. The page loads every month, newest first, and decodes each once.
//
// SPOILER CLASSIFICATION: spoiler-free. The store holds only games dated before the
// day it was built; the page drops games on or after `?d=` (filters.js `matcher`).

import { decodePlateAppearances } from './shard.js'

export const STORE_BASE = import.meta.env?.VITE_RESEARCH_STORE || 'https://p6soal2x5kpgb0ll.public.blob.vercel-storage.com/research/v1/'

const memo = new Map()
function getJson(path) {
  if (!memo.has(path)) {
    memo.set(
      path,
      fetch(`${STORE_BASE}${path}`).then((r) => {
        if (!r.ok) throw new Error(`research store HTTP ${r.status}`)
        return r.json()
      }),
    )
    memo.get(path).catch(() => memo.delete(path))
  }
  return memo.get(path)
}

// index: { v, built, seasons: { '2026': { months: { '04': { through, pitches, pas } } } } }
export const fetchIndex = () => getJson('index.json')

// Every plate appearance on file, oldest first, plus the people names.
// onProgress(loaded, total) fires as each month lands.
export async function fetchStore(index, onProgress = () => {}) {
  const paths = Object.entries(index.seasons).flatMap(([season, s]) => Object.keys(s.months).sort().map((m) => `${season}/${m}.json`))
  let loaded = 0
  onProgress(0, paths.length)
  const shards = await Promise.all(
    paths.map((p) =>
      getJson(p).then((shard) => {
        onProgress(++loaded, paths.length)
        return shard
      }),
    ),
  )
  const people = Object.assign({}, ...shards.map((s) => s.people))
  return { pas: shards.flatMap(decodePlateAppearances), people }
}

// The coverage line's facts: first and last season, and the newest game date.
export function coverage(index) {
  const seasons = Object.keys(index.seasons).map(Number).sort()
  const through = Object.values(index.seasons).flatMap((s) => Object.values(s.months).map((m) => m.through)).sort().at(-1) ?? null
  return { first: seasons[0] ?? null, last: seasons.at(-1) ?? null, through }
}
