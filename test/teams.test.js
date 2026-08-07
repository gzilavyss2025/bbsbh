// Coverage for the jersey-logo-variant lookups in src/lib/teams.js:
// localLogoUrl, teamLogoUrl's alternate/city-connect routing, and the
// treatmentBgColor/treatmentScale readers PR #339 pulled out of
// the Team Identity Lab so the home-page game cards could share them. PR #343
// added hasAlternate2/hasAlternate3/hasCityConnect, the Main-tile
// mainTreatment* readers, and treatmentPinstripeColor — covered below.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  localLogoUrl,
  teamLogoUrl,
  treatmentBgColor,
  treatmentScale,
  treatmentTile,
  treatmentPinstripeColor,
  hasAlternate2,
  hasAlternate3,
  hasCityConnect,
  defaultTreatmentFor,
  defaultHomeTreatmentFor,
  defaultAwayTreatmentFor,
  mainTreatmentTint,
  mainTreatmentScale,
  mainTreatmentPinstripe,
  mainTreatmentPinstripeColor,
  mainTreatmentRecolor,
  mainOverrideLogoUrl,
  cityConnectMastheadUrl,
  pickCityConnectMasthead,
  CITY_CONNECT_MASTHEAD_KEY,
  MLB_TREATMENT_TUNING,
  MAIN_OVERRIDES,
  offDayTreatmentFor,
  isMlbTeamId,
  headshotSources,
  realHeadshotUrl,
  milbHeadshotUrl,
  coachHeadshotUrl,
} from '../src/lib/teams.js'
import { MLB_TEAM_COLORS } from '../src/lib/brandColors.js'

// --------------------------------------------------------------------------
// localLogoUrl
// --------------------------------------------------------------------------
test('localLogoUrl builds a curated-art path from the team abbreviation', () => {
  assert.equal(localLogoUrl(158, 'alternate'), '/team-logos/alternate/MIL.png')
  assert.equal(localLogoUrl(158, 'city-connect'), '/team-logos/city-connect/MIL.png')
})

test('localLogoUrl uses .svg only for the ALT_LOGO_SVG teams, and only on alternate', () => {
  assert.equal(localLogoUrl(118, 'alternate'), '/team-logos/alternate/KC.svg') // Royals
  assert.equal(localLogoUrl(118, 'city-connect'), '/team-logos/city-connect/KC.png') // svg only applies to alternate
})

test('localLogoUrl returns null for a team with no known abbreviation', () => {
  assert.equal(localLogoUrl(999999, 'alternate'), null)
})

// --------------------------------------------------------------------------
// teamLogoUrl
// --------------------------------------------------------------------------
test('teamLogoUrl routes alternate/city-connect to the curated local asset', () => {
  assert.equal(teamLogoUrl(158, 'alternate'), localLogoUrl(158, 'alternate'))
  assert.equal(teamLogoUrl(158, 'city-connect'), localLogoUrl(158, 'city-connect'))
})

test('teamLogoUrl returns null without a teamId, even for alternate/city-connect', () => {
  assert.equal(teamLogoUrl(null, 'alternate'), null)
})

test('teamLogoUrl routes alternate-2/alternate-3 to the curated local asset', () => {
  assert.equal(teamLogoUrl(158, 'alternate-2'), localLogoUrl(158, 'alternate-2')) // Brewers
  assert.equal(teamLogoUrl(146, 'alternate-3'), localLogoUrl(146, 'alternate-3')) // Marlins
  assert.equal(teamLogoUrl(133, 'alternate'), localLogoUrl(133, 'alternate')) // Athletics — curated ATH.png
})

test('teamLogoUrl falls back to the plain CDN base logo for an ALT_USES_BASE_LOGO team', () => {
  assert.equal(teamLogoUrl(108, 'alternate'), 'https://www.mlbstatic.com/team-logos/108.svg') // Angels
})

test('teamLogoUrl falls back to the plain CDN base logo for an ALT2_USES_BASE_LOGO team', () => {
  assert.equal(teamLogoUrl(118, 'alternate-2'), 'https://www.mlbstatic.com/team-logos/118.svg') // Royals
})

test('teamLogoUrl falls back to the plain CDN base logo for an ALT3_USES_BASE_LOGO team', () => {
  assert.equal(teamLogoUrl(109, 'alternate-3'), 'https://www.mlbstatic.com/team-logos/109.svg') // Diamondbacks
  assert.equal(teamLogoUrl(110, 'alternate-3'), 'https://www.mlbstatic.com/team-logos/110.svg') // Orioles
})

test('teamLogoUrl routes main-recolor to the hand-edited Main override asset', () => {
  assert.equal(teamLogoUrl(114, 'main-recolor'), mainOverrideLogoUrl(114)) // Guardians
})

// --------------------------------------------------------------------------
// treatmentBgColor
// --------------------------------------------------------------------------
test('treatmentBgColor returns the bg:true hex for a curated team/treatment', () => {
  assert.equal(treatmentBgColor(109, 'alternate'), '#A71930') // Diamondbacks
  assert.equal(treatmentBgColor(158, 'city-connect'), '#ff6c58') // Brewers
})

test('treatmentBgColor returns null for a team with no curated background yet', () => {
  assert.equal(treatmentBgColor(116, 'alternate-4'), null) // Tigers — no ALT4_COLORS entry
})

test('treatmentBgColor returns null for a pinstriped tile with no flat bg swatch', () => {
  assert.equal(treatmentBgColor(158, 'alternate'), null) // Brewers Alternate is pinstriped, not a flat swatch
})

test('treatmentBgColor returns null for main/base, even for a team with alt colors curated', () => {
  assert.equal(treatmentBgColor(158, 'main'), null)
  assert.equal(treatmentBgColor(158, 'base'), null)
})

// --------------------------------------------------------------------------
// treatmentScale
// --------------------------------------------------------------------------
test('treatmentScale returns a curated per-team/treatment override', () => {
  assert.equal(treatmentScale(139, 'alternate'), 1.6) // Rays
  assert.equal(treatmentScale(113, 'city-connect'), 0.84) // Reds
})

test('treatmentScale defaults to 1 for an uncurated team or treatment', () => {
  assert.equal(treatmentScale(110, 'city-connect'), 1) // Orioles has no city-connect override
  assert.equal(treatmentScale(139, 'city-connect'), 1) // Rays has no city-connect override
})

// --------------------------------------------------------------------------
// treatmentPinstripeColor
// --------------------------------------------------------------------------
test('treatmentPinstripeColor returns the curated line color for a pinstriped non-Main tile', () => {
  assert.equal(treatmentPinstripeColor(158, 'alternate'), 'rgba(0, 0, 0, 0.16)') // Brewers Alternate
})

test('treatmentPinstripeColor returns null for a team/treatment with no pinstripe', () => {
  assert.equal(treatmentPinstripeColor(158, 'city-connect'), null)
  assert.equal(treatmentPinstripeColor(109, 'alternate'), null)
})

// --------------------------------------------------------------------------
// hasAlternate2 / hasAlternate3 / hasCityConnect
// --------------------------------------------------------------------------
test('hasAlternate2 is true for a team with curated colors or an explicit base-logo opt-in', () => {
  assert.equal(hasAlternate2(112), true) // Cubs — ALT2_COLORS entry
  assert.equal(hasAlternate2(118), true) // Royals — ALT2_USES_BASE_LOGO opt-in
})

test('hasAlternate2 is false for a team with no Alternate 2 set up', () => {
  assert.equal(hasAlternate2(147), false) // Yankees
})

test('hasAlternate3 is true only for teams with an ALT3_COLORS entry', () => {
  assert.equal(hasAlternate3(146), true) // Marlins
  assert.equal(hasAlternate3(158), true) // Brewers — Alternate 3 is their Road Powder Blue jersey
})

test('hasCityConnect is false only for NO_CITY_CONNECT teams', () => {
  assert.equal(hasCityConnect(147), false) // Yankees — opted out
  assert.equal(hasCityConnect(158), true) // Brewers
})

// --------------------------------------------------------------------------
// defaultTreatmentFor
// --------------------------------------------------------------------------
// Every club now carries a curated defaultHomeTreatment/defaultAwayTreatment
// (Team Identity Lab), which always wins outright over the heuristic below —
// see the "wins outright" test. So exercising the heuristic itself, or the
// null-return case, needs a club with those fields temporarily cleared
// rather than a real one that happens to lack them.
function withoutCuratedDefault(teamId, fn) {
  const entry = MLB_TEAM_COLORS[teamId]
  const home = entry.defaultHomeTreatment
  const away = entry.defaultAwayTreatment
  delete entry.defaultHomeTreatment
  delete entry.defaultAwayTreatment
  try {
    fn()
  } finally {
    if (home !== undefined) entry.defaultHomeTreatment = home
    if (away !== undefined) entry.defaultAwayTreatment = away
  }
}

test('defaultTreatmentFor predicts Main (away grey/road) for a road team', () => {
  withoutCuratedDefault(158, () => {
    // 2026-07-24 is a Friday — even so, the away side never predicts City Connect.
    assert.equal(defaultTreatmentFor(158, 'away', '2026-07-24'), 'main')
  })
})

test('defaultTreatmentFor predicts City Connect for a Friday home game when the club has one', () => {
  withoutCuratedDefault(158, () => {
    assert.equal(defaultTreatmentFor(158, 'home', '2026-07-24'), 'city-connect') // Brewers
  })
})

test('defaultTreatmentFor predicts Main for a Friday home game when the club has no City Connect', () => {
  withoutCuratedDefault(147, () => {
    assert.equal(defaultTreatmentFor(147, 'home', '2026-07-24'), 'main') // Yankees — opted out
  })
})

test('defaultTreatmentFor predicts Main for a home game on any other day of the week', () => {
  withoutCuratedDefault(158, () => {
    assert.equal(defaultTreatmentFor(158, 'home', '2026-07-23'), 'main') // Thursday
  })
})

test('defaultTreatmentFor predicts Main for a missing/garbled date', () => {
  withoutCuratedDefault(158, () => {
    assert.equal(defaultTreatmentFor(158, 'home', null), 'main')
    assert.equal(defaultTreatmentFor(158, 'home', ''), 'main')
  })
})

test('defaultHomeTreatmentFor/defaultAwayTreatmentFor return null for a club with no curated default', () => {
  withoutCuratedDefault(112, () => {
    assert.equal(defaultHomeTreatmentFor(112), null) // Cubs, with its curated fields cleared
    assert.equal(defaultAwayTreatmentFor(112), null)
  })
  assert.equal(defaultHomeTreatmentFor(999999), null) // no mlb-team-colors.json entry at all
})

test('a curated defaultHomeTreatment/defaultAwayTreatment wins outright over defaultTreatmentFor\'s heuristic', () => {
  const entry = MLB_TEAM_COLORS[158] // Brewers — Friday home game would otherwise predict City Connect
  const originalHome = entry.defaultHomeTreatment
  const originalAway = entry.defaultAwayTreatment
  try {
    entry.defaultHomeTreatment = 'alternate'
    entry.defaultAwayTreatment = 'alternate-2'
    assert.equal(defaultHomeTreatmentFor(158), 'alternate')
    assert.equal(defaultAwayTreatmentFor(158), 'alternate-2')
    assert.equal(defaultTreatmentFor(158, 'home', '2026-07-24'), 'alternate') // Friday, but the curated pick wins
    assert.equal(defaultTreatmentFor(158, 'away', '2026-07-24'), 'alternate-2')
  } finally {
    entry.defaultHomeTreatment = originalHome
    entry.defaultAwayTreatment = originalAway
  }
})

// --------------------------------------------------------------------------
// mainTreatmentTint / mainTreatmentScale / mainTreatmentPinstripe(Color) / mainTreatmentRecolor
// --------------------------------------------------------------------------
test('mainTreatmentTint resolves a bg role to that team\'s swatch hex', () => {
  assert.equal(mainTreatmentTint(108), '#BA0021') // Angels — bg: 'secondary'
})

test('mainTreatmentTint prefers a literal bgHex over any swatch role', () => {
  assert.equal(mainTreatmentTint(158), '#F3ECD8') // Brewers — bgHex, not one of the three brand swatches
  assert.equal(mainTreatmentTint(109), '#FFFDF6') // Diamondbacks — bgHex, not the secondary swatch
})

test('mainTreatmentTint returns null for a pinstriped team and for an uncurated team', () => {
  assert.equal(mainTreatmentTint(147), null) // Yankees — pinstripe, no flat swatch
  assert.equal(mainTreatmentTint(999999), null) // no MAIN_OVERRIDES entry at all
})

test('mainTreatmentScale returns a curated override or defaults to 1', () => {
  assert.equal(mainTreatmentScale(140), 0.85) // Rangers
  assert.equal(mainTreatmentScale(999999), 1)
})

// --------------------------------------------------------------------------
// offDayTreatmentFor
// --------------------------------------------------------------------------
test('offDayTreatmentFor reads a club\'s curated off-day treatment', () => {
  assert.equal(offDayTreatmentFor(135), 'alternate') // Padres — Brown Pinstripe alternate
})

test('offDayTreatmentFor defaults to main for a club with no override', () => {
  assert.equal(offDayTreatmentFor(112), 'main') // Cubs — no offDayTreatment set
  assert.equal(offDayTreatmentFor(999999), 'main') // no mlb-team-colors.json entry at all
})

test('offDayTreatmentFor reads the Brewers\' curated off-day treatment', () => {
  assert.equal(offDayTreatmentFor(158), 'alternate') // Brewers — pinned team, curated in this tuning session
})

test('mainTreatmentPinstripe is true only for the pinstriped Main-tile teams', () => {
  assert.equal(mainTreatmentPinstripe(115), true) // Rockies
  assert.equal(mainTreatmentPinstripe(147), true) // Yankees
  assert.equal(mainTreatmentPinstripe(109), false) // Diamondbacks
})

test('mainTreatmentPinstripeColor defaults to black unless a team overrides it', () => {
  assert.equal(mainTreatmentPinstripeColor(147), 'rgba(0, 0, 0, 0.16)') // Yankees — no override, shares the default
})

test('mainTreatmentRecolor is true only for teams whose Main mark swaps to the hand-edited asset', () => {
  assert.equal(mainTreatmentRecolor(114), true) // Guardians
  assert.equal(mainTreatmentRecolor(115), false) // Rockies — pinstriped but not recolored
})

// A club's Main override used to need a hand-authored `recolor: true` flag in
// mlb-treatment-tuning.json on top of the uploaded file — the exact trap that
// left an uploaded Giants Away Grey mark invisible with no error anywhere.
// mainTreatmentRecolor/mainOverrideLogoUrl now derive straight from what
// upload's own manifest (logo-art.json) says is on disk, so a new upload
// needs no companion data or code change to take effect.
test('mainOverrideLogoUrl and mainTreatmentRecolor resolve from disk presence alone, not a MAIN_OVERRIDES flag', () => {
  assert.equal(MAIN_OVERRIDES[114].recolor, undefined) // recolor is no longer even a field this store carries
  assert.equal(mainTreatmentRecolor(114), true) // Guardians — CLE.svg is on disk regardless
  assert.equal(mainOverrideLogoUrl(114), '/team-logos/main-overrides/CLE.svg')
})

// A club's own custom-mark assignment (Team Identity Lab, ADR-0029) beats even
// a procured main-overrides file, since assigning one is an explicit act about
// that club — see mainOverrideLogoUrl's own comment.
test('mainOverrideLogoUrl prefers an assigned custom mark over the procured main-overrides file', () => {
  assert.equal(mainOverrideLogoUrl(113), '/team-logos/custom/113-basewhite.svg') // Reds — assigned over CIN.png
})

test('mainOverrideLogoUrl prefers a procured .png over a stale .svg of the same team', () => {
  assert.equal(mainOverrideLogoUrl(120), '/team-logos/main-overrides/WSH.png') // Nationals — both files exist
})

test('mainOverrideLogoUrl is null for the one MAIN_USES_BASE_LOGO exception even though a file exists on disk', () => {
  assert.equal(mainOverrideLogoUrl(115), null) // Rockies — COL.svg exists but is intentionally unused
})

test('mainOverrideLogoUrl resolves the Yankees\' procured main override, no longer a MAIN_USES_BASE_LOGO exception', () => {
  assert.equal(mainOverrideLogoUrl(147), '/team-logos/main-overrides/NYY.png')
})

// --------------------------------------------------------------------------
// cityConnectMastheadUrl — a club's own override of the mark its themed
// .metricbar mastheads draw while it's wearing City Connect (ADR-0031),
// normally the club-wide precomputed knockout SVG. Reads logo-art.json's
// masthead-city-connect entries the exact way mainOverrideLogoUrl reads
// main-overrides — disk presence alone, no companion flag to keep in sync.
// --------------------------------------------------------------------------
test('cityConnectMastheadUrl is null for a club with no override uploaded yet', () => {
  assert.equal(cityConnectMastheadUrl(158), null) // Brewers — no file procured
})

test('cityConnectMastheadUrl is null for a club with no City Connect uniform at all', () => {
  assert.equal(cityConnectMastheadUrl(147), null) // Yankees — opted out of the program (NO_CITY_CONNECT)
  assert.equal(cityConnectMastheadUrl(112), null) // Cubs — City Connect moved to Alternate 2
})

test('cityConnectMastheadUrl is null for an id with no abbreviation to file art under', () => {
  assert.equal(cityConnectMastheadUrl(999999), null)
  assert.equal(cityConnectMastheadUrl(null), null)
})

// The second way into that slot: a mark PASTED as SVG source in the lab's City
// Connect bar mark panel, saved into the club's library and assigned to the
// synthetic 'city-connect-masthead' key. Pinned through the pure picker rather
// than through a real store entry — same reason customMarks.js splits
// parseMarkAssignmentKey out: the precedence has to be checkable whether or not
// any club currently wears one.
test('an assigned library mark outranks an uploaded PNG on the City Connect bar', () => {
  const assigned = { slug: 'cc-wordmark', name: 'CC wordmark', url: '/team-logos/custom/158-cc-wordmark.svg' }
  assert.equal(
    pickCityConnectMasthead(assigned, '/team-logos/masthead-city-connect/MIL.png'),
    '/team-logos/custom/158-cc-wordmark.svg',
    'the pointer wins, because clearing it is a click and deleting a PNG is not',
  )
})

test('with no assignment the City Connect bar falls back to the uploaded PNG, then to nothing', () => {
  assert.equal(pickCityConnectMasthead(null, '/team-logos/masthead-city-connect/MIL.png'), '/team-logos/masthead-city-connect/MIL.png')
  assert.equal(pickCityConnectMasthead(null, null), null)
})

test('a cdn: assignment is ignored on the City Connect bar rather than resolved', () => {
  // customMarkFor answers a `cdn:` assignment as { cdnVariant } with no url.
  // Drawing a stock CDN vector here would put full-color art on a bar nothing
  // re-inks — and that vector is what the knockout pipeline already converts.
  assert.equal(pickCityConnectMasthead({ cdnVariant: 'wordmark' }, null), null)
})

test('the City Connect masthead key is never a real jersey treatment', () => {
  // It names an upload directory and an assignment slot only. A club's own
  // treatment tuning must never carry an entry under it (ADR-0031's amendment).
  assert.equal(CITY_CONNECT_MASTHEAD_KEY, 'city-connect-masthead')
  for (const entry of Object.values(MLB_TREATMENT_TUNING)) {
    assert.ok(!entry.treatments?.[CITY_CONNECT_MASTHEAD_KEY], `${entry.name} carries a masthead-key treatment record`)
  }
})

// treatmentTile — the one resolver the slate card, the in-game masthead, and
// Team Identity Lab all read so a club's tile looks the same in every one.
// Added when the masthead adopted the tile (previously GameCard.jsx assembled
// these four values inline).

test('treatmentTile spells the Main look the three ways its callers do', () => {
  // The slate card says 'base', the WPA chart says 'main', and a game with no
  // posted uniform yet says null — all one look.
  const main = treatmentTile(115, 'main')
  assert.deepEqual(treatmentTile(115, 'base'), main)
  assert.deepEqual(treatmentTile(115, null), main)
  assert.deepEqual(treatmentTile(115, undefined), main)
})

test('treatmentTile picks a pinstripe pattern over a flat tint, never both', () => {
  const rockies = treatmentTile(115, 'main') // pinstriped Main tile
  assert.equal(rockies.pinstripeColor, 'rgba(0, 0, 0, 0.16)')
  assert.equal(rockies.tint, null, 'a pattern tile has no flat swatch to fill with')

  const dbacks = treatmentTile(109, 'main')
  assert.equal(dbacks.pinstripeColor, null)
  assert.ok(dbacks.tint, 'a flat tile keeps its curated swatch')
})

test('treatmentTile routes a recolored Main mark to its hand-edited asset', () => {
  assert.equal(treatmentTile(114, 'main').logoVariant, 'main-recolor') // Guardians
  assert.equal(treatmentTile(115, 'main').logoVariant, 'base') // Rockies — stock CDN mark
})

test('treatmentTile carries a non-Main treatment through as its own variant', () => {
  const cc = treatmentTile(158, 'city-connect')
  assert.equal(cc.logoVariant, 'city-connect')
  assert.equal(cc.tint, treatmentBgColor(158, 'city-connect'))
  assert.equal(cc.scale, treatmentScale(158, 'city-connect'))
})

test('treatmentTile gives an uncurated club a usable tile rather than throwing', () => {
  const tile = treatmentTile(999999, 'alternate')
  assert.equal(tile.logoVariant, 'alternate')
  assert.equal(tile.pinstripeColor, null)
  assert.equal(tile.scale, 1, 'no curated scale means no overscale adjustment')
})

// --------------------------------------------------------------------------
// isMlbTeamId — only the 30 current MLB clubs are "major-league" ids
// --------------------------------------------------------------------------
test('isMlbTeamId is true for current MLB clubs, false otherwise', () => {
  assert.equal(isMlbTeamId(158), true) // Brewers
  assert.equal(isMlbTeamId(141), true) // Blue Jays
  assert.equal(isMlbTeamId(144), true) // Braves
  assert.equal(isMlbTeamId(561), false) // Salt Lake Bees (AAA affiliate)
  assert.equal(isMlbTeamId(null), false)
  assert.equal(isMlbTeamId(undefined), false)
  assert.equal(isMlbTeamId(0), false)
})

// --------------------------------------------------------------------------
// headshotSources — the Headshot fallback-rung POLICY (spoiler-irrelevant,
// but the reason established MLB players stopped showing stale wrong-cap
// minor-league photos: a major-leaguer (mlb: true) drops the `milb` rung).
// --------------------------------------------------------------------------
test('headshotSources: an MLB player gets silo only, NOT the stale milb photo', () => {
  // George Springer (543807) — his milb variant is a years-old prospect photo
  // in the wrong cap, so it must never be a rung.
  const sources = headshotSources(543807, { mlb: true })
  assert.deepEqual(sources, [realHeadshotUrl(543807)])
  assert.equal(
    sources.includes(milbHeadshotUrl(543807)),
    false,
    'MLB player must not fall back to his minor-league headshot',
  )
})

test('headshotSources: a MiLB / prospect player keeps silo -> milb', () => {
  // A genuine prospect still gets the milb rung — a real recent face when his
  // MLB silo 404s.
  assert.deepEqual(headshotSources(700000, { mlb: false }), [
    realHeadshotUrl(700000),
    milbHeadshotUrl(700000),
  ])
  // The safe default (unspecified) also keeps milb.
  assert.deepEqual(headshotSources(700000, {}), [
    realHeadshotUrl(700000),
    milbHeadshotUrl(700000),
  ])
})

test('headshotSources: coaches use the coach variant only, regardless of mlb', () => {
  assert.deepEqual(headshotSources(11111, { coach: true, mlb: true }), [
    coachHeadshotUrl(11111),
  ])
})

test('headshotSources: no personId yields no photo rungs', () => {
  assert.deepEqual(headshotSources(null, { mlb: true }), [])
  assert.deepEqual(headshotSources(undefined, {}), [])
})
