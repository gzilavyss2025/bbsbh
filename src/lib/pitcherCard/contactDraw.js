// The contact replay's marks, set through refs (docs/contact-replay.md §6.2 to §6.5, §8.4, §12).
// Pure functions of nodes and numbers, no React: PitchScene.jsx keeps the loop and the JSX, and
// `drawContact` is called once per frame. A node is anything with `setAttribute`.
// Ink is measured, pencil is drawn: the look of each mark is in styles/pitcher-card/contact.css.
// Ported from .scratch/contact-replay/prototype.html `render`, `batPolygon` and `drawBat`.
import { clamp } from '../math/number.js'
import { easeOut } from '../motion/curves.js'
import { SIDE_X, battedPath, foulPath, isBunt, sideViewPath } from './batted.js'
import { SCENE_W, proj } from './scene.js'
import { ringStrength, squaredUp, swingSeconds } from './quality.js'
import { FOLLOW, swingModel } from './swing.js'
import { sceneClock } from './contactTimeline.js'

const f1 = (v) => v.toFixed(1)
const put = (n, attrs) => {
  for (const k in attrs) n.setAttribute(k, attrs[k])
}
const vis = (n, on) => n.setAttribute('visibility', on ? 'visible' : 'hidden')
const hide = (...ns) => ns.forEach((n) => vis(n, false))
const xy = (p) => `${f1(p[0])},${f1(p[1])}`

const SMEAR = [0.3, 0.2, 0.12, 0.06] // §6.2: four copies, 12 ms apart
const ARC_FROM = -1.6 // rad: the barrel path starts at -92 degrees
const RING_FOUL = 0.35
const TAG_CHAR = 7 // px a tag letter takes, caps and spacing included
// [for the aria-label, for the tag]. SVG text takes no CSS caps rule, so the tag's caps are written out.
const TRAJ = { line_drive: ['Line drive', 'LINE DRIVE'], fly_ball: ['Fly ball', 'FLY BALL'], ground_ball: ['Ground ball', 'GROUND BALL'], popup: ['Popup', 'POPUP'] }

// The scene's aria-label for a pitch (§12): "Four-seam, 96.1 mph. Line drive, 104.8 mph off the bat,
// 312 feet. In play, out." Built from the pitch, so it changes only when the pitch in view does.
export function sceneLabel(p) {
  const { hit, swing } = p
  const type = p.name.replace(/^\d+ · /, '')
  const parts = [
    TRAJ[hit?.trajectory]?.[0],
    hit?.exitVelo != null && `${hit.exitVelo.toFixed(1)} mph off the bat`,
    hit?.distance != null && `${Math.round(hit.distance)} feet`,
  ].filter(Boolean)
  const call = swing === 'whiff' ? 'Swing and miss' : p.call
  return [`${type}${p.mph === '—' ? '' : `, ${p.mph} mph`}.`, parts.length && `${parts.join(', ')}.`, call && `${call}.`].filter(Boolean).join(' ')
}

// What a swing pitch needs each frame, built once: the swing, the batted ball (null for a whiff and for
// a ball with no exit speed), whether a bat is drawn (not on a bunt, §10) and the trajectory tag.
// Null for a take, or a pitch with no contact point.
export function swingScene(p, beats, tr) {
  if (beats.contactMs == null) return null
  const { swing, contact, hit, batSide } = p
  const trajectory = TRAJ[hit?.trajectory]?.[1]
  return {
    SW: swingModel({ batSide, swing, K: contact.K, swingSec: swingSeconds(tr?.batSpeed) }),
    strength: ringStrength(swing === 'inplay' ? squaredUp(hit?.exitVelo, tr?.batSpeed, Number(p.mph)) : null),
    path: swing === 'inplay' ? battedPath(hit, contact.K) : swing === 'foul' ? foulPath(contact.K, batSide) : null,
    bunt: isBunt(hit),
    tag: trajectory && (hit.coordX == null ? `${trajectory} · DIRECTION DRAWN` : trajectory),
  }
}

// The bat as a polygon and its round cap, in scene px: `b` is swingModel `at(dt)` { knob, end }.
export function batShape({ knob, end }) {
  const [p0, p1] = [proj(...knob), proj(...end)]
  const [dx, dy] = [p1[0] - p0[0], p1[1] - p0[1]]
  const l = Math.hypot(dx, dy) || 1
  const [nx, ny] = [-dy / l, dx / l]
  const [wk, wb] = [Math.max(0.8, p0[2] * 0.33), Math.max(1.6, p1[2] * 0.95)]
  const at = (k, w) => [
    [p0[0] + dx * k + (nx * w) / 2, p0[1] + dy * k + (ny * w) / 2],
    [p0[0] + dx * k - (nx * w) / 2, p0[1] + dy * k - (ny * w) / 2],
  ]
  const [a, m, q, e] = [at(0, wk), at(0.42, wk * 1.15), at(0.72, wb), at(1, wb)] // flares from 42% to 72%
  return { points: [a[0], m[0], q[0], e[0], e[1], q[1], m[1], a[1]].map(xy).join(' '), cap: [p1[0], p1[1], wb / 2] }
}

export function setBat(poly, cap, b, opacity) {
  const { points, cap: [x, y, r] } = batShape(b)
  put(poly, { points, opacity: opacity.toFixed(2), visibility: 'visible' })
  if (cap) put(cap, { cx: f1(x), cy: f1(y), r: f1(r), opacity: opacity.toFixed(2), visibility: 'visible' })
}

// The four smear bats trail the bat while it is fast; none during the freeze.
export function setSmear(polys, SW, dt, frozen) {
  const on = !frozen && dt > -SW.SWING + 0.04 && dt < 0.09
  polys.forEach((n, k) => (on ? setBat(n, null, SW.at(dt - (k + 1) * 0.012), SMEAR[k]) : vis(n, false)))
}

// The barrel's path from -92 degrees to `th` (null before the swing starts: nothing to draw).
export function setBarrelPath(node, SW, th, opacity) {
  if (th == null || th <= ARC_FROM) return vis(node, false)
  const pts = Array.from({ length: 29 }, (_, i) => proj(...SW.sweet(ARC_FROM + ((th - ARC_FROM) * i) / 28)))
  return put(node, { points: pts.map(xy).join(' '), opacity, visibility: 'visible' })
}

// The ball's trail after contact up to `tEnd` s: 24 pieces as wide as the ball, the newest the darkest;
// a foul is one dashed pencil line instead.
export function setExit(segs, line, path, tEnd, foul, rest) {
  if (!path || tEnd <= 0) return hide(...segs, line)
  const pts = Array.from({ length: 25 }, (_, i) => proj(...path.pos((tEnd * i) / 24)))
  if (foul) {
    hide(...segs)
    return put(line, { points: pts.map(xy).join(' '), opacity: rest ? 0.75 : 0.9, visibility: 'visible' })
  }
  vis(line, false)
  return segs.forEach((seg, i) => {
    const [a, b] = [pts[i], pts[i + 1]]
    put(seg, {
      x1: f1(a[0]), y1: f1(a[1]), x2: f1(b[0]), y2: f1(b[1]),
      'stroke-width': Math.max(1.2, b[2] * 0.55).toFixed(2),
      opacity: (rest ? 0.45 + 0.4 * (i / 24) : 0.3 + 0.65 * (i / 24)).toFixed(2),
      visibility: 'visible',
    })
  })
}

// Shadow, drop line and ground track of the ball in flight. `ball` is its [x, y, z] in feet, or null.
export function setGround({ track, shadow, drop }, path, tNow, ball) {
  if (!path) return hide(track, shadow, drop)
  const pts = Array.from({ length: 17 }, (_, i) => {
    const p = path.pos((tNow * i) / 16)
    return proj(p[0], p[1], 0)
  })
  put(track, { points: pts.map(xy).join(' '), visibility: 'visible' })
  if (!ball) return hide(shadow, drop)
  const [g, b] = [proj(ball[0], ball[1], 0), proj(...ball)]
  put(shadow, { cx: f1(g[0]), cy: f1(g[1]), rx: f1(g[2] * 0.5), ry: f1(g[2] * 0.18), visibility: 'visible' })
  put(drop, { x1: f1(b[0]), y1: f1(b[1]), x2: f1(g[0]), y2: f1(g[1]), opacity: Math.min(0.6, ball[2] / 12).toFixed(2) })
  return vis(drop, ball[2] > 1)
}

// The contact ring and its eight ticks at `Kp` (the contact point in scene px), `q` 0 to 1 over 260 ms.
// It grows from 0.8x the ball's radius to at most one zone cell; the rest frame is 0.9x, faint, with no ticks.
export function setFlash(ring, ticks, Kp, { q, strength, foul, rest }) {
  const e = easeOut(q)
  const [r0, r1] = [Kp[2] * 0.4, Kp[2] * (0.6 + 0.5 * strength)]
  put(ring, {
    cx: f1(Kp[0]), cy: f1(Kp[1]), r: f1(rest ? r1 * 0.9 : r0 + (r1 - r0) * e),
    'stroke-width': (1 + strength).toFixed(2),
    opacity: rest ? 0.25 : ((0.4 + 0.6 * strength) * (1 - q)).toFixed(2),
    class: foul ? 'pscene__flash pscene__flash--pencil' : 'pscene__flash',
    visibility: 'visible',
  })
  const on = !foul && !rest && q < 1
  ticks.forEach((t, i) => {
    if (!on) return vis(t, false)
    const a = (i / 8) * Math.PI * 2 + 0.2
    const ra = r0 + 2 + (r1 + 3 - r0 - 2) * e
    const rb = ra + 2 + 2 * strength
    return put(t, {
      x1: f1(Kp[0] + Math.cos(a) * ra), y1: f1(Kp[1] + Math.sin(a) * ra),
      x2: f1(Kp[0] + Math.cos(a) * rb), y2: f1(Kp[1] + Math.sin(a) * rb),
      opacity: (1 - q).toFixed(2), visibility: 'visible',
    })
  })
}

// The whiff's pencil ring at the mitt `mp` (scene px), 0.7 to 1.6 ball diameters over 300 ms.
export function setMitt(node, mp, q, rest) {
  put(node, {
    cx: f1(mp[0]), cy: f1(mp[1]), r: f1(mp[2] * (0.7 + 0.9 * easeOut(q))),
    opacity: rest ? 0.4 : (0.8 * (1 - q) + 0.2).toFixed(2), visibility: 'visible',
  })
}

// The trajectory tag, top right: navy plate sized to the text. No label, no tag.
export function setTag(g, rect, text, label, opacity) {
  if (!label) return vis(g, false)
  const w = label.length * TAG_CHAR + 12
  if (text.textContent !== label) text.textContent = label
  put(text, { x: SCENE_W - 14 })
  put(rect, { x: f1(SCENE_W - 8 - w), width: f1(w) })
  return put(g, { opacity: opacity.toFixed(2), visibility: 'visible' })
}

// Every mark off, for a pitch the batter took. `mk.parts` holds the tag's children, which follow the group.
export const hideMarks = (mk) => Object.entries(mk).forEach(([k, v]) => k !== 'parts' && hide(...[v].flat()))

// One frame of a swing pitch at `tau` ms on its slot (§6.2 to §6.5 order, rest frame §8.4). `mk` is
// the refs; `b` the pitch's beats and `m` its swingScene. Returns the trail's `progress` (0 to 1 along
// the measured path) and the ball: undefined = the pitch ball, null = none, else [x, y, d] in scene px.
export function drawContact(mk, p, b, m, tau, slow, rest) {
  const { SW, path, bunt, tag } = m
  const { swing, T, flight, contact: { K, tc, tMitt } } = p
  const [whiff, foul] = [swing === 'whiff', swing === 'foul']
  const tReal = sceneClock(b, tau) / (slow * 1000)
  const dtC = tReal - tc
  const th = SW.at(rest ? 0.12 : dtC).th
  if (!bunt) {
    if (rest) {
      // a multiple exposure: mid-swing and follow-through faint, the bat at contact strong
      ;[-0.05, 0.12].forEach((d, k) => setBat(mk.smear[k], null, SW.at(d), 0.22))
      hide(...mk.smear.slice(2))
      setBat(mk.bat, mk.cap, SW.at(0), 0.95)
    } else {
      const fadeAt = (tc + FOLLOW) * slow * 1000 + b.freezeMs
      setBat(mk.bat, mk.cap, SW.at(dtC), 1 - 0.75 * clamp((tau - fadeAt) / 400, 0, 1))
      setSmear(mk.smear, SW, dtC, tau >= b.contactMs && tau <= b.contactMs + b.freezeMs)
    }
    setBarrelPath(mk.arc, SW, th, rest || dtC > FOLLOW ? 0.75 : 0.9)
  } else {
    // a bunt holds the bat still across the zone, in pencil: no smear, no barrel path (§10)
    hide(mk.arc, ...mk.smear)
    setBat(mk.bat, mk.cap, SW.at(0), 0.95)
  }
  // the batted ball: in flight until it leaves the scene
  const exitSec = path?.exitSec ?? 0 // a whiff has no batted ball
  const flying = dtC > 0 && dtC <= exitSec
  setExit(mk.segs, mk.line, path, dtC > 0 ? Math.min(dtC, exitSec) : 0, foul, rest)
  if (swing === 'inplay' && !rest && dtC > 0) setGround(mk, path, Math.min(dtC, exitSec), flying ? path.pos(dtC) : null)
  else hide(mk.track, mk.shadow, mk.drop)
  // contact: the ring, then the tag; the whiff has the mitt instead
  const since = (ms) => tau - b.contactMs - ms
  if (!whiff && since(0) >= 0) setFlash(mk.ring, mk.ticks, proj(...K), { q: clamp(since(0) / 260, 0, 1), strength: foul ? RING_FOUL : m.strength, foul, rest })
  else hide(mk.ring, ...mk.ticks)
  const mt = tMitt ?? T
  if (whiff && tReal >= mt) setMitt(mk.mitt, proj(...flight.at(mt / T)), clamp(((tReal - mt) * slow * 1000) / 300, 0, 1), rest)
  else vis(mk.mitt, false)
  setTag(mk.tag, mk.parts.rect, mk.parts.text, since(b.freezeMs) >= 0 ? tag : '', clamp(since(b.freezeMs) / 220, 0, 1))
  const ball = whiff ? proj(...flight.at(Math.min(tReal, mt) / T)) : dtC > 0 ? (flying ? proj(...path.pos(dtC)) : null) : undefined
  return { progress: Math.min(tReal, whiff ? T : tc) / T, ball }
}

// The side view's two label rules (§7.1), pure so `npm test` can pin them. Strip units, 336 x 100.
// An apex in the top 46 units would meet the title, so its label goes under the arc, right of the drop.
export function apexLabel(ax, ay, ft) {
  const under = ay < 46
  return { x: under ? ax + 5 : ax, y: under ? ay + 16 : ay - 5, anchor: under ? 'start' : 'middle', text: `apex ≈ ${Math.round(ft)} ft · drawn` }
}

// A ball landing past 370 ft would put its distance on the fence post, so the label takes the axis row,
// right-aligned, and the 400 ft tick label hides.
export function distanceLabel(ft) {
  const far = ft > 370
  return { x: far ? 332 : SIDE_X(ft), y: far ? 96 : 66, anchor: far ? 'end' : 'middle', text: `${Math.round(ft)} ft`, hideTick400: far }
}

// The side view's aria-label (§12), built from the pitch like `sceneLabel`: it changes only with the pitch in view.
export function sideLabel(p, path) {
  if (!path) return `Side view: ${p.swing === 'whiff' ? 'no contact' : p.swing === 'foul' ? 'foul, no flight drawn' : 'no ball in flight'}.`
  const ft = p.hit.distance != null ? `, ${Math.round(p.hit.distance)} feet` : ''
  const apex = path.apex ? `, apex about ${Math.round(path.apex.ft)} feet (drawn)` : ''
  return `Side view: ${(TRAJ[p.hit.trajectory]?.[0] ?? 'ball in play').toLowerCase()}${ft}${apex}.`
}

// The side view's path for a pitch: a ball in play WITH a contact point. Without one `pitchBeats` has
// no side beats (a take's { totalMs }), so there is nothing to time a path by.
export const sidePathFor = (p, beats) => (p.swing === 'inplay' && beats.sideStartMs != null ? sideViewPath(p.hit) : null)
