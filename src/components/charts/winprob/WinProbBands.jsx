import { memo } from 'react'
import { wpaTilePlacements } from '../../../lib/wpa/wpaLogo.js'
import { W, PLOT_L, PLOT_T, PLOT_H } from './plot.js'

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

// The static band layer: the logo-tile <pattern>s and recolor <filter>s plus the
// two bands. Everything here is strings, numbers or objects that hold their
// identity between renders, so a pointer move that only shifts the cursor skips
// the whole subtree (memo). `homeArea` is the path string, so a new plot (a
// reveal or a live poll adding plays) still redraws it.
export const WinProbBands = memo(function WinProbBands({
  uid, homeArea, awayLayout, homeLayout, awayLogo, homeLogo, awayLogoOverride, homeLogoOverride,
  awayPinstripe, homePinstripe, awayPinstripeBg, homePinstripeBg, awaySolid, homeSolid,
}) {
  const awayTile = wpaTilePlacements(awayLayout)
  const homeTile = wpaTilePlacements(homeLayout)
  const awayPatternId = `winprob-away-${uid}`
  const homePatternId = `winprob-home-${uid}`
  const awayRecolorId = `winprob-recolor-away-${uid}`
  const homeRecolorId = `winprob-recolor-home-${uid}`
  const awayPinstripeId = `winprob-pinstripe-away-${uid}`
  const homePinstripeId = `winprob-pinstripe-home-${uid}`
  const awayBandFill = awayPinstripe ? `url(#${awayPinstripeId})` : awaySolid
  const homeBandFill = homePinstripe ? `url(#${homePinstripeId})` : homeSolid
  return (
    <>
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
    </>
  )
})
