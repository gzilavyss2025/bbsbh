/* eslint-disable react-refresh/only-export-components -- a profile module's
   public surface is its descriptor object, not the components inside it; the
   components are local by design. Fast Refresh falls back to a full reload for
   this dev-only lab, which is a fine trade for keeping each dimension's data,
   copy text, and tiles in one readable file. */
import { useEffect, useState } from 'react'
import { CopyIconButton } from '../../../components/CopyBox.jsx'
import { TeamLogo } from '../../../components/TeamLogo.jsx'
import { teamLogoUrl } from '../../../lib/teams.js'
import {
  MILB_COLOR_LAB_LEVELS,
  MILB_TREATMENT_TUNING,
  MILB_LOGO_POS_OVERRIDES,
  MILB_WPA_LOGO_LAYOUT_OVERRIDES,
  MILB_WPA_BAND_COLOR_OVERRIDES,
  MILB_HEADER_COLOR_OVERRIDES,
  milbColorPair,
  milbHasLogoArt,
  milbHasResearchedColor,
  milbLogoPosition,
  milbWpaLogoLayout,
  milbWpaBandColor,
  milbWpaBandPinstripeColor,
  milbHeaderColorsFor,
} from '../../../lib/milbColors.js'
import { TreatmentBox } from '../TreatmentBox.jsx'
import { draftFieldsMatchLanded } from '../useDraftStore.js'
import { mergeDraftIntoStore } from '../saveStores.js'

// The MiLB dimensions — one per full-season level (Triple-A/Double-A/High-A/
// Single-A; complex and rookie leagues have no stable per-club identity to
// review). Deliberately NOT the MLB catalog: MLB gets a treatment system
// because real per-jersey art and colors exist and are worth curating one at a
// time; MiLB has too many one-off jerseys, reported too inconsistently across
// statsapi, for that to pay off. So every affiliate gets exactly two
// variations — Home and Away — built from one researched primary/secondary
// pair, no exceptions.
const VARIANTS = [
  { key: 'home', label: 'Home' },
  { key: 'away', label: 'Away' },
]

// Quick-reuse neutrals for the hex fields — an affiliate's Away variation, or
// an unresolved team's placeholder tile, often wants a plain neutral rather
// than either researched brand color, and typing one from memory invites a typo
// a click-to-copy value doesn't. Two steps each of cream/off-white/grey (a
// lighter and a darker), plus pure white/black, a common "road grey" jersey
// tone, and a navy that recurs as the primary or secondary for a large cluster
// of researched affiliates — handy as a one-click starting point rather than
// hunting one of THOSE teams' own swatches down. Ordered light to top, dark to
// bottom (by plain RGB-average lightness) — a spectrum reads faster than an
// alphabetical list when the whole point is "grab the shade I want."
const NEUTRAL_SWATCHES = [
  { label: 'White', hex: '#FFFFFF' },
  { label: 'Off-white (light)', hex: '#FFFDF6' },
  { label: 'Cream (light)', hex: '#F6EFDC' },
  { label: 'Off-white (dark)', hex: '#F3ECD8' },
  { label: 'Cream (dark)', hex: '#E8DCC0' },
  { label: 'Grey (light)', hex: '#D0D0D0' },
  { label: 'Road grey', hex: '#9EA2A2' },
  { label: 'Grey (dark)', hex: '#4A4A4A' },
  { label: 'Common navy', hex: '#0C2340' },
  { label: 'Black', hex: '#000000' },
]

function NeutralSwatchesSidebar() {
  return (
    <aside className="milbneutrals" aria-label="Quick-reuse neutral colors">
      <span className="milbneutrals__title">Neutrals</span>
      {NEUTRAL_SWATCHES.map((s) => (
        <div className="milbneutrals__row" key={s.hex}>
          <div className="milbneutrals__chip" style={{ background: s.hex }} />
          <span className="milbneutrals__text">
            <span className="milbneutrals__label">{s.label}</span>
            <span className="milbneutrals__hex">{s.hex}</span>
          </span>
          <CopyIconButton text={s.hex} label={`Copy ${s.label} (${s.hex})`} />
        </div>
      ))}
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Copy-text builders — same three snippets each editor's own copy icon
// produces, lifted out so the page-level "copy all changes" button reuses them
// verbatim instead of re-deriving the format and drifting from it.

function buildPosCopyText(name, teamId, variant, variantLabel, pos) {
  return (
    `Team: ${name} (id ${teamId}, MiLB)\n` +
    `Variant: ${variantLabel}\n` +
    `Where: src/lib/data/milb-treatment-tuning.json — ${teamId}.treatments.${variant}.position\n` +
    `{ "scale": ${pos.scale}, "offsetX": ${pos.offsetX}, "offsetY": ${pos.offsetY}, ` +
    `"bg": "${pos.bg}", "pinstripe": ${pos.pinstripe} }`
  )
}

function buildWpaCopyText(name, teamId, variant, variantLabel, layout, pinstripe, bandColor) {
  const band = pinstripe ? `{ "pinstripe": true, "color": "${bandColor}" }` : `"${bandColor}"`
  return (
    `Team: ${name} (id ${teamId}, MiLB)\n` +
    `Variant: ${variantLabel}\n` +
    `Where: src/lib/data/milb-treatment-tuning.json — ${teamId}.treatments.${variant}\n` +
    `"wpaLayout": { "size": ${layout.size}, "rotate": ${layout.rotate}, "offsetX": ${layout.offsetX}, ` +
    `"offsetY": ${layout.offsetY}, "paddingX": ${layout.paddingX}, "paddingY": ${layout.paddingY}, ` +
    `"rowShift": ${layout.rowShift} }\n` +
    `"band": ${band}`
  )
}

function buildHeaderCopyText(name, teamId, variant, variantLabel, colors) {
  const { blue, gold, font } = colors
  return (
    `Team: ${name} (id ${teamId}, MiLB)\n` +
    `Variant: ${variantLabel}\n` +
    `Where: src/lib/data/milb-treatment-tuning.json — ${teamId}.treatments.${variant}.header ` +
    `(design-lab preview only — no shipped component reads this yet)\n` +
    `blue: ${blue}, gold: ${gold}, font: ${font}`
  )
}

function buildAllChangesText(teams, drafts) {
  const sections = []
  for (const t of teams) {
    for (const v of VARIANTS) {
      const pd = drafts.pos[t.id]?.[v.key]
      if (pd && Object.keys(pd).length > 0) {
        sections.push(buildPosCopyText(t.name, t.id, v.key, v.label, milbLogoPosition(t.id, v.key, pd)))
      }
      const wd = drafts.wpa[t.id]?.[v.key]
      if (wd && Object.keys(wd).length > 0) {
        const layout = milbWpaLogoLayout(t.id, v.key, wd)
        const pinstripe = milbWpaBandPinstripeColor(t.id, v.key, wd)
        const band = milbWpaBandColor(t.id, v.key, wd)
        sections.push(
          buildWpaCopyText(t.name, t.id, v.key, v.label, layout, Boolean(pinstripe), pinstripe ?? band),
        )
      }
      const hd = drafts.header[t.id]?.[v.key]
      if (hd && Object.keys(hd).length > 0) {
        sections.push(
          buildHeaderCopyText(t.name, t.id, v.key, v.label, milbHeaderColorsFor(t.id, v.key, hd)),
        )
      }
    }
  }
  return sections.join('\n\n')
}

// A WPA draft is a single flat object (layout + bandColor + pinstripe) that in
// the store splits across two fields — `wpaLayout` for geometry, `band` for
// color/pinstripe, mirroring milbWpaBandColor/milbWpaBandPinstripeColor's own
// resolution. Flatten the landed pair into the draft's shape before diffing so
// one draftFieldsMatchLanded call still works.
function wpaLandedFlat(teamId, variant) {
  const layout = MILB_WPA_LOGO_LAYOUT_OVERRIDES[teamId]?.[variant]
  const band = MILB_WPA_BAND_COLOR_OVERRIDES[teamId]?.[variant]
  const isPinstripeObj = band && typeof band === 'object'
  return {
    ...layout,
    pinstripe: isPinstripeObj ? Boolean(band.pinstripe) : false,
    bandColor: isPinstripeObj ? band.color : band,
  }
}

// ---------------------------------------------------------------------------

// The curated Home/Away mark for (teamId, variant) when the manifest says one
// exists, falling back to the plain CDN mark otherwise — the lab's own preview
// of exactly what milbTreatmentTile resolves for a real tile. `version` busts
// the browser's cache for the same URL right after a same-session upload
// replaces the file (mirrors profiles/mlb.jsx's TreatmentLogo); `hasArt` alone
// drives the initial render so a page reload after someone else's upload also
// shows the curated mark immediately, no upload required this session.
function MilbTreatmentLogo({ teamId, name, variant, hasArt, version }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [teamId, variant, hasArt])
  if (!hasArt || failed) return <TeamLogo teamId={teamId} name={name} size={64} />
  const base = teamLogoUrl(teamId, `milb-${variant}`)
  const url = version > 0 ? `${base}?v=${version}` : base
  return (
    <img
      key={url}
      src={url}
      alt=""
      width={64}
      height={64}
      loading="eager"
      decoding="async"
      onError={() => setFailed(true)}
      aria-hidden="true"
    />
  )
}

function MilbTiles({ team, lastOpponent, drafts, on }) {
  return VARIANTS.map((v) => (
    <MilbTile
      key={v.key}
      teamId={team.id}
      name={team.name}
      variant={v.key}
      label={v.label}
      lastOpponent={lastOpponent}
      drafts={{
        pos: drafts.pos?.[v.key],
        wpa: drafts.wpa?.[v.key],
        header: drafts.header?.[v.key],
      }}
      on={on}
    />
  ))
}

function MilbTile({ teamId, name, variant, label, lastOpponent, drafts, on }) {
  const [primary, secondary] = milbColorPair(teamId)
  const [artVersion, setArtVersion] = useState(0)
  const hasArt = artVersion > 0 || milbHasLogoArt(teamId, variant)
  const pos = milbLogoPosition(teamId, variant, drafts.pos)
  const wpaPinstripe = milbWpaBandPinstripeColor(teamId, variant, drafts.wpa)
  const wpaBand = milbWpaBandColor(teamId, variant, drafts.wpa)
  const wpaLayout = milbWpaLogoLayout(teamId, variant, drafts.wpa)
  const headerColors = milbHeaderColorsFor(teamId, variant, drafts.header)

  return (
    <TreatmentBox
      label={label}
      nameField={null}
      logoBox={{
        className: `colorlab__logobox colorlab__logobox--gloss${pos.pinstripe ? ' colorlab__logobox--pinstripe' : ''}`,
        style: {
          '--tint': pos.pinstripe ? undefined : pos.bg,
          '--scale': 1.32 * pos.scale,
          '--offset-x': `${pos.offsetX}%`,
          '--offset-y': `${pos.offsetY}%`,
          '--origin-y': 'center',
          '--pinstripe-color': pos.pinstripe ? pos.bg : undefined,
          '--pinstripe-bg': undefined,
        },
        children: (
          <MilbTreatmentLogo
            teamId={teamId}
            name={name}
            variant={variant}
            hasArt={hasArt}
            version={artVersion}
          />
        ),
      }}
      upload={{
        teamId,
        treatment: `milb-${variant}`,
        caveat: null,
        onUploaded: () => setArtVersion((v) => v + 1),
      }}
      swatches={[
        { swatch: { label: 'Primary', hex: primary }, active: pos.bg.toLowerCase() === primary.toLowerCase() }, // caps-js-exempt
        { swatch: { label: 'Secondary', hex: secondary }, active: pos.bg.toLowerCase() === secondary.toLowerCase() }, // caps-js-exempt
      ]}
      position={{
        name,
        treatmentLabel: label,
        scale: pos.scale,
        offsetX: pos.offsetX,
        offsetY: pos.offsetY,
        bg: pos.bg,
        pinstripe: pos.pinstripe,
        hasDraft: Boolean(drafts.pos && Object.keys(drafts.pos).length > 0),
        copyText: buildPosCopyText(name, teamId, variant, label, pos),
        onField: (field, value) => on.posField(variant, field, value),
        onReset: () => on.posReset(variant),
      }}
      wpa={{
        name,
        treatmentLabel: label,
        layout: wpaLayout,
        pinstripe: Boolean(wpaPinstripe),
        bandColor: wpaPinstripe ?? wpaBand,
        hasDraft: Boolean(drafts.wpa && Object.keys(drafts.wpa).length > 0),
        copyText: buildWpaCopyText(
          name,
          teamId,
          variant,
          label,
          wpaLayout,
          Boolean(wpaPinstripe),
          wpaPinstripe ?? wpaBand,
        ),
        onField: (field, value) => on.wpaField(variant, field, value),
        onReset: () => on.wpaReset(variant),
      }}
      scenarios={{
        teamId,
        name,
        treatment: variant,
        lastOpponent,
        headerColors,
        wpaLayout,
        wpaBandOverride: { pinstripe: Boolean(wpaPinstripe), color: wpaPinstripe ?? wpaBand },
      }}
      header={{
        name,
        treatmentLabel: label,
        colors: headerColors,
        hasDraft: Boolean(drafts.header && Object.keys(drafts.header).length > 0),
        copyText: buildHeaderCopyText(name, teamId, variant, label, headerColors),
        onField: (field, value) => on.headerField(variant, field, value),
        onReset: () => on.headerReset(variant),
      }}
    />
  )
}

// The affiliate list for one level, out of the same precomputed
// public/data/affiliates.json the slate's level toggle reads. `null` while it
// loads, so the body can say so instead of rendering an empty grid.
function useAffiliates(sportId) {
  const [teams, setTeams] = useState(null)
  useEffect(() => {
    let cancelled = false
    fetch('/data/affiliates.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        const rows = []
        for (const affiliates of Object.values(data.byOrgId)) {
          for (const a of affiliates) {
            if (a.sportId === sportId) rows.push({ id: a.id, name: a.name })
          }
        }
        rows.sort((x, y) => x.name.localeCompare(y.name))
        setTeams(rows)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [sportId])
  return teams
}

function buildSaves(drafts) {
  let store = mergeDraftIntoStore(MILB_TREATMENT_TUNING, drafts.pos, (record, fields, variant, teamId) => ({
    ...record,
    position: { ...milbLogoPosition(teamId, variant, fields) },
  }))
  store = mergeDraftIntoStore(store, drafts.wpa, (record, fields, variant, teamId) => {
    const pinstripe = milbWpaBandPinstripeColor(teamId, variant, fields)
    const color = pinstripe ?? milbWpaBandColor(teamId, variant, fields)
    return {
      ...record,
      wpaLayout: milbWpaLogoLayout(teamId, variant, fields),
      band: pinstripe ? { pinstripe: true, color } : color,
    }
  })
  store = mergeDraftIntoStore(store, drafts.header, (record, fields, variant, teamId) => ({
    ...record,
    header: milbHeaderColorsFor(teamId, variant, fields),
  }))
  return [{ key: 'milb-treatment-tuning', body: store }]
}

// One descriptor per level. They share every function above — only the sportId,
// the label, and the localStorage namespace differ, exactly as the four routes
// they replace shared one component parameterized by level.
export const milbProfiles = MILB_COLOR_LAB_LEVELS.map((level) => ({
  key: level.key,
  label: level.label,
  sportId: level.sportId,
  title: `Team Identity Lab — ${level.label} (MiLB)`,
  storeKey: (suffix) => `bbsbh:identity-lab:${level.key}:${suffix}`,
  hint: (
    <>
      An unlisted, dev-only design harness — not linked anywhere in the app.
      Every {level.label} affiliate gets exactly two variations, Home and Away,
      built from one researched primary/secondary color pair (see{' '}
      <code>src/lib/data/milb-colors.json</code>) — no per-jersey treatment
      catalog like the MLB dimension, since MiLB clubs wear too many one-off
      jerseys, reported too inconsistently across statsapi, for that to be worth
      curating one at a time. A team shown with a gray placeholder pair has no
      confidently-researched color yet. Position nudges/rescales the logo tile
      and tries a new background; WPA previews the real win-probability band
      (against that team’s most recent opponent) at three score states; Header
      colors is an unwired mockup. Save writes every pending change straight to{' '}
      <code>src/lib/data/milb-treatment-tuning.json</code> while{' '}
      <code>npm run dev</code> is running. Drop a 512×512 PNG (under 400 KB) on
      either tile — or use Replace art — to give that side its own mark instead
      of today’s shared, tinted CDN logo; it lands in{' '}
      <code>public/team-logos/milb-home/</code> or{' '}
      <code>public/team-logos/milb-away/</code>, keyed by team id, and shows
      immediately. A team missing either side’s art is flagged below.
    </>
  ),
  useTeams: () => useAffiliates(level.sportId),
  useExtras: () => ({ afterSave: () => {} }),
  Tiles: MilbTiles,
  sidebar: <NeutralSwatchesSidebar />,
  rowBadge: (teamId) => {
    const gaps = []
    if (!milbHasResearchedColor(teamId)) gaps.push('no researched color')
    const hasHomeArt = milbHasLogoArt(teamId, 'home')
    const hasAwayArt = milbHasLogoArt(teamId, 'away')
    if (!hasHomeArt && !hasAwayArt) gaps.push('no logo art')
    else if (!hasHomeArt) gaps.push('no home art')
    else if (!hasAwayArt) gaps.push('no away art')
    return gaps.length ? <span className="hint hint--error">{gaps.join(' · ')}</span> : null
  },
  matchesLanded: {
    pos: (teamId, variant, fields) =>
      draftFieldsMatchLanded(fields, MILB_LOGO_POS_OVERRIDES[teamId]?.[variant]),
    wpa: (teamId, variant, fields) => draftFieldsMatchLanded(fields, wpaLandedFlat(teamId, variant)),
    header: (teamId, variant, fields) =>
      draftFieldsMatchLanded(fields, MILB_HEADER_COLOR_OVERRIDES[teamId]?.[variant]),
  },
  buildAllChangesText,
  buildSaves,
}))
