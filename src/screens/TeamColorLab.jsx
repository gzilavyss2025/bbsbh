import { useEffect, useState } from 'react'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import {
  ALL_MLB_TEAM_IDS,
  teamFullName,
  teamClubName,
  teamColorSwatches,
  teamLogoUrl,
  ALT_COLORS,
  ALT2_COLORS,
  ALT3_COLORS,
  CITY_CONNECT_COLORS,
  TREATMENT_SCALE,
  MAIN_OVERRIDES,
  mainOverrideLogoUrl,
  mainTreatmentPinstripeColor,
  treatmentPinstripeColor,
  hasAlternate2,
  hasAlternate3,
  hasCityConnect,
} from '../lib/teams.js'
import { fetchTeamUniformCatalog, classifyUniformAsset, jerseyLabel } from '../api/uniforms.js'

// Main already has a reliable source — the mlbstatic CDN this app uses
// everywhere else (components/TeamLogo.jsx) — so only Alternate and City
// Connect are locally procured, hand-cropped transparent PNGs (localLogoUrl,
// teams.js — same convention TeamLogo's 'alternate'/'city-connect' variants
// use for the home-page game cards). Order here is also render order per team.
const TREATMENTS = [
  { key: 'main', label: 'Main' },
  { key: 'alternate', label: 'Alternate' },
  { key: 'alternate-2', label: 'Alternate 2' },
  { key: 'alternate-3', label: 'Alternate 3' },
  { key: 'city-connect', label: 'City Connect' },
]

// ALT_COLORS/CITY_CONNECT_COLORS/TREATMENT_SCALE (per-treatment tile
// background swatches + the edge-bleed scale-downs a few dense marks need
// against a real fill) now live in teams.js — the home-page game card reads
// the same curated set (treatmentBgColor/treatmentScale) so a color tuned
// here shows up there too, with no second copy to drift.

// Per-team, per-treatment horizontal nudge (percent of the tile's own width,
// negative = left) for a mark whose visual weight sits off-center once scaled
// up — CSS translateX on .colorlab__logoimg/.teamlogo, applied before scale.
// Page-local only (unlike TREATMENT_SCALE above) — no other surface renders
// these tiles large enough for the off-center weight to matter yet.
const TREATMENT_OFFSET_X = {
  139: { alternate: -12 }, // Rays — the enlarged mark reads better shifted left
}

// Per-team, per-treatment vertical anchor for the edge-bleed scale-up — CSS
// transform-origin-y on .colorlab__logoimg/.teamlogo. Default 'center' bleeds
// evenly off all four edges; 'top' anchors the mark to the top of the tile so
// the overscale only bleeds off the bottom, keeping the mark's full size
// without clipping its top/sides. Page-local only, same footing as
// TREATMENT_OFFSET_X above.
const TREATMENT_ORIGIN_Y = {
  109: { alternate: '10%' }, // Diamondbacks — anchored just below the top so the teal border only just clips, most of the bleed still goes to the bottom
}

// A proposed replacement for a team's Primary swatch, tried out on this page
// only — teams.js's TEAM_COLOR_PAIRS/TEAM_COLORS (the real app-wide source
// every other surface reads) is untouched. Applied to the Main triad
// (mainColorTriad below); teams.js's ALT_COLORS[115] carries the same hex as
// a literal so the Main and Alternate tiles here can't drift onto two
// different "Primary" purples.
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

// MAIN_OVERRIDES (a first pass at every club's Main tile as it'd look with a
// colored background — names which swatch becomes the tile fill, an optional
// scale-down for a large/dense mark, and whether the mark itself needed a
// recolor) plus mainOverrideLogoUrl now live in teams.js — the home-page game
// card wears the exact same tile fill/scale/recolor this page prototyped, no
// second copy to drift.
const BG_ROLE_INDEX = { primary: 0, secondary: 1, third: 2 }

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
  const colors =
    treatmentKey === 'alternate'
      ? ALT_COLORS[teamId]
      : treatmentKey === 'alternate-2'
        ? ALT2_COLORS[teamId]
        : treatmentKey === 'alternate-3'
          ? ALT3_COLORS[teamId]
          : CITY_CONNECT_COLORS[teamId]
  return colors ? withMainRoleLabels(teamId, colors) : []
}

// Hand-tuned corrections where a jersey's own catalog naming doesn't match
// which logo it's actually paired with on the field — classifyUniformAsset's
// naming-convention guess is right for the other ~29 clubs but not every
// exception. Keyed by uniformAssetCode (stable within a season, unlike the
// label text) so a wording tweak next season can't silently mis-target this.
const JERSEY_TREATMENT_OVERRIDES = {
  '112_jersey_4_2026': 'alternate-2', // Cubs Alt 2 Baby Blue — worn with the Alternate 2 mark (moved off City Connect)
  '112_jersey_2_2026': 'alternate', // Cubs Away Grey — worn with the Alternate mark, not plain Main
  '133_jersey_4_2026': 'city-connect', // Athletics Alt 2 Yellow "Sacramento" — worn with the City Connect mark
  '144_jersey_4_2026': 'main', // Braves Alt 2 Navy — worn with the plain Main mark
  '146_jersey_3_2026': 'alternate-2', // Marlins Alt 1 Black — worn with the Alternate 2 mark
  '146_jersey_1_2026': 'alternate', // Marlins Home White — worn with the Alternate mark, not plain Main
  '146_jersey_4_2026': 'alternate-3', // Marlins Alt 2 Teal — worn with the Alternate 3 mark
  '147_jersey_2_2026': 'alternate', // Yankees Away Grey — worn with the Alternate mark, not plain Main
  '118_jersey_4_2026': 'main', // Royals Alt 1 Royal Blue — worn with the plain Main mark
  '118_jersey_2_2026': 'alternate-2', // Royals Away Grey — worn with the Alternate 2 mark
  '158_jersey_4_2026': 'alternate-2', // Brewers Alt 2 Navy Blue — worn with the Alternate 2 mark
  '108_jersey_2_2026': 'alternate', // Angels Away Grey — worn with the Alternate mark, not plain Main
  '138_jersey_3_2026': 'alternate-2', // Cardinals Alt 1 Cream — worn with the Alternate 2 mark
  '136_jersey_1_2026': 'alternate', // Mariners Home White — worn with the Alternate mark, not plain Main
  '136_jersey_3_2026': 'main', // Mariners Alt 1 Teal — worn with the plain Main mark
  '136_jersey_2_2026': 'alternate-2', // Mariners Away Navy — worn with the Alternate 2 mark
  '136_jersey_4_2026': 'alternate-3', // Mariners Steelheads Alt 2 Cream — worn with the Alternate 3 mark
  '137_jersey_4_2026': 'alternate-2', // Giants Alt 2 Black "Gigantes" — worn with the Alternate 2 mark (moved off City Connect)
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

// Design harness for reviewing each club's three logo treatments — Main,
// Alternate, City Connect — side by side with their official brand colors.
// Reached at /team-color-lab in production too, but linked from nowhere
// (unlisted, like /game-notes-debug — see lib/route.js) — no score/reveal
// content here, so there's no spoiler risk in shipping it. Logos and
// Alternate/City Connect colors are filled in as the user procures them;
// anything missing renders as a wireframe placeholder rather than blocking
// the page.
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
        An unlisted design harness — not linked anywhere in the app. Each
        club’s Main, Alternate, and City Connect logo treatment with its
        three brand colors. Missing logos or colors show as a placeholder
        until supplied.
      </p>

      <div className="colorlab__layout">
        <nav className="colorlab__nav" aria-label="Jump to team">
          {teams.map((id) => (
            <a key={id} className="colorlab__navlink" href={`#${teamAnchorId(id)}`} title={teamFullName(id)}>
              <TeamLogo teamId={id} name={teamFullName(id)} size={28} />
            </a>
          ))}
        </nav>
        <div className="colorlab">
          {teams.map((id) => (
            <TeamColorRow key={id} teamId={id} catalog={catalog} />
          ))}
        </div>
      </div>
    </div>
  )
}

// Anchor id for a team's row — shared by the row itself and the pinned
// sidebar's jump links (colorlab__nav) so the two never drift apart.
function teamAnchorId(teamId) {
  return `colorlab-team-${teamId}`
}

function TeamColorRow({ teamId, catalog }) {
  const name = teamFullName(teamId)
  // Alternate 2/3 are opt-in per team (unlike Main/Alternate/City Connect,
  // which every club eventually gets) — skip the tile entirely for a team
  // with none set up, rather than showing an empty placeholder. City Connect
  // is skipped outright for a team with no real one (hasCityConnect), same
  // idea but permanent rather than "not procured yet".
  const treatments = TREATMENTS.filter(
    (t) =>
      (t.key !== 'alternate-2' || hasAlternate2(teamId)) &&
      (t.key !== 'alternate-3' || hasAlternate3(teamId)) &&
      (t.key !== 'city-connect' || hasCityConnect(teamId)),
  )
  return (
    <section className="colorlab__row" id={teamAnchorId(teamId)}>
      <h2 className="colorlab__teamname">{name}</h2>
      <div className="colorlab__treatments">
        {treatments.map((t) => (
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
  const pinstripeColor = treatment === 'main'
    ? override?.pinstripe
      ? mainTreatmentPinstripeColor(teamId)
      : null
    : treatmentPinstripeColor(teamId, treatment)
  // Main picks its tile background from one of the three official swatches
  // (MAIN_OVERRIDES names which) or a literal `bgHex` (Brewers); Alternate/
  // City Connect flag whichever of their user-supplied swatches is the
  // background directly (see ALT_COLORS/CITY_CONNECT_COLORS' `bg: true`).
  const activeBgIndex = override?.pinstripe || override?.bgHex || pinstripeColor
    ? -1 // a hand-styled/literal background (see below), not one of the three brand swatches
    : override
      ? BG_ROLE_INDEX[override.bg]
      : colors.findIndex((c) => c?.bg)

  const tint = override?.bgHex ?? (activeBgIndex >= 0 ? colors[activeBgIndex]?.hex : undefined)
  const treatmentScale = override?.scale ?? TREATMENT_SCALE[teamId]?.[treatment] ?? 1
  const treatmentOffsetX = TREATMENT_OFFSET_X[teamId]?.[treatment] ?? 0
  const treatmentOriginY = TREATMENT_ORIGIN_Y[teamId]?.[treatment] ?? 'center'
  const logoboxStyle =
    tint || override || pinstripeColor || treatmentOffsetX || treatmentOriginY !== 'center'
      ? {
          '--tint': tint,
          '--scale': 1.32 * treatmentScale,
          '--offset-x': `${treatmentOffsetX}%`,
          '--origin-y': treatmentOriginY,
          '--pinstripe-color': pinstripeColor ?? undefined,
        }
      : undefined
  const logoboxClass = `colorlab__logobox colorlab__logobox--gloss${pinstripeColor ? ' colorlab__logobox--pinstripe' : ''}`

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
      : teamLogoUrl(teamId, treatment)
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
