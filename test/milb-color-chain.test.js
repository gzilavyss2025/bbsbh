// The one affiliate -> colour-pair chain (src/lib/brandColors.js), and the two
// call sites that used to disagree about it.
//
//   1. the affiliate's own researched pair   (data/milb-colors.json)
//   2. its parent MLB org's pair             (via MILB_PARENT_ORG)
//   3. NEUTRAL_FALLBACK_PAIR                 (milbColorPair only; milbBrandPair
//                                             returns null so a caller whose
//                                             contract is "no colour" still has
//                                             one)
//
// Step 1 is the behaviour change this file exists to pin. Before it, the
// headshot tint went straight to step 2 and never looked at the affiliate at
// all, while the logo tile read step 1 and had no step 2 — two mechanisms that
// could not agree by construction. Every assertion below that names a parent
// org is guarding against a regression back to that.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MILB_COLORS,
  MILB_RESEARCHED_PAIRS,
  NEUTRAL_FALLBACK_PAIR,
  TEAM_COLOR_PAIRS,
  milbBrandPair,
  milbColorPair,
  milbHasResearchedColor,
} from '../src/lib/brandColors.js'
import { teamTintColor, teamPrimaryColor, teamChipColors, teamStripeGradient } from '../src/lib/teams.js'
import { milbVariantColors, milbTreatmentTile } from '../src/lib/milbColors.js'

// Durham Bulls, a Rays affiliate with a researched pair of its own — the
// example the whole change is argued from.
const DURHAM = 234
const RAYS = 139
// Corpus Christi Hooks, an Astros affiliate marked `found: false` (colour names
// only, no hex ever found) — the step-2 case.
const CORPUS = 482
const ASTROS = 117
// Not a team.
const UNKNOWN = 999999

// --------------------------------------------------------------------------
// Step 1 — the affiliate's own pair, and it does NOT fall through
// --------------------------------------------------------------------------

test('step 1: an affiliate with its own researched pair resolves to that pair', () => {
  assert.deepEqual(milbBrandPair(DURHAM), MILB_RESEARCHED_PAIRS[DURHAM])
  assert.deepEqual(milbBrandPair(DURHAM), ['#0054A4', '#B15C12'])
})

test('step 1 short-circuits step 2 — a researched affiliate never wears its parent org', () => {
  // The regression this PR fixes: every one of these used to resolve through
  // MILB_PARENT_ORG and hand back the Rays' colours for a Bulls player.
  assert.notDeepEqual(milbBrandPair(DURHAM), TEAM_COLOR_PAIRS[RAYS])
  assert.equal(teamPrimaryColor(DURHAM), '#0054A4')
  assert.notEqual(teamPrimaryColor(DURHAM), teamPrimaryColor(RAYS))
  assert.notEqual(teamTintColor(DURHAM), teamTintColor(RAYS))
  assert.notEqual(teamStripeGradient(DURHAM), teamStripeGradient(RAYS))
  assert.notEqual(teamChipColors(DURHAM).primary, teamChipColors(RAYS).primary)
})

test('the headshot tint reads the affiliate primary, at the same alpha as an MLB club', () => {
  // 0x00/0x54/0xA4 = the Bulls' #0054A4, not any Rays colour.
  assert.equal(teamTintColor(DURHAM), 'rgba(0, 84, 164, 0.22)')
  assert.equal(teamTintColor(DURHAM, 0.5), 'rgba(0, 84, 164, 0.5)')
})

test('every researched affiliate now tints with its own colour, not its org', () => {
  // Not a spot check: whatever the store says, step 1 must win for all of them.
  for (const teamId of Object.keys(MILB_RESEARCHED_PAIRS)) {
    assert.deepEqual(
      milbBrandPair(teamId),
      MILB_RESEARCHED_PAIRS[teamId],
      `${teamId} (${MILB_COLORS[teamId].name}) fell through to its parent org`,
    )
  }
})

// --------------------------------------------------------------------------
// Step 2 — the parent org, only when research resolved nothing
// --------------------------------------------------------------------------

test('step 2: an affiliate marked found:false falls through to its parent org', () => {
  assert.equal(MILB_COLORS[CORPUS].found, false)
  assert.equal(MILB_COLORS[CORPUS].pair, undefined)
  assert.deepEqual(milbBrandPair(CORPUS), TEAM_COLOR_PAIRS[ASTROS])
  assert.equal(teamTintColor(CORPUS), 'rgba(0, 45, 98, 0.22)') // Astros #002D62
})

test('the three unresolved clubs are the only ones on step 2, and each has a real org', () => {
  const unresolved = Object.entries(MILB_COLORS)
    .filter(([, e]) => e.found === false)
    .map(([id]) => Number(id))
  assert.deepEqual(unresolved, [482, 553, 1956])
  for (const teamId of unresolved) {
    assert.equal(milbHasResearchedColor(teamId), false)
    // Real org colours, never the neutral placeholder — the whole point of
    // keeping MILB_PARENT_ORG rather than dropping straight to step 3.
    assert.notDeepEqual(milbBrandPair(teamId), NEUTRAL_FALLBACK_PAIR)
    assert.ok(milbBrandPair(teamId), `${teamId} has no parent org to fall back to`)
  }
})

// --------------------------------------------------------------------------
// Step 3 — the neutral last resort, and the null rung beside it
// --------------------------------------------------------------------------

test('step 3: a team id in neither table gets the neutral pair', () => {
  assert.deepEqual(milbColorPair(UNKNOWN), NEUTRAL_FALLBACK_PAIR)
  const { bg: home } = milbVariantColors(UNKNOWN, 'home')
  const { bg: away } = milbVariantColors(UNKNOWN, 'away')
  assert.equal(home, NEUTRAL_FALLBACK_PAIR[0])
  assert.equal(away, NEUTRAL_FALLBACK_PAIR[1])
  assert.equal(milbTreatmentTile(UNKNOWN, 'home').tint, NEUTRAL_FALLBACK_PAIR[0])
})

test('milbBrandPair stops at null where milbColorPair paints the neutral pair', () => {
  // One ordering, two endings. A caller that must render something reads
  // milbColorPair; a caller whose contract is "skip the tint entirely" reads
  // milbBrandPair and gets null instead of a wrong-looking graphite wash.
  assert.equal(milbBrandPair(UNKNOWN), null)
  assert.deepEqual(milbColorPair(UNKNOWN), NEUTRAL_FALLBACK_PAIR)
  assert.equal(teamTintColor(UNKNOWN), null)
  assert.equal(teamPrimaryColor(UNKNOWN), null)
  assert.equal(teamChipColors(UNKNOWN), null)
  assert.equal(teamStripeGradient(UNKNOWN), null)
})

// --------------------------------------------------------------------------
// The MLB side is untouched
// --------------------------------------------------------------------------

test('an MLB club still reads its own tables, chain or no chain', () => {
  // teamTintColor keeps using the rival-distinguishing accent (#F3ECD8 cream)
  // rather than the Brewers' primary navy — a different table for a different
  // purpose, and the chain must not have quietly merged the two.
  assert.equal(teamTintColor(158), 'rgba(243, 236, 216, 0.22)')
  assert.equal(teamPrimaryColor(158), '#12284B')
  assert.deepEqual(TEAM_COLOR_PAIRS[158], ['#12284B', '#FFC52F'])
})

// --------------------------------------------------------------------------
// The two promotions (PRD §5) — pinned so a future edit is a deliberate one
// --------------------------------------------------------------------------

test('the two promoted clubs carry the lab hex that was promoted, flagged low', () => {
  assert.deepEqual(milbBrandPair(6325), ['#f58b6d', '#000000']) // Columbus Clingstones
  assert.equal(MILB_COLORS[6325].confidence, 'low')
  assert.deepEqual(milbBrandPair(546), ['#e03a3e', '#003263']) // Portland Sea Dogs
  assert.equal(MILB_COLORS[546].confidence, 'low')
  // The unresolved two-source conflict is recorded, not erased by the call.
  assert.match(MILB_COLORS[546].note, /CONFLICTING sources/) // caps-js-exempt
})

test('the known-bad flags on live entries survived the reconciliation', () => {
  assert.match(MILB_COLORS[106].note, /mislabel/) // Erie SeaWolves
  assert.match(MILB_COLORS[3410].note, /pre-2026 colors/) // Richmond Flying Squirrels
})
