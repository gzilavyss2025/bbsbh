import { WPA_LOGO_DEFAULTS } from './wpaLogo.js'
import { DEFAULT_PINSTRIPE_COLOR } from './wpaBandColors.js'

// Per-affiliate MiLB brand colors + the Home/Away tuning tables for the
// simplified MiLB Team Color Lab (screens/MilbTeamColorLab.jsx, routes
// /team-color-lab-aaa|aa|higha|a). Deliberately separate from teams.js's MLB
// color system: MLB gets a Main/Alternate/City-Connect/… treatment catalog
// because real per-jersey art and colors exist and are worth curating one by
// one. MiLB doesn't — too many one-off jerseys, reported inconsistently
// across statsapi, for too little payoff — so every MiLB affiliate gets
// exactly two variations, Home and Away, no exceptions, built from ONE
// researched primary/secondary pair per team.
//
// The pairs below are WEB RESEARCH, not an official source (statsapi carries
// no color field for any team, MLB or MiLB, and neither MLB nor MiLB publish
// one) — see .scratch/milb-team-colors/README.md for the full methodology,
// per-team confidence ratings, and known gaps. Re-verify before leaning on
// any single value here for something more permanent than a QA lab.

// Five affiliates where research either found no hex at all, or only a
// single low-confidence/likely-stale source with unresolved conflicts
// (Portland Sea Dogs, Knoxville Smokies, Corpus Christi Hooks, Somerset
// Patriots, Columbus Clingstones — see the stash README) are left OUT of
// MILB_RESEARCHED_PAIRS on purpose, so milbColorPair's fallback below
// renders them with an explicit neutral placeholder rather than a
// possibly-wrong invented color.
export const MILB_RESEARCHED_PAIRS = {
  // Triple-A
  561: ['#000000', '#FDB913'], // Salt Lake Bees
  2310: ['#00285A', '#D21146'], // Reno Aces
  568: ['#009A44', '#010101'], // Norfolk Tides
  533: ['#00275C', '#E41134'], // Worcester Red Sox
  451: ['#0E3386', '#D12325'], // Iowa Cubs
  416: ['#EC1B2B', '#151240'], // Louisville Bats
  445: ['#002A5C', '#68ACDB'], // Columbus Clippers
  342: ['#000000', '#F61D30'], // Albuquerque Isotopes
  512: ['#002A5C', '#E71629'], // Toledo Mud Hens
  5434: ['#082439', '#38C2CD'], // Sugar Land Space Cowboys
  541: ['#004A8D', '#B9976A'], // Omaha Storm Chasers
  238: ['#005DAA', '#EF3E42'], // Oklahoma City Comets
  534: ['#EE3124', '#FFD200'], // Rochester Red Wings
  552: ['#004B8D', '#F47D30'], // Syracuse Mets
  400: ['#0A2240', '#FF4D00'], // Las Vegas Aviators
  484: ['#00243A', '#CD2132'], // Indianapolis Indians
  4904: ['#000000', '#A71930'], // El Paso Chihuahuas
  529: ['#002D5A', '#EB1750'], // Tacoma Rainiers
  105: ['#000000', '#800032'], // Sacramento River Cats
  235: ['#D31245', '#002B5C'], // Memphis Redbirds
  234: ['#0054A4', '#B15C12'], // Durham Bulls
  102: ['#091F40', '#A31F37'], // Round Rock Express
  422: ['#CE1141', '#0054A4'], // Buffalo Bisons
  1960: ['#001489', '#DA291C'], // St. Paul Saints
  1410: ['#05173C', '#C90116'], // Lehigh Valley IronPigs
  431: ['#0D223F', '#73AA4F'], // Gwinnett Stripers
  494: ['#000000', '#00AEDB'], // Charlotte Knights
  564: ['#002D62', '#007DC3'], // Jacksonville Jumbo Shrimp
  531: ['#003366', '#840026'], // Scranton/Wilkes-Barre RailRiders
  556: ['#071D49', '#C8102E'], // Nashville Sounds

  // Double-A
  559: ['#e93c49', '#3378c2'], // Rocket City Trash Pandas
  5368: ['#003A70', '#00A9E0'], // Amarillo Sod Poodles
  418: ['#010101', '#FC4C02'], // Chesapeake Baysox
  498: ['#ec3b46', '#000000'], // Chattanooga Lookouts
  402: ['#010101', '#0072CE'], // Akron RubberDucks
  538: ['#002c76', '#009a49'], // Hartford Yard Goats
  106: ['#231f20', '#d10c47'], // Erie SeaWolves
  1350: ['#002d6a', '#a20534'], // Northwest Arkansas Naturals
  260: ['#005294', '#221e1f'], // Tulsa Drillers
  547: ['#d10c47', '#042e61'], // Harrisburg Senators
  505: ['#bc0b35', '#0f213e'], // Binghamton Rumble Ponies
  237: ['#0069aa', '#fbb034'], // Midland RockHounds
  452: ['#b21921', '#231f20'], // Altoona Curve
  510: ['#081f3f', '#ceaa78'], // San Antonio Missions
  574: ['#ba0c2f', '#000000'], // Arkansas Travelers
  3410: ['#d41041', '#231f20'], // Richmond Flying Squirrels (pre-2026 refresh colors — see stash README)
  440: ['#d30e45', '#002c5d'], // Springfield Cardinals
  421: ['#febe28', '#0b2b76'], // Montgomery Biscuits
  540: ['#862633', '#326295'], // Frisco RoughRiders
  463: ['#c6021e', '#0f254b'], // New Hampshire Fisher Cats
  3898: ['#032c5b', '#e1143b'], // Wichita Wind Surge
  522: ['#d10c47', '#042d60'], // Reading Fightin Phils
  247: ['#231f20', '#be0940'], // Birmingham Barons
  4124: ['#003087', '#041e42'], // Pensacola Blue Wahoos
  5015: ['#0f69b1', '#e2b880'], // Biloxi Shuckers

  // High-A
  460: ['#041E42', '#B9975B'], // Tri-City Dust Devils
  419: ['#051C2C', '#7BAFD4'], // Hillsboro Hops
  493: ['#010101', '#FC4C02'], // Frederick Keys
  428: ['#C8102E', '#0C2340'], // Greenville Drive
  550: ['#002F6C', '#C8102E'], // South Bend Cubs
  459: ['#010101', '#007A33'], // Dayton Dragons
  437: ['#051C2C', '#F2A900'], // Lake County Captains
  486: ['#BA0C2F', '#041E42'], // Spokane Indians
  582: ['#0C2340', '#012169'], // West Michigan Whitecaps
  573: ['#0C2340', '#236192'], // Asheville Tourists
  565: ['#010101', '#003594'], // Quad Cities River Bandits
  456: ['#AF272F', '#010101'], // Great Lakes Loons
  426: ['#8BB8E8', '#041E42'], // Wilmington Blue Rocks
  453: ['#13294B', '#002D72'], // Brooklyn Cyclones
  499: ['#C8102E', '#010101'], // Lansing Lugnuts
  477: ['#00843D', '#010101'], // Greensboro Grasshoppers
  584: ['#2C5234', '#7A9A01'], // Fort Wayne TinCaps
  403: ['#041E42', '#00B5E2'], // Everett AquaSox
  461: ['#010101', '#007A53'], // Eugene Emeralds
  443: ['#0C2340', '#BA0C2F'], // Peoria Chiefs
  2498: ['#0C2340', '#FF6A14'], // Bowling Green Hot Rods
  6324: ['#0C2340', '#78BE21'], // Hub City Spartanburgers
  435: ['#D50032', '#9D2235'], // Vancouver Canadians
  492: ['#041E42', '#009A44'], // Cedar Rapids Kernels
  427: ['#BA0C2F', '#041E42'], // Jersey Shore BlueClaws
  432: ['#010101', '#DA291C'], // Rome Emperors
  580: ['#010101', '#5F249F'], // Winston-Salem Dash
  554: ['#010101', '#00A3E0'], // Beloit Sky Carp
  537: ['#0C2340', '#97999B'], // Hudson Valley Renegades
  572: ['#862633', '#010101'], // Wisconsin Timber Rattlers

  // Single-A
  526: ['#BA0C2F', '#0C2340'], // Rancho Cucamonga Quakes
  516: ['#010101', '#BA0C2F'], // Visalia Rawhide
  548: ['#010101', '#F9423A'], // Delmarva Shorebirds
  414: ['#0C2340', '#0072CE'], // Salem RidgeYaks
  521: ['#0072CE', '#0C2340'], // Myrtle Beach Pelicans
  450: ['#004E42', '#78BE21'], // Daytona Tortugas
  481: ['#002F6C', '#BA0C2F'], // Hill City Howlers
  259: ['#BA0C2F', '#010101'], // Fresno Grizzlies
  570: ['#0C2340', '#B94700'], // Lakeland Flying Tigers
  3712: ['#101820', '#C8102E'], // Fayetteville Woodpeckers
  3705: ['#002855', '#326295'], // Columbia Fireflies
  6482: ['#0032A0', '#92C1E9'], // Ontario Tower Buzzers
  436: ['#BA0C2F', '#041E42'], // Fredericksburg Nationals
  507: ['#002D72', '#FC4C02'], // St. Lucie Mets
  524: ['#C8102E', '#002D72'], // Stockton Ports
  3390: ['#010101', '#FFC72C'], // Bradenton Marauders
  103: ['#010101', '#C8102E'], // Lake Elsinore Storm
  401: ['#010101', '#69B3E7'], // Inland Empire 66ers
  476: ['#010101', '#FA4616'], // San Jose Giants
  279: ['#BA0C2F', '#0C2340'], // Palm Beach Cardinals
  233: ['#091F2C', '#F2A900'], // Charleston RiverDogs
  448: ['#E4002B', '#A6192E'], // Hickory Crawdads
  424: ['#003DA5', '#041E42'], // Dunedin Blue Jays
  509: ['#0C2340', '#24125F'], // Fort Myers Mighty Mussels
  566: ['#BA0C2F', '#236192'], // Clearwater Threshers
  478: ['#010101', '#007A53'], // Augusta GreenJackets
  487: ['#003A70', '#CB333B'], // Kannapolis Cannon Ballers
  479: ['#010101', '#0077C8'], // Jupiter Hammerheads
  587: ['#091F2C', '#009CDE'], // Tampa Tarpons
  249: ['#091F2C', '#00677F'], // Wilson Warbirds
}

// Same neutral graphite pair wpaBandColors.js's chipColorsFor falls back to
// for an unrecognized team — reused here rather than inventing a second
// "unknown team" color, for the 5 affiliates research couldn't confidently
// resolve (see the doc comment above).
const NEUTRAL_FALLBACK_PAIR = ['#6B6558', '#938C7C']

export function milbColorPair(teamId) {
  return MILB_RESEARCHED_PAIRS[teamId] ?? NEUTRAL_FALLBACK_PAIR
}

// Whether `teamId` has a real researched color (vs. the neutral fallback) —
// surfaced in the lab so an unresolved team is visibly flagged rather than
// looking indistinguishable from a confidently-researched one.
export function milbHasResearchedColor(teamId) {
  return Boolean(MILB_RESEARCHED_PAIRS[teamId])
}

// The two variations, no exceptions: Home wears the primary as its main
// color with the secondary as accent; Away swaps the pair — same two hexes,
// opposite roles. No separate "road grey" research was done (out of scope —
// see the module doc comment), so Away leans on the team's own secondary
// rather than a generic grey.
export function milbVariantColors(teamId, variant) {
  const [primary, secondary] = milbColorPair(teamId)
  return variant === 'away' ? { bg: secondary, accent: primary } : { bg: primary, accent: secondary }
}

// The four full-season MiLB levels this lab covers — same sportId set (and
// exclusion of complex/rookie leagues, which have no stable per-club
// identity) as TeamPatternLab's own LEAGUE_FILTERS. Shared by route.js (which
// route name maps to which level), App.jsx (which lazy screen export to
// render), and MilbTeamColorLab.jsx itself (the level-switcher nav + which
// affiliates.json bucket to show) — one list, so the four can't drift apart.
export const MILB_COLOR_LAB_LEVELS = [
  { key: 'aaa', routeName: 'team-color-lab-aaa', sportId: 11, label: 'Triple-A' },
  { key: 'aa', routeName: 'team-color-lab-aa', sportId: 12, label: 'Double-A' },
  { key: 'higha', routeName: 'team-color-lab-higha', sportId: 13, label: 'High-A' },
  { key: 'a', routeName: 'team-color-lab-a', sportId: 14, label: 'Single-A' },
]

// ---------------------------------------------------------------------------
// Hand-tuning tables (Phase 2) — same shape/naming convention as teams.js's
// MLB tables (TREATMENT_SCALE/TREATMENT_OFFSET_X/Y, MAIN_OVERRIDES) and
// lib/wpaLogo.js / lib/wpaBandColors.js's WPA_LOGO_LAYOUT_OVERRIDES /
// WPA_TREATMENT_BAND_COLOR_OVERRIDES / TREATMENT_HEADER_COLOR_OVERRIDES —
// just keyed by `'home'`/`'away'` instead of an MLB treatment key, and kept
// in this MiLB-only file so nothing here can collide with or drift against
// the MLB tables. Empty until MilbTeamColorLab's copy-icon snippets get
// pasted in by hand, same "propose in the lab, land by hand" workflow as
// Team Color Lab.

// `{ [teamId]: { [variant]: { scale, offsetX, offsetY, bg, pinstripe } } }`
export const MILB_LOGO_POS_OVERRIDES = {
  402: {
    home: { scale: 1, offsetX: 0, offsetY: 0, bg: '#0072CE', pinstripe: false },
    away: { scale: 1, offsetX: 0, offsetY: 0, bg: '#D0D0D0', pinstripe: false },
  }, // Akron RubberDucks
  342: { away: { scale: 1, offsetX: 0, offsetY: 0, bg: '#D0D0D0', pinstripe: false } }, // Albuquerque Isotopes
  5368: { home: { scale: 1, offsetX: 0, offsetY: 0, bg: '#003A70', pinstripe: false } }, // Amarillo Sod Poodles
  505: {
    home: { scale: 1, offsetX: -15, offsetY: 0, bg: '#bc0b35', pinstripe: false },
    away: { scale: 1, offsetX: -15, offsetY: 0, bg: '#0f213e', pinstripe: false },
  }, // Binghamton Rumble Ponies
  247: {
    home: { scale: 0.89, offsetX: 0, offsetY: 5, bg: '#231f20', pinstripe: false },
    away: { scale: 0.89, offsetX: 0, offsetY: 5, bg: '#9EA2A2', pinstripe: false },
  }, // Birmingham Barons
  422: {
    home: { scale: 1.12, offsetX: 7, offsetY: 7, bg: '#CE1141', pinstripe: false },
    away: { scale: 1.12, offsetX: 7, offsetY: 7, bg: '#0054A4', pinstripe: false },
  }, // Buffalo Bisons
  494: {
    home: { scale: 0.85, offsetX: -7, offsetY: 0, bg: '#000000', pinstripe: false },
    away: { scale: 0.85, offsetX: -7, offsetY: 0, bg: '#D0D0D0', pinstripe: false },
  }, // Charlotte Knights
  498: {
    home: { scale: 0.87, offsetX: -7, offsetY: 7, bg: '#ec3b46', pinstripe: false },
    away: { scale: 0.85, offsetX: 0, offsetY: 0, bg: '#9EA2A2', pinstripe: false },
  }, // Chattanooga Lookouts
  418: {
    home: { scale: 0.79, offsetX: -3, offsetY: 5, bg: '#010101', pinstripe: false },
    away: { scale: 0.79, offsetX: -3, offsetY: 5, bg: '#D0D0D0', pinstripe: false },
  }, // Chesapeake Baysox
  6325: {
    home: { scale: 1, offsetX: 0, offsetY: 0, bg: '#f58b6d', pinstripe: false },
    away: { scale: 1, offsetX: 0, offsetY: 0, bg: '#000000', pinstripe: false },
  }, // Columbus Clingstones
  445: {
    home: { scale: 1.13, offsetX: -7, offsetY: 0, bg: '#002A5C', pinstripe: false },
    away: { scale: 1.13, offsetX: -7, offsetY: 0, bg: '#68ACDB', pinstripe: false },
  }, // Columbus Clippers
  482: {
    home: { scale: 1, offsetX: 0, offsetY: 0, bg: '#FFFFFF', pinstripe: false },
    away: { scale: 1, offsetX: 0, offsetY: 0, bg: '#D0D0D0', pinstripe: false },
  }, // Corpus Christi Hooks
  234: {
    home: { scale: 1, offsetX: -12, offsetY: 11, bg: '#0054A4', pinstripe: false },
    away: { scale: 1, offsetX: -12, offsetY: 11, bg: '#B15C12', pinstripe: false },
  }, // Durham Bulls
  106: {
    home: { scale: 0.91, offsetX: 0, offsetY: 5, bg: '#231f20', pinstripe: false },
    away: { scale: 0.91, offsetX: 0, offsetY: 5, bg: '#d10c47', pinstripe: false },
  }, // Erie SeaWolves
  540: {
    home: { scale: 1, offsetX: 0, offsetY: 0, bg: '#326295', pinstripe: false },
    away: { scale: 1, offsetX: 0, offsetY: 0, bg: '#F3ECD8', pinstripe: false },
  }, // Frisco RoughRiders
  547: {
    home: { scale: 0.87, offsetX: -6, offsetY: 7, bg: '#d10c47', pinstripe: false },
    away: { scale: 0.87, offsetX: -6, offsetY: 7, bg: '#042e61', pinstripe: false },
  }, // Harrisburg Senators
  538: {
    home: { scale: 0.96, offsetX: 8, offsetY: 0, bg: '#002c76', pinstripe: false },
    away: { scale: 0.96, offsetX: 8, offsetY: 0, bg: '#009a49', pinstripe: false },
  }, // Hartford Yard Goats
  553: {
    home: { scale: 0.86, offsetX: -8, offsetY: 7, bg: '#FFFFFF', pinstripe: false },
    away: { scale: 0.86, offsetX: -8, offsetY: 7, bg: '#D0D0D0', pinstripe: false },
  }, // Knoxville Smokies
  237: {
    home: { scale: 1, offsetX: 13, offsetY: 0, bg: '#0069aa', pinstripe: false },
    away: { scale: 1, offsetX: 13, offsetY: 0, bg: '#fbb034', pinstripe: false },
  }, // Midland RockHounds
  421: {
    home: { scale: 0.9, offsetX: 8, offsetY: 5, bg: '#febe28', pinstripe: false },
    away: { scale: 0.9, offsetX: 8, offsetY: 5, bg: '#0b2b76', pinstripe: false },
  }, // Montgomery Biscuits
  463: {
    home: { scale: 0.77, offsetX: 0, offsetY: 0, bg: '#c6021e', pinstripe: false },
    away: { scale: 0.77, offsetX: 0, offsetY: 0, bg: '#0f254b', pinstripe: false },
  }, // New Hampshire Fisher Cats
  1350: {
    home: { scale: 0.86, offsetX: -9, offsetY: 6, bg: '#002d6a', pinstripe: false },
    away: { scale: 0.86, offsetX: -9, offsetY: 6, bg: '#a20534', pinstripe: false },
  }, // Northwest Arkansas Naturals
  4124: {
    home: { scale: 0.97, offsetX: -8, offsetY: 5, bg: '#003087', pinstripe: false },
    away: { scale: 0.97, offsetX: -8, offsetY: 5, bg: '#e20177', pinstripe: false },
  }, // Pensacola Blue Wahoos
  546: {
    home: { scale: 0.82, offsetX: -5, offsetY: 6, bg: '#e03a3e', pinstripe: false },
    away: { scale: 0.82, offsetX: -5, offsetY: 6, bg: '#cbccce', pinstripe: false },
  }, // Portland Sea Dogs
  522: {
    home: { scale: 0.96, offsetX: -13, offsetY: 6, bg: '#d10c47', pinstripe: false },
    away: { scale: 0.96, offsetX: -13, offsetY: 6, bg: '#042d60', pinstripe: false },
  }, // Reading Fightin Phils
  3410: {
    home: { scale: 1.6, offsetX: 0, offsetY: 3, bg: '#d41041', pinstripe: false },
    away: { scale: 1.6, offsetX: 0, offsetY: 3, bg: '#231f20', pinstripe: false },
  }, // Richmond Flying Squirrels
  559: {
    home: { scale: 1.09, offsetX: 20, offsetY: 13, bg: '#e93c49', pinstripe: false },
    away: { scale: 1.09, offsetX: 20, offsetY: 13, bg: '#3378c2', pinstripe: false },
  }, // Rocket City Trash Pandas
  510: {
    home: { scale: 0.99, offsetX: 3, offsetY: 0, bg: '#081f3f', pinstripe: false },
  }, // San Antonio Missions
  1956: {
    home: { scale: 1, offsetX: 0, offsetY: 0, bg: '#FFFFFF', pinstripe: false },
    away: { scale: 1, offsetX: 0, offsetY: 0, bg: '#D0D0D0', pinstripe: false },
  }, // Somerset Patriots
  260: {
    home: { scale: 1.06, offsetX: -10, offsetY: 22, bg: '#005294', pinstripe: false },
    away: { scale: 1.06, offsetX: -10, offsetY: 22, bg: '#221e1f', pinstripe: false },
  }, // Tulsa Drillers
  3898: {
    home: { scale: 1, offsetX: -15, offsetY: 0, bg: '#032c5b', pinstripe: false },
    away: { scale: 1, offsetX: -15, offsetY: 0, bg: '#e1143b', pinstripe: false },
  }, // Wichita Wind Surge
}

// `{ [teamId]: { [variant]: { size, rotate, offsetX, offsetY, paddingX, paddingY, rowShift } } }`
export const MILB_WPA_LOGO_LAYOUT_OVERRIDES = {
  402: {
    home: { size: 62, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 9, paddingY: -8, rowShift: 0 },
    away: { size: 62, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 9, paddingY: -8, rowShift: 0 },
  }, // Akron RubberDucks
  342: {
    home: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
    away: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
  }, // Albuquerque Isotopes
  452: {
    home: { size: 44, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 6, paddingY: 2, rowShift: 0 },
    away: { size: 44, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 6, paddingY: 2, rowShift: 0 },
  }, // Altoona Curve
  5368: {
    home: { size: 53, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 7, paddingY: -6, rowShift: 0 },
    away: { size: 53, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 7, paddingY: -6, rowShift: 0 },
  }, // Amarillo Sod Poodles
  574: {
    home: { size: 52, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 7, paddingY: 1, rowShift: 0 },
    away: { size: 54, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 8, paddingY: 1, rowShift: 0 },
  }, // Arkansas Travelers
  5015: { away: { size: 35, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 3, paddingY: 4, rowShift: 0 } }, // Biloxi Shuckers
  505: {
    home: { size: 51, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 8, paddingY: 2, rowShift: 0 },
    away: { size: 52, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 6, paddingY: 2, rowShift: 0 },
  }, // Binghamton Rumble Ponies
  247: {
    home: { size: 41, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 6, paddingY: 2, rowShift: 0 },
    away: { size: 38, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 2, paddingY: 3, rowShift: 0 },
  }, // Birmingham Barons
  422: {
    home: { size: 60, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
    away: { size: 60, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
  }, // Buffalo Bisons
  494: {
    home: { size: 60, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
    away: { size: 50, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
  }, // Charlotte Knights
  498: {
    home: { size: 46, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 9, paddingY: 3, rowShift: 0 },
    away: { size: 42, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 3, rowShift: 0 },
  }, // Chattanooga Lookouts
  418: {
    home: { size: 37, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
    away: { size: 38, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 7, paddingY: 6, rowShift: 0 },
  }, // Chesapeake Baysox
  6325: {
    home: { size: 46, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 5, paddingY: 2, rowShift: 0 },
    away: { size: 46, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 5, paddingY: 2, rowShift: 0 },
  }, // Columbus Clingstones
  445: {
    home: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 6, paddingY: -1, rowShift: 0 },
    away: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 6, paddingY: -1, rowShift: 0 },
  }, // Columbus Clippers
  482: {
    home: { size: 46, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 10, paddingY: 4, rowShift: 0 },
    away: { size: 46, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 10, paddingY: 4, rowShift: 0 },
  }, // Corpus Christi Hooks
  234: {
    home: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
    away: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
  }, // Durham Bulls
  106: {
    home: { size: 45, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 13, paddingY: 1, rowShift: 0 },
    away: { size: 45, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 13, paddingY: 1, rowShift: 0 },
  }, // Erie SeaWolves
  540: {
    home: { size: 45, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
    away: { size: 45, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
  }, // Frisco RoughRiders
  547: {
    home: { size: 45, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
    away: { size: 45, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
  }, // Harrisburg Senators
  538: {
    home: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
    away: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
  }, // Hartford Yard Goats
  553: {
    home: { size: 45, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
    away: { size: 45, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
  }, // Knoxville Smokies
  237: {
    home: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
    away: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
  }, // Midland RockHounds
  421: {
    home: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
    away: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
  }, // Montgomery Biscuits
  463: {
    home: { size: 45, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
    away: { size: 45, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
  }, // New Hampshire Fisher Cats
  1350: {
    home: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
    away: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
  }, // Northwest Arkansas Naturals
  4124: {
    home: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
    away: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
  }, // Pensacola Blue Wahoos
  546: {
    home: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 8, rowShift: 0 },
    away: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 6, paddingY: 6, rowShift: 0 },
  }, // Portland Sea Dogs
  522: {
    home: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 6, paddingY: 2, rowShift: 0 },
    away: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 6, paddingY: 0, rowShift: 0 },
  }, // Reading Fightin Phils
  3410: {
    home: { size: 82, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 9, paddingY: -37, rowShift: 0 },
    away: { size: 82, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 9, paddingY: -37, rowShift: 0 },
  }, // Richmond Flying Squirrels
  559: {
    home: { size: 60, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
    away: { size: 60, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
  }, // Rocket City Trash Pandas
  510: {
    home: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
    away: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
  }, // San Antonio Missions
  1956: {
    home: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
    away: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
  }, // Somerset Patriots
  440: {
    home: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
    away: { size: 55, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
  }, // Springfield Cardinals
  260: {
    home: { size: 60, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
    away: { size: 60, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 4, rowShift: 0 },
  }, // Tulsa Drillers
  3898: {
    home: { size: 60, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: -2, rowShift: 0 },
    away: { size: 60, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: -5, rowShift: 0 },
  }, // Wichita Wind Surge
}

// `{ [teamId]: { [variant]: string | { pinstripe: true, color } } }`
export const MILB_WPA_BAND_COLOR_OVERRIDES = {
  402: { home: '#0072CE', away: '#010101' }, // Akron RubberDucks
  342: { home: '#000000', away: '#D0D0D0' }, // Albuquerque Isotopes
  452: { home: '#b21921', away: '#231f20' }, // Altoona Curve
  5368: { home: '#00A9E0', away: '#00A9E0' }, // Amarillo Sod Poodles
  574: { home: '#ba0c2f', away: '#000000' }, // Arkansas Travelers
  5015: { away: '#e2b880' }, // Biloxi Shuckers
  505: { home: '#bc0b35', away: '#0f213e' }, // Binghamton Rumble Ponies
  247: { home: '#231f20', away: '#be0940' }, // Birmingham Barons
  422: { home: '#0054A4', away: '#0054A4' }, // Buffalo Bisons
  494: { home: '#000000', away: '#000000' }, // Charlotte Knights
  498: { home: '#ec3b46', away: '#9EA2A2' }, // Chattanooga Lookouts
  418: { home: '#010101', away: '#010101' }, // Chesapeake Baysox
  6325: { home: '#f58b6d', away: '#000000' }, // Columbus Clingstones
  445: { home: '#002A5C', away: '#68ACDB' }, // Columbus Clippers
  482: { home: '#FFFFFF', away: '#D0D0D0' }, // Corpus Christi Hooks
  234: { home: '#0054A4', away: '#B15C12' }, // Durham Bulls
  106: { home: '#231f20', away: '#d10c47' }, // Erie SeaWolves
  540: { home: '#326295', away: '#F3ECD8' }, // Frisco RoughRiders
  547: { home: '#d10c47', away: '#042e61' }, // Harrisburg Senators
  538: { home: '#002c76', away: '#009a49' }, // Hartford Yard Goats
  553: { home: '#FFFFFF', away: '#D0D0D0' }, // Knoxville Smokies
  237: { home: '#0069aa', away: '#fbb034' }, // Midland RockHounds
  421: { home: '#febe28', away: '#0b2b76' }, // Montgomery Biscuits
  463: { home: '#c6021e', away: '#0f254b' }, // New Hampshire Fisher Cats
  1350: { home: '#002d6a', away: '#a20534' }, // Northwest Arkansas Naturals
  4124: { home: '#003087', away: '#e20177' }, // Pensacola Blue Wahoos
  546: { home: '#e03a3e', away: '#cbccce' }, // Portland Sea Dogs
  522: { home: '#d10c47', away: '#042d60' }, // Reading Fightin Phils
  3410: { home: '#d41041', away: '#231f20' }, // Richmond Flying Squirrels
  559: { home: '#e93c49', away: '#3378c2' }, // Rocket City Trash Pandas
  510: { away: '#ceaa78' }, // San Antonio Missions
  1956: { home: '#FFFFFF', away: '#D0D0D0' }, // Somerset Patriots
  440: { home: '#d30e45', away: '#002c5d' }, // Springfield Cardinals
  260: { home: '#005294', away: '#221e1f' }, // Tulsa Drillers
  3898: { home: '#032c5b', away: '#e1143b' }, // Wichita Wind Surge
}

// `{ [teamId]: { [variant]: { blue, gold, font } } }` — same "design-lab
// sketch, not wired to any real component" footing as teams.js's
// TREATMENT_HEADER_COLOR_OVERRIDES.
export const MILB_HEADER_COLOR_OVERRIDES = {
  402: { home: { blue: '#0072CE', gold: '#010101', font: '#FBF6E9' } }, // Akron RubberDucks
  5368: { away: { blue: '#003A70', gold: '#00A9E0', font: '#FBF6E9' } }, // Amarillo Sod Poodles
  5015: { away: { blue: '#0f69b1', gold: '#e2b880', font: '#FBF6E9' } }, // Biloxi Shuckers
  422: { home: { blue: '#0054A4', gold: '#CE1141', font: '#FBF6E9' } }, // Buffalo Bisons
  418: { away: { blue: '#010101', gold: '#FC4C02', font: '#FBF6E9' } }, // Chesapeake Baysox
  6325: {
    home: { blue: '#000000', gold: '#f58b6d', font: '#FBF6E9' },
    away: { blue: '#000000', gold: '#f58b6d', font: '#FBF6E9' },
  }, // Columbus Clingstones
  445: { away: { blue: '#002A5C', gold: '#68ACDB', font: '#FBF6E9' } }, // Columbus Clippers
  482: {
    home: { blue: '#012b5d', gold: '#4f91ca', font: '#FBF6E9' },
    away: { blue: '#012b5d', gold: '#4f91ca', font: '#FBF6E9' },
  }, // Corpus Christi Hooks
  234: { away: { blue: '#0054A4', gold: '#B15C12', font: '#FBF6E9' } }, // Durham Bulls
  106: { away: { blue: '#231f20', gold: '#d10c47', font: '#FBF6E9' } }, // Erie SeaWolves
  421: { home: { blue: '#0b2b76', gold: '#febe28', font: '#FBF6E9' } }, // Montgomery Biscuits
  546: {
    home: { blue: '#e03a3e', gold: '#000000', font: '#FBF6E9' },
    away: { blue: '#e03a3e', gold: '#000000', font: '#FBF6E9' },
  }, // Portland Sea Dogs
}

// The resolved Scale/X/Y/Background/Pinstripe for a (team, variant)'s main
// logo-box tile — a draft (MilbTeamColorLab's own local edit) wins outright
// over a landed MILB_LOGO_POS_OVERRIDES entry, which wins outright over the
// plain researched variant color with no position tweak. Same "draft beats
// curated beats default" chain as teams.js/TeamColorLab's own position math.
export function milbLogoPosition(teamId, variant, draft) {
  const o = MILB_LOGO_POS_OVERRIDES[teamId]?.[variant]
  const { bg } = milbVariantColors(teamId, variant)
  return {
    scale: draft?.scale ?? o?.scale ?? 1,
    offsetX: draft?.offsetX ?? o?.offsetX ?? 0,
    offsetY: draft?.offsetY ?? o?.offsetY ?? 0,
    bg: draft?.bg ?? o?.bg ?? bg,
    pinstripe: draft?.pinstripe ?? o?.pinstripe ?? false,
  }
}

// Same merge chain, for the WPA band's logo tile layout — mirrors
// lib/wpaLogo.js's wpaLogoLayout, against MILB_WPA_LOGO_LAYOUT_OVERRIDES
// instead of that file's MLB-keyed table. `WPA_LOGO_DEFAULTS` (imported) is
// the one piece of shared ground truth with the real chart, so a MiLB tile
// with no override at all still renders at the exact same tile geometry a
// real WinProbChart band uses.
export function milbWpaLogoLayout(teamId, variant, draft) {
  const o = MILB_WPA_LOGO_LAYOUT_OVERRIDES[teamId]?.[variant]
  return {
    size: draft?.size ?? o?.size ?? WPA_LOGO_DEFAULTS.size,
    rotate: draft?.rotate ?? o?.rotate ?? WPA_LOGO_DEFAULTS.rotate,
    offsetX: draft?.offsetX ?? o?.offsetX ?? WPA_LOGO_DEFAULTS.offsetX,
    offsetY: draft?.offsetY ?? o?.offsetY ?? WPA_LOGO_DEFAULTS.offsetY,
    paddingX: draft?.paddingX ?? o?.paddingX ?? WPA_LOGO_DEFAULTS.paddingX,
    paddingY: draft?.paddingY ?? o?.paddingY ?? WPA_LOGO_DEFAULTS.paddingY,
    rowShift: draft?.rowShift ?? o?.rowShift ?? WPA_LOGO_DEFAULTS.rowShift,
  }
}

// The WPA band's effective pinstripe state for a (team, variant) — a draft
// toggle wins, else a landed MILB_WPA_BAND_COLOR_OVERRIDES entry, else no
// pinstripe (unlike MLB, no MiLB variant defaults to pinstriped). Returns the
// line color, or null for "render as a flat fill" (see milbWpaBandColor).
export function milbWpaBandPinstripeColor(teamId, variant, draft) {
  if (draft?.pinstripe != null) return draft.pinstripe ? (draft.bandColor ?? DEFAULT_PINSTRIPE_COLOR) : null
  const override = MILB_WPA_BAND_COLOR_OVERRIDES[teamId]?.[variant]
  if (override && typeof override === 'object') {
    return override.pinstripe ? (override.color ?? DEFAULT_PINSTRIPE_COLOR) : null
  }
  return null
}

// The WPA band's flat fill color for a (team, variant), ignored when
// milbWpaBandPinstripeColor above says this band should render pinstriped
// instead. Same draft-beats-curated-beats-computed chain as the position/
// layout resolvers.
export function milbWpaBandColor(teamId, variant, draft) {
  if (draft?.bandColor) return draft.bandColor
  const override = MILB_WPA_BAND_COLOR_OVERRIDES[teamId]?.[variant]
  const overrideColor = override && typeof override === 'object' ? override.color : override
  if (overrideColor) return overrideColor
  return milbVariantColors(teamId, variant).bg
}

// Seeds for the header-colors mockup when neither a draft nor a landed
// MILB_HEADER_COLOR_OVERRIDES entry supplies one — this variant's own
// resolved bg/accent, so the mockup starts from a real color instead of the
// app's generic navy/gold pair (unlike TreatmentHeaderPreview's MLB
// equivalent, which falls back to the app's brand pair only when a team has
// no swatches of its own at all — every MiLB team always has at least the
// neutral fallback pair, so that last-resort branch never applies here).
const DEFAULT_HEADER_FONT = '#FBF6E9' // --paper-2, same literal teams.js's MLB mockup uses
export function milbHeaderColorsFor(teamId, variant, draft) {
  const override = MILB_HEADER_COLOR_OVERRIDES[teamId]?.[variant]
  const { bg, accent } = milbVariantColors(teamId, variant)
  return {
    blue: draft?.blue ?? override?.blue ?? bg,
    gold: draft?.gold ?? override?.gold ?? accent,
    font: draft?.font ?? override?.font ?? DEFAULT_HEADER_FONT,
  }
}

// The real game-card/masthead tile's shape (see teams.js's treatmentTile,
// which TeamTreatmentMark reads for every MLB club) computed from this
// module's Home/Away tables instead — the live wiring this lab was staged
// for. `variant` is the game side ('home'/'away'); anything else falls back
// to 'away' so a caller that hasn't resolved a side yet still gets a real
// tile rather than a crash. No `draft` param — unlike the lab's own preview
// path, the shipped app only ever reads the landed MILB_LOGO_POS_OVERRIDES
// table.
export function milbTreatmentTile(teamId, variant) {
  const side = variant === 'home' ? 'home' : 'away'
  const pos = milbLogoPosition(teamId, side)
  return {
    logoVariant: 'base',
    tint: pos.pinstripe ? null : pos.bg,
    offsetX: pos.offsetX,
    offsetY: pos.offsetY,
    pinstripeColor: pos.pinstripe ? pos.bg : null,
    pinstripeBg: null,
    scale: pos.scale,
  }
}
