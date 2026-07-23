import { useId, useState } from 'react'
import { winProbSplit } from '../api/winprob.js'
import { teamChipColors, teamLogoUrl } from '../lib/teams.js'
import { ordinal } from '../lib/format.js'

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
// No horizontal or vertical grid lines, and no numeric y-axis — the two
// solid bands' own boundary already reads as "which side of 50%," and the
// two labeled split pills up top carry the exact numbers, so the gridlines/
// axis labels were dropped to give the plot the width back. The inning axis
// itself is landmarks, not a full ledger — only the top of every 3rd inning
// (3, 6, 9, and on into extras — 12, 15, …) gets a label.
//
// SPOILER RULE: this only draws what it's handed. `points` comes from
// selectWinProbPath (api/winprob.js), a REVEAL-ONLY selector — the box score
// passes the whole game (inside its seal), the innings view passes only the
// plays through the revealed half. So there's nothing sealed to leak here; this
// component never reaches for the feed itself. Renders nothing on an empty path
// (no data / a MiLB park with no win-prob endpoint), so callers can drop it in
// unconditionally.
//
// `partial` tags the innings-view instance for its accessible summary; the box
// score omits it.

const W = 328
const H = 168
// No y-axis labels to clear room for anymore (see the block comment above) —
// just enough left margin for the bands/line to not butt against the card
// edge.
const PAD_L = 8
const PAD_R = 16
const PAD_T = 10
const PAD_B = 22
const PLOT_L = PAD_L
const PLOT_R = W - PAD_R
const PLOT_T = PAD_T
const PLOT_B = H - PAD_B
const INNING_LABEL_Y = H - 7
// Only every 3rd inning gets an axis label (top of 3, top of 6, top of 9,
// and on into extras — 12, 15, …) — labeling every half-inning read as
// clutter once the bands themselves carry the identity via color + logo, and
// a coarser landmark ("about a third of the way through") is plenty to
// orient by.
const INNING_LABEL_STEP = 3
const PLOT_W = PLOT_R - PLOT_L
const PLOT_H = PLOT_B - PLOT_T

// The step-and-repeat band texture: each tile is a SOLID fill of that band's
// own club color plus one full-opacity copy of that club's own logo, inset
// with a small margin so neighboring tiles don't touch — compact and tightly
// packed rather than sparse. `LOGO_ROTATE` + `LOGO_OFFSET` (via
// patternTransform, see the pattern defs below) tilt and shift the whole
// tile grid off-axis, so the wallpaper reads as something the eye stumbles
// into mid-pattern rather than a grid anchored at the plot's top-left corner.
const LOGO_SIZE = 20
const LOGO_TILE = LOGO_SIZE + 4
const LOGO_INSET = (LOGO_TILE - LOGO_SIZE) / 2
const LOGO_ROTATE = -14
const LOGO_OFFSET_X = 8
const LOGO_OFFSET_Y = 6

// A handful of clubs' base logo mark is itself (near-)solid in the same hex
// as their own primary brand color — verified against the actual CDN SVGs,
// not a guess — so tiled over a same-colored band (below), the mark all but
// vanishes into its own background. Each entry is a hand-picked fix for one
// club, in one of three modes:
//   - 'flood': recolor the WHOLE rendered silhouette (its alpha channel) to
//     `color` via an SVG filter (feFlood + feComposite) — for a mark that's
//     genuinely (or close enough to) one flat color throughout, so there's
//     nothing worth preserving from its original fills.
//   - 'outline': keep the mark's own original colors, but add (or, per
//     Phillies, thicken an EXISTING) `color` halo just outside its
//     silhouette via feMorphology (dilate) + feFlood + feComposite +
//     feMerge — for a mark that's otherwise fine, just needs a touch more
//     separation from its own band.
//   - 'swap': the mark has MULTIPLE distinct original colors and only ONE
//     of them collides with the band — recoloring the whole silhouette
//     (flood) would wrongly flatten the colors that were already fine, and
//     an SVG filter can't reliably isolate one specific original hex from
//     another at this render size (anti-aliased edges between the two
//     regions blend into a smear). So `src` points at a small precomputed
//     variant of the CDN's own SVG (public/team-logo-overrides/), a
//     byte-for-byte copy with ONLY the colliding fill's hex swapped —
//     verified against the live CDN source, not reconstructed from memory.
// A team with no entry here keeps its logo's own natural colors.
export const LOGO_COLOR_OVERRIDES = {
  113: { mode: 'flood', color: '#FFFFFF' }, // Reds — base mark is solid red, no black in it to preserve
  118: { mode: 'flood', color: '#FFFFFF' }, // Royals
  119: { mode: 'flood', color: '#FFFFFF' }, // Dodgers
  120: { mode: 'flood', color: '#FFFFFF' }, // Nationals
  133: { mode: 'flood', color: '#FFFFFF' }, // Athletics
  135: { mode: 'flood', color: '#FFC425' }, // Padres — their own secondary yellow
  137: { mode: 'flood', color: '#27251F' }, // Giants — their own secondary near-black
  138: { mode: 'flood', color: '#FFFFFF' }, // Cardinals
  147: { mode: 'flood', color: '#FFFFFF' }, // Yankees
  116: { mode: 'flood', color: '#FFFFFF' }, // Tigers — the "D"
  142: { mode: 'swap', src: '/team-logo-overrides/142.svg' }, // Twins — navy "T" to white, red kept
  114: { mode: 'swap', src: '/team-logo-overrides/114.svg' }, // Guardians — navy outer border to white, red kept
  143: { mode: 'outline', color: '#FFFFFF', radius: 0.6 }, // Phillies — thicken the mark's existing white edge
}

// A handful of clubs' band background is better off as something OTHER than
// their TEAM_COLOR_PAIRS primary (teams.js) — a lighter secondary shade that
// reads better as a big fill. Falls through to the team's normal chip
// primary for every other team.
export const BAND_COLOR_OVERRIDES = {
  109: '#E3D4AD', // Diamondbacks — their real secondary sand/desert tone (TEAM_COLOR_PAIRS)
  111: '#0C2340', // Red Sox — secondary navy, not primary red
  136: '#005C5C', // Mariners — secondary green/teal, not primary navy
  139: '#8FBCE6', // Rays — secondary lighter blue, not primary navy
}

// A team's brand pair for chip/marker chrome, falling back to a neutral
// graphite pair for a team teamChipColors doesn't know (no teamId handed in,
// or an unrecognized MiLB id) rather than rendering an undefined color.
export function chipColorsFor(teamId) {
  return teamChipColors(teamId) ?? { primary: '#6B6558', secondary: '#938C7C', text: '#FBF6E9' }
}

// The <filter> a LOGO_COLOR_OVERRIDES entry needs, or null for no override /
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
  partial = false,
}) {
  // Linked highlighting: `pinnedIdx` survives until the same marker/row is
  // tapped again or the card is tapped elsewhere (this app is phone-first —
  // a phone has no hover, so pinning is the interaction that has to work).
  // `hoveredIdx` is a desktop-only bonus layered on top, cleared on
  // pointer-leave; a pin always wins over a stray hover. Both key off
  // `p.idx` — selectWinProbBigPlays' own index into `points`, not a
  // synthesized row id, so chart and ledger read the exact same identity.
  // Unique per mounted chart (the box score and the innings view can each
  // have their own WinProbChart instance on screen), so the two bands'
  // <pattern> defs never collide across instances despite sharing one <svg>
  // document-wide id namespace.
  const patternUid = useId()
  const [pinnedIdx, setPinnedIdx] = useState(null)
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const activeIdx = pinnedIdx ?? hoveredIdx
  const hasActive = activeIdx != null
  const togglePin = (idx) => setPinnedIdx((was) => (was === idx ? null : idx))
  const linkedProps = (idx, label) => ({
    tabIndex: 0,
    role: 'button',
    'aria-label': label,
    onPointerEnter: () => setHoveredIdx(idx),
    onPointerLeave: () => setHoveredIdx(null),
    onClick: (e) => {
      e.stopPropagation()
      togglePin(idx)
    },
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        togglePin(idx)
      }
    },
  })

  if (!points || points.length === 0) return null

  const away = awayAbbr || 'AWY'
  const home = homeAbbr || 'HOM'
  const split = winProbSplit(points)
  const awayColors = chipColorsFor(awayId)
  const homeColors = chipColorsFor(homeId)
  const awayLogoOverride = LOGO_COLOR_OVERRIDES[awayId]
  const homeLogoOverride = LOGO_COLOR_OVERRIDES[homeId]
  // A 'swap' override points at its own precomputed asset (see the
  // LOGO_COLOR_OVERRIDES block comment); every other case — no override, or
  // a 'flood'/'outline' override that recolors the ORIGINAL art in place via
  // filter — uses the normal CDN mark. Same base-variant mark the ABS
  // Challenges/favor-meter logos on this same card already use — null for
  // an unmapped MiLB id, in which case that band's pattern just has no logo
  // tile and reads as its flat structural color, same as before this
  // feature existed.
  const awayLogo = awayLogoOverride?.mode === 'swap' ? awayLogoOverride.src : teamLogoUrl(awayId)
  const homeLogo = homeLogoOverride?.mode === 'swap' ? homeLogoOverride.src : teamLogoUrl(homeId)
  const awayPatternId = `winprob-away-${patternUid}`
  const homePatternId = `winprob-home-${patternUid}`
  const awayRecolorId = `winprob-recolor-away-${patternUid}`
  const homeRecolorId = `winprob-recolor-home-${patternUid}`
  // The band's own fill: BAND_COLOR_OVERRIDES for the handful of clubs whose
  // primary chip color isn't the right pick here, else the same chip color
  // used everywhere else on this card (header swatches, splitbar).
  const awayBandColor = BAND_COLOR_OVERRIDES[awayId] ?? awayColors.primary
  const homeBandColor = BAND_COLOR_OVERRIDES[homeId] ?? homeColors.primary

  // Prepend a synthetic even-game origin so the line starts on the midfield 50%
  // (the score is 0–0 at first pitch); its inning matches the first real play so
  // the inning bands stay right.
  const pts = [{ home: 50, inning: points[0].inning, half: 'start' }, ...points]
  const n = pts.length

  const x = (i) => (n === 1 ? PLOT_L : PLOT_L + (i / (n - 1)) * PLOT_W)
  const y = (h) => PLOT_T + (1 - h / 100) * PLOT_H

  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.home).toFixed(1)}`)
    .join(' ')

  // Home band: the area between the line and the baseline. The away band is the
  // plot rect behind it, so the two always tile the full height.
  const homeArea =
    `M ${x(0).toFixed(1)} ${PLOT_B} ` +
    pts.map((p, i) => `L ${x(i).toFixed(1)} ${y(p.home).toFixed(1)}`).join(' ') +
    ` L ${x(n - 1).toFixed(1)} ${PLOT_B} Z`

  // Contiguous runs of the same half-inning (not just the same inning), for the
  // dividing hairlines and the inning-number labels centered under each run —
  // this is what lets top and bottom of an inning show as two distinct spans
  // instead of one merged block.
  const groups = []
  for (let i = 0; i < pts.length; i++) {
    const key = `${pts[i].inning}-${pts[i].half}`
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.end = i
    else groups.push({ inning: pts[i].inning, half: pts[i].half, key, start: i, end: i })
  }

  const scoring = pts
    .map((p, i) => (p.isScoring ? i : -1))
    .filter((i) => i >= 0)

  const summary =
    `Win probability${partial ? ' through the revealed half' : ''}: ` +
    `${home} ${split.home}%, ${away} ${split.away}%.`

  return (
    <section className={`winprob${hasActive ? ' is-active' : ''}`} onClick={() => setPinnedIdx(null)}>
      <div className="winprob__head">
        <h3 className="winprob__title">Win probability</h3>
        <div className="winprob__split" aria-hidden="true">
          <span className="winprob__team winprob__team--away" style={{ '--team-color': awayColors.primary }}>
            {away} <span className="winprob__pct">{split.away}%</span>
          </span>
          <span className="winprob__team winprob__team--home" style={{ '--team-color': homeColors.primary }}>
            {home} <span className="winprob__pct">{split.home}%</span>
          </span>
        </div>
      </div>

      {/* A one-line proportional recap of the split, in each team's own real
          color — the header swatches already carry the identity, this just
          echoes it as a shape. Purely decorative (the split pills carry the
          real numbers), hidden from assistive tech. */}
      <div className="winprob__splitbar" aria-hidden="true">
        <span
          className="winprob__splitbar-seg"
          style={{ width: `${split.away}%`, background: awayColors.primary }}
        />
        <span
          className="winprob__splitbar-seg"
          style={{ width: `${split.home}%`, background: homeColors.primary }}
        />
      </div>

      <svg
        className="winprob__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={summary}
      >
        {/* Each band's step-and-repeat texture: a tile of a solid fill of
            that band's own color (BAND_COLOR_OVERRIDES-aware) plus one copy
            of that club's own logo (LOGO_COLOR_OVERRIDES-aware — see the
            block comments up top for both). patternTransform (identical on
            both patterns) tilts + shifts the shared tile grid off-axis, so
            it reads as wallpaper rather than a grid anchored at the plot's
            corner. patternUnits="userSpaceOnUse" plus matching x/y ties both
            patterns to the SAME chart-coordinate origin, so — transform
            included — the away and home tiles still line up into one
            continuous grid across the seam between them. */}
        <defs>
          <RecolorFilter id={awayRecolorId} override={awayLogoOverride} />
          <RecolorFilter id={homeRecolorId} override={homeLogoOverride} />
          <pattern
            id={awayPatternId}
            patternUnits="userSpaceOnUse"
            x={PLOT_L}
            y={PLOT_T}
            width={LOGO_TILE}
            height={LOGO_TILE}
            patternTransform={`rotate(${LOGO_ROTATE}) translate(${LOGO_OFFSET_X} ${LOGO_OFFSET_Y})`}
          >
            <rect
              width={LOGO_TILE}
              height={LOGO_TILE}
              className="winprob__patternbg"
              style={{ '--band-color': awayBandColor }}
            />
            {awayLogo && (
              <image
                href={awayLogo}
                x={LOGO_INSET}
                y={LOGO_INSET}
                width={LOGO_SIZE}
                height={LOGO_SIZE}
                className="winprob__patternlogo"
                filter={awayLogoOverride && awayLogoOverride.mode !== 'swap' ? `url(#${awayRecolorId})` : undefined}
              />
            )}
          </pattern>
          <pattern
            id={homePatternId}
            patternUnits="userSpaceOnUse"
            x={PLOT_L}
            y={PLOT_T}
            width={LOGO_TILE}
            height={LOGO_TILE}
            patternTransform={`rotate(${LOGO_ROTATE}) translate(${LOGO_OFFSET_X} ${LOGO_OFFSET_Y})`}
          >
            <rect
              width={LOGO_TILE}
              height={LOGO_TILE}
              className="winprob__patternbg"
              style={{ '--band-color': homeBandColor }}
            />
            {homeLogo && (
              <image
                href={homeLogo}
                x={LOGO_INSET}
                y={LOGO_INSET}
                width={LOGO_SIZE}
                height={LOGO_SIZE}
                className="winprob__patternlogo"
                filter={homeLogoOverride && homeLogoOverride.mode !== 'swap' ? `url(#${homeRecolorId})` : undefined}
              />
            )}
          </pattern>
        </defs>

        {/* Away band fills the whole plot; the home band is painted over it. */}
        <rect
          className="winprob__band winprob__band--away"
          x={PLOT_L}
          y={PLOT_T}
          width={PLOT_W}
          height={PLOT_H}
          style={{ fill: `url(#${awayPatternId})` }}
        />
        <path className="winprob__band winprob__band--home" d={homeArea} style={{ fill: `url(#${homePatternId})` }} />

        {/* The win-probability line itself. */}
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

        {/* Inning landmarks along the foot — every half used to get its own
            label, which packed unreadably tight past a handful of innings;
            now only the top of every INNING_LABEL_STEP-th inning (3, 6, 9,
            and on into extras — 12, 15, …) gets one, coarse orientation
            ("about a third of the way through") rather than a full ledger
            the bands' own color + logo already make redundant. Always the
            top half specifically (the ▲ arrow — same card-wide rule as
            before: this is the only ▲/▼ glyph on this card, the ledger below
            carries direction as a team-colored chip instead) so the mark
            always lands on a consistent, real half-inning rather than
            needing to guess whether inning N's bottom was played. */}
        {groups
          .filter((g) => g.half === 'top' && g.inning % INNING_LABEL_STEP === 0)
          .map((g) => (
            <text
              key={`in-${g.key}`}
              className="winprob__inninglabel"
              x={(x(g.start) + x(g.end)) / 2}
              y={INNING_LABEL_Y}
              textAnchor="middle"
            >
              <tspan className="winprob__inningarrow">▲</tspan>
              {g.inning}
            </text>
          ))}

        {/* Linked highlighting, chart half: one hand-drawn baseball marker per
            selectWinProbBigPlays() entry, at points[bigPlay.idx]'s exact
            position — bigPlays isn't the same set as the scoring flecks above
            (a replay-reversed double play can swing win% hard with no run
            involved), so this is its own layer, not a reuse. `+1` accounts for
            the synthetic origin point prepended to `pts`. Idle markers sit at
            equal, unhighlighted weight; once anything is active every OTHER
            marker fades (`.winprob.is-active .winprob__bigdot:not(.is-active)`,
            see index.css) and the active one grows, tints toward the favored
            team's real brand color, and shows its value label. */}
        {bigPlays.map((p) => {
          const ptsIdx = p.idx + 1
          const cx = x(ptsIdx)
          const cy = y(pts[ptsIdx].home)
          const toHome = p.delta > 0
          const abbr = toHome ? home : away
          const colors = chipColorsFor(toHome ? homeId : awayId)
          const val = Math.round(Math.abs(p.delta))
          const labelText = `${abbr} +${val}%`
          const labelW = 16 + labelText.length * 6.4
          const labelBelow = cy < PLOT_T + PLOT_H * 0.32
          const labelY = labelBelow ? cy + 18 : cy - 14
          const labelCx = Math.min(W - 3 - labelW / 2, Math.max(3 + labelW / 2, cx))
          // Two mirrored seam arcs sized off the ball's r=3.5 body — a
          // simplified stand-in for real stitching, legible at this scale.
          const seamL = `M ${(cx - 1.9).toFixed(1)},${(cy - 2.6).toFixed(1)} Q ${(cx - 0.5).toFixed(1)},${cy.toFixed(1)} ${(cx - 1.9).toFixed(1)},${(cy + 2.6).toFixed(1)}`
          const seamR = `M ${(cx + 1.9).toFixed(1)},${(cy - 2.6).toFixed(1)} Q ${(cx + 0.5).toFixed(1)},${cy.toFixed(1)} ${(cx + 1.9).toFixed(1)},${(cy + 2.6).toFixed(1)}`
          const isActive = activeIdx === p.idx
          return (
            <g
              key={`bp-${p.idx}`}
              className={`winprob__bigdot${isActive ? ' is-active' : ''}`}
              style={{ '--team-color': colors.primary, '--team-text': colors.text }}
              {...linkedProps(
                p.idx,
                `Biggest swing: ${labelText}, ${p.half === 'top' ? 'top' : 'bottom'} of the ${ordinal(p.inning)}`,
              )}
            >
              <circle className="winprob__bigdot-hit" cx={cx} cy={cy} r={11} />
              <circle className="winprob__bigdot-ring" cx={cx} cy={cy} />
              <g className="winprob__bigdot-ball">
                <circle className="winprob__ball-body" cx={cx} cy={cy} r={3.5} />
                <path className="winprob__ball-seam" d={seamL} />
                <path className="winprob__ball-seam" d={seamR} />
              </g>
              <g className="winprob__bigdot-label" transform={`translate(${labelCx.toFixed(1)},${labelY.toFixed(1)})`}>
                <rect
                  className="winprob__bigdot-label-bg"
                  x={-labelW / 2}
                  y={-9}
                  width={labelW}
                  height={15}
                  rx={7.5}
                />
                <text className="winprob__bigdot-label-text" textAnchor="middle" dy={2}>
                  {labelText}
                </text>
              </g>
            </g>
          )
        })}
      </svg>

      {bigPlays.length > 0 && (
        <div className="winprob__ledger">
          <h4 className="winprob__subhead">Biggest swings</h4>
          <ol className="winprob__ledger-list">
            {bigPlays.map((p) => {
              const toHome = p.delta > 0
              const abbr = toHome ? home : away
              const colors = chipColorsFor(toHome ? homeId : awayId)
              const val = Math.round(Math.abs(p.delta))
              const chipText = `${abbr} +${val}%`
              // "Top 1st" / "Bottom 5th" — same half-label + ordinal shape as
              // the half card's own title (HalfInning.jsx), rendered upper-
              // case by .winprob__ledger-half's own text-transform rather
              // than the old compact "T1"/"B5" shorthand.
              const tag = `${p.half === 'top' ? 'Top' : 'Bottom'} ${ordinal(p.inning)}`
              const isActive = activeIdx === p.idx
              return (
                <li
                  className={`winprob__ledger-row${isActive ? ' is-active' : ''}`}
                  key={`bp-${p.idx}`}
                  style={{ '--team-color': colors.primary }}
                  {...linkedProps(
                    p.idx,
                    `Biggest swing: ${chipText}, ${p.half === 'top' ? 'top' : 'bottom'} of the ${ordinal(p.inning)}`,
                  )}
                >
                  <span className="winprob__ledger-meta">
                    <span
                      className="winprob__ledger-chip"
                      style={{ background: colors.primary, color: colors.text }}
                    >
                      {chipText}
                    </span>
                    <span className="winprob__ledger-half">{tag}</span>
                  </span>
                  <p className="winprob__ledger-desc">{p.desc || `${abbr} rally`}</p>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </section>
  )
}
