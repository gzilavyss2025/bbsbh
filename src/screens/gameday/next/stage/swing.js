// The batter's swing: seven keyframes and their timing, apart so a later session can tune them alone.
// Gary approved stance, load, launch, contact, extend and wrap (round 2, 2026-10-26); the finish is
// not approved ("bad, will fix in later session") and ships as drawn until he fixes it. The bat rule
// (2026-10-07) is met, so the bat may be drawn.
//
// A right-handed batter in his own frame: x toward the plate (the way he faces), y toward the
// pitcher, z up, in feet. Joints are [x, y, z].
import { clamp, ease, lerp, smooth, v3 } from './scene.js'

export const JOINTS = ['head', 'neck', 'lSho', 'rSho', 'lElb', 'rElb', 'hands', 'pelvis', 'lHip', 'rHip', 'lKnee', 'rKnee', 'lFoot', 'rFoot', 'batTip']

export const SWING = {
  stance: { head: [0.15, 0.05, 5.6], neck: [0.1, -0.05, 5.15], lSho: [0.15, 0.55, 4.85], rSho: [0.05, -0.65, 4.85], lElb: [0.55, -0.1, 4.45], rElb: [-0.05, -1.25, 4.75], hands: [0.25, -0.72, 4.95], pelvis: [0, 0, 3.2], lHip: [0, 0.45, 3.2], rHip: [0, -0.45, 3.2], lKnee: [0.35, 1.05, 1.75], rKnee: [0.25, -1.0, 1.75], lFoot: [0.1, 1.3, 0], rFoot: [0, -1.2, 0], batTip: [-0.05, -1.45, 7.4] },
  load: { head: [0.1, -0.1, 5.55], neck: [0.06, -0.18, 5.1], lSho: [0.38, 0.38, 4.78], rSho: [-0.08, -0.78, 4.85], lElb: [0.62, -0.42, 4.45], rElb: [-0.32, -1.45, 4.85], hands: [0.05, -1.15, 5.1], pelvis: [0, -0.18, 3.2], lHip: [0.12, 0.3, 3.22], rHip: [-0.08, -0.62, 3.2], lKnee: [0.78, 0.85, 2.5], rKnee: [0.32, -1.02, 1.62], lFoot: [0.38, 0.9, 0.95], rFoot: [0, -1.2, 0], batTip: [-0.15, -0.95, 7.6] },
  launch: { head: [0.15, 0.15, 5.5], neck: [0.12, 0.05, 5.05], lSho: [0.3, 0.6, 4.75], rSho: [0.0, -0.6, 4.7], lElb: [0.65, 0.1, 4.25], rElb: [0.1, -0.95, 4.2], hands: [0.4, -0.55, 4.45], pelvis: [0.05, 0.15, 3.1], lHip: [0.0, 0.6, 3.1], rHip: [0.1, -0.3, 3.1], lKnee: [0.4, 1.4, 1.75], rKnee: [0.35, -0.8, 1.6], lFoot: [0.15, 1.85, 0], rFoot: [0.02, -1.22, 0.05], batTip: [0.2, -3.0, 5.1] },
  contact: { head: [0.2, 0.3, 5.45], neck: [0.15, 0.2, 5.0], lSho: [-0.1, 0.6, 4.8], rSho: [0.45, -0.35, 4.7], lElb: [0.75, 0.6, 4.1], rElb: [0.8, -0.2, 3.85], hands: [1.25, 0.55, 3.45], pelvis: [0.1, 0.2, 3.05], lHip: [-0.15, 0.55, 3.05], rHip: [0.35, -0.2, 3.05], lKnee: [0.3, 1.6, 1.7], rKnee: [0.6, -0.65, 1.55], lFoot: [0.15, 1.9, 0], rFoot: [0.08, -1.25, 0.12], batTip: [3.6, 1.15, 3.0] },
  extend: { head: [0.18, 0.4, 5.42], neck: [0.12, 0.3, 4.98], lSho: [-0.3, 0.5, 4.8], rSho: [0.5, -0.05, 4.72], lElb: [-0.05, 1.1, 4.2], rElb: [0.6, 0.65, 4.0], hands: [0.3, 1.4, 4.05], pelvis: [0.1, 0.25, 3.05], lHip: [-0.2, 0.52, 3.05], rHip: [0.42, -0.08, 3.05], lKnee: [0.28, 1.6, 1.72], rKnee: [0.65, -0.5, 1.55], lFoot: [0.15, 1.9, 0], rFoot: [0.15, -1.1, 0.25], batTip: [-0.85, 3.6, 4.4] },
  wrap: { head: [0.1, 0.45, 5.42], neck: [0.06, 0.35, 4.98], lSho: [-0.45, 0.38, 4.82], rSho: [0.55, 0.2, 4.74], lElb: [-0.85, 0.65, 4.75], rElb: [0.25, 0.95, 4.55], hands: [-0.4, 0.9, 4.95], pelvis: [0.1, 0.3, 3.05], lHip: [-0.28, 0.48, 3.05], rHip: [0.48, 0.05, 3.05], lKnee: [0.22, 1.58, 1.74], rKnee: [0.7, -0.38, 1.52], lFoot: [0.15, 1.9, 0], rFoot: [0.25, -0.9, 0.35], batTip: [-1.93, 1.15, 6.94] },
  finish: { head: [0.05, 0.5, 5.4], neck: [0.02, 0.38, 4.98], lSho: [-0.5, 0.32, 4.85], rSho: [0.55, 0.3, 4.75], lElb: [-0.85, 0.5, 5.0], rElb: [0.1, 0.6, 4.85], hands: [-0.35, 0.2, 5.5], pelvis: [0.1, 0.3, 3.05], lHip: [-0.3, 0.45, 3.05], rHip: [0.5, 0.1, 3.05], lKnee: [0.2, 1.55, 1.75], rKnee: [0.7, -0.3, 1.5], lFoot: [0.15, 1.9, 0], rFoot: [0.3, -0.85, 0.4], batTip: [-0.99, -1.73, 3.96] },
}

// The swing clock: 0 stance, 1 load, 2 launch, CONTACT (2.4) contact, 2.6 extend, 2.8 wrap, 3 finish.
// The timeline (play.js) runs the load through the windup and the launch through the pitch's flight,
// so the batter reaches CONTACT as the ball reaches the plate.
export const CONTACT = 2.4

// A blend keeps the bat's length: the knob follows the hands, the barrel turns.
function blend(a, b, u) {
  const o = {}
  for (const k of JOINTS) o[k] = v3.lerp(a[k], b[k], u)
  const da = v3.sub(a.batTip, a.hands), db = v3.sub(b.batTip, b.hands)
  o.batTip = v3.add(o.hands, v3.mul(v3.norm(v3.lerp(v3.norm(da), v3.norm(db), u)), lerp(v3.len(da), v3.len(db), u)))
  return o
}

// The pose at swing clock `s`. A batter who takes the pitch loads, then settles back to the stance.
export function swingPose(s, swings) {
  const K = SWING
  if (s <= 0) return K.stance
  if (s < 1) return blend(K.stance, K.load, ease(s))
  if (!swings) return blend(K.load, K.stance, ease(clamp(s - 1, 0, 1)))
  if (s < 2) return blend(K.load, K.launch, ease(s - 1))
  if (s < CONTACT) return blend(K.launch, K.contact, smooth((s - 2) / 0.4))
  if (s < 2.6) return blend(K.contact, K.extend, smooth((s - CONTACT) / 0.2))
  if (s < 2.8) return blend(K.extend, K.wrap, smooth((s - 2.6) / 0.2))
  return blend(K.wrap, K.finish, ease(clamp((s - 2.8) / 0.2, 0, 1)))
}

// Batter frame to world. A right-handed batter stands on the third-base side (x < 0) facing +x; a
// left-handed batter is the mirror image.
export function batterToWorld(pose, side) {
  const m = side === 'L' ? -1 : 1, o = {}
  for (const k of JOINTS) o[k] = [-2.75 * m + m * pose[k][0], 0.6 + pose[k][1], pose[k][2]]
  return o
}
