/* eslint-disable react-refresh/only-export-components -- a profile module's
   public surface is its descriptor object, not the components inside it; the
   components are local by design. Fast Refresh falls back to a full reload for
   this dev-only lab, which is a fine trade for keeping each dimension's data,
   copy text, and tiles in one readable file. */
import { useEffect, useState } from 'react'
import { TeamLogo } from '../../../components/TeamLogo.jsx'
import { teamLogoUrl } from '../../../lib/teams.js'
import { contrastRatio } from '../../../lib/contrast.js'
import { customMarkAssignment, customMarksFor } from '../../../lib/customMarks.js'
import { clubMarkSources } from '../../../lib/markSources.js'
import { NeutralSwatchesSidebar } from '../NeutralSwatchesSidebar.jsx'
import {
  MILB_COLOR_LAB_LEVELS,
  MILB_TREATMENT_TUNING,
  MILB_LOGO_POS_OVERRIDES,
  MILB_WPA_LOGO_LAYOUT_OVERRIDES,
  MILB_WPA_BAND_COLOR_OVERRIDES,
  MILB_WPA_WORDMARK_OVERRIDES,
  milbColorPair,
  milbHasArt,
  milbHasResearchedColor,
  milbLogoPosition,
  milbWpaLogoLayout,
  milbWpaBandColor,
  milbWpaBandPinstripeColor,
  milbWpaBandFillColor,
  milbWpaWordmark,
  milbHeaderColorOverride,
  milbHeaderColorsFor,
} from '../../../lib/milbColors.js'
import { JerseyBench } from '../workbench/JerseyBench.jsx'
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
    `"bg": "${pos.bg}", "pinstripe": ${pos.pinstripe}, "pinstripeBg": "${pos.pinstripeBg}" }`
  )
}

function buildWpaCopyText(name, teamId, variant, variantLabel, layout, pinstripe, bandColor, bandBg, wordmark) {
  const band = pinstripe
    ? `{ "pinstripe": true, "color": "${bandColor}"${bandBg ? `, "bg": "${bandBg}"` : ''} }`
    : `"${bandColor}"`
  return (
    `Team: ${name} (id ${teamId}, MiLB)\n` +
    `Variant: ${variantLabel}\n` +
    `Where: src/lib/data/milb-treatment-tuning.json — ${teamId}.treatments.${variant}\n` +
    `"wpaLayout": { "size": ${layout.size}, "rotate": ${layout.rotate}, "offsetX": ${layout.offsetX}, ` +
    `"offsetY": ${layout.offsetY}, "paddingX": ${layout.paddingX}, "paddingY": ${layout.paddingY}, ` +
    `"rowShift": ${layout.rowShift} }\n` +
    `"band": ${band}\n` +
    `"wpaWordmark": ${Boolean(wordmark)}`
  )
}

function buildHeaderCopyText(name, teamId, variant, variantLabel, colors) {
  const { bar, accent, onBar } = colors
  return (
    `Team: ${name} (id ${teamId}, MiLB)\n` +
    `Variant: ${variantLabel}\n` +
    `Where: src/lib/data/milb-treatment-tuning.json — ${teamId}.treatments.${variant}.header ` +
    `(drives the lineup page's club bar + section mastheads — ADR-0030)\n` +
    `bar: ${bar}, accent: ${accent}, onBar: ${onBar}\n` +
    `onBar vs bar: ${contrastRatio(onBar, bar).toFixed(2)}:1 (scripts/check-contrast.mjs needs 4.5:1)`
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
        const bandBg = milbWpaBandFillColor(t.id, v.key, wd)
        const wordmark = milbWpaWordmark(t.id, v.key, wd)
        sections.push(
          buildWpaCopyText(
            t.name,
            t.id,
            v.key,
            v.label,
            layout,
            Boolean(pinstripe),
            pinstripe ?? band,
            bandBg,
            wordmark,
          ),
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
    bandBg: isPinstripeObj ? (band.bg ?? null) : null,
    wpaWordmark: Boolean(MILB_WPA_WORDMARK_OVERRIDES[teamId]?.[variant]),
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
  // Reset computed during render, not in an effect — see Headshot.jsx.
  const identityKey = `${teamId}|${variant}|${hasArt}`
  const [prevIdentityKey, setPrevIdentityKey] = useState(identityKey)
  if (identityKey !== prevIdentityKey) {
    setPrevIdentityKey(identityKey)
    setFailed(false)
  }
  if (!hasArt || failed) return <TeamLogo teamId={teamId} name={name} size={64} />
  const base = teamLogoUrl(teamId, `milb-${variant}`)
  const url = version > 0 ? `${base}?v=${version}` : base
  return (
    <img
      key={url}
      src={url}
      alt=""
      className="colorlab__logoimg"
      loading="eager"
      decoding="async"
      onError={() => setFailed(true)}
      aria-hidden="true"
    />
  )
}

// Exactly two jerseys per affiliate, but ONE shared header bar — unlike MLB's
// two-bar Main/City-Connect split (a real jersey-design asymmetry), MiLB's
// Home and Away have no such asymmetry to justify separate bars, so both wear
// the same one (milbHeaderColorOverride, src/lib/milbColors.js).
function benchItems() {
  return VARIANTS.map((v) => ({ key: v.key, treatment: v.key, label: v.label, shortLabel: v.label, subLabel: null }))
}

// Both variants collapse onto the same slot — see the comment above.
function headerSlotFor() {
  return 'home'
}

function headerUnits() {
  return [{ slot: 'home', label: 'Header bar', wearerCaption: 'Worn by Home and Away' }]
}

function headerProps(team, slot, drafts, extras, on) {
  const teamId = team.id
  const draft = drafts?.header?.[slot]
  const landed = milbHeaderColorOverride(teamId, slot)
  const colors = milbHeaderColorsFor(teamId, slot, draft)
  const label = headerUnits()[0].label
  return {
    colors,
    // milbHeaderColorsFor resolves every slot from the club's researched pair,
    // so there is no "unset" state to draw as an outline here the way MLB has —
    // the raw fields still show only what a draft or the landed store actually
    // carries.
    rawColors: {
      bar: draft?.bar ?? landed?.bar,
      accent: draft?.accent ?? landed?.accent,
      onBar: draft?.onBar ?? landed?.onBar,
    },
    unset: false,
    landed: Boolean(landed),
    contrast: contrastRatio(colors.onBar, colors.bar),
    hasDraft: Boolean(draft && Object.keys(draft).length > 0),
    copyText: buildHeaderCopyText(team.name, teamId, slot, label, colors),
    onField: (field, value) => on.headerField(slot, field, value),
    onReset: () => on.headerReset(slot),
  }
}

// The affiliate's two marks on file — the curated Home/Away art when the
// manifest says it exists, the plain CDN mark standing in where it doesn't.
// Coverage is thin at this level by design, so a shelf slot standing empty is
// the useful answer rather than a missing row.
function shelfMarks(teamId) {
  const marks = VARIANTS.map((v) => ({
    key: v.key,
    treatment: v.key,
    label: v.label,
    url: milbHasArt(teamId, v.key) ? teamLogoUrl(teamId, `milb-${v.key}`) : teamLogoUrl(teamId, 'base'),
  }))
  // Marks recolored in the Logo art editor — same as the MLB shelf, `wornBy`
  // included: without it, a mark you've actually assigned to Home or Away
  // (LogoDropZone's assign select) shows up looking exactly as orphaned as one
  // nobody's used yet. An affiliate is the likelier customer for this whole
  // editor: MiLB art coverage is thinner, so recoloring the CDN mark is often
  // the only way to get a second one.
  for (const mark of customMarksFor(teamId)) {
    const wornBy = VARIANTS.filter((v) => customMarkAssignment(teamId, `milb-${v.key}`) === mark.slug)
    marks.push({
      key: `custom-${mark.slug}`,
      treatment: wornBy[0]?.key ?? null,
      label: mark.name,
      url: mark.url,
      wornBy: wornBy.map((v) => v.label),
    })
  }
  return marks
}

function markVisual(teamId, variant, drafts) {
  const pos = milbLogoPosition(teamId, variant, drafts?.pos?.[variant])
  return {
    className: `colorlab__logobox colorlab__logobox--gloss${pos.pinstripe ? ' colorlab__logobox--pinstripe' : ''}`,
    style: logoBoxStyle(pos),
    url: milbHasArt(teamId, variant) ? teamLogoUrl(teamId, `milb-${variant}`) : teamLogoUrl(teamId, 'base'),
  }
}

function logoBoxStyle(pos) {
  return {
    '--tint': pos.pinstripe ? undefined : pos.bg,
    '--scale': 1.32 * pos.scale,
    '--offset-x': `${pos.offsetX}%`,
    '--offset-y': `${pos.offsetY}%`,
    '--origin-y': 'center',
    '--pinstripe-color': pos.pinstripe ? pos.bg : undefined,
    '--pinstripe-bg': pos.pinstripeBg || undefined,
  }
}

function MilbBench({ team, item, lastOpponent, extras, drafts, on }) {
  const slot = headerSlotFor(item.treatment)
  return (
    <MilbJersey
      teamId={team.id}
      name={team.name}
      variant={item.treatment}
      label={item.label}
      lastOpponent={lastOpponent}
      headerUnit={{
        slot,
        label: headerUnits()[0].label,
        props: headerProps(team, slot, drafts, extras, on),
      }}
      drafts={{
        pos: drafts.pos?.[item.treatment],
        wpa: drafts.wpa?.[item.treatment],
        header: drafts.header?.[slot],
      }}
      on={on}
    />
  )
}

function MilbJersey({ teamId, name, variant, label, lastOpponent, headerUnit, drafts, on }) {
  const isHeaderOwner = variant === headerUnit.slot
  const [primary, secondary] = milbColorPair(teamId)
  const [artVersion, setArtVersion] = useState(0)
  const hasArt = artVersion > 0 || milbHasArt(teamId, variant)
  const pos = milbLogoPosition(teamId, variant, drafts.pos)
  const wpaPinstripe = milbWpaBandPinstripeColor(teamId, variant, drafts.wpa)
  const wpaBand = milbWpaBandColor(teamId, variant, drafts.wpa)
  const wpaBandBg = milbWpaBandFillColor(teamId, variant, drafts.wpa)
  const wpaLayout = milbWpaLogoLayout(teamId, variant, drafts.wpa)
  const wpaWordmarkOn = milbWpaWordmark(teamId, variant, drafts.wpa)
  // Same idea as MLB's own live "Use Logo Art" preview (profiles/mlb.jsx) —
  // without this, the WpaScenarios mockups would keep showing whatever mark
  // is already saved until Save actually lands the toggle. `null` (not an
  // override at all) when off, so WinProbChart falls through to its own
  // normal mark resolution.
  const wpaMarkOverride = wpaWordmarkOn ? { src: teamLogoUrl(teamId, 'wordmark'), recolor: null } : null
  // Resolved by the Header bars panel above rather than a second time here, so
  // the WPA mockups' own recolored chrome and the panel's bar can't disagree.
  const headerColors = headerUnit.props.colors

  return (
    <JerseyBench
      teamId={teamId}
      label={label}
      nameField={null}
      logoBox={{
        className: `colorlab__logobox colorlab__logobox--gloss${pos.pinstripe ? ' colorlab__logobox--pinstripe' : ''}`,
        style: logoBoxStyle(pos),
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
        savedMarks: customMarksFor(teamId),
        cdnMarks: clubMarkSources(teamId).filter((s) => s.kind === 'cdn'),
        assignedSlug: customMarkAssignment(teamId, `milb-${variant}`),
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
        pinstripeBg: pos.pinstripeBg,
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
        bandBg: wpaBandBg ?? '',
        wordmark: wpaWordmarkOn,
        hasDraft: Boolean(drafts.wpa && Object.keys(drafts.wpa).length > 0),
        copyText: buildWpaCopyText(
          name,
          teamId,
          variant,
          label,
          wpaLayout,
          Boolean(wpaPinstripe),
          wpaPinstripe ?? wpaBand,
          wpaBandBg,
          wpaWordmarkOn,
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
        wpaBandOverride: { pinstripe: Boolean(wpaPinstripe), color: wpaPinstripe ?? wpaBand, bg: wpaBandBg },
        wpaMarkOverride,
      }}
      headerPreview={{
        name,
        colors: headerColors,
        unset: headerUnit.props.unset,
        lineage: {
          anchorId: `idlab-bar-${teamId}-${headerUnit.slot}`,
          caption: isHeaderOwner
            ? `This jersey owns the ${headerUnit.label}.`
            : `Wears the ${headerUnit.label}.`,
        },
      }}
      // Only Home owns the shared bar (headerSlotFor above) — Away wears it
      // read-only, same as MLB's non-Main jerseys relative to Main's bar.
      headerWrite={isHeaderOwner ? (field, value) => on.headerField(headerUnit.slot, field, value) : undefined}
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
    const bg = milbWpaBandFillColor(teamId, variant, fields)
    const next = {
      ...record,
      wpaLayout: milbWpaLogoLayout(teamId, variant, fields),
      band: pinstripe ? { pinstripe: true, color, ...(bg ? { bg } : {}) } : color,
    }
    // Absent (not `false`) is the default — off is the same as never having
    // touched this, same "omit rather than write a stray false" rule the
    // rest of this store follows (e.g. teams.js's offDayTreatment).
    if (milbWpaWordmark(teamId, variant, fields)) next.wpaWordmark = true
    else delete next.wpaWordmark
    return next
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
      colors is one shared bar for both Home and Away (edited from Home; Away
      wears it read-only), unlike Position/WPA which still tune independently
      per side. Save writes every pending change straight to{' '}
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
  benchItems,
  Bench: MilbBench,
  headerUnits,
  headerProps,
  headerSlotFor,
  markVisual,
  shelfMarks,
  sidebar: <NeutralSwatchesSidebar />,
  rowBadge: (teamId) => {
    const gaps = []
    if (!milbHasResearchedColor(teamId)) gaps.push('no researched color')
    const hasHomeArt = milbHasArt(teamId, 'home')
    const hasAwayArt = milbHasArt(teamId, 'away')
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
      draftFieldsMatchLanded(fields, milbHeaderColorOverride(teamId, variant)),
  },
  buildAllChangesText,
  buildSaves,
}))
