import { useId, useRef } from 'react'
import { winProbSplit } from '../../api/winprob.js'
import { winProbChangeLabel, winProbReadout } from './winprob/explore.js'
import { useWinProbSelection } from './winprob/useWinProbSelection.js'
import { useSwingClip } from './winprob/useSwingClip.js'
import { winProbKeyColor, winProbKeyPair, winProbKeyPill } from './winprob/keyColors.js'
import { SwingLedger } from './winprob/SwingLedger.jsx'
import { HighlightSheet } from '../playbyplay/HighlightSheet.jsx'
import { wpaBandColor, wpaBandPinstripeColor, wpaBandPinstripeBg, chipColorsFor } from '../../lib/wpa/wpaBandColors.js'
import { wpaLogoLayout, wpaTilePlacements } from '../../lib/wpa/wpaLogo.js'
import { isMlbTeamId } from '../../lib/teams.js'
import { milbWpaLogoLayout, milbWpaBandColor, milbWpaBandPinstripeColor } from '../../lib/milbColors.js'
import { useWpaLogo } from '../../hooks/useWpaLogo.js'
import { useMilbWpaLogo } from '../../hooks/useMilbWpaLogo.js'
import { Card } from '../ui/frame/Card.jsx'

// The win-probability "story of the game", drawn the scorebook way: one ink line
// tracing the home team's win % across every plotted play, the plot split into
// two bands at the line — the HOME share below it, the AWAY share above — each
// a solid step-and-repeat banner of that club's OWN brand color plus a full-
// opacity tiling of that club's own logo (SVG <pattern>, rotated off-axis
// with an offset origin so the grid reads as wallpaper a viewer stumbles
// across rather than one anchored at the plot's corner). A band unambiguously
// reads as "that club's share" from its own color + its own mark, without the
// earlier generic clay/navy scheme's risk of a viewer conflating a structural
// tint with a DIFFERENT club's real color (verified live: a viewer misread
// the away band's clay as the home club's actual red). NOTE: a club whose
// logo mark is itself drawn in (close to) that same primary color — several
// are, by design, single-tone marks — will partly or wholly disappear into
// its own band; this is a known open issue, not yet worked around.
//
// No grid lines, axis labels or tick marks on either axis — the two solid
// bands' own boundary already reads as "which side of 50%," and the readout
// above the plot names the selected play's half-inning, so the axes were
// dropped to give the plot the room back.
//
// SPOILER RULE: this only draws what it's handed. `points` comes from
// selectWinProbPath (api/winprob.js), a REVEAL-ONLY selector — the box score
// passes the whole game (inside its seal), the innings view passes only the
// plays through the revealed half. So there's nothing sealed to leak here; this
// component never reaches for the feed itself. Renders nothing on an empty path
// (no data / a MiLB park with no win-prob endpoint), so callers can drop it in
// unconditionally.
//
// `partial` tags the innings-view instance as revealed events only; the box
// score omits it.

const W = 328
const H = 220
// No axis labels to clear room for (see the block comment above) — just a
// small inset. The readout sits above the <svg>, not in this top pad,
// and lib/wpa/wpaBandColors.js's WPA_PLOT_SIZE repeats these numbers. The
// bands run the full width, edge to edge with the card (.winprob__svg bleeds
// past the card's padding). Only the plays sit inside PAD_L/PAD_R, so a
// numbered marker or the cursor at the first or last play is not cut off;
// the line runs flat out to each edge.
const PAD_L = 8
const PAD_R = 8
const PAD_T = 10
const PAD_B = 10
const PLOT_L = PAD_L
const PLOT_R = W - PAD_R
const PLOT_T = PAD_T
const PLOT_B = H - PAD_B
const PLOT_W = PLOT_R - PLOT_L
// A swing marker's radius, and how far above (or below) its step it floats.
const MARK_R = 7
const MARK_LIFT = 15
const PLOT_H = PLOT_B - PLOT_T

// The step-and-repeat band texture — each tile a SOLID fill of that band's
// own club color plus a copy of that club's own logo, the grid tilted and
// offset so it reads as wallpaper the eye stumbles into mid-pattern rather
// than one anchored at the plot's corner. All of that geometry (the
// per-(team, treatment) layout table, its defaults, and the tile placement
// math) lives in lib/wpa/wpaLogo.js alongside the art resolver, pure and
// unit-tested (test/wpa-logo.test.js); the two dev labs that preview this
// texture read the same helpers, so a preview can't drift from what ships.
//
// The recolor curation there (LOGO_COLOR_OVERRIDES) was verified against each
// club's stock CDN base mark and only ever reaches that art, never the
// hand-procured treatment PNGs in public/team-logos/, which already carry
// their own colors. RecolorFilter below renders whatever entry the resolver
// hands back.
//
// Which logo TREATMENT tiles a club's band is decided PER GAME, not per
// team — see the `awayTreatment`/`homeTreatment` props below, sourced from
// that game's real uniform assignment (api/jerseys.js's precomputed
// gamePk+teamId -> treatment map, the same data GameCard.jsx reads to swap a
// slate card's logo). A team/game with no posted assignment (MiLB, not yet
// posted) renders 'main', same as every game before this feature existed.
//
// The band fill/pinstripe resolution (WPA_PLOT_SIZE, BAND_COLOR_OVERRIDES,
// WPA_TREATMENT_BAND_COLOR_OVERRIDES, wpaBandColor, wpaBandPinstripeColor,
// chipColorsFor) lives in lib/wpa/wpaBandColors.js — pure data/functions kept out
// of this file so it can stay component-only for Fast Refresh; the two dev
// labs that preview this texture import the same helpers from there.

// A repeating thin-line-on-white fill for an SVG `fill="url(#id)"` (or, as
// used below, a `--band-color: url(#id)` CSS custom property feeding
// `.winprob__patternbg { fill: var(--band-color) }`) — the same scorebook
// pinstripe motif as `.colorlab__logobox--pinstripe`'s CSS
// repeating-linear-gradient, just as an SVG pattern since a plain CSS
// background doesn't apply to an SVG shape's `fill`. Tiled small (4x4) since
// the WPA band's own logo tile is itself tiny.
const PINSTRIPE_TILE = 4
export function PinstripePattern({ id, color, bg = '#fff' }) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={PINSTRIPE_TILE} height={PINSTRIPE_TILE}>
      <rect width={PINSTRIPE_TILE} height={PINSTRIPE_TILE} fill={bg} />
      <rect width={1} height={PINSTRIPE_TILE} fill={color} />
    </pattern>
  )
}

// The <filter> a wpaLogoFor `recolor` entry needs, or null for no override /
// a 'swap' override (that one's already-recolored asset needs no filter at
// all). 'flood': feFlood paints the override color, feComposite's
// operator="in" clips that flood to the image's own alpha channel (its
// silhouette) — the whole mark becomes one flat replacement color. 'outline':
// feMorphology (dilate) grows a copy of that same silhouette outward by
// `radius`, feFlood + feComposite paint JUST that outward ring in the
// override color, then feMerge stacks it BEHIND (feMergeNode order = paint
// order) the original artwork — a same-color halo just outside the mark's
// existing edge, thickened if the mark already had one of its own (Phillies).
export function RecolorFilter({ id, override }) {
  if (!override || override.mode === 'swap') return null
  if (override.mode === 'outline') {
    return (
      <filter id={id}>
        <feMorphology in="SourceAlpha" operator="dilate" radius={override.radius} result="dilated" />
        <feFlood floodColor={override.color} result="flood" />
        <feComposite in="flood" in2="dilated" operator="in" result="outline" />
        <feMerge>
          <feMergeNode in="outline" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    )
  }
  return (
    <filter id={id}>
      <feFlood floodColor={override.color} result="flood" />
      <feComposite in="flood" in2="SourceAlpha" operator="in" />
    </filter>
  )
}

export function WinProbChart({
  points,
  bigPlays = [],
  awayAbbr,
  homeAbbr,
  awayId,
  homeId,
  awayTreatment,
  homeTreatment,
  homeLayoutOverride,
  homeBandOverride,
  homeMarkOverride,
  partial = false,
  final = false,
  highlights = null,
  filmEligible = true,
}) {
  const patternUid = useId()
  // The latest play until the user picks one (winprob/useWinProbSelection.js).
  // A click near a numbered marker snaps to it.
  const { activeIdx, select, svgHandlers, used, input } = useWinProbSelection(
    points?.length ?? 0, { W, H, left: PLOT_L, width: PLOT_W }, bigPlays.map((p) => p.idx),
  )
  // A swing row's Watch button opens that play's clip (winprob/useSwingClip.js).
  const clip = useSwingClip({ highlights, filmEligible })
  const svgRef = useRef(null)
  // A swing row selects its play and brings the plot into view to show it.
  const pickSwing = (idx) => {
    select(idx)
    svgRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }

  // `awayTreatment`/`homeTreatment` (props) carry that GAME's real worn
  // uniform treatment — see api/jerseys.js — so the tiled mark actually
  // matches tonight's jersey rather than always being the club's Main mark.
  // Callers with no such data (or a MiLB game outside jerseys.json's
  // coverage) simply omit the prop, and this falls back to 'main'.
  //
  // A MiLB affiliate (awayId/homeId isn't one of the 30 MLB clubs) reads its
  // band/logo-tile geometry from milbColors.js's Home/Away tables instead of
  // this file's MLB per-treatment ones — same "which system owns this team"
  // split as TeamTreatmentMark's tile (components/TeamTreatmentMark.jsx). The
  // role ('away'/'home') is fixed by which prop this is, not guessed. Computed
  // here, above every hook call below, since both useWpaLogo AND
  // useMilbWpaLogo must run unconditionally (a hook can't be called
  // conditionally) and this decides which one's result actually gets used.
  const awayMilb = !isMlbTeamId(awayId)
  const homeMilb = !isMlbTeamId(homeId)

  // useWpaLogo/useMilbWpaLogo (hooks/) resolve each band's mark AND whether a
  // recolor override reaches it, dropping back to a club's normal mark for a
  // treatment/variant whose art isn't on file yet. Resolved ABOVE the
  // empty-points early return below, since a hook can't be called
  // conditionally.
  const awayTreat = awayTreatment ?? 'main'
  const homeTreat = homeTreatment ?? 'main'
  const awayMlbLogo = useWpaLogo(awayId, awayTreat)
  const awayMilbLogo = useMilbWpaLogo(awayId, 'away')
  const { src: awayLogo, recolor: awayLogoOverride } = awayMilb ? awayMilbLogo : awayMlbLogo
  const homeMlbLogo = useWpaLogo(homeId, homeTreat)
  const homeMilbLogo = useMilbWpaLogo(homeId, 'home')
  const homeLogoResolved = homeMilb ? homeMilbLogo : homeMlbLogo
  // `homeMarkOverride` — Team Identity Lab's own live "Use Logo Art"/"Use
  // wordmark" DRAFT state (an in-progress uncheck, or a just-uploaded file,
  // cache-busted by the caller's own artVersion counter — WpaArtBox/
  // WpaScenarios, profiles/mlb.jsx and profiles/milb.jsx). Without this, the
  // mockups would keep showing whatever mark is already SAVED until Save
  // actually lands the field — every other WPA field (layout, band color)
  // already previews its own in-progress edit live via
  // homeLayoutOverride/homeBandOverride; this is the same idea for which MARK
  // tiles the band. `undefined` for every real game chart, so this is inert
  // there.
  const homeLogo = homeMarkOverride ? homeMarkOverride.src : homeLogoResolved.src
  const homeLogoOverride = homeMarkOverride ? (homeMarkOverride.recolor ?? null) : homeLogoResolved.recolor

  if (!points || points.length === 0) return null

  const away = awayAbbr || 'AWY'
  const home = homeAbbr || 'HOM'
  const selected = points[activeIdx]
  // The last play of a finished game reads as the result (`final`, box score).
  const readout = winProbReadout(selected, { final: final && activeIdx === points.length - 1 })
  const split = winProbSplit([selected])
  const awayColors = chipColorsFor(awayId)
  const homeColors = chipColorsFor(homeId)
  const awayLayout = awayMilb ? milbWpaLogoLayout(awayId, 'away') : wpaLogoLayout(awayId, awayTreat)
  // `homeLayoutOverride` — Team Identity Lab's TreatmentWpaPreview draft
  // (merged over the shipped WPA_LOGO_LAYOUT_OVERRIDES default, same shape
  // wpaLogoLayout returns) — lets that page's scenario mockups show an
  // in-progress edit live, without a second, drift-prone tile-rendering
  // path. No other caller passes it, so every real game chart is
  // unaffected.
  const homeLayout = homeLayoutOverride ?? (homeMilb ? milbWpaLogoLayout(homeId, 'home') : wpaLogoLayout(homeId, homeTreat))
  const awayTile = wpaTilePlacements(awayLayout)
  const homeTile = wpaTilePlacements(homeLayout)
  const awayPatternId = `winprob-away-${patternUid}`
  const homePatternId = `winprob-home-${patternUid}`
  const awayRecolorId = `winprob-recolor-away-${patternUid}`
  const homeRecolorId = `winprob-recolor-home-${patternUid}`
  // The band's own fill: WPA_TREATMENT_BAND_COLOR_OVERRIDES /
  // BAND_COLOR_OVERRIDES for the handful of clubs whose primary chip color
  // isn't the right pick here, else the same chip color used everywhere
  // else on this card (header swatches, splitbar). Pinstripe (a scorebook
  // white-with-line pattern instead of a flat fill) wins outright when set —
  // same tables Team Identity Lab's logo box reads, so a pinstriped tile there
  // renders pinstriped here too.
  const awayPinstripe = awayMilb ? milbWpaBandPinstripeColor(awayId, 'away') : wpaBandPinstripeColor(awayId, awayTreat)
  // `homeBandOverride` — `{ pinstripe, color, bg }`, the SAME live draft state
  // as homeLayoutOverride above (Team Identity Lab's TreatmentWpaPreview +
  // ColorSwatch pick), standing in for the wpaBandPinstripeColor/wpaBandColor/
  // wpaBandPinstripeBg table lookups below it — so an in-progress Fill edit
  // shows up in this same live mockup, not just the tile's own preview.
  const homePinstripe = homeBandOverride
    ? (homeBandOverride.pinstripe ? homeBandOverride.color : null)
    : homeMilb
      ? milbWpaBandPinstripeColor(homeId, 'home')
      : wpaBandPinstripeColor(homeId, homeTreat)
  // MiLB pinstripe bands have no colored-bg variant (milbColors.js's Home/Away
  // system, unlike the MLB one, never pairs a pinstripe with anything but a
  // plain white fill) — only the MLB lookup can return one.
  const awayPinstripeBg = awayMilb ? null : wpaBandPinstripeBg(awayId, awayTreat)
  const homePinstripeBg = homeBandOverride
    ? (homeBandOverride.pinstripe ? homeBandOverride.bg || undefined : null)
    : homeMilb
      ? null
      : wpaBandPinstripeBg(homeId, homeTreat)
  const awayPinstripeId = `winprob-pinstripe-away-${patternUid}`
  const homePinstripeId = `winprob-pinstripe-home-${patternUid}`
  const awaySolid = awayMilb ? milbWpaBandColor(awayId, 'away') : wpaBandColor(awayId, awayTreat)
  const homeSolid = homeBandOverride
    ? homeBandOverride.color
    : homeMilb
      ? milbWpaBandColor(homeId, 'home')
      : wpaBandColor(homeId, homeTreat)
  const awayBandFill = awayPinstripe ? `url(#${awayPinstripeId})` : awaySolid
  const homeBandFill = homePinstripe ? `url(#${homePinstripeId})` : homeSolid
  // The colour key (header swatches, change pill, swing pills) takes each
  // band's own colour, so a pill matches the band it describes
  // (winprob/keyColors.js). A pinstripe band keys on its line colour.
  const keys = winProbKeyPair(
    winProbKeyColor(awayPinstripe ?? awaySolid, awayColors),
    winProbKeyColor(homePinstripe ?? homeSolid, homeColors),
    awayColors,
  )

  // Prepend a synthetic even-game origin so the line starts on the midfield 50%
  // (the score is 0–0 at first pitch); its inning matches the first real play so
  // the inning bands stay right.
  const pts = [{ home: 50, inning: points[0].inning, half: 'start' }, ...points]
  const n = pts.length

  const x = (i) => (n === 1 ? PLOT_L : PLOT_L + (i / (n - 1)) * PLOT_W)
  const y = (h) => PLOT_T + (1 - h / 100) * PLOT_H

  const linePath =
    `M 0 ${y(pts[0].home).toFixed(1)} ` +
    pts.map((p, i) => `L ${x(i).toFixed(1)} ${y(p.home).toFixed(1)}`).join(' ') +
    ` L ${W} ${y(pts[n - 1].home).toFixed(1)}`

  // Home band: the area between the line and the baseline. The away band is the
  // plot rect behind it, so the two always tile the full height.
  const homeArea = `M 0 ${PLOT_B} L${linePath.slice(1)} L ${W} ${PLOT_B} Z`

  const scoring = pts
    .map((p, i) => (p.isScoring ? i : -1))
    .filter((i) => i >= 0)

  const change = readout.delta == null ? '' : winProbChangeLabel(readout.delta, home, away)
  const changeKey = Math.round(readout.delta ?? 0) === 0 ? null : readout.delta > 0 ? keys.home : keys.away
  const summary = `${away} ${split.away}%, ${home} ${split.home}%. ${readout.context.replace('▲', 'Top ').replace('▼', 'Bottom ')}.${change ? ` ${change}.` : ''}`

  // A swing marker floats above the step it marks on a short pin, or below it
  // when the step is too near the top, so it never covers the line.
  const markerAt = (idx) => {
    const cx = x(idx + 1)
    const cy = y(points[idx].home)
    const up = cy - MARK_LIFT - MARK_R >= PLOT_T
    const my = up ? cy - MARK_LIFT : cy + MARK_LIFT
    return { cx, cy, my, edge: up ? my + MARK_R : my - MARK_R }
  }

  return (
    <Card body="flush" className="winprob">
      <div className="winprob__head sectionhead--band sectionhead--house">
        <h3 className="winprob__title">Win probability</h3>
        {/* The slider's aria-valuetext reads these same two numbers. */}
        <div className="winprob__split" aria-hidden="true">
          <span className="winprob__team winprob__team--away" style={{ '--team-color': keys.away.fill }}>
            {away} <span className="winprob__pct">{split.away}%</span>
          </span>
          <span className="winprob__team winprob__team--home" style={{ '--team-color': keys.home.fill }}>
            {home} <span className="winprob__pct">{split.home}%</span>
          </span>
        </div>
      </div>

      <div className="winprob__explorer">
      {/* The slider's aria-valuetext and the help text below carry all of this. */}
      <div className="winprob__readout" aria-hidden="true">
        {changeKey ? (
          <span className="pill pill--ink pill--figure winprob__change" style={winProbKeyPill(changeKey)}>{change}</span>
        ) : (
          change && <span className="winprob__change winprob__change--none">{change}</span>
        )}
        <span className="winprob__context">
          {readout.context} · Play {activeIdx + 1}/{points.length}{partial ? ' revealed' : ''}
          {/* The how-to drops once the reader has used the chart. */}
          {!used && <span className="winprob__hint winprob__hint-fine"> · Hover or use ← →</span>}
          {!used && <span className="winprob__hint winprob__hint-touch"> · Tap or drag</span>}
        </span>
      </div>

      <svg
        ref={svgRef}
        className="winprob__svg"
        data-input={input}
        viewBox={`0 0 ${W} ${H}`}
        role="slider"
        tabIndex={0}
        aria-label="Explore win probability by completed play"
        aria-valuemin={1} aria-valuemax={points.length} aria-valuenow={activeIdx + 1}
        aria-valuetext={summary}
        aria-describedby={`winprob-help-${patternUid}`}
        {...svgHandlers}
      >
        {/* Each band's step-and-repeat texture: a tile of a solid fill of
            that band's own color (BAND_COLOR_OVERRIDES-aware) plus one copy
            of that club's own logo (wpaLogoFor-resolved — see the block
            comments up top for both). patternTransform (identical on
            both patterns) tilts + shifts the shared tile grid off-axis, so
            it reads as wallpaper rather than a grid anchored at the plot's
            corner. patternUnits="userSpaceOnUse" plus matching x/y ties both
            patterns to the SAME chart-coordinate origin, so — transform
            included — the away and home tiles still line up into one
            continuous grid across the seam between them. */}
        <defs>
          <RecolorFilter id={awayRecolorId} override={awayLogoOverride} />
          <RecolorFilter id={homeRecolorId} override={homeLogoOverride} />
          {awayPinstripe && (
            <PinstripePattern id={awayPinstripeId} color={awayPinstripe} bg={awayPinstripeBg ?? undefined} />
          )}
          {homePinstripe && (
            <PinstripePattern id={homePinstripeId} color={homePinstripe} bg={homePinstripeBg ?? undefined} />
          )}
          <pattern
            id={awayPatternId}
            patternUnits="userSpaceOnUse"
            x={PLOT_L}
            y={PLOT_T}
            width={awayTile.tileW}
            height={awayTile.tileH}
            patternTransform={`rotate(${awayLayout.rotate}) translate(${awayLayout.offsetX} ${awayLayout.offsetY})`}
            style={{ overflow: 'visible' }}
          >
            <rect
              width={awayTile.tileW}
              height={awayTile.tileH}
              className="winprob__patternbg"
              style={{ '--band-color': awayBandFill }}
            />
            {awayLogo &&
              awayTile.images.map((img, i) => (
                <image
                  key={i}
                  href={awayLogo}
                  x={img.x}
                  y={img.y}
                  width={awayLayout.size}
                  height={awayLayout.size}
                  className="winprob__patternlogo"
                  filter={awayLogoOverride && awayLogoOverride.mode !== 'swap' ? `url(#${awayRecolorId})` : undefined}
                />
              ))}
          </pattern>
          <pattern
            id={homePatternId}
            patternUnits="userSpaceOnUse"
            x={PLOT_L}
            y={PLOT_T}
            width={homeTile.tileW}
            height={homeTile.tileH}
            patternTransform={`rotate(${homeLayout.rotate}) translate(${homeLayout.offsetX} ${homeLayout.offsetY})`}
            style={{ overflow: 'visible' }}
          >
            <rect
              width={homeTile.tileW}
              height={homeTile.tileH}
              className="winprob__patternbg"
              style={{ '--band-color': homeBandFill }}
            />
            {homeLogo &&
              homeTile.images.map((img, i) => (
                <image
                  key={i}
                  href={homeLogo}
                  x={img.x}
                  y={img.y}
                  width={homeLayout.size}
                  height={homeLayout.size}
                  className="winprob__patternlogo"
                  filter={homeLogoOverride && homeLogoOverride.mode !== 'swap' ? `url(#${homeRecolorId})` : undefined}
                />
              ))}
          </pattern>
        </defs>

        {/* Away band fills the whole plot; the home band is painted over it. */}
        <rect
          className="winprob__band winprob__band--away"
          x={0}
          y={PLOT_T}
          width={W}
          height={PLOT_H}
          style={{ fill: `url(#${awayPatternId})` }}
        />
        <path className="winprob__band winprob__band--home" d={homeArea} style={{ fill: `url(#${homePatternId})` }} />

        {/* The win-probability line itself. */}
        {/* An ink casing under the line keeps it readable on any band. */}
        <path className="winprob__line-casing" d={linePath} />
        <path className="winprob__line" d={linePath} />

        {/* Scoring plays — where the line took its steps. Flattened into the
            line on purpose (small, dim, no stroke halo, no pointer affordance):
            not every scoring play is a big swing, so this layer must stay
            visibly inert rather than read as a second kind of tappable dot —
            see the big-swing markers below, a DIFFERENT set of plays. */}
        {scoring.map((i) => (
          <circle
            key={`sc-${i}`}
            className="winprob__scoremark"
            cx={x(i)}
            cy={y(pts[i].home)}
            r={1.4}
          />
        ))}

        {/* The current/final point. */}
        <circle
          className="winprob__now"
          cx={x(n - 1)}
          cy={y(pts[n - 1].home)}
          r={3}
        />

        {/* The selection cursor sits under the numbered markers, so a
            marker stays readable when the cursor passes over it. */}
        <g className="winprob__cursor" aria-hidden="true">
          <path className="winprob__cursor-halo" d={`M ${x(activeIdx + 1)} ${PLOT_T} V ${PLOT_B}`} />
          <path className="winprob__cursor-line" d={`M ${x(activeIdx + 1)} ${PLOT_T} V ${PLOT_B}`} />
          <circle cx={x(activeIdx + 1)} cy={y(selected.home)} r={4} />
        </g>

        {/* Numbered landmarks match the ledger (1 = biggest swing). */}
        {bigPlays.map((p, index) => {
          const m = markerAt(p.idx)
          return (
            <g key={p.idx} className={`winprob__moment${activeIdx === p.idx ? ' is-active' : ''}`}>
              <path className="winprob__pin" d={`M ${m.cx} ${m.cy} V ${m.edge}`} />
              <circle cx={m.cx} cy={m.my} r={MARK_R} />
              <text x={m.cx} y={m.my} dy=".35em" textAnchor="middle">{index + 1}</text>
            </g>
          )
        })}
      </svg>

      <p id={`winprob-help-${patternUid}`} className="sr-only">Hover, tap or drag to select a recorded play. Arrow keys move one play. Home selects the first; End selects the latest. Values are rounded to whole percentages. Probabilities are after the selected play.</p>

      <SwingLedger
        bigPlays={bigPlays}
        activeIdx={activeIdx}
        home={home}
        away={away}
        keys={keys}
        clip={clip}
        onPick={pickSwing}
        onWatch={select}
      />
      </div>

      {clip.open && (
        <HighlightSheet
          item={clip.open.item}
          src={clip.src}
          loading={clip.loading}
          notice={clip.notice}
          title={clip.open.title}
          onClose={clip.close}
        />
      )}
    </Card>
  )
}
