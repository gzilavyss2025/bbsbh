// The umpire detail page's data — for a given umpire, every MLB game he's
// worked this season plus which base he had — read from a static same-origin
// file (public/data/umpires.json) rather than computed live.
//
// There's no "games by umpire" endpoint, so getting this list means scanning
// the whole season's schedule and re-indexing by umpire id — too much to fetch
// on every umpire-page visit, so scripts/gen-umpires.mjs does it on a cron (see
// .github/workflows/update-umpires.yml) and this module just reads the shaped
// result. Same build-time-fetch pattern as war.js/rehab.js (see
// docs/data-enrichment.md §5). Game dates/assignments carry no score, so the
// file is spoiler-free like the rest of the roster-move surfaces.
//
// MLB-only for now, like war.js — a MiLB umpire simply won't be found.
// Degrades to null before the file exists or on any failure.
let cached = null

async function load() {
  if (cached) return cached
  try {
    const res = await fetch('/data/umpires.json')
    if (!res.ok) throw new Error(`umpires.json ${res.status}`)
    const data = await res.json()
    cached = { season: data.season ?? null, generatedAt: data.generatedAt ?? null, umpires: data.umpires ?? {} }
  } catch {
    cached = { season: null, generatedAt: null, umpires: {} }
  }
  return cached
}

// { id, name, games, season, generatedAt } for one umpire, or null if he
// hasn't worked a game this season (or the file failed to load).
export async function loadUmpire(id) {
  const { umpires, season, generatedAt } = await load()
  const u = umpires[id]
  if (!u) return null
  return { ...u, season, generatedAt }
}
