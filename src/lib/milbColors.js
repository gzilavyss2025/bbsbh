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
  498: {
    home: { scale: 0.85, offsetX: 0, offsetY: 2, bg: '#ec3b46', pinstripe: false },
    away: { scale: 0.85, offsetX: 0, offsetY: 0, bg: '#9EA2A2', pinstripe: false },
  }, // Chattanooga Lookouts
}

// `{ [teamId]: { [variant]: { size, rotate, offsetX, offsetY, paddingX, paddingY, rowShift } } }`
export const MILB_WPA_LOGO_LAYOUT_OVERRIDES = {
  402: {
    home: { size: 62, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 9, paddingY: -8, rowShift: 0 },
    away: { size: 62, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 9, paddingY: -8, rowShift: 0 },
  }, // Akron RubberDucks
  5015: { away: { size: 35, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 3, paddingY: 4, rowShift: 0 } }, // Biloxi Shuckers
  498: {
    home: { size: 46, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 9, paddingY: 3, rowShift: 0 },
    away: { size: 42, rotate: -14, offsetX: 8, offsetY: 6, paddingX: 4, paddingY: 3, rowShift: 0 },
  }, // Chattanooga Lookouts
}

// `{ [teamId]: { [variant]: string | { pinstripe: true, color } } }`
export const MILB_WPA_BAND_COLOR_OVERRIDES = {
  402: { home: '#0072CE', away: '#010101' }, // Akron RubberDucks
  5015: { away: '#e2b880' }, // Biloxi Shuckers
  498: { home: '#ec3b46', away: '#9EA2A2' }, // Chattanooga Lookouts
}

// `{ [teamId]: { [variant]: { blue, gold, font } } }` — same "design-lab
// sketch, not wired to any real component" footing as teams.js's
// TREATMENT_HEADER_COLOR_OVERRIDES.
export const MILB_HEADER_COLOR_OVERRIDES = {
  402: { home: { blue: '#0072CE', gold: '#010101', font: '#FBF6E9' } }, // Akron RubberDucks
  5015: { away: { blue: '#0f69b1', gold: '#e2b880', font: '#FBF6E9' } }, // Biloxi Shuckers
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
