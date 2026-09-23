// Nine Keys report's data — every World Series champion since 2000 ranked
// against nine measures, the clubs currently holding a postseason place
// ranked the same way, and the figures that say how well the rule holds.
// Read from a static same-origin file (public/data/nine-keys.json) rather
// than computed live.
//
// scripts/gen-nine-keys.mjs builds it. The champion half is immutable once a
// season ends; the current-season half moves with the standings, so the file
// is regenerated alongside the other nightly data rather than by hand.
//
// NO SPOILER SURFACE HERE. Every number is a season-long rank or a finished
// season's result — the same footing as Standings, League Leaders and
// Postseason History, which all open live (see CLAUDE.md's scope note). It
// reads no live game and carries no per-game score, so it needs no cutoff
// and no SealBox.
//
// Degrades to an empty report before the file exists or on any failure — the
// page then says it has nothing to show rather than breaking.

import { staticJson } from './staticJson.js'

export const loadNineKeys = staticJson('/data/nine-keys.json', {
  shape: (d) => ({
    generatedAt: d.generatedAt ?? null,
    bar: d.bar ?? 15,
    limit: d.limit ?? 3,
    firstSeason: d.firstSeason ?? 2000,
    keys: d.keys ?? [],
    distribution: d.distribution ?? {},
    champions: d.champions ?? [],
    current: d.current ?? null,
    thresholds: d.thresholds ?? [],
    ladder: d.ladder ?? [],
    limitSupport: d.limitSupport ?? null,
    placebo: d.placebo ?? null,
  }),
  fallback: {
    generatedAt: null,
    bar: 15,
    limit: 3,
    firstSeason: 2000,
    keys: [],
    distribution: {},
    champions: [],
    current: null,
    thresholds: [],
    ladder: [],
    limitSupport: null,
    placebo: null,
  },
})

// ---------------------------------------------------------------------------
// The page's derived sentences. Each is built from the file on every render,
// never written into the component, because a regenerate can change who sits
// at the limit, what they share and how the figures fall. They live here, not
// in NineKeysPage.jsx, so test/nine-keys.test.js can check the grammar for
// every count the data can produce.
// ---------------------------------------------------------------------------

// "A", "A and B", "A, B and C".
export function listOf(items) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

// What the champions exactly at the limit have in common. Null when fewer
// than two sit there; the limit sentence already names a lone one.
export function floorSentence(champions, limit, keyLabel) {
  const atLimit = champions.filter((c) => (c.failed?.length ?? 0) === limit)
  if (atLimit.length < 2) return null
  const shared = atLimit
    .slice(1)
    .reduce((acc, c) => acc.filter((id) => c.failed.includes(id)), [...atLimit[0].failed])
  const who = listOf(atLimit.map((c) => `the ${c.year} ${c.name}`))
  const lead = `${who.charAt(0).toUpperCase()}${who.slice(1)} sit at the limit.`
  const all = atLimit.length === 2 ? 'both' : 'all'
  if (shared.length === 0) return `${lead} They share no failed key.`
  const names = listOf(shared.map(keyLabel))
  if (shared.length === 1) return `${lead} The only key they ${all} failed is ${names}.`
  return `${lead} The keys they ${all} failed are ${names}.`
}

// How much the limit rests on a single season.
export function supportSentence(support, limit, champions) {
  if (!support || !support.of) return null
  if (support.atLimit >= 2) {
    return `${support.atLimit} of the ${support.of} champions sit at the limit, so no one season sets it: take any one of them out and the limit stays at ${limit}.`
  }
  const lone = champions.find((c) => (c.failed?.length ?? 0) === limit)
  const who = lone ? `the ${lone.year} ${lone.name}` : 'one champion'
  return `Only ${who} sit${lone ? '' : 's'} at the limit. Without that season, the limit would be ${support.withoutLoneWorst}.`
}

// The placebo. `p` is the share of RANDOM screens that filter at least as
// hard as the real one, so a small p is the strong result.
export function placeboSentence(placebo) {
  if (!placebo || !placebo.reps) return null
  const share = placebo.p < 0.01 ? 'fewer than 1%' : `${Math.round(placebo.p * 100)}%`
  return `Of ${placebo.reps.toLocaleString('en-US')} screens built the same way from randomly drawn postseason clubs, ${share} filter as hard as this one.`
}
