import { useEffect, useState } from 'react'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { ALL_MLB_TEAM_IDS, teamAbbr, teamFullName, teamColorSwatches } from '../lib/teams.js'

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
const ALT_LOGO_SVG = new Set([133]) // Athletics

// Per-team, per-treatment tweak to the tile's edge-bleed scale (applied on
// top of the 1.32 default every tinted tile gets) — for treatments other than
// Main, which has its own scale on MAIN_OVERRIDES.
const TREATMENT_SCALE = {
  139: { alternate: 1.3 }, // Rays — mark reads small against the tint at 1.32 alone
}

// The three official colors for a team's Main treatment are already known
// for every current MLB club (TEAM_COLOR_PAIRS' primary/secondary + the
// TEAM_COLORS accent, both in teams.js) — reuse that instead of asking the
// user to re-supply colors this page already has.
function mainColorTriad(teamId) {
  const labels = ['Primary', 'Secondary', 'Third']
  return teamColorSwatches(teamId)
    .slice(0, 3)
    .map((s, i) => ({ label: labels[i], hex: s.hex }))
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
  115: { bg: 'primary' }, // Rockies
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
  140: { bg: 'secondary', scale: 0.9 }, // Rangers
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

function mainOverrideLogoUrl(teamId) {
  const abbr = teamAbbr({ id: teamId })
  return abbr ? `/team-logos/main-overrides/${abbr}.svg` : null
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
  // Diamondbacks — sampled off the snake-head mark itself (a transparent PNG,
  // so no bg pick is obvious from the art the way it is for a filled patch);
  // both colors happen to be exact matches for Main's own Primary/Third, so
  // no bg:true here — the tile stays plain paper until a background is
  // chosen by eye.
  109: [
    { label: 'Primary', hex: '#A71930' },
    { label: 'Third', hex: '#30CED8' },
  ],
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
  // Athletics — the Sacramento patch's own solid field IS Main's Primary
  // (an unambiguous bg pick, unlike a transparent PNG), Secondary is the
  // bridge/lettering detail — same pair as Main.
  133: [
    { label: 'Primary', hex: '#003831', bg: true },
    { label: 'Secondary', hex: '#EFB21E' },
  ],
  139: [{ label: 'Background', hex: '#000000', bg: true }], // Rays
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
          <TeamColorRow key={id} teamId={id} />
        ))}
      </div>
    </div>
  )
}

function TeamColorRow({ teamId }) {
  const name = teamFullName(teamId)
  return (
    <section className="colorlab__row">
      <h2 className="colorlab__teamname">{name}</h2>
      <div className="colorlab__treatments">
        {TREATMENTS.map((t) => (
          <TreatmentBox key={t.key} teamId={teamId} name={name} treatment={t.key} label={t.label} />
        ))}
      </div>
    </section>
  )
}

function TreatmentBox({ teamId, name, treatment, label }) {
  const colors = colorsFor(teamId, treatment)
  const slots = [0, 1, 2].map((i) => colors[i] ?? null)
  const override = treatment === 'main' ? MAIN_OVERRIDES[teamId] : null
  // Main picks its tile background from one of the three official swatches
  // (MAIN_OVERRIDES names which); Alternate/City Connect flag whichever of
  // their user-supplied swatches is the background directly (see ALT_COLORS/
  // CITY_CONNECT_COLORS' `bg: true`).
  const activeBgIndex = override
    ? BG_ROLE_INDEX[override.bg]
    : colors.findIndex((c) => c?.bg)

  const tint = activeBgIndex >= 0 ? colors[activeBgIndex]?.hex : undefined
  const treatmentScale = override?.scale ?? TREATMENT_SCALE[teamId]?.[treatment] ?? 1
  const logoboxStyle =
    tint || override
      ? {
          '--tint': tint,
          '--scale': 1.32 * treatmentScale,
        }
      : undefined

  return (
    <div className="colorlab__treatment">
      <span className="colorlab__treatmentlabel">{label}</span>
      <div className="colorlab__treatmentbox">
        <div className="colorlab__logobox colorlab__logobox--gloss" style={logoboxStyle}>
          <TreatmentLogo teamId={teamId} name={name} treatment={treatment} override={override} />
        </div>
        <div className="colorlab__swatchrow">
          {slots.map((s, i) => (
            <ColorSwatch key={i} swatch={s} active={i === activeBgIndex} />
          ))}
        </div>
      </div>
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
