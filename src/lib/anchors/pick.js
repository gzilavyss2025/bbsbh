// The anchor picker (issue #2809): a count of players -> the well-known number to compare
// it with, or null. Pure; shared by scripts/gen-nuggets.mjs (which freezes the pick into
// each nugget) and the tests. The registry and its editorial rules: ./anchors.json.
//
// Rules (.scratch/anchor-callouts/spec.md, "Picker rules"):
//   1. Only `status: verified`. Players pair with `people` and `things` anchors ("as many
//      as the Great Lakes"); `teams` anchors pair only with club counts.
//   2. A `volatile` anchor is skipped VOLATILE_DAYS after its newest `checked` date. A
//      `static` one never expires here. The registry test lists the late ones; nothing fails.
//   3. Closest count wins. A gap past max(1, round(0.2 * n)), n being the ANCHOR's count,
//      is no fit. A tier-3 (niche)
//      anchor is picked only when no tier 1 or 2 anchor fits at all.
//   4. Ties: the lower tier, then the anchor ABOVE the count ("fewer than" reads as rarity),
//      then a stable hash of `seed` (player id and date), so one player does not always
//      get the moon.
import registry from './anchors.json' with { type: 'json' }
import { daysBetween } from '../time/seasonPhase.js'

export const VOLATILE_DAYS = 180
const NICHE_TIER = 3

const PAIRS = { people: new Set(['people', 'things']), teams: new Set(['teams']) }

export const relationOf = (count, n) => (count < n ? 'fewer' : count === n ? 'equal' : 'more')

const lastChecked = (a) => (a.sources ?? []).map((s) => s.checked).filter(Boolean).sort().at(-1) ?? null

// A volatile anchor read with no checked date, or on no valid date, counts as expired.
export function isExpired(a, date) {
  if (a.kind !== 'volatile') return false
  const age = daysBetween(lastChecked(a), date)
  return age == null || age > VOLATILE_DAYS
}

// FNV-1a, so the spread is the same in node and the browser.
function hash(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i += 1) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193)
  return h >>> 0
}

// count: players at the line that day. unit: 'people' for player thresholds. date: the
// day of the count (YYYY-MM-DD). seed: anything stable for the tie-break.
export function pick(count, { unit, date, seed = '', anchors = registry.anchors }) {
  if (!Number.isInteger(count) || count < 1) return null
  const pairs = PAIRS[unit]
  if (!pairs) return null
  const fits = anchors
    .filter((a) => a.status === 'verified' && pairs.has(a.unit) && !isExpired(a, date))
    .map((a) => ({ a, gap: Math.abs(a.count - count) }))
    .filter(({ a, gap }) => gap <= Math.max(1, Math.round(0.2 * a.count)))
  if (!fits.length) return null
  // Tier 3 is niche: picked only when no tier 1 or 2 anchor fits (anchors.json, "tier").
  const known = fits.filter(({ a }) => a.tier < NICHE_TIER)
  const pool = known.length ? known : fits
  pool.sort((x, y) => x.gap - y.gap
    || x.a.tier - y.a.tier
    || (y.a.count > count) - (x.a.count > count)
    || hash(`${seed}|${x.a.id}`) - hash(`${seed}|${y.a.id}`))
  const anchor = pool[0].a
  return { anchor, relation: relationOf(count, anchor.count) }
}

export const anchorById = (id) => registry.anchors.find((a) => a.id === id) ?? null
