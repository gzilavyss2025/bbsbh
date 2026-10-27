// The pitcher's delivery and a fielder's ready stance: five keyframes (set, kick, stride, release,
// finish) in the pitcher's frame: x to his glove side for a right-hander, y toward home, z up, feet.
import { MOUND, clamp, ease, smooth, v3 } from './scene.js'

export const PJ = ['head', 'neck', 'lSho', 'rSho', 'lElb', 'rElb', 'pelvis', 'lHip', 'rHip', 'lKnee', 'rKnee', 'lFoot', 'rFoot', 'ball']

const PITCH = {
  set: { head: [0, 0, 5.75], neck: [0, 0, 5.3], lSho: [0.55, 0.05, 5.0], rSho: [-0.55, -0.05, 5.0], lElb: [0.45, 0.45, 4.3], rElb: [-0.45, 0.4, 4.3], pelvis: [0, 0, 3.3], lHip: [0.4, 0, 3.3], rHip: [-0.4, 0, 3.3], lKnee: [0.45, 0.1, 1.75], rKnee: [-0.45, 0.1, 1.75], lFoot: [0.45, 0, 0], rFoot: [-0.45, 0, 0], ball: [0, 0.6, 4.4] },
  kick: { head: [0, -0.2, 5.75], neck: [0, -0.2, 5.3], lSho: [0.35, 0.3, 5.0], rSho: [-0.4, -0.5, 5.0], lElb: [0.6, 0.4, 4.4], rElb: [-0.2, 0.2, 4.4], pelvis: [0, -0.2, 3.4], lHip: [0.3, 0.1, 3.4], rHip: [-0.3, -0.45, 3.4], lKnee: [0.35, 0.9, 4.0], rKnee: [-0.35, -0.3, 1.8], lFoot: [0.3, 0.6, 2.6], rFoot: [-0.4, -0.3, 0], ball: [0.15, 0.4, 4.6] },
  stride: { head: [0, 1.1, 5.2], neck: [0, 1.0, 4.85], lSho: [0.5, 1.5, 4.7], rSho: [-0.5, 0.4, 4.8], lElb: [0.9, 2.2, 4.6], rElb: [-0.9, -0.3, 4.9], pelvis: [0, 0.8, 3.0], lHip: [0.35, 1.1, 3.0], rHip: [-0.35, 0.5, 3.0], lKnee: [0.35, 2.6, 1.9], rKnee: [-0.4, 0.1, 1.6], lFoot: [0.35, 3.6, 0], rFoot: [-0.4, -0.3, 0], ball: [-1.2, -0.7, 5.6] },
  release: { head: [-0.1, 2.3, 4.9], neck: [-0.1, 2.1, 4.55], lSho: [0.45, 2.1, 4.4], rSho: [-0.55, 2.0, 4.65], lElb: [0.55, 1.6, 3.9], rElb: [-0.8, 2.6, 5.4], pelvis: [0, 1.6, 2.8], lHip: [0.35, 1.9, 2.8], rHip: [-0.35, 1.3, 2.9], lKnee: [0.35, 3.3, 1.6], rKnee: [-0.35, 0.7, 1.5], lFoot: [0.35, 4.6, 0], rFoot: [-0.35, 0.2, 0.4], ball: [-0.55, 3.3, 5.8] },
  finish: { head: [0.2, 2.7, 4.3], neck: [0.15, 2.5, 4.0], lSho: [0.6, 2.2, 3.8], rSho: [-0.3, 2.8, 3.9], lElb: [0.8, 1.7, 3.4], rElb: [0.3, 3.4, 3.1], pelvis: [0, 1.8, 2.7], lHip: [0.35, 2.0, 2.7], rHip: [-0.35, 1.6, 2.9], lKnee: [0.4, 3.4, 1.5], rKnee: [-0.2, 1.6, 1.8], lFoot: [0.35, 4.6, 0], rFoot: [-0.1, 1.2, 1.5], ball: [0.6, 3.6, 2.8] },
}

const mix = (a, b, u) => Object.fromEntries(PJ.map((k) => [k, v3.lerp(a[k], b[k], u)]))

// The pose at delivery clock `s`: 0 set, 1 kick, 2 stride, 2.35 release, 3 finish.
export function pitcherPose(s) {
  const K = PITCH
  if (s <= 0) return K.set
  if (s < 1) return mix(K.set, K.kick, ease(s))
  if (s < 2) return mix(K.kick, K.stride, ease(s - 1))
  if (s < 2.35) return mix(K.stride, K.release, smooth((s - 2) / 0.35))
  return mix(K.release, K.finish, ease(clamp((s - 2.35) / 0.65, 0, 1)))
}

// Pitcher frame to world: he faces -y from the mound. `off` shifts the body so the ball leaves his
// hand at the measured release point.
export function pitcherToWorld(pose, hand, off = [0, 0, 0]) {
  const m = hand === 'L' ? -1 : 1, o = {}
  for (const k of PJ) o[k] = [MOUND[0] + m * pose[k][0] + off[0], MOUND[1] - 1.5 - pose[k][1] + off[1], 0.8 + pose[k][2] + off[2]]
  return o
}

// Capped, so an odd row cannot throw the body off the mound.
export function releaseOffset(first, hand) {
  const r = pitcherToWorld(PITCH.release, hand).ball
  return [clamp(first[0] - r[0], -2.5, 2.5), clamp(first[1] - r[1], -2, 2), clamp(first[2] - r[2], -1.5, 1.5)]
}

// A fielder's ready stance at `pos`, turned to face home.
export function fielderJoints(pos) {
  const pose = PITCH.set, f = v3.norm([-pos[0], -pos[1], 0]), r = [f[1], -f[0], 0], o = {}
  for (const k of PJ) o[k] = v3.add(pos, v3.add(v3.add(v3.mul(r, pose[k][0]), v3.mul(f, pose[k][1] * 0.3)), [0, 0, pose[k][2]]))
  return o
}
