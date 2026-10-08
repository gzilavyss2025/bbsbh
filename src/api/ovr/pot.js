// POT for a Top 100 player (docs/ovr-rating.md, "POT"; #1721). Pure. Every constant is
// a start value, decided by Gary on 2026-10-08.
import { clamp } from '../../lib/math/number.js'
import { CONSTANTS } from './rating.js'
import { rankValue } from '../around-the-game/farmSystem.js'

// rankValue runs 100 (rank 1) to 8 (rank 100); it maps onto 95 down to 70.
const BASE = 70
const SPAN = 25
const LAST_VALUE = 8
const PIVOT_AGE = 21 // AGE_PIVOT in farmSystem.js
const CREDIT_PER_YEAR = 1.5
const MAX_CREDIT = 4

// -> number | null. null for a player off the list (no rank); a missing age earns no credit.
export function potRating(ovr, rank, age) {
  if (!(rank >= 1)) return null
  const base = BASE + (SPAN * (rankValue(rank) - LAST_VALUE)) / (100 - LAST_VALUE)
  const credit = age == null ? 0 : clamp(CREDIT_PER_YEAR * (PIVOT_AGE - age), 0, MAX_CREDIT)
  return Math.min(CONSTANTS.CAP, Math.max(ovr, base + credit))
}
