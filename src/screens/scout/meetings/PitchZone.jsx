// THE PITCH MODAL'S MINI ZONE (#1490): one Savant pitch against ITS OWN zone
// (the row's sz_top / sz_bot), so the two always share a frame. Savant's 2026
// plate_z frame differs from the feed's, so a Savant pitch never goes on the
// season maps; drawn against its own row it is true (checked on 1,101 called
// 2026 pitches: the own-zone call agrees 94.3% of the time).
//
// It mirrors with the page's View, the way the maps do (ADR-0093): first base
// on the left in the Pitcher's view, on the right in the Hitter's. The side
// words say inside and away for the batter's stance in that plate appearance.
import { clamp } from '../../../lib/math/number.js'

const W = 120
const H = 140
const FT = 34 // px per foot
const TOP_FT = 4.4 // the frame's top, ft
const HALF = 17 / 24 // the plate's half width, ft

export function PitchZone({ pitch, view, stance, family }) {
  const sign = view === 'hitter' ? 1 : -1
  const X = (px) => W / 2 + sign * px * FT
  const Z = (pz) => 6 + (TOP_FT - pz) * FT
  const top = pitch.szTop ?? 3.5
  const bot = pitch.szBot ?? 1.6
  const x0 = Math.min(X(-HALF), X(HALF))
  const cx = clamp(X(pitch.px ?? 0), 6, W - 6)
  const cy = clamp(Z(pitch.pz ?? 2.5), 6, H - 20)
  // Third-base side is -x: on the viewer's left in the Hitter's view.
  const leftIs3b = view === 'hitter'
  const leftWord = leftIs3b === (stance === 'R') ? 'inside' : 'away'
  const rightWord = leftWord === 'inside' ? 'away' : 'inside'
  const thirds = [1, 2]
  return (
    <svg className="scout__pmzone" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Location: ${pitch.px == null ? 'not tracked' : `${Math.abs(pitch.px * 12).toFixed(0)} in ${pitch.px * (stance === 'R' ? -1 : 1) > 0 ? 'inside' : 'away'} of centre, ${pitch.pz?.toFixed(1)} ft high`}`}>
      <rect className="scout__pmbox" x={x0} y={Z(top)} width={2 * HALF * FT} height={(top - bot) * FT} />
      {thirds.map((k) => (
        <g key={k}>
          <line className="scout__pmgrid" x1={x0 + (2 * HALF * FT * k) / 3} x2={x0 + (2 * HALF * FT * k) / 3} y1={Z(top)} y2={Z(bot)} />
          <line className="scout__pmgrid" x1={x0} x2={x0 + 2 * HALF * FT} y1={Z(bot + ((top - bot) * k) / 3)} y2={Z(bot + ((top - bot) * k) / 3)} />
        </g>
      ))}
      <circle className="scout__pmdot" data-family={family} cx={cx} cy={cy} r="5" />
      <text className="scout__pmside" x="2" y={H - 4} textAnchor="start">{leftWord}</text>
      <text className="scout__pmside" x={W - 2} y={H - 4} textAnchor="end">{rightWord}</text>
    </svg>
  )
}
