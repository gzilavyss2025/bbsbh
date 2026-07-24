import { useEffect, useState } from 'react'
import { CopyIconButton } from '../components/CopyBox.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { WinProbChart } from '../components/WinProbChart.jsx'
import { DEFAULT_PINSTRIPE_COLOR, wpaBandColor, wpaBandPinstripeColor } from '../lib/wpaBandColors.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import {
  ALL_MLB_TEAM_IDS,
  teamFullName,
  teamClubName,
  teamColorSwatches,
  teamLogoUrl,
  teamAbbr,
  ALT_COLORS,
  ALT2_COLORS,
  ALT3_COLORS,
  ALT4_COLORS,
  CITY_CONNECT_COLORS,
  TREATMENT_SCALE,
  MAIN_OVERRIDES,
  mainOverrideLogoUrl,
  mainTreatmentPinstripeColor,
  treatmentPinstripeColor,
  treatmentPinstripeBg,
  hasAlternate2,
  hasAlternate3,
  hasAlternate4,
  hasCityConnect,
  treatmentHeaderColorOverride,
} from '../lib/teams.js'
import { wpaLogoLayout } from '../lib/wpaLogo.js'
import {
  fetchTeamUniformCatalog,
  classifyUniformAsset,
  jerseyLabel,
  fetchUniformNameOverrides,
  primeUniformNameOverridesCache,
  uniformDisplayName,
} from '../api/uniforms.js'
import { fetchLastOpponent } from '../api/schedule.js'

// Same dev-only save endpoint UniformNamesPage.jsx posts to (vite.config.js's
// middleware) — this page isn't itself dev-gated (unlike that one, see
// TeamColorLab's own doc comment below), so a save attempted outside
// `npm run dev` just fails and shows the same "Save failed" hint, no
// different from any other of this page's proposed-but-unwired mockups.
const NAME_SAVE_URL = '/__dev/uniform-names'

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
  { key: 'alternate-4', label: 'Alternate 4' },
  { key: 'city-connect', label: 'City Connect' },
]

// Alternate 2/3/4 are opt-in per team (unlike Main/Alternate/City Connect,
// which every club eventually gets) — skip the tile entirely for a team with
// none set up. City Connect is skipped outright for a team with no real one
// (hasCityConnect), same idea but permanent rather than "not procured yet".
// Shared by TeamColorRow (which treatments to render) and buildAllChangesText
// below (which treatments to scan for drafts) so the two can't drift onto
// two different per-team treatment lists.
function treatmentsForTeam(teamId) {
  return TREATMENTS.filter(
    (t) =>
      (t.key !== 'alternate-2' || hasAlternate2(teamId)) &&
      (t.key !== 'alternate-3' || hasAlternate3(teamId)) &&
      (t.key !== 'alternate-4' || hasAlternate4(teamId)) &&
      (t.key !== 'city-connect' || hasCityConnect(teamId)),
  )
}

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
  158: { alternate: 4, 'alternate-2': 9 }, // Brewers — Alt 1 Pinstripe and Alt 2 Navy Blue both read better nudged right
  144: { 'city-connect': 4, alternate: 6 }, // Braves — City Connect 2.0 and Alt 1 Red marks nudged right
  112: { main: 4 }, // Cubs — Home Pinstripe mark nudged right
  145: { 'city-connect': 3 }, // White Sox — City Connect 2.0 mark nudged right
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

// Per-team, per-treatment vertical nudge (percent of the tile's own height,
// negative = up) — the Y counterpart to TREATMENT_OFFSET_X above, same
// CSS-custom-property mechanism (--offset-y on .colorlab__logoimg/.teamlogo).
// Page-local only, same footing as TREATMENT_OFFSET_X. Left empty — every
// entry so far comes from a user edit in LogoPositionControls below, copied
// in by hand.
const TREATMENT_OFFSET_Y = {
  144: { 'city-connect': 4, alternate: 1 }, // Braves — City Connect 2.0 mark nudged down, Alt 1 Red mark nudged down slightly
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
          : treatmentKey === 'alternate-4'
            ? ALT4_COLORS[teamId]
            : CITY_CONNECT_COLORS[teamId]
  return colors ? withMainRoleLabels(teamId, colors) : []
}

// Which jersey(s) in the uniforms CATALOG (as opposed to a single game's
// worn assignment) correspond to a given tile — the cross-reference the
// team-color-lab page exists to answer. Every club's catalog jersey label
// self-identifies as Home/Away/Road, "Alt N …", or "City Connect …"
// (verified against a live 2026 pull for all 30 clubs — classifyUniformAsset),
// so this needs no per-team hand-authoring like ALT_COLORS/CITY_CONNECT_COLORS
// above beyond the rare exceptions classifyUniformAsset's own
// JERSEY_TREATMENT_OVERRIDES table covers (src/api/uniforms.js — shared with
// gen-jerseys.mjs's live game-card classification, so this page's jersey
// matches can't drift from what the real card actually renders); a new/
// renamed jersey in a future season's catalog is otherwise picked up
// automatically. `null` means the catalog hasn't loaded yet (still fetching
// or MLB-only endpoint miss); an empty array is a loaded catalog with no
// jersey in that bucket.
function jerseyMatchesFor(catalog, teamId, treatmentKey) {
  const assets = catalog[teamId]
  if (!assets) return null
  const clubName = teamClubName(teamId)
  return assets
    .filter((a) => a.piece === 'J' && classifyUniformAsset(a.text, clubName, a.code) === treatmentKey)
    .map((a) => ({ label: jerseyLabel(a.text, clubName), code: a.code ?? null, text: a.text }))
}

// The tile's Position-panel state — override chain (bgHex/bg role/curated
// swatch), TREATMENT_SCALE/TREATMENT_OFFSET_X/Y, and any live
// LogoPositionControls draft, all merged in ONE place so TreatmentBox's own
// rendering and the page-level "copy all changes" button (buildAllChangesText
// below) can never resolve a different answer for the same (team, treatment,
// draft) triple. `posDraft` is null for a landed/no-draft read (used by the
// auto-clear-landed-drafts effect below to compare against what's already
// shipped in code).
function resolvePositionState(teamId, treatment, posDraft, colors) {
  const override = treatment === 'main' ? MAIN_OVERRIDES[teamId] : null
  const pinstripeColor =
    treatment === 'main'
      ? override?.pinstripe
        ? mainTreatmentPinstripeColor(teamId)
        : null
      : treatmentPinstripeColor(teamId, treatment)
  const pinstripeBg = treatment === 'main' ? null : treatmentPinstripeBg(teamId, treatment)
  const activeBgIndex = override?.bgHex || pinstripeColor
    ? -1
    : override
      ? BG_ROLE_INDEX[override.bg]
      : colors.findIndex((c) => c?.bg)
  const tint = override?.bgHex ?? (activeBgIndex >= 0 ? colors[activeBgIndex]?.hex : undefined)
  const scale = posDraft?.scale ?? override?.scale ?? TREATMENT_SCALE[teamId]?.[treatment] ?? 1
  const offsetX = posDraft?.offsetX ?? TREATMENT_OFFSET_X[teamId]?.[treatment] ?? 0
  const offsetY = posDraft?.offsetY ?? TREATMENT_OFFSET_Y[teamId]?.[treatment] ?? 0
  const pinstripe = posDraft?.pinstripe ?? Boolean(pinstripeColor)
  const bg = pinstripe ? posDraft?.bg || pinstripeColor || DEFAULT_PINSTRIPE_COLOR : posDraft?.bg || tint
  return { override, pinstripeColor, pinstripeBg, activeBgIndex, tint, scale, offsetX, offsetY, pinstripe, bg: bg ?? '' }
}

// Same idea for the WPA-preview panel's pinstripe/band-color state — the
// real chart's own fallback chain (wpaBandPinstripeColor/wpaBandColor) with
// any live TreatmentWpaPreview draft layered on top. `wpaDraft` null means a
// landed/no-draft read, same convention as resolvePositionState above.
function resolveWpaBandState(teamId, treatment, wpaDraft) {
  const pinstripeDefault = wpaBandPinstripeColor(teamId, treatment)
  const pinstripe = wpaDraft?.pinstripe ?? Boolean(pinstripeDefault)
  const band = wpaDraft?.bandColor ?? (pinstripe ? pinstripeDefault ?? DEFAULT_PINSTRIPE_COLOR : wpaBandColor(teamId, treatment))
  return { pinstripe, band }
}

// Design harness for reviewing each club's three logo treatments — Main,
// Alternate, City Connect — side by side with their official brand colors.
// Reached at /team-color-lab in production too, but linked from nowhere
// (unlisted, like /game-notes-debug — see lib/route.js) — no score/reveal
// content here, so there's no spoiler risk in shipping it. Logos and
// Alternate/City Connect colors are filled in as the user procures them;
// anything missing renders as a wireframe placeholder rather than blocking
// the page.
// Each treatment tile's proposed WPA-chart preview state (TreatmentWpaPreview
// below), persisted across reloads the same way TeamPatternLab.jsx persists
// its per-team feedback — never written back to WinProbChart.jsx's real
// override tables automatically, only offered as a copy-icon snippet to
// paste in by hand. Nested `{ [teamId]: { [treatment]: { size, rotate,
// offsetX, offsetY, bandColor } } }` — a real game can wear ANY of a club's
// treatments (see api/jerseys.js), so each tile needs its own independent
// layout/color proposal rather than one pick per team.
const WPA_LAB_KEY = 'bbsbh:team-color-lab:wpa'

// Same per-(team, treatment) draft, for the main rectangle's own logo
// position (LogoPositionControls) — `{ scale, offsetX, offsetY, bg }`.
const POS_LAB_KEY = 'bbsbh:team-color-lab:logopos'

// Same again, for the header-recolor mockup (TreatmentHeaderPreview) —
// `{ blue, gold, font }`. Nothing reads this outside the page; see that
// component's own doc comment for why.
const HEADER_LAB_KEY = 'bbsbh:team-color-lab:headercolors'

// The shared shape behind all three stores above: `{ [teamId]: { [treatment]:
// { ...fields } } }` in localStorage, one load-on-mount + write-on-change
// pair per store. Centralized here so WPA/position/header drafts can't drift
// into three slightly different persistence bugs.
function useDraftStore(key) {
  const [draft, setDraft] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || '{}')
    } catch {
      return {}
    }
  })
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(draft))
  }, [key, draft])
  const setField = (teamId, treatment, field, value) =>
    setDraft((was) => ({
      ...was,
      [teamId]: {
        ...was[teamId],
        [treatment]: { ...was[teamId]?.[treatment], [field]: value },
      },
    }))
  const reset = (teamId, treatment) =>
    setDraft((was) => {
      if (!was[teamId]) return was
      const nextTeam = { ...was[teamId] }
      delete nextTeam[treatment]
      return { ...was, [teamId]: nextTeam }
    })
  return [draft, setField, reset]
}

// True when every field the user actually touched in `fields` (a draft
// object — only the keys the user edited, not a full resolved object) has
// the exact same value already sitting in `landed` (the current no-draft
// resolution — resolvePositionState/resolvedWpaLayout+resolveWpaBandState/
// treatmentHeaderColorOverride called with a null draft). Numbers compare
// with float tolerance so a round-tripped `0.85` doesn't false-negative
// against itself.
function draftFieldsMatchLanded(fields, landed) {
  if (!landed) return false
  return Object.entries(fields).every(([k, v]) =>
    typeof v === 'number' ? Math.abs((landed[k] ?? NaN) - v) < 1e-9 : landed[k] === v,
  )
}

// Once a session's edits have actually been landed into src/lib/teams.js /
// wpaLogo.js / wpaBandColors.js (a real code change, not just a browser
// draft), the matching draft is stale — it no longer represents a *pending*
// change, just a record of one that already happened. Runs whenever any
// draft store changes (including right after the initial load-from-
// localStorage on a page refresh) and silently drops any (team, treatment)
// draft whose every touched field now equals the landed value, so "Copy N
// pending changes" only ever counts changes still waiting to be landed.
function useAutoClearLandedDrafts({ posDraft, resetPosDraft, wpaDraft, resetWpaDraft, headerDraft, resetHeaderDraft }) {
  useEffect(() => {
    for (const [teamId, treatments] of Object.entries(posDraft)) {
      for (const [treatment, fields] of Object.entries(treatments)) {
        if (!fields || Object.keys(fields).length === 0) continue
        const landed = resolvePositionState(Number(teamId), treatment, null, colorsFor(Number(teamId), treatment))
        if (draftFieldsMatchLanded(fields, landed)) resetPosDraft(teamId, treatment)
      }
    }
  }, [posDraft, resetPosDraft])

  useEffect(() => {
    for (const [teamId, treatments] of Object.entries(wpaDraft)) {
      for (const [treatment, fields] of Object.entries(treatments)) {
        if (!fields || Object.keys(fields).length === 0) continue
        const layout = resolvedWpaLayout(Number(teamId), treatment, null)
        const { pinstripe, band } = resolveWpaBandState(Number(teamId), treatment, null)
        if (draftFieldsMatchLanded(fields, { ...layout, pinstripe, bandColor: band })) resetWpaDraft(teamId, treatment)
      }
    }
  }, [wpaDraft, resetWpaDraft])

  useEffect(() => {
    for (const [teamId, treatments] of Object.entries(headerDraft)) {
      for (const [treatment, fields] of Object.entries(treatments)) {
        if (!fields || Object.keys(fields).length === 0) continue
        const landed = treatmentHeaderColorOverride(Number(teamId), treatment)
        if (draftFieldsMatchLanded(fields, landed)) resetHeaderDraft(teamId, treatment)
      }
    }
  }, [headerDraft, resetHeaderDraft])
}

// Scans every team's three draft stores (position/WPA/header — all
// per-team-per-treatment, see useDraftStore) and concatenates the same
// copy-text snippet each individual field's own CopyIconButton would
// produce, in team-list order. This is the one button meant to be pasted
// into a Claude prompt after a session of poking around several teams'
// controls — answers "what all did I change" without hunting down and
// re-opening every row's individual copy icon by hand.
function buildAllChangesText(teams, catalog, posDraft, wpaDraft, headerDraft) {
  const sections = []
  for (const teamId of teams) {
    const name = teamFullName(teamId)
    for (const t of treatmentsForTeam(teamId)) {
      const matches = jerseyMatchesFor(catalog, teamId, t.key)
      const treatmentLabel = matches?.[0]?.label ?? t.label
      const colors = colorsFor(teamId, t.key)

      const pd = posDraft[teamId]?.[t.key]
      if (pd && Object.keys(pd).length > 0) {
        const { scale, offsetX, offsetY, pinstripe, bg } = resolvePositionState(teamId, t.key, pd, colors)
        sections.push(buildPosCopyText(name, teamId, t.key, treatmentLabel, scale, offsetX, offsetY, bg, pinstripe))
      }
      const wd = wpaDraft[teamId]?.[t.key]
      if (wd && Object.keys(wd).length > 0) {
        const layout = resolvedWpaLayout(teamId, t.key, wd)
        const { pinstripe, band } = resolveWpaBandState(teamId, t.key, wd)
        sections.push(buildWpaCopyText(name, teamId, t.key, treatmentLabel, layout, pinstripe, band))
      }
      const hd = headerDraft[teamId]?.[t.key]
      if (hd && Object.keys(hd).length > 0) {
        const resolvedColors = headerColorsFor(colors, hd, treatmentHeaderColorOverride(teamId, t.key))
        sections.push(buildHeaderCopyText(name, teamId, t.key, treatmentLabel, resolvedColors))
      }
    }
  }
  return sections.join('\n\n')
}

// Sits above the team list, always visible regardless of scroll position, so
// it's reachable right after a session of poking at several teams' controls
// without hunting back up the page. Counts sections instead of teams (a team
// with both a Main position tweak and an Alternate band-color tweak counts
// as 2) so the number tracks buildAllChangesText's own output 1:1 — pasting
// the copy and counting blank-line-separated blocks should always match what
// this button reported.
function AllChangesButton({ teams, catalog, posDraft, wpaDraft, headerDraft }) {
  const text = buildAllChangesText(teams, catalog, posDraft, wpaDraft, headerDraft)
  const count = text ? text.split('\n\n').length : 0
  if (count === 0) return null
  return (
    <div className="colorlab__allchanges">
      <CopyIconButton text={text} label={`Copy all ${count} pending change(s) across every team`} />
      <span className="colorlab__allchanges__text">
        Copy all {count} pending change{count === 1 ? '' : 's'}
      </span>
    </div>
  )
}

// Which teams' rows are collapsed — persisted the same way, so a club
// that's been locked in stays collapsed across reloads instead of tempting
// another look (and another accidental edit) every time the page is
// revisited. `{ [teamId]: false }` marks a team explicitly EXPANDED; every
// other team (no entry, or `true`) renders collapsed by default — a fresh
// visit (empty localStorage) starts every row collapsed rather than firing
// all 30 teams' lazy lastOpponent fetch + rendering ~120 real WinProbChart
// scenario mockups at once (see TeamColorRow's own effect below).
const COLLAPSED_KEY = 'bbsbh:team-color-lab:collapsed'

function loadCollapsed() {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '{}')
  } catch {
    return {}
  }
}

export function TeamColorLab() {
  useDocumentTitle('Team Color Lab')
  const teams = [...ALL_MLB_TEAM_IDS].sort((a, b) =>
    teamFullName(a).localeCompare(teamFullName(b)),
  )
  const [catalog, setCatalog] = useState({})
  const [wpaDraft, setWpaField, resetWpaDraft] = useDraftStore(WPA_LAB_KEY)
  const [posDraft, setPosField, resetPosDraft] = useDraftStore(POS_LAB_KEY)
  const [headerDraft, setHeaderField, resetHeaderDraft] = useDraftStore(HEADER_LAB_KEY)
  useAutoClearLandedDrafts({ posDraft, resetPosDraft, wpaDraft, resetWpaDraft, headerDraft, resetHeaderDraft })
  const [collapsed, setCollapsed] = useState(loadCollapsed)
  // The same curated-name save flow as UniformNamesPage.jsx, embedded here so
  // a jersey's display name can be edited right next to the treatment tile it
  // actually renders on, instead of cross-referencing a separate page.
  // `savedNames` is the last-saved public/data/uniform-names.json map;
  // `nameEdits` is this session's in-progress code -> text edits, same
  // "merge edits over last-saved so an untouched row survives" save as that
  // page's own handleSave.
  const [savedNames, setSavedNames] = useState({})
  const [nameEdits, setNameEdits] = useState({})
  const [nameSaveStatus, setNameSaveStatus] = useState(null) // 'saving' | 'saved' | 'error' | null

  // One call for all 30 clubs' current-season uniform catalog (verified to
  // accept a comma list — docs/uniforms-and-logos.md), so the jersey-match
  // field below never needs a per-team fetch.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchTeamUniformCatalog(ALL_MLB_TEAM_IDS, new Date().getFullYear()),
      fetchUniformNameOverrides(),
    ]).then(([catalogData, overrides]) => {
      if (cancelled) return
      setCatalog(catalogData)
      setSavedNames(overrides)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsed))
  }, [collapsed])

  const toggleCollapsed = (teamId) =>
    setCollapsed((was) => ({ ...was, [teamId]: was[teamId] === false ? true : false }))

  const handleNameChange = (code, value) => {
    setNameEdits((prev) => ({ ...prev, [code]: value }))
    setNameSaveStatus(null)
  }

  async function handleSaveNames() {
    setNameSaveStatus('saving')
    const merged = { ...savedNames }
    for (const [code, name] of Object.entries(nameEdits)) {
      const trimmed = name.trim()
      if (trimmed) merged[code] = trimmed
      else delete merged[code]
    }
    try {
      const res = await fetch(NAME_SAVE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      })
      if (!res.ok) throw new Error(`save failed: ${res.status}`)
      primeUniformNameOverridesCache(merged)
      setSavedNames(merged)
      setNameEdits({})
      setNameSaveStatus('saved')
    } catch {
      setNameSaveStatus('error')
    }
  }

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Team Color Lab</h1>
      </header>
      <p className="hint">
        An unlisted design harness — not linked anywhere in the app. Each
        club’s Main, Alternate, and City Connect logo treatment with its
        three brand colors, a preview of that SAME treatment tiled in the
        win-probability chart (the real chart picks a game’s treatment from
        that night’s actual uniform — see <code>api/jerseys.js</code> —
        so any tile here could be the one that shows up), and which catalog
        jersey(s) map to each treatment. Click a swatch to try it as that
        tile’s WPA band color. Missing logos or colors show as a placeholder
        until supplied; every proposed edit here comes with a copy icon that
        tells Claude exactly what to change. Position lets you nudge/rescale
        the main rectangle’s own logo and its Background field tries a new
        tile-fill hex; Header colors is an unwired mockup of
        what a Blue/Gold header recolor could look like for this treatment.
        Each tile’s name field is the same curated wording{' '}
        <code>/uniform-names</code> edits — Save writes the whole map to{' '}
        <code>public/data/uniform-names.json</code> while{' '}
        <code>npm run dev</code> is running, no effect otherwise.
      </p>
      <div className="uniformnames__actions">
        <button className="btn" onClick={handleSaveNames} disabled={nameSaveStatus === 'saving'}>
          Save
        </button>
        {nameSaveStatus === 'saved' && <span className="hint">Saved.</span>}
        {nameSaveStatus === 'error' && (
          <span className="hint hint--error">Save failed — is `npm run dev` running?</span>
        )}
      </div>

      <AllChangesButton teams={teams} catalog={catalog} posDraft={posDraft} wpaDraft={wpaDraft} headerDraft={headerDraft} />

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
            <TeamColorRow
              key={id}
              teamId={id}
              catalog={catalog}
              savedNames={savedNames}
              nameEdits={nameEdits}
              onNameChange={handleNameChange}
              wpaDraft={wpaDraft[id]}
              onWpaField={(treatment, field, value) => setWpaField(id, treatment, field, value)}
              onWpaReset={(treatment) => resetWpaDraft(id, treatment)}
              posDraft={posDraft[id]}
              onPosField={(treatment, field, value) => setPosField(id, treatment, field, value)}
              onPosReset={(treatment) => resetPosDraft(id, treatment)}
              headerDraft={headerDraft[id]}
              onHeaderField={(treatment, field, value) => setHeaderField(id, treatment, field, value)}
              onHeaderReset={(treatment) => resetHeaderDraft(id, treatment)}
              collapsed={collapsed[id] !== false}
              onToggleCollapsed={() => toggleCollapsed(id)}
            />
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

function TeamColorRow({
  teamId,
  catalog,
  savedNames,
  nameEdits,
  onNameChange,
  wpaDraft,
  onWpaField,
  onWpaReset,
  posDraft,
  onPosField,
  onPosReset,
  headerDraft,
  onHeaderField,
  onHeaderReset,
  collapsed,
  onToggleCollapsed,
}) {
  const name = teamFullName(teamId)
  // The real rival for this row's WPA scenario mockups (TreatmentWpaScenarios
  // below) — fetched once, lazily: `undefined` means "haven't tried yet",
  // skipped entirely while the row is collapsed so a fresh page load doesn't
  // fire 30 schedule requests up front (unlike the one batched uniform-
  // catalog fetch above, there's no multi-team schedule endpoint to spread
  // this over). Stays cached in this row's own state once it resolves —
  // re-collapsing/expanding the row never re-fetches.
  const [lastOpponent, setLastOpponent] = useState(undefined)
  useEffect(() => {
    if (collapsed || lastOpponent !== undefined) return
    let cancelled = false
    fetchLastOpponent(teamId).then((opp) => {
      if (!cancelled) setLastOpponent(opp ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [collapsed, teamId, lastOpponent])
  const treatments = treatmentsForTeam(teamId)
  return (
    <section className="colorlab__row" id={teamAnchorId(teamId)}>
      <button
        type="button"
        className="colorlab__teamtoggle"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
      >
        <span className="colorlab__teamname">{name}</span>
        <span className="colorlab__teamchevron" aria-hidden="true">
          {collapsed ? '▸' : '▾'}
        </span>
      </button>
      {!collapsed && (
        <div className="colorlab__treatments">
          {treatments.flatMap((t) => {
            // A treatment sometimes covers more than one catalog jersey — most
            // often Main, when a club has no Away-jersey override and wears
            // both Home White and Road Grey under the same plain mark (see
            // jerseyMatchesFor's own doc comment). Rather than cramming N name
            // fields into one shared tile, duplicate the tile once per jersey
            // — same colors/logo/WPA draft (they genuinely share the same
            // treatment), just headed by that ONE jersey's own name, so
            // scrolling the page surfaces every jersey that still needs
            // reviewing instead of hiding a second one inside the first's box.
            // `null` (no catalog match yet, or the catalog hasn't loaded) still
            // renders exactly one tile, with the generic Main/Alternate/City
            // Connect label and no name field — unchanged from before.
            const matches = jerseyMatchesFor(catalog, teamId, t.key)
            const jerseyItems = matches?.length ? matches : [null]
            return jerseyItems.map((jerseyMatch) => (
              <TreatmentBox
                key={jerseyMatch ? `${t.key}:${jerseyMatch.code ?? jerseyMatch.label}` : t.key}
                teamId={teamId}
                name={name}
                treatment={t.key}
                label={t.label}
                jerseyMatch={jerseyMatch}
                savedNames={savedNames}
                nameEdits={nameEdits}
                onNameChange={onNameChange}
                lastOpponent={lastOpponent}
                wpaDraft={wpaDraft?.[t.key]}
                onWpaField={(field, value) => onWpaField(t.key, field, value)}
                onWpaReset={() => onWpaReset(t.key)}
                posDraft={posDraft?.[t.key]}
                onPosField={(field, value) => onPosField(t.key, field, value)}
                onPosReset={() => onPosReset(t.key)}
                headerDraft={headerDraft?.[t.key]}
                onHeaderField={(field, value) => onHeaderField(t.key, field, value)}
                onHeaderReset={() => onHeaderReset(t.key)}
              />
            ))
          })}
        </div>
      )}
    </section>
  )
}

function TreatmentBox({
  teamId,
  name,
  treatment,
  label,
  jerseyMatch,
  savedNames,
  nameEdits,
  onNameChange,
  lastOpponent,
  wpaDraft,
  onWpaField,
  onWpaReset,
  posDraft,
  onPosField,
  onPosReset,
  headerDraft,
  onHeaderField,
  onHeaderReset,
}) {
  const colors = colorsFor(teamId, treatment)
  // One tile per jersey this treatment covers (TeamColorRow's own flatMap
  // duplicates the tile when there's more than one — see its doc comment) —
  // so this box only ever has ITS OWN single jersey, if any, to head and name.
  // `jerseyMatch` is null while the catalog hasn't loaded yet, or for a
  // treatment with no catalog jersey at all; both fall back to the generic
  // Main/Alternate/City Connect bucket label with no name field to edit.
  const displayLabel = jerseyMatch?.label ?? label
  // The same curated full name UniformNamesPage.jsx edits for this jersey. No
  // code (no art procured for a future-season jersey yet) means nothing to
  // edit against.
  const nameField = jerseyMatch?.code
    ? {
        code: jerseyMatch.code,
        value: nameEdits[jerseyMatch.code] ?? uniformDisplayName(jerseyMatch.text, teamClubName(teamId), jerseyMatch.code, savedNames),
      }
    : null
  const slots = [0, 1, 2].map((i) => colors[i] ?? null)
  // A LogoPositionControls draft wins outright over every hardcoded default
  // below it — same "draft overrides curated default" pattern as the WPA
  // preview's own size/rotate/offset fields. `bg`/`pinstripe` are the same
  // draft-wins-over-curated pattern applied to the tile's own background, so
  // a proposed background — flat or pinstriped — can be tried live right
  // next to the position knobs it's usually tuned alongside. Pinstripe seeds
  // from whatever's already curated (`pinstripeColor`, computed below) so
  // toggling starts from the tile's real current look, same as the WPA
  // preview's own pinstripe checkbox.
  const {
    override,
    pinstripeBg,
    activeBgIndex,
    scale: treatmentScale,
    offsetX: treatmentOffsetX,
    offsetY: treatmentOffsetY,
    pinstripe: bgPinstripe,
    bg: treatmentBg,
  } = resolvePositionState(teamId, treatment, posDraft, colors)
  const treatmentOriginY = TREATMENT_ORIGIN_Y[teamId]?.[treatment] ?? 'center'
  const hasPosDraft = posDraft && Object.keys(posDraft).length > 0
  const logoboxStyle =
    treatmentBg || override || bgPinstripe || treatmentOffsetX || treatmentOffsetY || treatmentScale !== 1 || treatmentOriginY !== 'center'
      ? {
          '--tint': bgPinstripe ? undefined : treatmentBg,
          '--scale': 1.32 * treatmentScale,
          '--offset-x': `${treatmentOffsetX}%`,
          '--offset-y': `${treatmentOffsetY}%`,
          '--origin-y': treatmentOriginY,
          '--pinstripe-color': bgPinstripe ? treatmentBg : undefined,
          '--pinstripe-bg': pinstripeBg ?? undefined,
        }
      : undefined
  const logoboxClass = `colorlab__logobox colorlab__logobox--gloss${bgPinstripe ? ' colorlab__logobox--pinstripe' : ''}`

  // The WPA preview's effective pinstripe state + color: a draft toggle/typed
  // value if present, else the real chart's own fallback chain
  // (wpaBandPinstripeColor/wpaBandColor) for this exact (team, treatment)
  // pair — so the preview always shows what the real chart would actually
  // render right now, not just once edited. Clicking a swatch (below) always
  // means "flat fill", so it explicitly clears pinstripe.
  const { pinstripe: wpaPinstripe, band: wpaBand } = resolveWpaBandState(teamId, treatment, wpaDraft)
  // Same merged Size/Rotate/X/Y/H-Pad/V-Pad/Shift% TreatmentWpaPreview's own
  // fields show — computed once via the shared resolvedWpaLayout helper so
  // TreatmentWpaScenarios' mockups below render the SAME in-progress draft,
  // not just what's already saved in WPA_LOGO_LAYOUT_OVERRIDES.
  const wpaLayout = resolvedWpaLayout(teamId, treatment, wpaDraft)

  return (
    <div className="colorlab__treatment">
      <div className="colorlab__treatmentlabelrow">
        <span className="colorlab__treatmentlabel">{displayLabel}</span>
        {nameField && (
          <input
            className="searchbox__input colorlab__nameinput"
            value={nameField.value}
            placeholder="Display name"
            onChange={(e) => onNameChange(nameField.code, e.target.value)}
          />
        )}
      </div>
      <div className="colorlab__treatmentbox">
        <div className={logoboxClass} style={logoboxStyle}>
          <TreatmentLogo teamId={teamId} name={name} treatment={treatment} override={override} />
        </div>
        <div className="colorlab__swatchrow">
          {slots.map((s, i) => (
            <ColorSwatch
              key={i}
              swatch={s}
              active={i === activeBgIndex}
              wpaSelected={Boolean(!wpaPinstripe && s && wpaBand.toLowerCase() === s.hex.toLowerCase())} // caps-js-exempt
              onPickWpaBand={
                s
                  ? () => {
                      onWpaField('pinstripe', false)
                      onWpaField('bandColor', s.hex)
                    }
                  : undefined
              }
            />
          ))}
        </div>
        <LogoPositionControls
          teamId={teamId}
          name={name}
          treatment={treatment}
          treatmentLabel={displayLabel}
          scale={treatmentScale}
          offsetX={treatmentOffsetX}
          offsetY={treatmentOffsetY}
          bg={treatmentBg ?? ''}
          pinstripe={bgPinstripe}
          hasDraft={hasPosDraft}
          onField={onPosField}
          onReset={onPosReset}
        />
      </div>
      <TreatmentWpaPreview
        teamId={teamId}
        name={name}
        treatment={treatment}
        treatmentLabel={displayLabel}
        draft={wpaDraft}
        pinstripe={wpaPinstripe}
        bandColor={wpaBand}
        onField={onWpaField}
        onReset={onWpaReset}
      />
      <TreatmentWpaScenarios
        teamId={teamId}
        treatment={treatment}
        lastOpponent={lastOpponent}
        headerColors={headerColorsFor(colors, headerDraft, treatmentHeaderColorOverride(teamId, treatment))}
        wpaLayout={wpaLayout}
        wpaBandOverride={{ pinstripe: wpaPinstripe, color: wpaBand }}
      />
      <TreatmentHeaderPreview
        teamId={teamId}
        treatment={treatment}
        name={name}
        treatmentLabel={displayLabel}
        colors={colors}
        draft={headerDraft}
        onField={onHeaderField}
        onReset={onHeaderReset}
      />
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

// `onPickWpaBand`, when supplied, turns the chip into a button that sets
// this swatch's hex as the WPA preview's band color (TreatmentWpaPreview
// below) — a quick "try this one" instead of hand-typing a hex.
// `wpaSelected` rings the chip that's currently doing that job, a distinct
// ring color (--accent-primary) from `active`'s (--accent-positive) so the
// two "this swatch is driving X" indicators — the tile's own background vs.
// the WPA preview's band — never read as the same claim.
function ColorSwatch({ swatch, active, wpaSelected, onPickWpaBand }) {
  if (!swatch) {
    return (
      <div className="colorlab__swatchcell colorlab__swatchcell--placeholder">
        <div className="colorlab__swatchchip colorlab__swatchchip--placeholder" />
        <span className="colorlab__swatchlabel">—</span>
      </div>
    )
  }
  const cellClass = `colorlab__swatchcell${active ? ' colorlab__swatchcell--active' : ''}${wpaSelected ? ' colorlab__swatchcell--wpaselected' : ''}`
  return (
    <div className={cellClass}>
      {onPickWpaBand ? (
        <button
          type="button"
          className="colorlab__swatchchip colorlab__swatchchip--btn"
          style={{ background: swatch.hex }}
          onClick={onPickWpaBand}
          aria-label={`Use ${swatch.label} (${swatch.hex}) as this tile's WPA band color`}
          title="Use as WPA band color"
        />
      ) : (
        <div className="colorlab__swatchchip" style={{ background: swatch.hex }} />
      )}
      <span className="colorlab__swatchlabel">{swatch.label}</span>
      <span className="colorlab__swatchhex">{swatch.hex}</span>
    </div>
  )
}

// The editable Size/Rotate/X/Y/H-Pad/V-Pad/Shift%/Band/Pinstripe knobs for
// THIS treatment's WPA band — one per treatment tile, not one per team,
// since a real game can wear ANY of a club's treatments (the chart reads
// that from that night's actual uniform, api/jerseys.js) rather than always
// tiling Main. A LOCAL proposal (persisted to localStorage so a reload
// doesn't lose it, same as Team Pattern Lab's per-team feedback) — nothing
// here writes to wpaLogo.js/wpaBandColors.js automatically; the copy icon
// hands over the exact WPA_LOGO_LAYOUT_OVERRIDES / WPA_TREATMENT_BAND_COLOR_OVERRIDES
// entries to paste in by hand. Band color can also be set by clicking a
// swatch in the tile's own color row (see ColorSwatch's onPickWpaBand)
// instead of typing a hex here. Used to carry its own live single-tile SVG
// mockup alongside these fields; dropped in favor of TreatmentWpaScenarios
// below, which shows the SAME knobs' real effect against a real opponent at
// three score states instead of one static tile with no sense of scale.
// The merged Size/Rotate/X/Y/H-Pad/V-Pad/Shift% for a (team, treatment) —
// a WPA-preview draft field wins outright over WPA_LOGO_LAYOUT_OVERRIDES'
// shipped default, same "draft overrides curated default" pattern as
// LogoPositionControls. Shared by TreatmentWpaPreview (its own editable
// fields) AND TreatmentBox (feeds TreatmentWpaScenarios below, so an
// in-progress edit shows up in the scenario mockups immediately instead of
// only after it's pasted into wpaLogo.js) — one merge formula, so the two
// can't drift into showing different numbers for the same draft.
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

// Lifted out of TreatmentWpaPreview so the page-level "copy all changes"
// button (buildAllChangesText, below AllChangesButton) can produce the exact
// same snippet its own per-tile copy icon would, without re-deriving the
// format and risking drift.
function buildWpaCopyText(name, teamId, treatment, treatmentLabel, layout, pinstripe, bandColor) {
  const { size, rotate, offsetX, offsetY, paddingX, paddingY, rowShift } = layout
  const overrideValue = pinstripe ? `{ pinstripe: true, color: '${bandColor}' }` : `'${bandColor}'`
  return (
    `Team: ${name} (id ${teamId})\n` +
    `Treatment: ${treatmentLabel}\n` +
    `Where: src/lib/wpaLogo.js — WPA_LOGO_LAYOUT_OVERRIDES[${teamId}].${treatment} / ` +
    `src/lib/wpaBandColors.js — WPA_TREATMENT_BAND_COLOR_OVERRIDES[${teamId}].${treatment}\n` +
    `WPA_LOGO_LAYOUT_OVERRIDES[${teamId}] = { ...WPA_LOGO_LAYOUT_OVERRIDES[${teamId}], ` +
    `${treatment}: { size: ${size}, rotate: ${rotate}, offsetX: ${offsetX}, offsetY: ${offsetY}, ` +
    `paddingX: ${paddingX}, paddingY: ${paddingY}, rowShift: ${rowShift} } }\n` +
    `WPA_TREATMENT_BAND_COLOR_OVERRIDES[${teamId}] = { ...WPA_TREATMENT_BAND_COLOR_OVERRIDES[${teamId}], ` +
    `${treatment}: ${overrideValue} }`
  )
}

function TreatmentWpaPreview({ teamId, name, treatment, treatmentLabel, draft, pinstripe, bandColor, onField, onReset }) {
  const layout = resolvedWpaLayout(teamId, treatment, draft)
  const { size, rotate, offsetX, offsetY, paddingX, paddingY, rowShift } = layout
  const hasDraft = draft && Object.keys(draft).length > 0
  const copyText = buildWpaCopyText(name, teamId, treatment, treatmentLabel, layout, pinstripe, bandColor)

  return (
    <div className="colorlab__wpapreview">
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">WPA</span>
        {hasDraft && (
          <button type="button" className="colorlab__wparesetbtn" onClick={onReset}>
            Reset
          </button>
        )}
        <CopyIconButton text={copyText} label={`Copy ${name} ${treatmentLabel} WPA context`} />
      </div>
      <div className="colorlab__wpapreviewfields">
        <label>
          <span>Size</span>
          <input type="number" value={size} onChange={(e) => onField('size', Number(e.target.value))} />
        </label>
        <label>
          <span>Rotate</span>
          <input type="number" value={rotate} onChange={(e) => onField('rotate', Number(e.target.value))} />
        </label>
        <label>
          <span>X</span>
          <input type="number" value={offsetX} onChange={(e) => onField('offsetX', Number(e.target.value))} />
        </label>
        <label>
          <span>Y</span>
          <input type="number" value={offsetY} onChange={(e) => onField('offsetY', Number(e.target.value))} />
        </label>
        <label>
          <span>H-Pad</span>
          <input type="number" value={paddingX} onChange={(e) => onField('paddingX', Number(e.target.value))} />
        </label>
        <label>
          <span>V-Pad</span>
          <input type="number" value={paddingY} onChange={(e) => onField('paddingY', Number(e.target.value))} />
        </label>
        {/* Percent of a tile's width each row steps sideways from the one
            above it — 0 (the shipped default) is a plain grid, 50 the
            brickwork half-drop. */}
        <label>
          <span>Shift %</span>
          <input type="number" value={rowShift} onChange={(e) => onField('rowShift', Number(e.target.value))} />
        </label>
        <label className="colorlab__wpapreviewcolor">
          <span>{pinstripe ? 'Stripe' : 'Band'}</span>
          <input type="text" value={bandColor} onChange={(e) => onField('bandColor', e.target.value)} />
        </label>
        <label className="colorlab__wpapreviewcolor colorlab__wpapreviewcheck">
          <input type="checkbox" checked={pinstripe} onChange={(e) => onField('pinstripe', e.target.checked)} />
          <span>Pinstripe</span>
        </label>
      </div>
    </div>
  )
}

// Three fixed win-probability states — a losing team gets a small band, a
// tied game splits evenly, a winning team gets a large one — so the "how
// does this tile's band actually read at different score states" question
// TreatmentWpaPreview's single always-50/50-ish live edit can't answer gets
// answered directly. `homePct` feeds a single real data point (plus
// WinProbChart's own synthetic 50%-at-first-pitch origin), so each mockup
// draws as a real, if short, win-prob line rather than a flat cut.
const WPA_MOCK_SCENARIOS = [
  { key: 'losing', label: 'Losing', homePct: 20 },
  { key: 'tied', label: '50/50', homePct: 50 },
  { key: 'winning', label: 'Winning', homePct: 80 },
]

// Three side-by-side mockups of the REAL two-team win-probability chart
// (WinProbChart.jsx itself, not a hand-rolled stand-in — no drift risk) at
// the three score states above. This tile's own team is the HOME band —
// `wpaLayout`/`wpaBandOverride` (TreatmentBox's own resolvedWpaLayout() /
// pinstripe+band merge, the SAME values TreatmentWpaPreview's fields show)
// feed WinProbChart's homeLayoutOverride/homeBandOverride props, so an
// in-progress WPA-preview edit shows up here live rather than only once
// pasted into WPA_LOGO_LAYOUT_OVERRIDES/WPA_TREATMENT_BAND_COLOR_OVERRIDES.
// `lastOpponent` (this team's most recent completed game's rival,
// TeamColorRow's own lazy fetch) plays the AWAY band on their own Main
// look — unaffected by any of this tile's own draft edits — so the split
// reads as a real, recognizable matchup instead of a placeholder club.
// Renders nothing until lastOpponent resolves — `undefined` (still
// fetching) and `null` (never found, e.g. before Opening Day) both skip the
// row rather than showing a broken half-built chart.
//
// `headerColors` (this treatment's resolved Header colors — see
// headerColorsFor below, shared with TreatmentHeaderPreview so the two can't
// drift) recolors each mockup's OWN real .winprob__head bar, not a second
// fake header: WinProbChart's header reads the plain --navy/--seal/
// --text-on-ink tokens, and CSS custom properties cascade, so setting those
// three as inline style on this wrapper overrides them for everything inside
// it without touching the real tokens (or any other chart on the page).
function TreatmentWpaScenarios({ teamId, treatment, lastOpponent, headerColors, wpaLayout, wpaBandOverride }) {
  if (!lastOpponent) return null
  const homeAbbr = teamAbbr({ id: teamId })
  return (
    <div
      className="colorlab__wpascenarios"
      style={{ '--navy': headerColors.blue, '--seal': headerColors.gold, '--text-on-ink': headerColors.font }}
    >
      {WPA_MOCK_SCENARIOS.map((s) => (
        <div className="colorlab__wpascenario" key={s.key}>
          <span className="colorlab__wpascenariolabel">{s.label}</span>
          <WinProbChart
            points={[{ home: s.homePct, inning: 1, half: 'top' }]}
            awayId={lastOpponent.id}
            homeId={teamId}
            awayAbbr={lastOpponent.abbreviation}
            homeAbbr={homeAbbr}
            awayTreatment="main"
            homeLayoutOverride={wpaLayout}
            homeBandOverride={wpaBandOverride}
            homeTreatment={treatment}
          />
        </div>
      ))}
    </div>
  )
}

// A compact numeric-precision editor for the SAME scale/offset knobs the
// main rectangle's own logo already renders with (TREATMENT_SCALE in
// teams.js, TREATMENT_OFFSET_X/TREATMENT_OFFSET_Y above) — the "move it
// around" counterpart to TreatmentWpaPreview's Size/X/Y fields, for the one
// non-tiled mark this page shows per treatment instead of a repeating WPA
// pattern. Rendered INSIDE .colorlab__treatmentbox (unlike the WPA/header
// previews, which get their own boxed card) — a dashed divider instead of
// its own border, so it reads as a third column of the logo+swatches card
// it's positioning rather than a separate proposal. A draft here is
// page-local only, same footing as TREATMENT_OFFSET_X/TREATMENT_ORIGIN_Y —
// nothing writes back automatically; the copy icon hands over the literal to
// paste in by hand.
// Which teams.js swatch table backs a treatment's background color — so the
// Background field's copy text can point at the exact array to edit, the
// same way TREATMENT_SCALE/TREATMENT_OFFSET_X/Y already do for position.
// 'main' has no entry: its background is either MAIN_OVERRIDES' `bgHex`
// literal or one of TEAM_COLOR_PAIRS' three swatches by role (`bg`), so the
// copy text spells both out instead of naming one array.
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
      ? `src/lib/teams.js — MAIN_OVERRIDES[${teamId}].pinstripe: true (the line color itself is the shared default unless mainTreatmentPinstripeColor curates a per-team one)`
      : `src/lib/teams.js — TREATMENT_PINSTRIPE_COLOR[${teamId}].${treatment} (a plain string for the line color, or { color, bg } to also set the fill under the stripes)`
  }
  const table = TREATMENT_COLOR_TABLE_NAME[treatment]
  if (table) return `src/lib/teams.js — ${table}[${teamId}], the swatch flagged \`bg: true\` (background)`
  return (
    `src/lib/teams.js — MAIN_OVERRIDES[${teamId}].bgHex (a literal), or if it should ` +
    `instead track one of the club's three brand swatches, MAIN_OVERRIDES[${teamId}].bg ` +
    `('primary'/'secondary'/'third', see TEAM_COLOR_PAIRS/TEAM_COLORS/TEAM_COLOR_EXTRAS)`
  )
}

// Lifted out of LogoPositionControls so the page-level "copy all changes"
// button (buildAllChangesText, below AllChangesButton) can produce the exact
// same snippet its own per-tile copy icon would, without re-deriving the
// format and risking drift.
function buildPosCopyText(name, teamId, treatment, treatmentLabel, scale, offsetX, offsetY, bg, pinstripe) {
  return (
    `Team: ${name} (id ${teamId})\n` +
    `Treatment: ${treatmentLabel}\n` +
    `Where: src/lib/teams.js — TREATMENT_SCALE[${teamId}].${treatment} (scale) / ` +
    `src/screens/TeamColorLab.jsx — TREATMENT_OFFSET_X[${teamId}].${treatment} and ` +
    `TREATMENT_OFFSET_Y[${teamId}].${treatment} (page-local) / ` +
    `${bgOverrideLocation(teamId, treatment, pinstripe)}\n` +
    `scale: ${scale}, offsetX: ${offsetX}, offsetY: ${offsetY}, ` +
    (pinstripe ? `pinstripe: true, color: ${bg || '(none)'}` : `background: ${bg || '(none)'}`)
  )
}

function LogoPositionControls({
  teamId,
  name,
  treatment,
  treatmentLabel,
  scale,
  offsetX,
  offsetY,
  bg,
  pinstripe,
  hasDraft,
  onField,
  onReset,
}) {
  const copyText = buildPosCopyText(name, teamId, treatment, treatmentLabel, scale, offsetX, offsetY, bg, pinstripe)
  return (
    <div className="colorlab__posinline">
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">Position</span>
        {hasDraft && (
          <button type="button" className="colorlab__wparesetbtn" onClick={onReset}>
            Reset
          </button>
        )}
        <CopyIconButton text={copyText} label={`Copy ${name} ${treatmentLabel} logo-position context`} />
      </div>
      <div className="colorlab__posinlinefields">
        <label>
          <span>Scale</span>
          <input
            type="number"
            step="0.01"
            value={scale}
            onChange={(e) => onField('scale', Number(e.target.value))}
          />
        </label>
        <label>
          <span>X</span>
          <input type="number" value={offsetX} onChange={(e) => onField('offsetX', Number(e.target.value))} />
        </label>
        <label>
          <span>Y</span>
          <input type="number" value={offsetY} onChange={(e) => onField('offsetY', Number(e.target.value))} />
        </label>
        <label className="colorlab__posbgfield">
          <span>{pinstripe ? 'Stripe' : 'Background'}</span>
          <input type="text" value={bg} placeholder="#hex" onChange={(e) => onField('bg', e.target.value)} />
        </label>
        <label className="colorlab__posbgfield colorlab__poscheck">
          <input type="checkbox" checked={pinstripe} onChange={(e) => onField('pinstripe', e.target.checked)} />
          <span>Pinstripe</span>
        </label>
      </div>
    </div>
  )
}

// Seeds for the header mockup below when neither a draft nor this tile's own
// lead swatches (`colors`, passed in from TreatmentBox) supply one — the
// app's current navy/kraft-amber brand pair (see --navy/--seal, tokens/
// colors.css) and its light on-ink text color (--paper-2), copied as literals
// since a JS default can't reach into CSS custom properties.
const DEFAULT_HEADER_BLUE = '#1B2A3A'
const DEFAULT_HEADER_GOLD = '#B5824A'
const DEFAULT_HEADER_FONT = '#FBF6E9'

// Shared by TreatmentHeaderPreview below AND TreatmentWpaScenarios above it —
// so the win-probability scenario mockups' own header bars use the EXACT
// same resolved Blue/Gold/Font this treatment's Header colors panel shows,
// not a second computation that could drift from it. Priority: a live
// page-local draft edit, then a landed TREATMENT_HEADER_COLOR_OVERRIDES
// entry (teams.js), then this tile's own lead swatches, then the app's
// current brand pair.
function headerColorsFor(colors, draft, override) {
  return {
    blue: draft?.blue ?? override?.blue ?? colors[0]?.hex ?? DEFAULT_HEADER_BLUE,
    gold: draft?.gold ?? override?.gold ?? colors[1]?.hex ?? DEFAULT_HEADER_GOLD,
    font: draft?.font ?? override?.font ?? DEFAULT_HEADER_FONT,
  }
}

// A rough mockup of what the app's navy/gold header chrome could look like
// recolored to this club's brand for this treatment — NOT wired to any real
// component. The site-wide theming idea this previews (neutral pages
// matching a favorite team, game pages matching the home/batting team) is
// still undecided, so this is a design-lab sketch only, same "propose, don't
// wire into the real app" footing as the WPA preview above it. Blue/Gold/
// Font are hex text fields seeded from a landed TREATMENT_HEADER_COLOR_OVERRIDES
// entry (teams.js) or, absent one, this tile's own two lead swatches
// (`colors`); edits persist the same local-draft way, with a copy icon that
// hands over the three hexes plus the table path to land them at.
// Lifted out of TreatmentHeaderPreview so the page-level "copy all changes"
// button (buildAllChangesText, below AllChangesButton) can produce the exact
// same snippet its own per-tile copy icon would, without re-deriving the
// format and risking drift.
function buildHeaderCopyText(name, teamId, treatment, treatmentLabel, colors) {
  const { blue, gold, font } = colors
  return (
    `Team: ${name} (id ${teamId})\n` +
    `Treatment: ${treatmentLabel}\n` +
    `Where: src/lib/teams.js — TREATMENT_HEADER_COLOR_OVERRIDES[${teamId}].${treatment} ` +
    `(design-lab preview only — no real component reads this table yet)\n` +
    `blue: ${blue}, gold: ${gold}, font: ${font}`
  )
}

function TreatmentHeaderPreview({ teamId, treatment, name, treatmentLabel, colors, draft, onField, onReset }) {
  const override = treatmentHeaderColorOverride(teamId, treatment)
  const resolved = headerColorsFor(colors, draft, override)
  const { blue, gold, font } = resolved
  const hasDraft = draft && Object.keys(draft).length > 0
  const copyText = buildHeaderCopyText(name, teamId, treatment, treatmentLabel, resolved)
  return (
    <div className="colorlab__wpapreview colorlab__headerpreview">
      <div className="colorlab__wpapreviewhead">
        <span className="colorlab__wpapreviewlabel">Header colors</span>
        {hasDraft && (
          <button type="button" className="colorlab__wparesetbtn" onClick={onReset}>
            Reset
          </button>
        )}
        <CopyIconButton text={copyText} label={`Copy ${name} ${treatmentLabel} header-color context`} />
      </div>
      <div className="colorlab__headerpreviewbody">
        <div className="colorlab__headerfields">
          <label>
            <span>Blue</span>
            <input type="text" value={blue} onChange={(e) => onField('blue', e.target.value)} />
          </label>
          <label>
            <span>Gold</span>
            <input type="text" value={gold} onChange={(e) => onField('gold', e.target.value)} />
          </label>
          <label>
            <span>Font</span>
            <input type="text" value={font} onChange={(e) => onField('font', e.target.value)} />
          </label>
        </div>
        <div
          className="colorlab__headerbar"
          style={{ '--header-blue': blue, '--header-gold': gold, '--header-font': font }}
        >
          <span className="colorlab__headerbar__title">{name}</span>
        </div>
      </div>
    </div>
  )
}
