import { useId } from 'react'
import { showsPerformerCard } from '../lib/resultCards.js'

// Placeholder for a PastGameFlipCard's back face while a revealed game's
// feed/win-probability are still in flight (see PastGameFlipCard.jsx) —
// grayscale blocks shaped like GameResultFace's layout, pulsing together as
// one unit, with a small baseball rolling across the middle of the card,
// overlaid above the pulsing content on its own z-index, as the "still
// fetching" tell. Replaces the shared page-level Loader here since
// N of these can be on screen at once (one per still-loading card after
// "Reveal all results"), each finishing independently as its own fetch
// lands — a per-card skeleton reads as normal progressive loading, where N
// copies of the scoreboard-flip Loader reads as the same animation
// stuttering/repeating. Purely decorative (aria-hidden); the one accessible
// string is the status message screen readers get instead.
//
// `cardMeta` is the SAME classification PastGameFlipCard forwards to
// GameResultFace once revealed, threaded through here too so
// showsPerformerCard (resultCards.js) can reserve a matching
// .skel__perfcard block when the real face is going to stack an extra
// PerformerCard above its Play of the Game text (the crowned Game of the
// Night shows both). Best-effort, NOT a guarantee against every layout
// jump: cardMeta comes from a day-wide batch (useDayCardMeta.js) that needs
// every game's own signals before it can classify any one of them, so it
// can populate no earlier than — and often slightly after — this card's own
// fetch resolves and this skeleton unmounts. When it lands late,
// GameResultFace itself mounts without the block and grows into it on the
// next render, same as it already could before this skeleton existed; this
// placeholder only narrows that window, for whichever cards' own fetches
// happen to be slower than the day-wide classification.
export function BoxScoreSkeleton({ cardMeta = null }) {
  const showPerformer = showsPerformerCard(cardMeta)
  return (
    <div className="flipback skel" role="status">
      <span className="sr-only">Pulling the box score…</span>
      <div className="skel__body" aria-hidden="true">
        <div className="skel__topRow">
          <span className="skel__bar skel__bar--btn" />
          <span className="skel__bar skel__bar--pill" />
        </div>
        <div className="skel__linescore">
          <SkelTeamRow />
          <SkelTeamRow />
        </div>
        <div className="skel__decisions">
          <span className="skel__bar skel__bar--decision" />
          <span className="skel__bar skel__bar--decision" />
        </div>
        {showPerformer && <SkelPerformerCard />}
        <div className="skel__potg">
          <span className="skel__circle skel__circle--shot" />
          <div className="skel__potgLines">
            <span className="skel__bar skel__bar--short" />
            <span className="skel__bar skel__bar--long" />
          </div>
        </div>
        <SkelBall />
      </div>
    </div>
  )
}

function SkelTeamRow() {
  return (
    <div className="skel__team">
      <span className="skel__circle skel__circle--logo" />
      <span className="skel__bar skel__bar--team" />
      <span className="skel__bar skel__bar--num" />
      <span className="skel__bar skel__bar--num" />
      <span className="skel__bar skel__bar--num" />
    </div>
  )
}

// Mirrors PerformerCard.jsx's shape (headshot + name/team/stat lines) — only
// rendered when showsPerformerCard(cardMeta) says the real GameResultFace
// will show one too (see the BoxScoreSkeleton header comment above).
function SkelPerformerCard() {
  return (
    <div className="skel__perfcard">
      <span className="skel__bar skel__bar--perfShot" />
      <div className="skel__perfLines">
        <span className="skel__bar skel__bar--perfName" />
        <span className="skel__bar skel__bar--perfTeam" />
        <span className="skel__bar skel__bar--perfStat" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The rolling ball — a from-scratch line drawing rather than the ⚾️ emoji
// this replaced (a glossy platform emoji reads as an off-brand sticker next
// to the app's hand-drawn ink/paper scorebook look), built from an actual 3D
// model of the seam rather than a flat icon spun in the picture plane.
//
// Why 3D: a ball rolling along a path viewed from above (this basepath, like
// looking down at an infield) spins around an axis that lies IN the image
// plane, not one pointing at the viewer — so the real motion is the seam
// pattern wrapping around a sphere (arcs foreshortening and swinging behind
// as they rotate away, new ones swinging into view), not a flat decal
// spinning in place. A plain CSS `rotate()` on the flat icon (the previous
// version) is the WRONG motion — it's what you'd see from a rolling ball's
// axle-on view, not this one.
//
// There's no way to fake that wrap with a single flat image, so this
// precomputes BALL_FRAME_COUNT snapshots of the seam rotated around the
// vertical axis (see rotY) and animates through them like a classic sprite
// sheet (the same `steps()` technique real rotating-ball sprite animations
// use) — see the `.skel__ballFrames` rule in index.css.
//
// The seam geometry itself: a real baseball's seam is ONE continuous closed
// curve (the boundary between the two "peanut"-shaped leather panels — trace
// either panel's own edge and you've traced the whole seam, since both
// panels share that one boundary). SEAM_TOP/SEAM_BOTTOM are the two arcs
// every glove/bat/box-score icon draws (bowing toward the equator, near
// hemisphere, lifted onto the sphere via liftToSphere — a point at 2D offset
// (dx, dy) from center sits on a sphere of radius R at z = sqrt(R² - dx² -
// dy²), simple Pythagoras) — but on their own they're just two disconnected
// dashes. RIGHT_CONNECTOR/LEFT_CONNECTOR are the rest of that same loop: the
// seam continuing on from each arc's end, swinging around the ball's side
// (bulging outward in x, dipping behind in z) to meet the OTHER arc's
// matching end — built from TOP_RIGHT/TOP_LEFT/BOTTOM_RIGHT/BOTTOM_LEFT, the
// exact same corner points SEAM_TOP/SEAM_BOTTOM already end on, so the loop
// closes with shared coordinates rather than four dangling ends. This one
// connected loop is also what keeps some seam visible from any rotation
// (the connectors are what's facing the viewer when the top/bottom arcs
// have rotated away) — no separate "back of the ball" copy needed.
const SEAM_TOP = [
  { x: 17, y: 20 },
  { x: 36, y: 48 },
  { x: 64, y: 48 },
  { x: 83, y: 20 },
]
const SEAM_BOTTOM = [
  { x: 17, y: 80 },
  { x: 36, y: 52 },
  { x: 64, y: 52 },
  { x: 83, y: 80 },
]
const BALL_R = 46
const SAMPLES_PER_ARC = 24
const STITCHES_PER_SEAM = 11
const STITCH_LEN = 5
const STITCH_SPREAD = 0.62 // radians the stitch tilts off the seam's normal — the tilt that makes it read as a stitch rather than a perpendicular tally mark
// index.css's `.skel__ballFrames` spin keyframes hardcode both of these (in
// the strip width/translate math) — update all three together if any
// changes. BALL_SPIN_LOOPS is how many full 360°s the ball turns over one
// roll traversal (matching the old rotate(1080deg)'s 3 turns) — the strip
// repeats the same BALL_FRAME_COUNT unique frames that many times (via
// <use>, not by regenerating geometry) so `steps()` has somewhere to land
// for every step instead of running off the end into blank space.
const BALL_FRAME_COUNT = 12
const BALL_SPIN_LOOPS = 3
const BALL_TOTAL_STEPS = BALL_FRAME_COUNT * BALL_SPIN_LOOPS

function cubicPoint([p0, p1, p2, p3], t) {
  const mt = 1 - t
  return {
    x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
    y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y,
  }
}

function cubicPoint3D([p0, p1, p2, p3], t) {
  const mt = 1 - t
  return {
    x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
    y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y,
    z: mt ** 3 * p0.z + 3 * mt ** 2 * t * p1.z + 3 * mt * t ** 2 * p2.z + t ** 3 * p3.z,
  }
}

// --- minimal 3D vector helpers ---------------------------------------------
function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}
function addScaled(a, dir, s) {
  return { x: a.x + dir.x * s, y: a.y + dir.y * s, z: a.z + dir.z * s }
}
function cross(a, b) {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }
}
function normalize(v) {
  const m = Math.hypot(v.x, v.y, v.z) || 1
  return { x: v.x / m, y: v.y / m, z: v.z / m }
}
// Rodrigues' rotation formula: `v` rotated by `angle` radians around unit `axis`.
function rotateAroundAxis(v, axis, angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const dot = v.x * axis.x + v.y * axis.y + v.z * axis.z
  const axv = cross(axis, v)
  return {
    x: v.x * c + axv.x * s + axis.x * dot * (1 - c),
    y: v.y * c + axv.y * s + axis.y * dot * (1 - c),
    z: v.z * c + axv.z * s + axis.z * dot * (1 - c),
  }
}
// The ball's own spin: rotate around the vertical (Y) axis.
function rotY(p, theta) {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c }
}

// A real rolled ball doesn't spin on a perfectly clean, fixed axis — there's
// always a bit of tilt/wobble, and it's that imperfection that reads as
// "rolling" instead of "a turntable" (a purely vertical rotY spin keeps
// every strand's Y-coordinate fixed, which is what looked robotic/flat
// before). WOBBLE_AXIS is a genuine second rotation — not a cosmetic 2D
// tilt of the already-flattened image, but a real Rodrigues rotation of the
// 3D points BEFORE projecting — so the tumble actually changes what's
// foreshortened and what's rotated into/out of view, which is what makes it
// read as a solid object tumbling in 3D rather than a flat sticker rocking
// side to side. Tilted off every cardinal axis on purpose (not pure X or Y)
// so the tumble doesn't look like it's confined to one tidy plane either.
// BALL_TILT_BASE keeps a constant cant even at rest; BALL_TILT_WOBBLE adds a
// slow oscillation on top so the cant itself drifts through the roll.
const WOBBLE_AXIS = normalize({ x: 1, y: 0.35, z: 0.18 })
const BALL_TILT_BASE = (22 * Math.PI) / 180
const BALL_TILT_WOBBLE = (14 * Math.PI) / 180
const BALL_TILT_WOBBLE_FREQ = 2
function wobbleAngleFor(theta) {
  return BALL_TILT_BASE + BALL_TILT_WOBBLE * Math.sin(theta * BALL_TILT_WOBBLE_FREQ)
}

// A 2D seam-curve point (0–100 icon space, center at (50,50)) as a point on
// the near hemisphere of the sphere: z from Pythagoras against the ball's
// radius.
function liftToSphere(p2d) {
  const dx = p2d.x - 50
  const dy = p2d.y - 50
  const z = Math.sqrt(Math.max(BALL_R * BALL_R - dx * dx - dy * dy, 0))
  return { x: dx, y: dy, z }
}

// A raw 3D point pulled onto the sphere's surface by scaling it to radius R
// — for points that AREN'T already on the sphere (a connector's bezier
// handles, and every non-endpoint sample along a connector, since a convex
// combination of points on a sphere lands strictly inside it).
function projectToSphere(p) {
  const m = Math.hypot(p.x, p.y, p.z) || 1
  return { x: (p.x * BALL_R) / m, y: (p.y * BALL_R) / m, z: (p.z * BALL_R) / m }
}

const TOP_LEFT = liftToSphere(SEAM_TOP[0])
const TOP_RIGHT = liftToSphere(SEAM_TOP[3])
const BOTTOM_LEFT = liftToSphere(SEAM_BOTTOM[0])
const BOTTOM_RIGHT = liftToSphere(SEAM_BOTTOM[3])
const RIGHT_CONNECTOR = [TOP_RIGHT, { x: 55, y: -15, z: -10 }, { x: 55, y: 15, z: -10 }, BOTTOM_RIGHT]
const LEFT_CONNECTOR = [BOTTOM_LEFT, { x: -55, y: 15, z: -10 }, { x: -55, y: -15, z: -10 }, TOP_LEFT]

// Samples one strand's points + evenly spaced stitch ticks, given a
// `pointAt(t)` that returns an on-sphere 3D point for any t in [0,1] —
// shared by both the 2D-icon-curve strands (SEAM_TOP/BOTTOM, lifted exactly
// via Pythagoras) and the connector strands (3D control points, pulled onto
// the sphere via projectToSphere), so stitch placement doesn't care which
// kind of curve it's walking.
function sampleStrand(pointAt) {
  const points = []
  for (let i = 0; i <= SAMPLES_PER_ARC; i++) points.push(pointAt(i / SAMPLES_PER_ARC))
  const stitches = []
  for (let i = 1; i <= STITCHES_PER_SEAM; i++) {
    const t = i / (STITCHES_PER_SEAM + 1)
    const eps = 0.01
    const anchor = pointAt(t)
    const tangent = normalize(sub(pointAt(Math.min(t + eps, 1)), pointAt(Math.max(t - eps, 0))))
    const normal = normalize(anchor) // sphere is centered at the origin, so the point IS its own outward normal
    const tilted = rotateAroundAxis(normalize(cross(normal, tangent)), normal, STITCH_SPREAD)
    stitches.push({ anchor, a: addScaled(anchor, tilted, STITCH_LEN), b: addScaled(anchor, tilted, -STITCH_LEN) })
  }
  return { points, stitches }
}

const BALL_STRANDS = [
  sampleStrand((t) => liftToSphere(cubicPoint(SEAM_TOP, t))),
  sampleStrand((t) => liftToSphere(cubicPoint(SEAM_BOTTOM, t))),
  sampleStrand((t) => projectToSphere(cubicPoint3D(RIGHT_CONNECTOR, t))),
  sampleStrand((t) => projectToSphere(cubicPoint3D(LEFT_CONNECTOR, t))),
]

// One rotation frame: every strand's points/stitches rotated by `theta` and
// projected (orthographically — just drop z), keeping only what's rotated to
// face the viewer (z >= 0). A seam polyline is split into a fresh subpath
// wherever it dips behind the ball, so an arc visibly shrinks toward the
// limb and vanishes as it turns away, instead of being drawn straight
// through the far side.
function buildFrame(theta) {
  const wobble = wobbleAngleFor(theta)
  // Spin, THEN tumble: composing the two as one function keeps every point
  // (seam samples and stitch endpoints alike) transformed identically, so
  // the loop's shared corner coordinates stay shared and it doesn't
  // silently drift apart from the extra rotation.
  const project = (p) => rotateAroundAxis(rotY(p, theta), WOBBLE_AXIS, wobble)
  const toScreen = (r) => ({ x: 50 + r.x, y: 50 + r.y })

  const subpaths = []
  for (const strand of BALL_STRANDS) {
    let current = null
    for (const p of strand.points) {
      const r = project(p)
      if (r.z >= 0) {
        if (!current) {
          current = []
          subpaths.push(current)
        }
        current.push(toScreen(r))
      } else {
        current = null
      }
    }
  }
  const seamD = subpaths
    .filter((subpath) => subpath.length > 1)
    .map((subpath) => subpath.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '))
    .join(' ')

  const stitchLines = []
  for (const strand of BALL_STRANDS) {
    for (const st of strand.stitches) {
      const anchor = project(st.anchor)
      if (anchor.z < 0) continue
      const a = toScreen(project(st.a))
      const b = toScreen(project(st.b))
      stitchLines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })
    }
  }
  return { seamD, stitchLines }
}

const BALL_FRAMES = Array.from({ length: BALL_FRAME_COUNT }, (_, i) =>
  buildFrame((i / BALL_FRAME_COUNT) * Math.PI * 2),
)

function SkelBall() {
  // A prefix, not a raw id: possibly several skeleton cards are on screen
  // at once (one per still-loading game after "Reveal all results"), and
  // plain hardcoded <defs> ids would collide across those instances — the
  // <use> elements below would all end up pointing at the FIRST card's
  // defs. useId() keeps each instance's frame ids unique to it.
  const idPrefix = useId()
  return (
    <div className="skel__ball">
      <svg className="skel__ballBody" viewBox="0 0 100 100">
        <defs>
          {/* A soft highlight-to-shadow gradient, not a flat fill — the
              single cheapest cue that reads "sphere" instead of "circle
              with lines on it," independent of anything the seam is doing. */}
          <radialGradient id={`${idPrefix}shade`} cx="34%" cy="28%" r="80%">
            <stop className="skel__ballShadeLight" offset="0%" />
            <stop className="skel__ballShadeDark" offset="100%" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r={BALL_R} fill={`url(#${idPrefix}shade)`} />
      </svg>
      <div className="skel__ballWindow">
        <svg className="skel__ballFrames" viewBox={`0 0 ${BALL_TOTAL_STEPS * 100} 100`}>
          <defs>
            {BALL_FRAMES.map((frame, i) => (
              <g key={i} id={`${idPrefix}f${i}`}>
                <path className="skel__ballSeam" d={frame.seamD} />
                {frame.stitchLines.map((s, j) => (
                  <line key={j} className="skel__ballStitch" x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
                ))}
              </g>
            ))}
          </defs>
          {Array.from({ length: BALL_TOTAL_STEPS }, (_, i) => (
            <use key={i} href={`#${idPrefix}f${i % BALL_FRAME_COUNT}`} x={i * 100} />
          ))}
        </svg>
      </div>
    </div>
  )
}
