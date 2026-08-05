// Band fill/pinstripe resolution + chip-color fallback for every WPA
// step-and-repeat surface (the real chart, components/WinProbChart.jsx, plus
// the two dev labs that preview it, screens/identity-lab/ and
// screens/identity-lab/profiles/pattern.jsx). Pure data + functions, deliberately kept out
// of the chart's .jsx so that file can stay component-only (Fast Refresh).
import {
  teamChipColors,
  treatmentBgColor,
  mainTreatmentPinstripe,
  mainTreatmentPinstripeColor,
  treatmentPinstripeColor,
  treatmentPinstripeBg,
} from '../teams.js'
import { byTeam, byTreatment } from '../tuningStore.js'
import { WPA_TUNING } from './wpaLogo.js'
import { DEFAULT_PINSTRIPE_COLOR } from './wpaDefaults.js'

// The real chart's own band area, in the SAME px units as its desktop
// render (the <svg> has no responsive scaling of its own beyond the
// container — see .winprob__svg) — exported so Team Identity Lab's WPA preview
// (screens/identity-lab/) can render its tile pattern at TRUE size
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
export const BAND_COLOR_OVERRIDES = byTeam(WPA_TUNING, (e) => e.bandColor)

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
export const WPA_TREATMENT_BAND_COLOR_OVERRIDES = byTreatment(WPA_TUNING, (f) => f.band)

// Re-exported so this stays the module you import band colors from — the
// literal lives in the dependency-free lib/wpaDefaults.js leaf, so a caller who
// wants only that one string (lib/milbColors.js, on the eager first-paint path)
// doesn't drag this module — and, through its WPA_TUNING import, the whole of
// data/wpa-tuning.json — into the entry chunk. Read wpaDefaults.js first.
export { DEFAULT_PINSTRIPE_COLOR }

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
// (teams.js's treatmentBgColor — the exact color Team Identity Lab's logo box
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

// The colored fill under a pinstriped WPA band's lines, or null for the
// plain-white default (same white-implied convention wpaBandPinstripeColor's
// own doc comment names) — same two-tier default: an explicit WPA override's
// own `bg` wins outright, else this falls through to teams.js's
// treatmentPinstripeBg (White Sox City Connect's red), so a colored-pinstripe
// tile on the left renders with the same colored pinstripe here too.
export function wpaBandPinstripeBg(teamId, treatment) {
  const override = WPA_TREATMENT_BAND_COLOR_OVERRIDES[teamId]?.[treatment]
  if (override && typeof override === 'object') return override.bg ?? null
  if (override) return null
  if (treatment === 'main') return null // MAIN_OVERRIDES' pinstripe has no colored-bg variant
  return treatmentPinstripeBg(teamId, treatment)
}
