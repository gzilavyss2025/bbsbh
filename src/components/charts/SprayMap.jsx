import { useId, useMemo, useState } from 'react'
import { HOME } from '../../lib/ballpark/ballparkGeometry.js'
import { HARD_HIT_MPH, hitCoordToSvg } from '../../lib/ballpark/hitProjection.js'
import { directionCaption, directionMix, hrNote, splitBalls } from '../../api/spray.js'

// The season spray map: where one batter's hits land, and how that moves
// against a right-handed or a left-handed pitcher.
//
// Purely presentational — it fetches nothing and derives nothing that isn't
// pure geometry. `view` arrives from src/api/spray.js, which is spoiler-FREE
// (a completed-game season aggregate on an open surface), so unlike its
// neighbour HitChart.jsx this card needs no gate of any kind. It shares that
// card's projection, its heat ramp and its home-run diamond on purpose: the
// same batted ball should look like the same batted ball wherever the app
// draws it.
//
// A GENERIC FIELD, AND THAT IS THE POINT. The hit chart plots onto the park
// the game was played in, because it charts ONE game. A season is 60 parks, so
// there is no park to draw — and a drawing that picked one would quietly claim
// a 330-foot line for balls hit in a stadium with a 355-foot one. So the ground
// here is a nameless field with no posted distances anywhere on it: foul lines,
// a fence, an infield. The fence is a horizon, not a measurement, and the card
// never says a ball cleared it.

// The window onto the shared 620x560 diagram space. Cut from the plotted
// season: across 193,235 balls in play the 0.1st-to-99.9th percentile spread is
// x 35→588 and y 63→554, so this box holds all but the handful of coordinates
// that land behind the backstop or in the second deck.
const VIEWBOX = '10 40 600 530'
const BOX = { x: 10, y: 40, w: 600, h: 530 }

// The nameless park. Symmetric, 330 down each line and 400 to centre, eased
// between with a mild exponent so the corners round the way a real outfield
// does. No posted number appears on the drawing — see the header.
const FENCE_POLE_FT = 330
const FENCE_CF_FT = 400
const FOUL_LINE_DEG = 45

// Feet from home, at `deg` off dead centre (negative toward left field), as a
// point in the diagram's own SVG space. The same mapping ballparkGeometry.js
// uses: feet 1:1 to SVG units, +x toward right field, y growing down the
// screen.
function ptAt(deg, ft) {
  const rad = (deg * Math.PI) / 180
  return { x: HOME.x + ft * Math.sin(rad), y: HOME.y - ft * Math.cos(rad) }
}

const fenceFt = (deg) =>
  FENCE_CF_FT - (FENCE_CF_FT - FENCE_POLE_FT) * Math.abs(deg / FOUL_LINE_DEG) ** 1.6

const f1 = (n) => Math.round(n * 10) / 10
const poly = (pts) => pts.map((p) => `${f1(p.x)} ${f1(p.y)}`).join(' L ')

const sample = (step, ft) => {
  const pts = []
  for (let deg = -FOUL_LINE_DEG; deg <= FOUL_LINE_DEG + 0.001; deg += step) {
    pts.push(ptAt(deg, typeof ft === 'function' ? ft(deg) : ft))
  }
  return pts
}

const FENCE_PATH = `M ${poly(sample(3, fenceFt))}`
const LEFT_LINE = `M ${f1(HOME.x)} ${f1(HOME.y)} L ${poly([ptAt(-FOUL_LINE_DEG, FENCE_POLE_FT)])}`
const RIGHT_LINE = `M ${f1(HOME.x)} ${f1(HOME.y)} L ${poly([ptAt(FOUL_LINE_DEG, FENCE_POLE_FT)])}`
// Bases at ninety feet, second base at the diagonal — the diamond, and nothing
// else. An infield drawn in full dirt-and-grass detail competes with the
// density layer that sits on top of it.
const DIAMOND = `M ${poly([
  { x: HOME.x, y: HOME.y },
  ptAt(45, 90),
  ptAt(0, 90 * Math.SQRT2),
  ptAt(-45, 90),
])} Z`
const MOUND = ptAt(0, 60.5)
// Fair territory as a clip: the wedge between the two foul lines, run out far
// enough to hold anything the box can show. It is the FOUL LINES that bound the
// heat, never the fence — a ball into the seats is still a fair ball, and
// clipping the density at a fence this park does not have would delete exactly
// the deepest contact.
const FAIR_CLIP = `M ${poly([{ x: HOME.x, y: HOME.y }, ...sample(5, 620)])} Z`

// The density grid. Coarse cells, counted then blurred, which is the cheapest
// honest heat map: no library, no per-point gradient stack, and a cell small
// enough that the blur — not the grid — is what the eye reads.
const CELL = 24
const BLUR = 16
const BANDS = 5

function densityCells(points) {
  const bins = new Map()
  for (const p of points) {
    const gx = Math.floor((p.x - BOX.x) / CELL)
    const gy = Math.floor((p.y - BOX.y) / CELL)
    const key = `${gx}:${gy}`
    bins.set(key, (bins.get(key) ?? 0) + 1)
  }
  if (!bins.size) return []
  // A floor under the denominator so a thin sample doesn't paint its two
  // busiest cells at full heat and call that a pattern.
  const denom = Math.max(3, ...bins.values())
  return [...bins].map(([key, n]) => {
    const [gx, gy] = key.split(':').map(Number)
    return {
      key,
      x: BOX.x + gx * CELL,
      y: BOX.y + gy * CELL,
      band: Math.min(BANDS, Math.max(1, Math.ceil((n / denom) * BANDS))),
    }
  })
}

const LEVEL_LABEL = { mlb: 'MLB', aaa: 'AAA' }
const isHit = (b) => b.result !== 'out'
const isXbh = (b) => b.result === 'double' || b.result === 'triple' || b.result === 'hr'
const pct = (n, of) => (of > 0 ? `${Math.round((n / of) * 100)}%` : '—')

export function SprayMap({ view }) {
  // An SVG id is document-global, and two spray maps can share a page once a
  // pitcher-side card exists — without a per-instance id the second card's
  // clip and blur would repaint the first one's heat.
  const uid = useId()
  const clipId = `spray-fair-${uid}`
  const blurId = `spray-blur-${uid}`

  const [split, setSplit] = useState('all')
  const [hardOnly, setHardOnly] = useState(false)

  const chosen = view.splits.find((s) => s.key === split) ?? view.splits[0]
  const balls = useMemo(() => splitBalls(view.balls, chosen.key), [view.balls, chosen.key])
  const hits = useMemo(() => balls.filter(isHit), [balls])

  // The density's basis is HITS by default — the question the card answers is
  // where this man's hits go. The switch re-bases it to hard contact (95+ mph)
  // over every ball in play, hit or out, which is the other question worth
  // asking of the same picture: where he squares a ball up, whether or not it
  // found grass.
  const basis = useMemo(
    () => (hardOnly ? balls.filter((b) => b.exitVelo != null && b.exitVelo >= HARD_HIT_MPH) : hits),
    [hardOnly, balls, hits],
  )
  const cells = useMemo(
    () => densityCells(basis.map((b) => hitCoordToSvg(b.x, b.y)).filter(Boolean)),
    [basis],
  )
  const marks = useMemo(
    () => hits.map((b) => ({ ...b, pt: hitCoordToSvg(b.x, b.y) })).filter((b) => b.pt),
    [hits],
  )

  const mix = useMemo(() => directionMix(balls), [balls])
  const note = hrNote(marks.filter((b) => b.result === 'hr').length, chosen.hr)
  const levels = view.levels.map((l) => LEVEL_LABEL[l]).join(' + ')

  return (
    <div className="spray">
      <div className="spray__chiprow">
        {view.splits.map((s) => (
          <button
            key={s.key}
            type="button"
            // NAVY WHEN LIT, never kraft amber: in this app amber is the seal
            // over a score you have not opened yet, and a control wearing it
            // would say "sealed" on a card that never seals anything.
            className={`spray__chip${s.key === chosen.key ? ' spray__chip--on' : ''}${
              s.thin ? ' spray__chip--thin' : ''
            }`}
            aria-pressed={s.key === chosen.key}
            aria-label={`${s.label}, ${s.bip} balls in play`}
            onClick={() => setSplit(s.key)}
          >
            {s.label}
            <span className="spray__count">{s.bip}</span>
          </button>
        ))}
      </div>

      <div className="spray__plot">
        <svg
          className="spray__field"
          viewBox={VIEWBOX}
          role="img"
          aria-label={`Spray map of ${view.name}'s hits, ${chosen.label}`}
        >
          <defs>
            <clipPath id={clipId}>
              <path d={FAIR_CLIP} />
            </clipPath>
            <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation={BLUR} />
            </filter>
          </defs>

          {/* Blurred first, THEN clipped — an SVG filter runs before the
              clip — so the heat can bleed softly inside the foul lines and
              stops dead at them. */}
          <g className="spray__heat" filter={`url(#${blurId})`} clipPath={`url(#${clipId})`}>
            {cells.map((c) => (
              <rect
                key={c.key}
                className={`spray__cell spray__cell--${c.band}`}
                x={c.x}
                y={c.y}
                width={CELL}
                height={CELL}
              />
            ))}
          </g>

          <g className="spray__art" aria-hidden="true">
            <path className="spray__fence" d={FENCE_PATH} />
            <path className="spray__foul" d={LEFT_LINE} />
            <path className="spray__foul" d={RIGHT_LINE} />
            <path className="spray__diamond" d={DIAMOND} />
            <circle className="spray__mound" cx={f1(MOUND.x)} cy={f1(MOUND.y)} r="5" />
          </g>

          <g className="spray__marks">
            {marks.map((b, i) =>
              b.result === 'hr' ? (
                <rect
                  key={`${b.pt.x}:${b.pt.y}:${i}`}
                  className="spray__hr"
                  x={b.pt.x - 6.5}
                  y={b.pt.y - 6.5}
                  width="13"
                  height="13"
                  transform={`rotate(45 ${b.pt.x} ${b.pt.y})`}
                />
              ) : (
                <circle
                  key={`${b.pt.x}:${b.pt.y}:${i}`}
                  className={isXbh(b) ? 'spray__dot spray__dot--xbh' : 'spray__dot'}
                  cx={b.pt.x}
                  cy={b.pt.y}
                  r={isXbh(b) ? 6.4 : 4.2}
                />
              ),
            )}
          </g>
        </svg>
      </div>

      <div className="spray__chiprow spray__chiprow--switches">
        <button
          type="button"
          className={`spray__chip${hardOnly ? ' spray__chip--on' : ''}`}
          aria-pressed={hardOnly}
          onClick={() => setHardOnly((v) => !v)}
        >
          <span className="spray__switch" aria-hidden="true" />
          Hard-hit heat <span className="spray__count">{HARD_HIT_MPH}+</span>
        </button>
        <p className="spray__basis">
          {hardOnly ? 'Heat shows balls hit 95+ mph' : 'Heat shows where the hits landed'}
        </p>
      </div>

      <div className="spray__key">
        <span className="spray__keyitem">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle className="spray__dot" cx="8" cy="8" r="3.6" />
          </svg>
          Single
        </span>
        <span className="spray__keyitem">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <circle className="spray__dot spray__dot--xbh" cx="9" cy="9" r="5.4" />
          </svg>
          2B / 3B
        </span>
        <span className="spray__keyitem">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <rect
              className="spray__hr spray__hr--key"
              x="4.4"
              y="4.4"
              width="9.2"
              height="9.2"
              transform="rotate(45 9 9)"
            />
          </svg>
          Home run
        </span>
      </div>

      {/* THE DIRECTION BAR IS ABSENT FOR A SWITCH-HITTER'S "All" VIEW, and
          directionMix is what decides that (see its header): pull means left
          field from one side of the plate and right field from the other, so
          the two halves cannot be added into one bar. Each split still has
          its own, which is where a switch-hitter's spray actually reads. */}
      {mix && (
        <div className="spray__direction">
          <div className="spray__dirbar">
            {['pull', 'center', 'oppo'].map((third) => (
              <span
                key={third}
                className={`spray__dirseg spray__dirseg--${third}`}
                style={{ flexGrow: mix[third] }}
              />
            ))}
          </div>
          <div className="spray__dirlabels">
            {[
              ['pull', 'Pull'],
              ['center', 'Center'],
              ['oppo', 'Oppo'],
            ].map(([third, label]) => (
              <span key={third} className="spray__dirlabel">
                {label} <b>{pct(mix[third], mix.n)}</b>
              </span>
            ))}
          </div>
          <p className="spray__dircaption">{directionCaption(mix.side)}</p>
        </div>
      )}

      <dl className="factgrid spray__facts">
        {[
          ['Hits', chosen.hits],
          ['XBH', chosen.xbh],
          ['HR', chosen.hr],
          ['Hard-hit', pct(chosen.hard, chosen.bip)],
        ].map(([label, value]) => (
          <div className="fact" key={label}>
            <dt className="fact__label">{label}</dt>
            <dd className="fact__value">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="spray__foot">
        {levels} · {chosen.bip} balls in play. Hard-hit share is of balls in play.
        {note ? ` ${note}.` : ''}
      </p>
    </div>
  )
}
