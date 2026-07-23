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
  return abbr ? `/team-logos/${treatment}/${abbr}.png` : null
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

// A first pass at 29 clubs' Main tile as it'd look with a colored background
// (the real card, and every other row on this page, uses a plain paper
// fill) — each entry names which of the three swatches above becomes the
// tile's background, an optional scale-down off the card's normal 1.32
// edge-bleed (a large/dense mark reading as "the whole tile is this color"
// against its own brand fill), and whether the mark itself needed a
// recolor (see public/team-logos/main-overrides/{ABBR}.svg — the mlbstatic
// CDN mark with specific fills swapped, e.g. Guardians' navy outline ->
// white, Phillies' red/white swapped) to stay legible against its new
// background. Diamondbacks has no entry — not part of this pass.
const MAIN_OVERRIDES = {
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
// Keyed by teamId, each value up to 3 { label, hex } entries in Primary/
// Secondary/Third order. A team with no entry yet (or an entry short of 3)
// renders the missing slot(s) as a placeholder swatch, same as a missing logo.
const ALT_COLORS = {}

const CITY_CONNECT_COLORS = {}

function colorsFor(teamId, treatmentKey) {
  if (treatmentKey === 'main') return mainColorTriad(teamId)
  if (treatmentKey === 'alternate') return ALT_COLORS[teamId] ?? []
  return CITY_CONNECT_COLORS[teamId] ?? []
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
  const activeBgIndex = override ? BG_ROLE_INDEX[override.bg] : -1

  const logoboxStyle = override
    ? {
        '--tint': colors[activeBgIndex]?.hex,
        '--scale': 1.32 * (override.scale ?? 1),
      }
    : undefined

  return (
    <div className="colorlab__treatment">
      <span className="colorlab__treatmentlabel">{label}</span>
      <div className="colorlab__treatmentbox">
        <div className="colorlab__logobox" style={logoboxStyle}>
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
