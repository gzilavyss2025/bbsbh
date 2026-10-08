// POT for a Top 100 player (docs/ovr-rating.md, "POT"; #1721). Pure. Every constant is
// a start value, decided by Gary on 2026-10-08.
import { clamp } from '../../lib/math/number.js'
import { CONSTANTS } from './rating.js'
import { AGE_PIVOT, rankValue } from '../around-the-game/farmSystem.js'

// rankValue runs 100 (rank 1) down to rankValue(100) (about 8); it maps onto 95 down to 70.
const BASE = 70
const SPAN = 25
const LAST_VALUE = rankValue(100)
const CREDIT_PER_YEAR = 1.5
const MAX_CREDIT = 4

// -> number | null. null for a player off the list (no rank); a missing age earns no credit.
export function potRating(ovr, rank, age) {
  if (!(rank >= 1)) return null
  const base = BASE + (SPAN * (rankValue(rank) - LAST_VALUE)) / (100 - LAST_VALUE)
  const credit = age == null ? 0 : clamp(CREDIT_PER_YEAR * (AGE_PIVOT - age), 0, MAX_CREDIT)
  return Math.min(CONSTANTS.CAP, Math.max(ovr, base + credit))
}
