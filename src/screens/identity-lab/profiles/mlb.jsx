/* eslint-disable react-refresh/only-export-components -- a profile module's
   public surface is its descriptor object, not the components inside it; the
   components are local by design. Fast Refresh falls back to a full reload for
   this dev-only lab, which is a fine trade for keeping each dimension's data,
   copy text, and tiles in one readable file. */
import { useEffect, useState } from 'react'
import { TeamLogo } from '../../../components/TeamLogo.jsx'
import { NeutralSwatchesSidebar } from '../NeutralSwatchesSidebar.jsx'
import {
  DEFAULT_PINSTRIPE_COLOR,
  wpaBandColor,
  wpaBandPinstripeColor,
  wpaBandPinstripeBg,
} from '../../../lib/wpaBandColors.js'
import { WPA_TUNING, WPA_OWN_ART, wpaLogoLayout } from '../../../lib/wpaLogo.js'
import { MLB_TEAM_COLORS } from '../../../lib/brandColors.js'
import {
  ALL_MLB_TEAM_IDS,
  teamFullName,
  teamClubName,
  teamColorExtras,
  teamLogoUrl,
  ALT_COLORS,
  ALT2_COLORS,
  ALT3_COLORS,
  ALT4_COLORS,
  CITY_CONNECT_COLORS,
  MLB_TREATMENT_TUNING,
  TREATMENT_SCALE,
  MAIN_OVERRIDES,
  mainOverrideLogoUrl,
  mainTreatmentPinstripeColor,
  treatmentPinstripeColor,
  treatmentPinstripeBg,
  treatmentOffsetX,
  treatmentOffsetY,
  treatmentOriginY,
  hasAlternate2,
  hasAlternate3,
  hasAlternate4,
  hasCityConnect,
  treatmentHeaderColorOverride,
  treatmentTuningRecord,
} from '../../../lib/teams.js'
import { logoUploadTarget, wpaArtTreatmentKey, wpaArtUrl } from '../../../lib/logoArt.js'
import { contrastRatio } from '../../../lib/contrast.js'
import { fetchJerseysData, jerseyWearDates } from '../../../api/jerseys.js'
import { fetchTeamSchedule } from '../../../api/schedule.js'
import { gamePhotosPath } from '../../../lib/route.js'
import { useNav } from '../../../lib/nav.js'
import {
  fetchTeamUniformCatalog,
  classifyUniformAsset,
  jerseyLabel,
  fetchUniformNameOverrides,
  primeUniformNameOverridesCache,
  uniformNameOverridesLoaded,
  uniformNamesSaveBody,
  uniformDisplayName,
} from '../../../api/uniforms.js'
import { TreatmentBox } from '../TreatmentBox.jsx'
import { LogoDropZone } from '../LogoDropZone.jsx'
import { draftFieldsMatchLanded } from '../useDraftStore.js'
import { mergeDraftIntoStore, mergeTeamDraftIntoStore } from '../saveStores.js'
import {
  COLOR_ROLES,
  COLOR_ROLE_LABELS,
  applyColorsDraft,
  colorsDraftMatchesLanded,
  TREATMENT_COLOR_ROLES,
  TREATMENT_COLOR_ROLE_LABELS,
  applyTreatmentColorsDraft,
} from './mlbColorRoles.js'

// The MLB dimension: each club's logo treatments side by side with their brand
// colors, the catalog jersey(s) each maps to, and that treatment's WPA band.
// Main already has a reliable source — the mlbstatic CDN this app uses
// everywhere else — so only Alternate/City Connect are locally procured,
// hand-cropped transparent PNGs (teams.js's localLogoUrl). Order here is also
// render order per team.
const TREATMENTS = [
  { key: 'main', label: 'Main' },
  { key: 'alternate', label: 'Alternate' },
  { key: 'alternate-2', label: 'Alternate 2' },
  { key: 'alternate-3', label: 'Alternate 3' },
  { key: 'alternate-4', label: 'Alternate 4' },
  { key: 'city-connect', label: 'City Connect' },
]

// Alternate 2/3/4 are opt-in per team (unlike Main/Alternate/City Connect,
// which every club eventually gets) — skip the tile entirely for a team with
// none set up. City Connect is skipped outright for a team with no real one,
// same idea but permanent rather than "not procured yet".
function treatmentsForTeam(teamId) {
  return TREATMENTS.filter(
    (t) =>
      (t.key !== 'alternate-2' || hasAlternate2(teamId)) &&
      (t.key !== 'alternate-3' || hasAlternate3(teamId)) &&
      (t.key !== 'alternate-4' || hasAlternate4(teamId)) &&
      (t.key !== 'city-connect' || hasCityConnect(teamId)),
  )
}

// The Main triad's three role keys live in mlbColorRoles.js alongside the
// clear-a-swatch rules that have to agree with them — see that file for why the
// third role is `accent` rather than `third`, and why an Accent chip repeating
// the Primary or Secondary is correct rather than a duplicate to dedupe away.
// A club's real third-or-later brand colors are the separate `extras` list
// (teamColorExtras), appended after the triad by mainSwatches below.

// A team's Main-treatment Primary/Secondary/Accent, landed value with any live
// draft layered on top — mlb-team-colors.json is the one source both the tile
// and teams.js's real TEAM_COLOR_PAIRS/TEAM_COLORS resolvers read (src/lib/CLAUDE.md),
// so an edit here and the real app tint can never disagree. Always three
// slots, in role order, even when a role is blank — editing needs a stable
// slot-to-role mapping, which a dedup/filter (the old teamColorSwatches) can't
// guarantee.
function resolveColorTriad(teamId, draft) {
  const landed = MLB_TEAM_COLORS[teamId] ?? {}
  return COLOR_ROLES.map((role) => ({
    role,
    label: COLOR_ROLE_LABELS[role],
    hex: draft?.[role] ?? landed[role] ?? '',
  }))
}

// A (team, treatment)'s four editable color slots, landed value with any live
// draft layered on top — mlb-treatment-tuning.json's `colors` field, one
// independent set per treatment (Main included — see mlbColorRoles.js's
// comment on why this is a separate thing from Main's club-wide triad).
function resolveTreatmentColorSlots(teamId, treatment, draft) {
  const landed = treatmentTuningRecord(teamId, treatment)?.colors ?? {}
  return TREATMENT_COLOR_ROLES.map((role) => ({
    role,
    label: TREATMENT_COLOR_ROLE_LABELS[role],
    hex: draft?.[role] ?? landed[role] ?? '',
  }))
}

// The Main tile's full swatch row: the three editable role slots, then the
// club's researched extras (teamColorExtras — Angels Silver, Giants Cream…).
// Extras are read-only and deduped against the triad, since an extra whose hex
// merely restates a role IS redundant — unlike the Accent slot, which has to
// hold its position even when it repeats, or editing loses its stable
// slot-to-role mapping. Showing them at all is the point of storing them:
// before, an extra reached the tile only by the accident of a dedupe dropping
// the accent, so most of the research was invisible.
function mainSwatches(teamId, draft) {
  const triad = resolveColorTriad(teamId, draft)
  const seen = new Set(triad.map((c) => c.hex.toLowerCase()).filter(Boolean)) // caps-js-exempt
  const extras = []
  for (const e of teamColorExtras(teamId)) {
    const key = e.hex.toLowerCase() // caps-js-exempt
    if (seen.has(key)) continue
    seen.add(key)
    extras.push({ role: null, label: e.label, hex: e.hex })
  }
  return [...triad, ...extras]
}

const BG_ROLE_INDEX = { primary: 0, secondary: 1, accent: 2, third: 2, accent2: 3 }

// A plain "Background" swatch (the common case — just describes the tile fill,
// no color identity of its own) gets relabeled to Primary/Secondary/Accent (or
// a researched extra's own name) when its hex is one of that same club's
// Main-treatment colors — e.g. the Brewers' Alternate background is their Main
// Powder Blue extra. Same color, so it should read as the same swatch, not a
// second unrelated one. An entry with its own explicit label already (e.g.
// Diamondbacks City Connect's Primary/Secondary, a distinct identity unrelated
// to their Main triad) is left alone.
function withMainRoleLabels(teamId, colors) {
  const main = mainSwatches(teamId, null).filter((c) => c.hex)
  return colors.map((c) => {
    if (c.label !== 'Background') return c
    const match = main.find((m) => m.hex.toLowerCase() === c.hex.toLowerCase()) // caps-js-exempt
    return match ? { ...c, label: match.label } : c
  })
}

function colorsFor(teamId, treatmentKey) {
  if (treatmentKey === 'main') return mainSwatches(teamId, null).filter((c) => c.hex)
  const colors =
    treatmentKey === 'alternate'
      ? ALT_COLORS[teamId]
      : treatmentKey === 'alternate-2'
        ? ALT2_COLORS[teamId]
        : treatmentKey === 'alternate-3'
          ? ALT3_COLORS[teamId]
          : treatmentKey === 'alternate-4'
            ? ALT4_COLORS[teamId]
            : CITY_CONNECT_COLORS[teamId]
  return colors ? withMainRoleLabels(teamId, colors) : []
}

// Which jersey(s) in the uniforms CATALOG (as opposed to a single game's worn
// assignment) correspond to a given tile — the cross-reference this dimension
// exists to answer. Every club's catalog jersey label self-identifies as
// Home/Away/Road, "Alt N …", or "City Connect …" (verified against a live 2026
// pull for all 30 clubs — classifyUniformAsset), so this needs no per-team
// hand-authoring beyond the rare exceptions JERSEY_TREATMENT_OVERRIDES covers
// (src/api/uniforms.js — shared with gen-jerseys.mjs's live game-card
// classification, so a jersey match here can't drift from what the real card
// renders). `null` means the catalog hasn't loaded yet (still fetching, or an
// MLB-only endpoint miss); an empty array is a loaded catalog with no jersey in
// that bucket.
function jerseyMatchesFor(catalog, teamId, treatmentKey) {
  const assets = catalog[teamId]
  if (!assets) return null
  const clubName = teamClubName(teamId)
  return assets
    .filter((a) => a.piece === 'J' && classifyUniformAsset(a.text, clubName, a.code) === treatmentKey)
    .map((a) => ({ label: jerseyLabel(a.text, clubName), code: a.code ?? null, text: a.text }))
}

// The tile's Position-panel state — override chain (bgHex/bg role/curated
// swatch), the landed scale/offset tuning, and any live draft, all merged in
// ONE place so the tile's own rendering and the page-level "copy all changes"
// button can never resolve a different answer for the same (team, treatment,
// draft) triple. `posDraft` is null for a landed/no-draft read (used by the
// auto-clear sweep to compare against what's already on disk).
function resolvePositionState(teamId, treatment, posDraft, colors) {
  const override = treatment === 'main' ? MAIN_OVERRIDES[teamId] : null
  const pinstripeColor =
    treatment === 'main'
      ? override?.pinstripe
        ? mainTreatmentPinstripeColor(teamId)
        : null
      : treatmentPinstripeColor(teamId, treatment)
  // undefined (not '') for Main — the data model has no fill-color concept for
  // Main's pinstripe (MAIN_OVERRIDES' pinstripe is line-color only), and
  // LogoPositionControls gates its new "Fill" field on this being defined.
  const pinstripeBg =
    treatment === 'main' ? undefined : posDraft?.pinstripeBg ?? treatmentPinstripeBg(teamId, treatment) ?? ''
  const activeBgIndex = override?.bgHex || pinstripeColor
    ? -1
    : override
      ? BG_ROLE_INDEX[override.bg]
      : colors.findIndex((c) => c?.bg)
  const tint = override?.bgHex ?? (activeBgIndex >= 0 ? colors[activeBgIndex]?.hex : undefined)
  const scale = posDraft?.scale ?? override?.scale ?? TREATMENT_SCALE[teamId]?.[treatment] ?? 1
  const offsetX = posDraft?.offsetX ?? treatmentOffsetX(teamId, treatment)
  const offsetY = posDraft?.offsetY ?? treatmentOffsetY(teamId, treatment)
  const pinstripe = posDraft?.pinstripe ?? Boolean(pinstripeColor)
  const bg = pinstripe ? posDraft?.bg || pinstripeColor || DEFAULT_PINSTRIPE_COLOR : posDraft?.bg || tint
  return { override, pinstripeColor, pinstripeBg, activeBgIndex, tint, scale, offsetX, offsetY, pinstripe, bg: bg ?? '' }
}

// Same idea for the WPA-preview panel's pinstripe/band-color state — the real
// chart's own fallback chain with any live draft layered on top.
function resolveWpaBandState(teamId, treatment, wpaDraft) {
  const pinstripeDefault = wpaBandPinstripeColor(teamId, treatment)
  const pinstripe = wpaDraft?.pinstripe ?? Boolean(pinstripeDefault)
  const band = wpaDraft?.bandColor ?? (pinstripe ? pinstripeDefault ?? DEFAULT_PINSTRIPE_COLOR : wpaBandColor(teamId, treatment))
  // The colored fill under the stripes — not named `bg`, which the Position
  // panel's own unrelated field already owns on this same tile.
  const bandBg = wpaDraft?.bandBg ?? wpaBandPinstripeBg(teamId, treatment) ?? ''
  return { pinstripe, band, bandBg }
}

// Whether this (team, treatment)'s WPA band has opted OUT of the shared mark
// in favor of a separately uploaded WPA-only PNG — resolved in ONE place
// (same rule resolveWpaBandState above already follows) so the tile, the
// copy text, and the auto-clear matcher below can never disagree.
function resolveWpaOwnArt(teamId, treatment, wpaDraft) {
  return wpaDraft?.ownArt ?? Boolean(WPA_OWN_ART[teamId]?.[treatment])
}

// The merged Size/Rotate/X/Y/H-Pad/V-Pad/Shift% for a (team, treatment) — a
// draft field wins outright over the landed layout, same "draft overrides
// curated default" pattern as the position controls. Shared by the WPA editor's
// own fields AND the scenario mockups, so an in-progress edit shows up in both.
function resolvedWpaLayout(teamId, treatment, draft) {
  const d = wpaLogoLayout(teamId, treatment)
  return {
    size: draft?.size ?? d.size,
    rotate: draft?.rotate ?? d.rotate,
    offsetX: draft?.offsetX ?? d.offsetX,
    offsetY: draft?.offsetY ?? d.offsetY,
    paddingX: draft?.paddingX ?? d.paddingX,
    paddingY: draft?.paddingY ?? d.paddingY,
    rowShift: draft?.rowShift ?? d.rowShift,
  }
}

// Seeds for the header editor when neither a draft nor this tile's own lead
// swatches supply one — the app's current navy/kraft-amber brand pair (--navy /
// --seal, tokens/colors.css) and its light on-ink text color (--paper-2),
// copied as literals since a JS default can't reach into CSS custom properties.
// These are the same three DEFAULT_CHROME (lib/headerTheme.js) falls back to
// for an unlanded tile, so the editor's starting point and the app's fallback
// can't drift.
const DEFAULT_HEADER_BAR = '#1B2A3A'
const DEFAULT_HEADER_ACCENT = '#B5824A'
const DEFAULT_HEADER_ON_BAR = '#FBF6E9'

// Shared by the header editor AND the WPA scenario mockups above it, so the
// mockups' own header bars use the EXACT same resolved Bar/Accent/On-bar the
// Header colors panel shows. Priority: a live draft edit, then a landed
// TREATMENT_HEADER_COLOR_OVERRIDES entry, then this tile's own lead swatches,
// then the app's brand pair.
// `||` rather than `??` on the swatch hexes: a Main role the owner has cleared
// is `''`, not nullish, so `??` would hand an empty string to the preview
// instead of falling through to the default bar/accent.
function headerColorsFor(colors, draft, override) {
  return {
    bar: draft?.bar ?? override?.bar ?? (colors[0]?.hex || DEFAULT_HEADER_BAR),
    accent: draft?.accent ?? override?.accent ?? (colors[1]?.hex || DEFAULT_HEADER_ACCENT),
    onBar: draft?.onBar ?? override?.onBar ?? DEFAULT_HEADER_ON_BAR,
  }
}

// ---------------------------------------------------------------------------
// Copy-text builders. Kept even though Save now lands most of these directly:
// the background hex for a non-Main treatment lands in the colour tables
// (ALT_COLORS and friends), which are still JS literals, and the
// "copy all changes" button is still how a session's worth of poking gets
// summarized into a prompt.

const TREATMENT_COLOR_TABLE_NAME = {
  alternate: 'ALT_COLORS',
  'alternate-2': 'ALT2_COLORS',
  'alternate-3': 'ALT3_COLORS',
  'alternate-4': 'ALT4_COLORS',
  'city-connect': 'CITY_CONNECT_COLORS',
}

function bgOverrideLocation(teamId, treatment, pinstripe) {
  if (pinstripe) {
    return treatment === 'main'
      ? `src/lib/data/mlb-treatment-tuning.json — ${teamId}.treatments.main.pinstripe: true (the line color itself is the shared default unless pinstripeColor curates a per-team one)`
      : `src/lib/data/mlb-treatment-tuning.json — ${teamId}.treatments.${treatment}.pinstripeColor (plus pinstripeBg to also set the fill under the stripes)`
  }
  const table = TREATMENT_COLOR_TABLE_NAME[treatment]
  if (table) return `src/lib/teams.js — ${table}[${teamId}], the swatch flagged \`bg: true\` (background)`
  return (
    `src/lib/data/mlb-treatment-tuning.json — ${teamId}.treatments.main.bgHex (a literal), or if it should ` +
    `instead track one of the club's three brand swatches, ${teamId}.treatments.main.bg ` +
    `('primary'/'secondary'/'accent', see src/lib/data/mlb-team-colors.json)`
  )
}

function buildPosCopyText(name, teamId, treatment, treatmentLabel, scale, offsetX, offsetY, bg, pinstripe) {
  return (
    `Team: ${name} (id ${teamId})\n` +
    `Treatment: ${treatmentLabel}\n` +
    `Where: src/lib/data/mlb-treatment-tuning.json — ${teamId}.treatments.${treatment} ` +
    `(scale / offsetX / offsetY) / ${bgOverrideLocation(teamId, treatment, pinstripe)}\n` +
    `scale: ${scale}, offsetX: ${offsetX}, offsetY: ${offsetY}, ` +
    (pinstripe ? `pinstripe: true, color: ${bg || '(none)'}` : `background: ${bg || '(none)'}`)
  )
}

function buildWpaCopyText(name, teamId, treatment, treatmentLabel, layout, pinstripe, bandColor, ownArt) {
  const { size, rotate, offsetX, offsetY, paddingX, paddingY, rowShift } = layout
  const band = pinstripe ? `{ "pinstripe": true, "color": "${bandColor}" }` : `"${bandColor}"`
  return (
    `Team: ${name} (id ${teamId})\n` +
    `Treatment: ${treatmentLabel}\n` +
    `Where: src/lib/data/wpa-tuning.json — ${teamId}.treatments.${treatment}\n` +
    `"layout": { "size": ${size}, "rotate": ${rotate}, "offsetX": ${offsetX}, "offsetY": ${offsetY}, ` +
    `"paddingX": ${paddingX}, "paddingY": ${paddingY}, "rowShift": ${rowShift} }\n` +
    `"band": ${band}\n` +
    `"ownArt": ${ownArt}` +
    (ownArt ? ` (uploaded WPA-only mark: ${wpaArtUrl(teamId, treatment) ?? '(none uploaded yet)'})` : '')
  )
}

function buildHeaderCopyText(name, teamId, treatment, treatmentLabel, colors) {
  const { bar, accent, onBar } = colors
  return (
    `Team: ${name} (id ${teamId})\n` +
    `Treatment: ${treatmentLabel}\n` +
    `Where: src/lib/data/mlb-treatment-tuning.json — ${teamId}.treatments.${treatment}.header ` +
    `(drives the lineup page's club bar + section mastheads — ADR-0030)\n` +
    `bar: ${bar}, accent: ${accent}, onBar: ${onBar}\n` +
    `onBar vs bar: ${contrastRatio(onBar, bar).toFixed(2)}:1 (scripts/check-contrast.mjs needs 4.5:1)`
  )
}

function buildColorsCopyText(name, teamId, triad) {
  const byRole = Object.fromEntries(triad.map((c) => [c.role, c.hex]))
  return (
    `Team: ${name} (id ${teamId})\n` +
    `Where: src/lib/data/mlb-team-colors.json — ${teamId}\n` +
    `primary: ${byRole.primary || '(none)'}, secondary: ${byRole.secondary || '(none)'}, ` +
    `accent: ${byRole.accent || '(none)'}`
  )
}

function buildTreatmentColorsCopyText(name, teamId, treatment, treatmentLabel, slots) {
  const byRole = Object.fromEntries(slots.map((s) => [s.role, s.hex]))
  return (
    `Team: ${name} (id ${teamId})\n` +
    `Treatment: ${treatmentLabel}\n` +
    `Where: src/lib/data/mlb-treatment-tuning.json — ${teamId}.treatments.${treatment}.colors\n` +
    `primary: ${byRole.primary || '(none)'}, secondary: ${byRole.secondary || '(none)'}, ` +
    `accent1: ${byRole.accent1 || '(none)'}, accent2: ${byRole.accent2 || '(none)'}`
  )
}

// Scans every team's four draft stores and concatenates the same copy-text
// snippet each individual field's own copy icon would produce, in team-list
// order — answers "what all did I change" without re-opening every row.
// Colors is team-level, not per-treatment, so it's checked once per team
// rather than inside the treatment loop below.
function buildAllChangesText(teams, drafts, extras) {
  const sections = []
  for (const team of teams) {
    const teamId = team.id
    const name = teamFullName(teamId)
    const cd = drafts.colors[teamId]
    if (cd && Object.keys(cd).length > 0) {
      sections.push(buildColorsCopyText(name, teamId, resolveColorTriad(teamId, cd)))
    }
    for (const t of treatmentsForTeam(teamId)) {
      const matches = jerseyMatchesFor(extras.catalog, teamId, t.key)
      const treatmentLabel = matches?.[0]?.label ?? t.label
      const colors = colorsFor(teamId, t.key)

      const pd = drafts.pos[teamId]?.[t.key]
      if (pd && Object.keys(pd).length > 0) {
        const { scale, offsetX, offsetY, pinstripe, bg } = resolvePositionState(teamId, t.key, pd, colors)
        sections.push(buildPosCopyText(name, teamId, t.key, treatmentLabel, scale, offsetX, offsetY, bg, pinstripe))
      }
      const wd = drafts.wpa[teamId]?.[t.key]
      if (wd && Object.keys(wd).length > 0) {
        const layout = resolvedWpaLayout(teamId, t.key, wd)
        const { pinstripe, band } = resolveWpaBandState(teamId, t.key, wd)
        const ownArt = resolveWpaOwnArt(teamId, t.key, wd)
        sections.push(buildWpaCopyText(name, teamId, t.key, treatmentLabel, layout, pinstripe, band, ownArt))
      }
      const hd = drafts.header[teamId]?.[t.key]
      if (hd && Object.keys(hd).length > 0) {
        const resolvedColors = headerColorsFor(colors, hd, treatmentHeaderColorOverride(teamId, t.key))
        sections.push(buildHeaderCopyText(name, teamId, t.key, treatmentLabel, resolvedColors))
      }
      const tcd = drafts.tcolors[teamId]?.[t.key]
      if (tcd && Object.keys(tcd).length > 0) {
        const slots = resolveTreatmentColorSlots(teamId, t.key, tcd)
        sections.push(buildTreatmentColorsCopyText(name, teamId, t.key, treatmentLabel, slots))
      }
    }
  }
  return sections.join('\n\n')
}

// ---------------------------------------------------------------------------

// Which URL the app itself would render for this tile — the CDN base mark for a
// plain Main, a hand-recolored override, a procured local file, or (for a club
// in one of teams.js's *_USES_BASE_LOGO sets) the CDN mark again. `null` means
// Main's plain TeamLogo, which builds its own URL.
function treatmentLogoUrl(teamId, treatment, override) {
  if (treatment === 'main') return override?.recolor ? mainOverrideLogoUrl(teamId) : null
  return teamLogoUrl(teamId, treatment)
}

// Every mark this club is actually rendered with somewhere on the site —
// the collapsed row's own quick "what have we got" strip (TeamLabRow's
// `logos` prop), so a reviewer can eyeball coverage without expanding every
// tile. One entry per real treatment (the CDN base mark, a hand-recolored
// Main override, or a procured local PNG — whichever `treatmentLogoUrl`
// resolves for that tile, same as the expanded tile itself renders), PLUS a
// trailing entry for any treatment that's opted into its own separately
// uploaded WPA-only mark (WPA_OWN_ART) — a real, distinct file the owner
// uploaded, even though it never appears as a tile's own logo box.
function rowLogos(teamId) {
  const treatments = treatmentsForTeam(teamId)
  const marks = treatments.map((t) => {
    const override = t.key === 'main' ? MAIN_OVERRIDES[teamId] : null
    return {
      key: t.key,
      label: t.label,
      // treatmentLogoUrl returns null for a plain Main (the real tile falls
      // back to <TeamLogo>, which resolves its own CDN url) — spell that
      // fallback out explicitly here since this strip has no such component.
      url: treatmentLogoUrl(teamId, t.key, override) ?? teamLogoUrl(teamId, 'base'),
    }
  })
  for (const t of treatments) {
    if (!WPA_OWN_ART[teamId]?.[t.key]) continue
    const url = wpaArtUrl(teamId, t.key)
    if (url) marks.push({ key: `${t.key}-wpa`, label: `${t.label} — WPA`, url })
  }
  return marks
}

// `version` counts uploads onto this tile. Vite serves public/ off disk, so a
// dropped file is live immediately — but the browser has the old bytes cached
// under the same URL, so without a changing query the tile would keep showing
// the mark that was just replaced.
function TreatmentLogo({ teamId, name, treatment, override, version = 0 }) {
  const base = treatmentLogoUrl(teamId, treatment, override)
  const url = base && version > 0 ? `${base}?v=${version}` : base
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

// The drop target for a treatment's WPA-only mark (WpaPreview's "Use Logo
// Art" checkbox, unchecked) — same load/error/cache-bust shape as
// TreatmentLogo above, but with no tile-art fallback to render: there's
// nothing here until the owner uploads something.
function WpaArtBox({ teamId, treatment, name, version = 0 }) {
  const base = wpaArtUrl(teamId, treatment)
  const url = base && version > 0 ? `${base}?v=${version}` : base
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])

  if (!url || failed) {
    return (
      <div className="colorlab__logoplaceholder" aria-hidden="true">
        <span>No WPA art yet</span>
      </div>
    )
  }

  return (
    <img
      key={url}
      src={url}
      alt={`${name} — ${treatment} WPA`}
      className="colorlab__logoimg"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}

// A tile whose art file is NOT what the app resolves for it — a club in one of
// teams.js's *_USES_BASE_LOGO sets (the plain CDN mark), one whose art is
// filed as .svg (ALT_LOGO_SVG / the main-overrides default), or a Main tile
// with no `recolor` override. The upload still lands in the right place, but
// the tile keeps rendering what teams.js says, so say so rather than leaving
// the owner staring at an unchanged mark wondering whether the save worked.
function uploadCaveat(teamId, treatment, override, target) {
  if (!target) return null
  const resolved = treatmentLogoUrl(teamId, treatment, override)
  if (resolved === target.url) return null
  return (
    `teams.js still renders ${resolved ?? 'the plain CDN mark'} for this tile — ` +
    'see MAIN_OVERRIDES / ALT_LOGO_SVG / the *_USES_BASE_LOGO sets'
  )
}

// The two halves of "when did this club wear this", fetched once per EXPANDED
// row: the nightly gamePk -> treatment export (module-cached in api/jerseys.js,
// so 30 clubs share one request) and this club's dated schedule. Neither
// carries what the other has — jerseys.json has no dates, the schedule has no
// jerseys — and jerseyWearDates is the join.
//
// Lazy by construction rather than by a flag: TeamLabRow only renders its
// children while the row is EXPANDED, so this hook — called from MlbTiles —
// simply never runs for a collapsed club. Same reasoning as that row's own
// `lastOpponent` fetch: a fresh visit starts every row collapsed, and firing 30
// season-schedule requests on page load to populate links nobody has scrolled
// to would be a poor trade. `null` means "still loading".
function useWearDates(teamId) {
  const [state, setState] = useState({ jerseys: null, schedule: null })
  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchJerseysData(),
      fetchTeamSchedule(teamId, new Date().getFullYear(), 1),
    ]).then(([jerseys, schedule]) => {
      if (!cancelled) setState({ jerseys, schedule })
    })
    return () => {
      cancelled = true
    }
  }, [teamId])
  return state
}

// One club's tiles. A treatment sometimes covers more than one catalog jersey —
// most often Main, when a club has no Away-jersey override and wears both Home
// White and Road Grey under the same plain mark. Rather than cramming N name
// fields into one shared tile, the tile is duplicated once per jersey (same
// colors/logo/drafts — they genuinely share the treatment), each headed by its
// OWN jersey's name, so scrolling surfaces every jersey still needing review
// instead of hiding a second one inside the first's box.
function MlbTiles({ team, lastOpponent, extras, drafts, on }) {
  const teamId = team.id
  const name = team.name
  const wear = useWearDates(teamId)
  const navigate = useNav()
  return treatmentsForTeam(teamId).flatMap((t) => {
    const matches = jerseyMatchesFor(extras.catalog, teamId, t.key)
    const jerseyItems = matches?.length ? matches : [null]
    return jerseyItems.map((jerseyMatch) => (
      <MlbTile
        key={jerseyMatch ? `${t.key}:${jerseyMatch.code ?? jerseyMatch.label}` : t.key}
        teamId={teamId}
        name={name}
        treatment={t.key}
        label={t.label}
        jerseyMatch={jerseyMatch}
        extras={extras}
        lastOpponent={lastOpponent}
        wearDates={{
          dates: wear.jerseys && wear.schedule
            ? jerseyWearDates(wear.jerseys, wear.schedule, teamId, t.key)
            : null,
          onOpen: (gamePk) => navigate(gamePhotosPath(gamePk)),
        }}
        drafts={{
          pos: drafts.pos?.[t.key],
          wpa: drafts.wpa?.[t.key],
          header: drafts.header?.[t.key],
          colors: drafts.colors,
          tcolors: drafts.tcolors?.[t.key],
        }}
        on={on}
      />
    ))
  })
}

function MlbTile({ teamId, name, treatment, label, jerseyMatch, extras, lastOpponent, wearDates, drafts, on }) {
  const isMain = treatment === 'main'
  const colors = isMain ? mainSwatches(teamId, drafts.colors) : colorsFor(teamId, treatment)
  const hasColorsDraft = isMain && drafts.colors && Object.keys(drafts.colors).length > 0
  const treatmentColorSlots = resolveTreatmentColorSlots(teamId, treatment, drafts.tcolors)
  const hasTcolorsDraft = drafts.tcolors && Object.keys(drafts.tcolors).length > 0
  const [artVersion, setArtVersion] = useState(0)
  const [wpaArtVersion, setWpaArtVersion] = useState(0)
  const displayLabel = jerseyMatch?.label ?? label
  // The same curated full name the Uniform Names page edits for this jersey. No
  // code (no art procured for a future-season jersey yet) means nothing to edit
  // against.
  const nameField = jerseyMatch?.code
    ? {
        value:
          extras.nameEdits[jerseyMatch.code] ??
          uniformDisplayName(jerseyMatch.text, teamClubName(teamId), jerseyMatch.code, extras.savedNames),
        onChange: (value) => extras.onNameChange(jerseyMatch.code, value),
      }
    : null
  // Main already comes back as three role slots plus however many extras the
  // club has researched. Every other treatment shows its four Colors-panel
  // slots here too — the SAME treatmentColorSlots the panel below edits, so
  // typing a hex in either place updates both at once (one shared draft, two
  // views onto it), and a filled-in Accent 2 gets its own chip for free.
  const slots = isMain ? colors : treatmentColorSlots

  const {
    override,
    pinstripeBg,
    scale: treatmentScale,
    offsetX: treatmentOffsetXValue,
    offsetY: treatmentOffsetYValue,
    pinstripe: bgPinstripe,
    bg: treatmentBg,
  } = resolvePositionState(teamId, treatment, drafts.pos, colors)
  const originY = treatmentOriginY(teamId, treatment)
  const hasPosDraft = drafts.pos && Object.keys(drafts.pos).length > 0
  const logoboxStyle =
    treatmentBg || override || bgPinstripe || treatmentOffsetXValue || treatmentOffsetYValue || treatmentScale !== 1 || originY !== 'center'
      ? {
          '--tint': bgPinstripe ? undefined : treatmentBg,
          '--scale': 1.32 * treatmentScale,
          '--offset-x': `${treatmentOffsetXValue}%`,
          '--offset-y': `${treatmentOffsetYValue}%`,
          '--origin-y': originY,
          '--pinstripe-color': bgPinstripe ? treatmentBg : undefined,
          '--pinstripe-bg': pinstripeBg || undefined,
        }
      : undefined

  const { pinstripe: wpaPinstripe, band: wpaBand, bandBg: wpaBandBg } = resolveWpaBandState(teamId, treatment, drafts.wpa)
  const wpaLayout = resolvedWpaLayout(teamId, treatment, drafts.wpa)
  const headerLanded = treatmentHeaderColorOverride(teamId, treatment)
  const headerColors = headerColorsFor(colors, drafts.header, headerLanded)
  const wpaOwnArt = resolveWpaOwnArt(teamId, treatment, drafts.wpa)
  const wpaArtKey = wpaArtTreatmentKey(treatment)
  // Absent (no `-wpa` destination — can't happen for a real MLB treatment,
  // but mirrors upload's own `caveat: null` shape) rather than special-cased
  // in WpaPreview, same "absent rather than special-cased" convention
  // TreatmentBox already follows for nameField/upload.
  const artUpload = wpaArtKey ? (
    <LogoDropZone
      teamId={teamId}
      treatment={wpaArtKey}
      label={`${name} ${displayLabel} WPA`}
      onUploaded={() => setWpaArtVersion((v) => v + 1)}
    >
      <div className="colorlab__logobox colorlab__logobox--gloss">
        <WpaArtBox teamId={teamId} treatment={treatment} name={name} version={wpaArtVersion} />
      </div>
    </LogoDropZone>
  ) : null
  // The WpaScenarios mockups' own live preview of "Use Logo Art" — unchecked
  // (a draft in progress, or already landed) means those three chart
  // mockups should tile whatever the owner uploaded, not the tile's normal
  // mark, and reflect a same-session upload immediately (?v= cache-bust,
  // same idea as artVersion above) rather than only after Save. `null` when
  // checked, so WinProbChart falls through to its own normal resolution.
  const wpaMarkOverride =
    wpaOwnArt && wpaArtKey
      ? { src: wpaArtVersion > 0 ? `${wpaArtUrl(teamId, treatment)}?v=${wpaArtVersion}` : wpaArtUrl(teamId, treatment), recolor: null }
      : null

  return (
    <TreatmentBox
      label={displayLabel}
      nameField={nameField}
      logoBox={{
        className: `colorlab__logobox colorlab__logobox--gloss${bgPinstripe ? ' colorlab__logobox--pinstripe' : ''}`,
        style: logoboxStyle,
        children: (
          <TreatmentLogo
            teamId={teamId}
            name={name}
            treatment={treatment}
            override={override}
            version={artVersion}
          />
        ),
      }}
      upload={{
        teamId,
        treatment,
        caveat: uploadCaveat(teamId, treatment, override, logoUploadTarget(teamId, treatment)),
        onUploaded: () => setArtVersion((v) => v + 1),
      }}
      wearDates={wearDates}
      swatches={slots.map((s) => ({
        swatch: s,
        // Compared by hex value, not array position: for Main this still
        // rings whichever of the triad the tile's tint chain actually picked
        // (resolvePositionState's own colors array), and for every other
        // treatment `treatmentBg` no longer shares an array with `slots`
        // (its default comes from the club's own curated fill, not this
        // panel), so index equality can't answer this at all — a Colors edit
        // that happens not to match the current fill correctly rings nothing.
        active: Boolean(s?.hex && treatmentBg && s.hex.toLowerCase() === treatmentBg.toLowerCase()), // caps-js-exempt
        wpaSelected: Boolean(!wpaPinstripe && s?.hex && wpaBand.toLowerCase() === s.hex.toLowerCase()), // caps-js-exempt
        onPickWpaBand: s?.hex
          ? () => {
              // Clicking a swatch always means "flat fill", so it explicitly
              // clears pinstripe rather than recoloring the stripes.
              on.wpaField(treatment, 'pinstripe', false)
              on.wpaField(treatment, 'bandColor', s.hex)
            }
          : undefined,
        // Only a role slot is editable — an extra (Main's researched colors
        // beyond its triad) is research, shown and copyable but not retyped
        // here, and carries no role to write to. Main writes its club-wide
        // triad (mlb-team-colors.json); every other treatment writes its own
        // Colors-panel slot (mlb-treatment-tuning.json) — the identical field
        // the panel below edits, so the two can never show two different
        // values for the same role.
        editable: s?.role
          ? {
              value: s.hex ?? '',
              onChange: (hex) => (isMain ? on.colorField(s.role, hex) : on.tcolorField(treatment, s.role, hex)),
            }
          : undefined,
      }))}
      colorsPanel={
        isMain
          ? { hasDraft: hasColorsDraft, onReset: on.colorReset }
          : { hasDraft: hasTcolorsDraft, onReset: () => on.tcolorReset(treatment) }
      }
      position={{
        name,
        treatmentLabel: displayLabel,
        scale: treatmentScale,
        offsetX: treatmentOffsetXValue,
        offsetY: treatmentOffsetYValue,
        bg: treatmentBg ?? '',
        pinstripe: bgPinstripe,
        pinstripeBg,
        hasDraft: hasPosDraft,
        copyText: buildPosCopyText(
          name,
          teamId,
          treatment,
          displayLabel,
          treatmentScale,
          treatmentOffsetXValue,
          treatmentOffsetYValue,
          treatmentBg,
          bgPinstripe,
        ),
        onField: (field, value) => on.posField(treatment, field, value),
        onReset: () => on.posReset(treatment),
      }}
      wpa={{
        name,
        treatmentLabel: displayLabel,
        layout: wpaLayout,
        pinstripe: wpaPinstripe,
        bandColor: wpaBand,
        bandBg: wpaBandBg,
        ownArt: wpaOwnArt,
        artUpload,
        hasDraft: Boolean(drafts.wpa && Object.keys(drafts.wpa).length > 0),
        copyText: buildWpaCopyText(name, teamId, treatment, displayLabel, wpaLayout, wpaPinstripe, wpaBand, wpaOwnArt),
        onField: (field, value) => on.wpaField(treatment, field, value),
        onReset: () => on.wpaReset(treatment),
      }}
      scenarios={{
        teamId,
        name,
        treatment,
        lastOpponent,
        headerColors,
        wpaLayout,
        wpaBandOverride: { pinstripe: wpaPinstripe, color: wpaBand, bg: wpaBandBg },
        wpaMarkOverride,
      }}
      header={{
        name,
        treatmentLabel: displayLabel,
        colors: headerColors,
        landed: Boolean(headerLanded),
        contrast: contrastRatio(headerColors.onBar, headerColors.bar),
        hasDraft: Boolean(drafts.header && Object.keys(drafts.header).length > 0),
        copyText: buildHeaderCopyText(name, teamId, treatment, displayLabel, headerColors),
        onField: (field, value) => on.headerField(treatment, field, value),
        onReset: () => on.headerReset(treatment),
      }}
    />
  )
}

// One call for all 30 clubs' current-season uniform catalog (verified to accept
// a comma list — docs/uniforms-and-logos.md) plus the curated name map, so no
// tile needs a per-team fetch. `nameEdits` is this session's in-progress
// code -> text edits; Save merges them over the last-saved map so an untouched
// row survives (the middleware always overwrites the whole file).
function useMlbExtras() {
  const [catalog, setCatalog] = useState({})
  const [savedNames, setSavedNames] = useState({})
  const [namesLoaded, setNamesLoaded] = useState(false)
  const [nameEdits, setNameEdits] = useState({})

  // Deliberately NOT one Promise.all over both fetches. The catalog comes from
  // statsapi and the names from a same-origin static file, so a statsapi
  // outage used to reject the combined promise and leave `savedNames` at its
  // initial `{}` for the whole session — which Save then wrote over the real
  // file. They're independent facts; they load independently, and a failure in
  // either degrades only its own half.
  useEffect(() => {
    let cancelled = false
    fetchTeamUniformCatalog(ALL_MLB_TEAM_IDS, new Date().getFullYear())
      .then((catalogData) => !cancelled && setCatalog(catalogData))
      .catch(() => {}) // no catalog means no jersey matches, not a broken page
    fetchUniformNameOverrides().then((overrides) => {
      if (cancelled) return
      setSavedNames(overrides)
      setNamesLoaded(uniformNameOverridesLoaded())
    })
    return () => {
      cancelled = true
    }
  }, [])

  return {
    catalog,
    savedNames,
    namesLoaded,
    nameEdits,
    // Pending jersey-name edits that Save will refuse to write, because the
    // current names never loaded. The colour/tuning stores still save fine, so
    // without this the page would report a flat "Saved." while quietly dropping
    // the one edit the owner can see on screen.
    blockedNameEdits: !namesLoaded && Object.keys(nameEdits).length > 0,
    onNameChange: (code, value) => setNameEdits((prev) => ({ ...prev, [code]: value })),
    afterSave: (payloads) => {
      const names = payloads.find((p) => p.key === 'uniform-names')?.body
      if (!names) return
      // Keep src/api/uniforms.js's module-level cache in step so any consumer
      // that calls fetchUniformNameOverrides() later this session sees the save
      // rather than the pre-save snapshot it cached on first load.
      primeUniformNameOverridesCache(names)
      setSavedNames(names)
      setNameEdits({})
    },
  }
}

// Which store fields a position draft lands in. `bg` only has a home here for
// Main (MAIN_OVERRIDES' bgHex) and for a pinstripe line color; a flat
// background for any other treatment belongs to ALT_COLORS and friends, which
// are still JS literals — the copy snippet covers those.
function applyPositionDraft(record, fields, treatment) {
  const next = { ...record }
  if (fields.scale !== undefined) next.scale = fields.scale
  if (fields.offsetX !== undefined) next.offsetX = fields.offsetX
  if (fields.offsetY !== undefined) next.offsetY = fields.offsetY
  if (fields.pinstripe !== undefined) {
    if (fields.pinstripe) {
      // Main's own flag is what mainTreatmentPinstripe reads; every other
      // treatment is pinstriped purely by having a line color.
      if (treatment === 'main') next.pinstripe = true
      if (fields.bg) next.pinstripeColor = fields.bg
    } else {
      delete next.pinstripe
      delete next.pinstripeColor
      delete next.pinstripeBg
    }
  }
  if (fields.bg !== undefined && !fields.pinstripe && treatment === 'main') next.bgHex = fields.bg
  if (treatment !== 'main' && fields.pinstripeBg !== undefined) {
    if (fields.pinstripeBg) next.pinstripeBg = fields.pinstripeBg
    else delete next.pinstripeBg
  }
  return next
}

function buildSaves(drafts, extras) {
  // null when the names never loaded or nothing was edited — that payload is
  // then dropped entirely rather than posted, because a uniform-names write
  // overwrites the whole file (uniformNamesSaveBody).
  const merged = uniformNamesSaveBody(extras.savedNames, extras.nameEdits, {
    loaded: extras.namesLoaded,
  })

  const name = (teamId) => teamFullName(teamId)
  const tuning = mergeDraftIntoStore(
    mergeDraftIntoStore(
      mergeDraftIntoStore(MLB_TREATMENT_TUNING, drafts.pos, applyPositionDraft, { name }),
      drafts.header,
      (record, fields) => {
        const { bar, accent, onBar } = { ...record.header, ...fields }
        return { ...record, header: { bar, accent, onBar } }
      },
      { name },
    ),
    drafts.tcolors,
    (record, fields) => {
      const next = applyTreatmentColorsDraft(record.colors ?? {}, fields)
      const result = { ...record }
      if (Object.keys(next).length) result.colors = next
      else delete result.colors
      return result
    },
    { name },
  )

  const wpa = mergeDraftIntoStore(
    WPA_TUNING,
    drafts.wpa,
    (record, fields) => {
      const next = { ...record }
      const layout = { ...next.layout }
      for (const key of ['size', 'rotate', 'offsetX', 'offsetY', 'paddingX', 'paddingY', 'rowShift']) {
        if (fields[key] !== undefined) layout[key] = fields[key]
      }
      if (Object.keys(layout).length) next.layout = layout
      if (fields.pinstripe !== undefined || fields.bandColor !== undefined || fields.bandBg !== undefined) {
        const pinstripe = fields.pinstripe ?? (typeof next.band === 'object' && next.band?.pinstripe) ?? false
        const color = fields.bandColor ?? (typeof next.band === 'object' ? next.band?.color : next.band)
        const bg = fields.bandBg ?? (typeof next.band === 'object' ? next.band?.bg : undefined)
        next.band = pinstripe ? (bg ? { pinstripe: true, color, bg } : { pinstripe: true, color }) : color
      }
      // Set-or-delete, same rule as every other cleared field here — absent
      // means "Use Logo Art" (checked, the default), never a stray `false`.
      if (fields.ownArt !== undefined) {
        if (fields.ownArt) next.ownArt = true
        else delete next.ownArt
      }
      return next
    },
    { name },
  )

  const colors = mergeTeamDraftIntoStore(MLB_TEAM_COLORS, drafts.colors, applyColorsDraft, { name })

  return [
    ...(merged ? [{ key: 'uniform-names', body: merged }] : []),
    { key: 'mlb-treatment-tuning', body: tuning },
    { key: 'wpa-tuning', body: wpa },
    { key: 'mlb-team-colors', body: colors },
  ]
}

export const mlbProfile = {
  key: 'mlb',
  label: 'MLB',
  sportId: 1,
  title: 'Team Identity Lab — MLB',
  storeKey: (suffix) => `bbsbh:identity-lab:mlb:${suffix}`,
  hint: (
    <>
      An unlisted, dev-only design harness — not linked anywhere in the app. Each
      club’s logo treatments with their brand colors, a preview of that SAME
      treatment tiled in the win-probability chart (the real chart picks a
      game’s treatment from that night’s actual uniform — see{' '}
      <code>api/jerseys.js</code> — so any tile here could be the one that shows
      up), and which catalog jersey(s) map to each treatment. Every swatch is
      editable directly on the chip — type a hex to change it, or clear it to
      say the club has no such color. A Main tile edits its club-wide
      Primary/Secondary/Accent (Accent is the “tells two clubs apart” pick, so
      for most clubs it restates the Primary or Secondary on purpose; any
      researched extra colors follow it, read-only); every other treatment
      edits its own independent Primary/Secondary/Accent 1/Accent 2, a
      separate per-jersey reference distinct from Main’s club-wide swatch.
      Click a swatch to try it as that tile’s WPA band color. Each WPA panel’s
      “Use Logo Art”
      checkbox is on by default (the band tiles the same mark as the tile
      above it, unchanged); uncheck it to upload a separate 512×512 PNG that
      band alone tiles instead.
      Missing logos or colors show as a placeholder until supplied. Save
      writes every pending change straight to{' '}
      <code>src/lib/data/*.json</code> and{' '}
      <code>public/data/uniform-names.json</code> while <code>npm run dev</code>{' '}
      is running; each editor’s copy icon still spells out what it would change,
      for the few values whose table hasn’t moved into a store yet. Drop a
      512×512 PNG (under 400 KB) on any tile — or use Replace art — to procure
      that club’s mark for that treatment; it lands in{' '}
      <code>public/team-logos/</code> and shows immediately.
    </>
  ),
  useTeams: () =>
    [...ALL_MLB_TEAM_IDS]
      .sort((a, b) => teamFullName(a).localeCompare(teamFullName(b)))
      .map((id) => ({ id, name: teamFullName(id) })),
  useExtras: useMlbExtras,
  Tiles: MlbTiles,
  sidebar: <NeutralSwatchesSidebar />,
  rowLogos,
  matchesLanded: {
    pos: (teamId, treatment, fields) =>
      draftFieldsMatchLanded(
        fields,
        resolvePositionState(teamId, treatment, null, colorsFor(teamId, treatment)),
      ),
    wpa: (teamId, treatment, fields) => {
      const layout = resolvedWpaLayout(teamId, treatment, null)
      const { pinstripe, band, bandBg } = resolveWpaBandState(teamId, treatment, null)
      const ownArt = resolveWpaOwnArt(teamId, treatment, null)
      return draftFieldsMatchLanded(fields, { ...layout, pinstripe, bandColor: band, bandBg, ownArt })
    },
    header: (teamId, treatment, fields) =>
      draftFieldsMatchLanded(fields, treatmentHeaderColorOverride(teamId, treatment)),
    colors: (teamId, fields) => colorsDraftMatchesLanded(fields, MLB_TEAM_COLORS[teamId]),
    treatmentColors: (teamId, treatment, fields) =>
      colorsDraftMatchesLanded(fields, treatmentTuningRecord(teamId, treatment)?.colors),
  },
  buildAllChangesText,
  buildSaves,
}
