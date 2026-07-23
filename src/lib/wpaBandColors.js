// Band fill/pinstripe resolution + chip-color fallback for every WPA
// step-and-repeat surface (the real chart, components/WinProbChart.jsx, plus
// the two dev labs that preview it, screens/TeamColorLab.jsx and
// screens/TeamPatternLab.jsx). Pure data + functions, deliberately kept out
// of the chart's .jsx so that file can stay component-only (Fast Refresh).
import {
  teamChipColors,
  treatmentBgColor,
  mainTreatmentPinstripe,
  mainTreatmentPinstripeColor,
  treatmentPinstripeColor,
} from './teams.js'

// The real chart's own band area, in the SAME px units as its desktop
// render (the <svg> has no responsive scaling of its own beyond the
// container — see .winprob__svg) — exported so Team Color Lab's WPA preview
// (screens/TeamColorLab.jsx) can render its tile pattern at TRUE size
// instead of a shrunken thumbnail, the same size a size/rotate/offset tweak
// would actually look like in the app.
const W = 328
const H = 220
const PAD_L = 8
const PAD_R = 16
const PAD_T = 10
const PAD_B = 22
export const WPA_PLOT_SIZE = { width: W - PAD_R - PAD_L, height: H - PAD_B - PAD_T }

// A handful of clubs' band background is better off as something OTHER than
// their TEAM_COLOR_PAIRS primary (teams.js) — a lighter secondary shade that
// reads better as a big fill. Falls through to the team's normal chip
// primary for every other team. A MiLB affiliate's own id (not its parent
// org's) also works here — e.g. Nashville Sounds below — since a farmhand's
// club identity/logo can differ entirely from its parent org's.
export const BAND_COLOR_OVERRIDES = {
  109: '#E3D4AD', // Diamondbacks — their real secondary sand/desert tone (TEAM_COLOR_PAIRS)
  111: '#0C2340', // Red Sox — secondary navy, not primary red
  140: '#EBDFCB', // Rangers — their real cream tone, sampled off their own alt mark (ALT_COLORS)
  144: '#13274F', // Braves — secondary navy, not primary red
  145: '#C4CED4', // White Sox — their real secondary silver/gray, not primary near-black
  147: '#132448', // Yankees — their true logo navy, darker than TEAM_COLORS' brighter #003087 accent
  136: '#005C5C', // Mariners — secondary green/teal, not primary navy
  139: '#8FBCE6', // Rays — secondary lighter blue, not primary navy
  484: '#D9D9D9', // Indianapolis Indians (MiLB) — light gray, not their parent org's near-black
  556: '#E31837', // Nashville Sounds (MiLB) — their own logo red, sampled off the CDN mark
  572: '#8A2432', // Wisconsin Timber Rattlers (MiLB) — their own logo maroon, sampled off the CDN mark
  580: '#C7BEE0', // Winston-Salem Dash (MiLB) — pale tint of their own logo purple
  6325: '#000000', // Columbus Clingstones (MiLB) — plain black
  432: '#D0A353', // Rome Emperors (MiLB) — no true yellow in their mark, closest is this laurel gold
  437: '#FDB913', // Lake County Captains (MiLB) — their own logo gold, sampled off the CDN mark
  565: '#AD8505', // Quad Cities River Bandits (MiLB) — their own logo bronze/gold, not their parent org's navy
}

// A (team, treatment)-specific band override, for the rare club whose
// Alternate/City Connect mark reads better on its OWN brand color than its
// curated tile background (e.g. a City Connect jersey's own signature
// purple, unrelated to the club's year-round tile fill). Checked first;
// everything else falls through to wpaBandColor/wpaBandPinstripeColor's own
// default per treatment — see there. A value is either a plain hex string
// (flat fill) or `{ pinstripe: true, color }` (the scorebook pinstripe
// pattern — see PinstripePattern in components/WinProbChart.jsx — `color`
// is the line color, white background implied, same convention as
// teams.js's MAIN_OVERRIDES).
export const WPA_TREATMENT_BAND_COLOR_OVERRIDES = {
  109: {
    main: '#E3D4AD',
    alternate: '#E3D4AD',
    'city-connect': '#523178',
  },
  133: {
    main: '#003831',
  },
  144: {
    alternate: '#CE1141',
    'city-connect': '#7BA7D8',
  },
  111: {
    main: '#0C2340',
    alternate: '#0C2340',
    'city-connect': '#5A8D84',
  },
  158: {
    alternate: { pinstripe: true, color: 'rgba(0, 0, 0, 0.16)' },
    'city-connect': '#ff6c58',
  },
  136: {
    'city-connect': '#203F79',
    'alternate-3': '#000000',
    'alternate-2': '#0C2C56',
  },
  139: {
    'city-connect': '#7bc35e',
    alternate: '#8FBCE6',
  },
  141: {
    'city-connect': '#161827',
  },
  110: {
    'city-connect': '#E1D2BE',
  },
  112: {
    main: { pinstripe: true, color: 'rgba(0, 0, 0, 0.16)' },
    alternate: '#0E3386',
    'alternate-2': '#7698CE',
  },
  115: {
    'city-connect': '#8ABFEB',
  },
}

// The pinstripe line color at its default weight — same literal
// mainTreatmentPinstripeColor/treatmentPinstripeColor (teams.js) fall back
// to, so a pinstriped WPA band always matches a pinstriped logo-box tile
// exactly unless a team/treatment explicitly picks its own line color.
export const DEFAULT_PINSTRIPE_COLOR = 'rgba(0, 0, 0, 0.16)'

// A team's brand pair for chip/marker chrome, falling back to a neutral
// graphite pair for a team teamChipColors doesn't know (no teamId handed in,
// or an unrecognized MiLB id) rather than rendering an undefined color.
export function chipColorsFor(teamId) {
  return teamChipColors(teamId) ?? { primary: '#6B6558', secondary: '#938C7C', text: '#FBF6E9' }
}

// BAND_COLOR_OVERRIDES above is a Main-ONLY curation — those hand-picked
// hexes (Red Sox navy over primary red, Diamondbacks sand, …) were tuned
// against the Main mark specifically and must never leak onto an
// Alternate/City Connect band as a generic fallback. For any OTHER
// treatment, default to that treatment's own curated tile background
// (teams.js's treatmentBgColor — the exact color Team Color Lab's logo box
// already shows for that same tile, ALT_COLORS/CITY_CONNECT_COLORS'
// `bg: true` swatch), so the WPA preview matches the logo lockup on the
// left rather than guessing independently. A team/treatment with neither
// falls back to the club's own chip primary. Ignored outright when
// wpaBandPinstripeColor (below) says this band should be pinstriped instead.
export function wpaBandColor(teamId, treatment) {
  const override = WPA_TREATMENT_BAND_COLOR_OVERRIDES[teamId]?.[treatment]
  const overrideColor = override && typeof override === 'object' ? override.color : override
  if (overrideColor) return overrideColor
  if (treatment === 'main') return BAND_COLOR_OVERRIDES[teamId] ?? chipColorsFor(teamId).primary
  return treatmentBgColor(teamId, treatment) ?? chipColorsFor(teamId).primary
}

// The pinstripe line color for this (team, treatment)'s band, or null when
// it should render as a flat fill (wpaBandColor above) instead. Same
// two-tier default as wpaBandColor: an explicit WPA_TREATMENT_BAND_COLOR_OVERRIDES
// entry wins outright (either turning pinstripe ON with its own line color,
// or turning it OFF by supplying a plain hex); with no override, Main
// mirrors mainTreatmentPinstripe/mainTreatmentPinstripeColor and every other
// treatment mirrors treatmentPinstripeColor — the SAME two tables Team
// Color Lab's logo box already reads, so a tile that renders pinstriped on
// the left renders pinstriped in its WPA preview too, with no separate
// authoring surface to keep in sync.
export function wpaBandPinstripeColor(teamId, treatment) {
  const override = WPA_TREATMENT_BAND_COLOR_OVERRIDES[teamId]?.[treatment]
  if (override && typeof override === 'object') {
    return override.pinstripe ? (override.color ?? DEFAULT_PINSTRIPE_COLOR) : null
  }
  if (override) return null // an explicit flat hex override wins outright, no pinstripe
  if (treatment === 'main') return mainTreatmentPinstripe(teamId) ? mainTreatmentPinstripeColor(teamId) : null
  return treatmentPinstripeColor(teamId, treatment)
}
