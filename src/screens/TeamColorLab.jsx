import { useEffect, useId, useState } from 'react'
import { CopyIconButton } from '../components/CopyBox.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { PinstripePattern, RecolorFilter } from '../components/WinProbChart.jsx'
import {
  DEFAULT_PINSTRIPE_COLOR,
  WPA_PLOT_SIZE,
  wpaBandColor,
  wpaBandPinstripeColor,
} from '../lib/wpaBandColors.js'
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
  ALT4_COLORS,
  CITY_CONNECT_COLORS,
  TREATMENT_SCALE,
  MAIN_OVERRIDES,
  mainOverrideLogoUrl,
  mainTreatmentPinstripeColor,
  treatmentPinstripeColor,
  hasAlternate2,
  hasAlternate3,
  hasAlternate4,
  hasCityConnect,
} from '../lib/teams.js'
import { wpaLogoLayout, wpaTilePlacements } from '../lib/wpaLogo.js'
import { useWpaLogo } from '../hooks/useWpaLogo.js'
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
  { key: 'alternate-4', label: 'Alternate 4' },
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
    .map((a) => ({ label: jerseyLabel(a.text, clubName), code: a.code ?? null }))
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

function loadWpaDraft() {
  try {
    return JSON.parse(localStorage.getItem(WPA_LAB_KEY) || '{}')
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
  const [wpaDraft, setWpaDraft] = useState(loadWpaDraft)

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

  useEffect(() => {
    localStorage.setItem(WPA_LAB_KEY, JSON.stringify(wpaDraft))
  }, [wpaDraft])

  const setWpaField = (teamId, treatment, field, value) =>
    setWpaDraft((was) => ({
      ...was,
      [teamId]: {
        ...was[teamId],
        [treatment]: { ...was[teamId]?.[treatment], [field]: value },
      },
    }))
  const resetWpaDraft = (teamId, treatment) =>
    setWpaDraft((was) => {
      if (!was[teamId]) return was
      const nextTeam = { ...was[teamId] }
      delete nextTeam[treatment]
      return { ...was, [teamId]: nextTeam }
    })

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
        tells Claude exactly what to change.
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
            <TeamColorRow
              key={id}
              teamId={id}
              catalog={catalog}
              wpaDraft={wpaDraft[id]}
              onWpaField={(treatment, field, value) => setWpaField(id, treatment, field, value)}
              onWpaReset={(treatment) => resetWpaDraft(id, treatment)}
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

function TeamColorRow({ teamId, catalog, wpaDraft, onWpaField, onWpaReset }) {
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
      (t.key !== 'alternate-4' || hasAlternate4(teamId)) &&
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
            wpaDraft={wpaDraft?.[t.key]}
            onWpaField={(field, value) => onWpaField(t.key, field, value)}
            onWpaReset={() => onWpaReset(t.key)}
          />
        ))}
      </div>
    </section>
  )
}

function TreatmentBox({ teamId, name, treatment, label, catalog, wpaDraft, onWpaField, onWpaReset }) {
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
  const activeBgIndex = override?.bgHex || pinstripeColor
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

  // The WPA preview's effective pinstripe state + color: a draft toggle/typed
  // value if present, else the real chart's own fallback chain
  // (wpaBandPinstripeColor/wpaBandColor) for this exact (team, treatment)
  // pair — so the preview always shows what the real chart would actually
  // render right now, not just once edited. Clicking a swatch (below) always
  // means "flat fill", so it explicitly clears pinstripe.
  const wpaPinstripeDefault = wpaBandPinstripeColor(teamId, treatment)
  const wpaPinstripe = wpaDraft?.pinstripe ?? Boolean(wpaPinstripeDefault)
  const wpaBand =
    wpaDraft?.bandColor ?? (wpaPinstripe ? wpaPinstripeDefault ?? DEFAULT_PINSTRIPE_COLOR : wpaBandColor(teamId, treatment))

  return (
    <div className="colorlab__treatment">
      <span className="colorlab__treatmentlabel">{label}</span>
      <div className="colorlab__treatmentrow">
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
        </div>
        <TreatmentWpaPreview
          teamId={teamId}
          name={name}
          treatment={treatment}
          treatmentLabel={label}
          draft={wpaDraft}
          pinstripe={wpaPinstripe}
          bandColor={wpaBand}
          onField={onWpaField}
          onReset={onWpaReset}
        />
      </div>
      <JerseyMatch matches={jerseyMatches} teamId={teamId} name={name} treatmentLabel={label} />
    </div>
  )
}

// The uniforms-CATALOG cross-reference for this tile — which real jersey
// name(s) a scorer would see this club actually wear when this treatment is
// the one on the field. `null` while the catalog is still loading; an empty
// array is a loaded catalog with nothing in this bucket. The copy icon next
// to a matched jersey hands over exactly what to edit if the mapping is
// wrong — classifyUniformAsset's naming-convention guess, or a
// JERSEY_TREATMENT_OVERRIDES entry keyed by that jersey's own catalog code
// (both in src/api/uniforms.js) — without the matching itself being editable
// on this page (a wrong guess is rare enough that hand-editing the source
// table is simpler than a second UI to keep in sync with it).
function JerseyMatch({ matches, teamId, name, treatmentLabel }) {
  if (matches === null) return null
  const copyText =
    `Team: ${name} (id ${teamId})\n` +
    `Treatment: ${treatmentLabel}\n` +
    `Jersey(s) currently matched to it: ${matches.length ? matches.map((m) => m.label).join(' · ') : '(none)'}\n` +
    `Where: src/api/uniforms.js — classifyUniformAsset's naming-convention guess, or ` +
    `add/edit a JERSEY_TREATMENT_OVERRIDES entry keyed by uniformAssetCode ` +
    `(${matches.length ? matches.map((m) => m.code ?? '—').join(', ') : 'n/a'}) to force a different treatment`
  return (
    <div className="colorlab__jerseymatch">
      <span className="colorlab__jerseymatchlabel">Jersey</span>
      <span>{matches.length ? matches.map((m) => m.label).join(' · ') : '—'}</span>
      <CopyIconButton text={copyText} label={`Copy ${name} ${treatmentLabel} jersey-match context`} />
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

// A compact live preview of THIS treatment tiled the way the real
// win-probability chart (WinProbChart.jsx) would render it — one per
// treatment tile, not one per team, since a real game can wear ANY of a
// club's treatments (the chart now reads that from that night's actual
// uniform, api/jerseys.js) rather than always tiling Main. Size/rotate/
// offset/band-color edits here are a LOCAL proposal (persisted to
// localStorage so a reload doesn't lose it, same as Team Pattern Lab's
// per-team feedback) — nothing here writes to WinProbChart.jsx itself; the
// copy icon hands over the exact WPA_LOGO_LAYOUT_OVERRIDES /
// WPA_TREATMENT_BAND_COLOR_OVERRIDES entries to paste in by hand. Band
// color can also be set by clicking a swatch in the tile's own color row
// (see ColorSwatch's onPickWpaBand) instead of typing a hex here.
function TreatmentWpaPreview({
  teamId,
  name,
  treatment,
  treatmentLabel,
  draft,
  pinstripe,
  bandColor,
  onField,
  onReset,
}) {
  const uid = useId()
  const layoutDefaults = wpaLogoLayout(teamId, treatment)
  const size = draft?.size ?? layoutDefaults.size
  const rotate = draft?.rotate ?? layoutDefaults.rotate
  const offsetX = draft?.offsetX ?? layoutDefaults.offsetX
  const offsetY = draft?.offsetY ?? layoutDefaults.offsetY
  const paddingX = draft?.paddingX ?? layoutDefaults.paddingX
  const paddingY = draft?.paddingY ?? layoutDefaults.paddingY
  const rowShift = draft?.rowShift ?? layoutDefaults.rowShift
  const hasDraft = draft && Object.keys(draft).length > 0

  // Same resolver the real chart uses (hooks/useWpaLogo.js), so this preview
  // can't drift from it — including the rule that a recolor override never
  // touches a treatment's own procured art (only the stock CDN base mark),
  // and the drop back to the club's Main mark when there's no art on file for
  // this treatment yet. The tile on the LEFT is the one that still says "No
  // logo yet" — that's the panel whose job is flagging the gap; this one
  // shows what a real game would render.
  const { src: logo, recolor: logoOverride } = useWpaLogo(teamId, treatment)

  // Same tile math as the real chart, too (wpaTilePlacements) — the two
  // paddings are independent, and either can go negative to overlap adjacent
  // tiles' logos on purpose. `images` is one placement per row the tile
  // needs — one by default, two once a row shift is dialed in — so a shifted
  // grid previews exactly as it would ship.
  const { tileW, tileH, images } = wpaTilePlacements({ size, paddingX, paddingY, rowShift })
  const patternId = `wpaprev-pattern-${uid}`
  const recolorId = `wpaprev-recolor-${uid}`
  const pinstripeId = `wpaprev-pinstripe-${uid}`
  // Pinstripe uses the SAME `bandColor` value as the flat-fill case, just as
  // the line color instead of the tile fill — one text field covers both
  // modes rather than a second color input that'd sit unused half the time.
  const bandFill = pinstripe ? `url(#${pinstripeId})` : bandColor

  const overrideValue = pinstripe ? `{ pinstripe: true, color: '${bandColor}' }` : `'${bandColor}'`
  const copyText =
    `Team: ${name} (id ${teamId})\n` +
    `Treatment: ${treatmentLabel}\n` +
    `Where: src/lib/wpaLogo.js — WPA_LOGO_LAYOUT_OVERRIDES[${teamId}].${treatment} / ` +
    `src/lib/wpaBandColors.js — WPA_TREATMENT_BAND_COLOR_OVERRIDES[${teamId}].${treatment}\n` +
    `WPA_LOGO_LAYOUT_OVERRIDES[${teamId}] = { ...WPA_LOGO_LAYOUT_OVERRIDES[${teamId}], ` +
    `${treatment}: { size: ${size}, rotate: ${rotate}, offsetX: ${offsetX}, offsetY: ${offsetY}, ` +
    `paddingX: ${paddingX}, paddingY: ${paddingY}, rowShift: ${rowShift} } }\n` +
    `WPA_TREATMENT_BAND_COLOR_OVERRIDES[${teamId}] = { ...WPA_TREATMENT_BAND_COLOR_OVERRIDES[${teamId}], ` +
    `${treatment}: ${overrideValue} }`

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
      <div className="colorlab__wpapreviewbody">
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
        {/* True desktop size (WPA_PLOT_SIZE — the real chart's own band area,
            in the same px units it actually renders at) rather than a
            shrunken thumbnail, so a size/rotate/offset tweak here looks
            exactly like it would in the app — including a Size well past
            100, which only ever looked identical to ~100 in the old
            3-tile-wide thumbnail. */}
        <svg
          className="colorlab__wpapreviewsvg"
          viewBox={`0 0 ${WPA_PLOT_SIZE.width} ${WPA_PLOT_SIZE.height}`}
          role="img"
          aria-label={`${name} ${treatmentLabel} win-probability logo pattern, true size`}
        >
          <defs>
            <RecolorFilter id={recolorId} override={logoOverride} />
            {pinstripe && <PinstripePattern id={pinstripeId} color={bandColor} />}
            <pattern
              id={patternId}
              patternUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={tileW}
              height={tileH}
              patternTransform={`rotate(${rotate}) translate(${offsetX} ${offsetY})`}
              style={{ overflow: 'visible' }}
            >
              <rect width={tileW} height={tileH} className="winprob__patternbg" style={{ '--band-color': bandFill }} />
              {logo &&
                images.map((img, i) => (
                  <image
                    key={i}
                    href={logo}
                    x={img.x}
                    y={img.y}
                    width={size}
                    height={size}
                    className="winprob__patternlogo"
                    filter={logoOverride && logoOverride.mode !== 'swap' ? `url(#${recolorId})` : undefined}
                  />
                ))}
            </pattern>
          </defs>
          <rect
            x={0}
            y={0}
            width={WPA_PLOT_SIZE.width}
            height={WPA_PLOT_SIZE.height}
            style={{ fill: `url(#${patternId})` }}
          />
        </svg>
      </div>
    </div>
  )
}
