import { useEffect, useState } from 'react'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { ALL_MLB_TEAM_IDS, teamAbbr, teamFullName, teamClubName, teamColorSwatches } from '../lib/teams.js'
import { fetchTeamUniformCatalog, classifyUniformAsset, jerseyLabel } from '../api/uniforms.js'

// Main already has a reliable source — the mlbstatic CDN this app uses
// everywhere else (components/TeamLogo.jsx) — so only Alternate and City
// Connect are locally procured, hand-cropped transparent PNGs (see the
// folder convention below). Order here is also render order per team.
const TREATMENTS = [
  { key: 'main', label: 'Main' },
  { key: 'alternate', label: 'Alternate' },
  { key: 'city-connect', label: 'City Connect' },
]

// Where a procured file for `teamId`/`treatment` is expected, served
// same-origin out of public/ like every other static asset in this app.
// Filename is the club's real abbreviation (teams.js's TEAM_ABBR, e.g.
// "MIL", "SD", "CWS") — human-legible for manually sorting a folder of PNGs,
// and already the single source of truth for spelling a club's short code
// everywhere else in the app, so there's no second id scheme to keep in sync.
// A missing file 404s and TreatmentLogo below falls back to a wireframe
// placeholder — there's no manifest to hand-maintain as files are added.
// Never called for 'main' — that treatment renders TeamLogo instead.
function localLogoUrl(teamId, treatment) {
  const abbr = teamAbbr({ id: teamId })
  if (!abbr) return null
  const ext = ALT_LOGO_SVG.has(teamId) && treatment === 'alternate' ? 'svg' : 'png'
  return `/team-logos/${treatment}/${abbr}.${ext}`
}

// Teams whose Alternate mark is a hand-flattened solid-color SVG silhouette
// (every path recolored to the club's one real brand color straight off the
// official multicolor logo) rather than a photographed/cropped PNG like every
// other Alternate treatment here.
const ALT_LOGO_SVG = new Set([
  133, // Athletics
  118, // Royals — same recolored-white KC mark as Main, reused here (main-overrides/KC.svg copied to alternate/KC.svg)
])

// Per-team, per-treatment horizontal nudge (percent of the tile's own width,
// negative = left) for a mark whose visual weight sits off-center once scaled
// up — CSS translateX on .colorlab__logoimg/.teamlogo, applied before scale.
const TREATMENT_OFFSET_X = {
  139: { alternate: -12 }, // Rays — the enlarged mark reads better shifted left
}

// Per-team, per-treatment tweak to the tile's edge-bleed scale (applied on
// top of the 1.32 default every tinted tile gets) — for treatments other than
// Main, which has its own scale on MAIN_OVERRIDES.
const TREATMENT_SCALE = {
  139: { alternate: 1.6 }, // Rays — mark reads small against the tint at 1.32 alone
  113: { 'city-connect': 0.75 }, // Reds — the "C" mark already touches all four
  // edges of its own canvas, so the default 1.32 edge-bleed crops it; shrink
  // down so the whole mark stays inside the tile.
  117: { 'city-connect': 0.72 }, // Astros — same edge-to-edge canvas issue as the Reds mark
  118: { alternate: 0.85 }, // Royals — same KC mark + scale as Main's own override
  140: {
    // T-badge (alternate/TEX.png, swapped in from Main) — the navy fill was
    // chroma-keyed to transparent, and its own bbox already fills most of the
    // canvas, so shrink slightly off the default 1.32 edge-bleed to avoid
    // clipping the crossbar tips.
    alternate: 0.85,
    'city-connect': 0.855, // shrunk 5%, then another 10%; tile bg matches the png's own red so the new edge gap is seamless
  },
}

// A proposed replacement for a team's Primary swatch, tried out on this page
// only — teams.js's TEAM_COLOR_PAIRS/TEAM_COLORS (the real app-wide source
// every other surface reads) is untouched. Applied to BOTH the Main triad
// (mainColorTriad below) and ALT_COLORS' own Primary entry, so the two tiles
// can't drift onto two different "Primary" hexes.
const PRIMARY_OVERRIDE = {
  115: '#33006F', // Rockies — proposed purple
}

// The three official colors for a team's Main treatment are already known
// for every current MLB club (TEAM_COLOR_PAIRS' primary/secondary + the
// TEAM_COLORS accent, both in teams.js) — reuse that instead of asking the
// user to re-supply colors this page already has.
function mainColorTriad(teamId) {
  const labels = ['Primary', 'Secondary', 'Third']
  return teamColorSwatches(teamId)
    .slice(0, 3)
    .map((s, i) => ({
      label: labels[i],
      hex: i === 0 && PRIMARY_OVERRIDE[teamId] ? PRIMARY_OVERRIDE[teamId] : s.hex,
    }))
}

// A first pass at every club's Main tile as it'd look with a colored
// background (the real card, and every other row on this page, uses a plain
// paper fill) — each entry names which of the three swatches above becomes
// the tile's background, an optional scale-down off the card's normal 1.32
// edge-bleed (a large/dense mark reading as "the whole tile is this color"
// against its own brand fill), and whether the mark itself needed a
// recolor (see public/team-logos/main-overrides/{ABBR}.svg — the mlbstatic
// CDN mark with specific fills swapped, e.g. Guardians' navy outline ->
// white, Phillies' red/white swapped) to stay legible against its new
// background.
const MAIN_OVERRIDES = {
  109: { bg: 'secondary' }, // Diamondbacks
  108: { bg: 'secondary', scale: 0.9 }, // Angels
  110: { bg: 'secondary' }, // Orioles
  111: { bg: 'secondary' }, // Red Sox
  112: { bg: 'secondary', scale: 0.9 }, // Cubs
  113: { bg: 'secondary' }, // Reds
  114: { bg: 'primary', recolor: true }, // Guardians — navy border -> white
  // Rockies — white with a subtle black pinstripe (colorlab__logobox--pinstripe
  // below) to match their home pinstripe jersey, instead of a flat brand-color
  // tint like every other override here. `recolor` here isn't a color swap —
  // it points at a local copy of the mlbstatic mark with the black rim thinned
  // (a matching-color stroke on the silver inset paths, same weld technique as
  // the Athletics Alternate seam fix) so it doesn't read too heavy against white.
  115: { pinstripe: true, recolor: true },
  116: { bg: 'primary', recolor: true }, // Tigers — navy -> white
  117: { bg: 'secondary', scale: 0.9 }, // Astros
  118: { bg: 'primary', recolor: true, scale: 0.85 }, // Royals — navy -> white
  119: { bg: 'primary', recolor: true, scale: 0.85 }, // Dodgers — blue -> white
  120: { bg: 'primary', recolor: true, scale: 0.95 }, // Nationals — red -> white
  121: { bg: 'primary', scale: 0.9 }, // Mets
  133: { bg: 'primary', recolor: true }, // Athletics — green -> white
  134: { bg: 'primary', scale: 0.95 }, // Pirates
  135: { bg: 'primary', recolor: true, scale: 0.85 }, // Padres — dark -> secondary gold
  136: { bg: 'secondary' }, // Mariners
  137: { bg: 'secondary', scale: 0.9 }, // Giants
  138: { bg: 'primary', recolor: true, scale: 0.85 }, // Cardinals — red -> white
  139: { bg: 'secondary', scale: 0.95 }, // Rays
  // Rangers — the circular "Texas Rangers" crest badge (main-overrides/TEX.png,
  // swapped in from Alternate) rather than the mlbstatic mark; it's already
  // edge-to-edge in its own canvas like the Reds/Astros marks below, so scale
  // down off the default 1.32 edge-bleed instead of up.
  140: { bg: 'primary', recolor: true, scale: 0.75 },
  141: { bg: 'third' }, // Blue Jays
  142: { bg: 'primary', recolor: true, scale: 0.85 }, // Twins — navy T -> white
  143: { bg: 'primary', recolor: true }, // Phillies — red/white swapped
  144: { bg: 'secondary', recolor: true }, // Braves — red -> white (bg matches the navy border)
  145: { bg: 'secondary' }, // White Sox
  146: { bg: 'primary' }, // Marlins
  147: { bg: 'third', recolor: true }, // Yankees — navy -> white
  158: { bg: 'third' }, // Brewers
}

const BG_ROLE_INDEX = { primary: 0, secondary: 1, third: 2 }

// Every other override here is a hand-edited copy of the vector mlbstatic
// mark (.svg); the Rangers' is a chroma-keyed raster crop (see MAIN_OVERRIDES).
const MAIN_OVERRIDE_PNG = new Set([140])

function mainOverrideLogoUrl(teamId) {
  const abbr = teamAbbr({ id: teamId })
  if (!abbr) return null
  const ext = MAIN_OVERRIDE_PNG.has(teamId) ? 'png' : 'svg'
  return `/team-logos/main-overrides/${abbr}.${ext}`
}

// Alternate/City Connect colors have no existing source in this app — the
// user supplies these treatment-by-treatment, together with each logo file.
// Usually just the one tile-background color (unlike Main's fixed Primary/
// Secondary/Third triad, since these marks don't carry an official 3-color
// set here), but a team can get a full swatch set too (e.g. Diamondbacks
// City Connect's Primary/Secondary) — whichever entry carries `bg: true` is
// the one used as the tile's actual background. Keyed by teamId; a team
// with no entry yet renders a placeholder swatch, same as a missing logo.
const ALT_COLORS = {
  // Rockies — the outline-only mark's background is the proposed purple
  // (PRIMARY_OVERRIDE), same value Main's own Primary swatch now shows.
  115: [{ label: 'Primary', hex: PRIMARY_OVERRIDE[115], bg: true }],
  // Royals — the same recolored-white KC mark as Main (ALT_LOGO_SVG), but on
  // a baby-blue background of its own — Main keeps its real Primary navy.
  118: [{ label: 'Baby Blue', hex: '#6DADF4', bg: true }],
  // Diamondbacks — sampled off the snake-head mark itself (a transparent
  // PNG); both colors are exact matches for Main's own Primary/Third.
  109: [
    { label: 'Primary', hex: '#A71930', bg: true },
    { label: 'Third', hex: '#30CED8' },
  ],
  112: [
    { label: 'Primary', hex: '#0E3386', bg: true },
    { label: 'Secondary', hex: '#CC3433' },
  ], // Cubs — same pair as Main
  110: [
    { label: 'Primary', hex: '#DF4601' },
    { label: 'Secondary', hex: '#000000', bg: true },
  ], // Orioles — same pair as Main, background is the Secondary
  111: [{ label: 'Background', hex: '#0C2340', bg: true }], // Red Sox
  113: [
    { label: 'Primary', hex: '#C6011F', bg: true },
    { label: 'Secondary', hex: '#000000' },
  ], // Reds — same pair as Main
  114: [{ label: 'Background', hex: '#00385D', bg: true }], // Guardians
  119: [{ label: 'Background', hex: '#FFFFFF', bg: true }], // Dodgers
  133: [
    { label: 'Primary', hex: '#003831' },
    { label: 'Secondary', hex: '#EFB21E', bg: true },
    { label: 'Third', hex: '#A2AAAD' },
  ], // Athletics — Main's own triad, background is Secondary
  135: [{ label: 'Background', hex: '#2F241D', bg: true }], // Padres
  136: [{ label: 'Background', hex: '#005C5C', bg: true }], // Mariners
  137: [{ label: 'Background', hex: '#FD5A1E', bg: true }], // Giants
  139: [
    { label: 'Primary', hex: '#092C5C' },
    { label: 'Secondary', hex: '#8FBCE6', bg: true },
    { label: 'Third', hex: '#F5D130' },
  ], // Rays — Main's own triad, background is Secondary (unchanged)
  140: [
    { label: 'Primary', hex: '#003278', bg: true },
    { label: 'Secondary', hex: '#C0111F' },
  ], // Rangers — same Primary/Secondary pair as Main; background is Primary
  // (navy), same hex the T-badge's own chroma-keyed-out fill used to be
  144: [
    { label: 'Primary', hex: '#CE1141', bg: true },
    { label: 'Secondary', hex: '#13274F' },
  ], // Braves — script wordmark, same pair as Main
  146: [{ label: 'Background', hex: '#FFFFFF', bg: true }], // Marlins
  147: [{ label: 'Background', hex: '#0C2340', bg: true }], // Yankees
  158: [{ label: 'Background', hex: '#6CACE4', bg: true }], // Brewers
}

const CITY_CONNECT_COLORS = {
  109: [
    { label: 'Primary', hex: '#0097A9' },
    { label: 'Secondary', hex: '#523178', bg: true },
  ], // Diamondbacks
  110: [{ label: 'Secondary', hex: '#E1D2BE', bg: true }], // Orioles
  144: [
    { label: 'Primary', hex: '#D32826' },
    { label: 'Secondary', hex: '#374EA1' },
    { label: 'Third', hex: '#7BA7D8', bg: true },
  ], // Braves
  113: [
    { label: 'Primary', hex: '#C6011F' },
    { label: 'Secondary', hex: '#000000', bg: true },
  ], // Reds — same pair as Main, background is the Secondary
  115: [
    { label: 'Primary', hex: '#8ABFEB', bg: true },
    { label: 'Secondary', hex: '#4F4FC9' },
  ], // Rockies
  118: [{ label: 'Background', hex: '#FFFFFF', bg: true }], // Royals
  111: [{ label: 'Primary', hex: '#5A8D84', bg: true }], // Red Sox
  117: [
    { label: 'Primary', hex: '#0F2948' },
    { label: 'Secondary', hex: '#CEC8B2', bg: true },
    { label: 'Third', hex: '#FC7A1E' },
  ], // Astros
  // Athletics — the Sacramento patch's own solid field IS Main's Primary
  // (an unambiguous bg pick, unlike a transparent PNG), Secondary is the
  // bridge/lettering detail — same pair as Main.
  133: [
    { label: 'Primary', hex: '#003831', bg: true },
    { label: 'Secondary', hex: '#EFB21E' },
  ],
  139: [{ label: 'Background', hex: '#000000', bg: true }], // Rays
  140: [
    { label: 'Primary', hex: '#892535', bg: true },
    { label: 'Secondary', hex: '#EBDFCB' },
  ], // Rangers — both sampled off the png itself (red field, cream T)
  145: [{ label: 'Background', hex: '#000000', bg: true }], // White Sox
  158: [{ label: 'Primary', hex: '#0C436A', bg: true }], // Brewers
}

// A plain "Background" swatch (the common case above — just describes the
// tile fill, no color identity of its own) gets relabeled to Primary/
// Secondary/Third when its hex is one of that same club's Main-treatment
// colors (e.g. the Brewers' Alternate background is their Main Third,
// Powder Blue) — same color, so it should read as the same swatch, not a
// second unrelated one. An entry with its own explicit label already (e.g.
// Diamondbacks City Connect's Primary/Secondary — a distinct color identity
// unrelated to their Main triad) is left alone.
function withMainRoleLabels(teamId, colors) {
  const triad = mainColorTriad(teamId)
  return colors.map((c) => {
    if (c.label !== 'Background') return c
    const match = triad.find((m) => m.hex.toLowerCase() === c.hex.toLowerCase()) // caps-js-exempt
    return match ? { ...c, label: match.label } : c
  })
}

function colorsFor(teamId, treatmentKey) {
  if (treatmentKey === 'main') return mainColorTriad(teamId)
  const colors = treatmentKey === 'alternate' ? ALT_COLORS[teamId] : CITY_CONNECT_COLORS[teamId]
  return colors ? withMainRoleLabels(teamId, colors) : []
}

// Hand-tuned corrections where a jersey's own catalog naming doesn't match
// which logo it's actually paired with on the field — classifyUniformAsset's
// naming-convention guess is right for the other ~29 clubs but not every
// exception. Keyed by uniformAssetCode (stable within a season, unlike the
// label text) so a wording tweak next season can't silently mis-target this.
const JERSEY_TREATMENT_OVERRIDES = {
  '112_jersey_4_2026': 'city-connect', // Cubs Alt 2 Baby Blue — worn with the City Connect mark, not the plain Alternate "C"
}

// Which jersey(s) in the uniforms CATALOG (as opposed to a single game's
// worn assignment) correspond to a given tile — the cross-reference the
// team-color-lab page exists to answer. Every club's catalog jersey label
// self-identifies as Home/Away/Road, "Alt N …", or "City Connect …"
// (verified against a live 2026 pull for all 30 clubs — classifyUniformAsset),
// so this needs no per-team hand-authoring like ALT_COLORS/CITY_CONNECT_COLORS
// above beyond the rare JERSEY_TREATMENT_OVERRIDES exception; a new/renamed
// jersey in a future season's catalog is otherwise picked up automatically.
// `null` means the catalog hasn't loaded yet (still fetching or MLB-only
// endpoint miss); an empty array is a loaded catalog with no jersey in that
// bucket.
function jerseyMatchesFor(catalog, teamId, treatmentKey) {
  const assets = catalog[teamId]
  if (!assets) return null
  const clubName = teamClubName(teamId)
  return assets
    .filter((a) => {
      if (a.piece !== 'J') return false
      const treatment = JERSEY_TREATMENT_OVERRIDES[a.code] ?? classifyUniformAsset(a.text, clubName)
      return treatment === treatmentKey
    })
    .map((a) => jerseyLabel(a.text, clubName))
}

// Dev harness for reviewing each club's three logo treatments — Main,
// Alternate, City Connect — side by side with their official brand colors.
// Reached at /team-color-lab, linked from nowhere. Logos and Alternate/City
// Connect colors are filled in as the user procures them; anything missing
// renders as a wireframe placeholder rather than blocking the page.
export function TeamColorLab() {
  useDocumentTitle('Team Color Lab')
  const teams = [...ALL_MLB_TEAM_IDS].sort((a, b) =>
    teamFullName(a).localeCompare(teamFullName(b)),
  )
  const [catalog, setCatalog] = useState({})

  // One call for all 30 clubs' current-season uniform catalog (verified to
  // accept a comma list — docs/uniforms-and-logos.md), so the jersey-match
  // field below never needs a per-team fetch.
  useEffect(() => {
    let cancelled = false
    fetchTeamUniformCatalog(ALL_MLB_TEAM_IDS, new Date().getFullYear()).then((data) => {
      if (!cancelled) setCatalog(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Team Color Lab</h1>
      </header>
      <p className="hint">
        A dev harness; not linked anywhere in the app. Each club’s Main,
        Alternate, and City Connect logo treatment with its three brand
        colors. Missing logos or colors show as a placeholder until supplied.
      </p>

      <div className="colorlab">
        {teams.map((id) => (
          <TeamColorRow key={id} teamId={id} catalog={catalog} />
        ))}
      </div>
    </div>
  )
}

function TeamColorRow({ teamId, catalog }) {
  const name = teamFullName(teamId)
  return (
    <section className="colorlab__row">
      <h2 className="colorlab__teamname">{name}</h2>
      <div className="colorlab__treatments">
        {TREATMENTS.map((t) => (
          <TreatmentBox
            key={t.key}
            teamId={teamId}
            name={name}
            treatment={t.key}
            label={t.label}
            catalog={catalog}
          />
        ))}
      </div>
    </section>
  )
}

function TreatmentBox({ teamId, name, treatment, label, catalog }) {
  const colors = colorsFor(teamId, treatment)
  const jerseyMatches = jerseyMatchesFor(catalog, teamId, treatment)
  const slots = [0, 1, 2].map((i) => colors[i] ?? null)
  const override = treatment === 'main' ? MAIN_OVERRIDES[teamId] : null
  // Main picks its tile background from one of the three official swatches
  // (MAIN_OVERRIDES names which); Alternate/City Connect flag whichever of
  // their user-supplied swatches is the background directly (see ALT_COLORS/
  // CITY_CONNECT_COLORS' `bg: true`).
  const activeBgIndex = override?.pinstripe
    ? -1 // a hand-styled background (see below), not one of the three brand swatches
    : override
      ? BG_ROLE_INDEX[override.bg]
      : colors.findIndex((c) => c?.bg)

  const tint = activeBgIndex >= 0 ? colors[activeBgIndex]?.hex : undefined
  const treatmentScale = override?.scale ?? TREATMENT_SCALE[teamId]?.[treatment] ?? 1
  const treatmentOffsetX = TREATMENT_OFFSET_X[teamId]?.[treatment] ?? 0
  const logoboxStyle =
    tint || override || treatmentOffsetX
      ? {
          '--tint': tint,
          '--scale': 1.32 * treatmentScale,
          '--offset-x': `${treatmentOffsetX}%`,
        }
      : undefined
  const logoboxClass = `colorlab__logobox colorlab__logobox--gloss${override?.pinstripe ? ' colorlab__logobox--pinstripe' : ''}`

  return (
    <div className="colorlab__treatment">
      <span className="colorlab__treatmentlabel">{label}</span>
      <div className="colorlab__treatmentbox">
        <div className={logoboxClass} style={logoboxStyle}>
          <TreatmentLogo teamId={teamId} name={name} treatment={treatment} override={override} />
        </div>
        <div className="colorlab__swatchrow">
          {slots.map((s, i) => (
            <ColorSwatch key={i} swatch={s} active={i === activeBgIndex} />
          ))}
        </div>
      </div>
      <JerseyMatch matches={jerseyMatches} />
    </div>
  )
}

// The uniforms-CATALOG cross-reference for this tile — which real jersey
// name(s) a scorer would see this club actually wear when this treatment is
// the one on the field. `null` while the catalog is still loading; an empty
// array is a loaded catalog with nothing in this bucket.
function JerseyMatch({ matches }) {
  if (matches === null) return null
  return (
    <div className="colorlab__jerseymatch">
      <span className="colorlab__jerseymatchlabel">Jersey</span>
      <span>{matches.length ? matches.join(' · ') : '—'}</span>
    </div>
  )
}

function TreatmentLogo({ teamId, name, treatment, override }) {
  const url =
    treatment === 'main'
      ? override?.recolor
        ? mainOverrideLogoUrl(teamId)
        : null
      : localLogoUrl(teamId, treatment)
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])

  if (treatment === 'main' && !override?.recolor) {
    return <TeamLogo teamId={teamId} name={name} size={64} />
  }

  if (!url || failed) {
    return (
      <div className="colorlab__logoplaceholder" aria-hidden="true">
        <span>No logo yet</span>
      </div>
    )
  }

  return (
    <img
      key={url}
      src={url}
      alt={`${name} — ${treatment}`}
      className="colorlab__logoimg"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}

function ColorSwatch({ swatch, active }) {
  if (!swatch) {
    return (
      <div className="colorlab__swatchcell colorlab__swatchcell--placeholder">
        <div className="colorlab__swatchchip colorlab__swatchchip--placeholder" />
        <span className="colorlab__swatchlabel">—</span>
      </div>
    )
  }
  return (
    <div className={`colorlab__swatchcell ${active ? 'colorlab__swatchcell--active' : ''}`}>
      <div className="colorlab__swatchchip" style={{ background: swatch.hex }} />
      <span className="colorlab__swatchlabel">{swatch.label}</span>
      <span className="colorlab__swatchhex">{swatch.hex}</span>
    </div>
  )
}
