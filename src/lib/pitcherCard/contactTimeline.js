// The contact replay's clock (docs/contact-replay.md §8). Pure math, no React.
// Every beat is in ms of SCREEN time from the pitch's release; `tau` is that clock.
// Ported from .scratch/contact-replay/prototype.html `build` and `render`.
// scene.js `sceneFrame` still gives the Now Pitching card and the Scout their one fixed slot.
import { clamp } from '../math/number.js'
import { battedPath, foulPath } from './batted.js'
import { HOLD } from './scene.js'
import { FOLLOW, YC } from './swing.js'

const FREEZE_MS = { inplay: 66, foul: 33, whiff: 0 } // hit-stop, screen time: SLOW does not scale it
const SIDE_DELAY_MS = 140 // side view starts this long after the ball leaves the scene
const FIG_AFTER_LAND_MS = 200
const FIG_AFTER_SCENE_MS = 120 // a whiff or a foul has no landing
const FIG_STEP_MS = 55 // --stagger-step
const VERDICT_AFTER_MS = 110
const VERDICT_MS = 380 // --dur-stamp-in
const REST_MS = 500
const MITT_Y = -0.8 // ft: the catcher's mitt, behind the plate's back point

// The u in [0, hi] where the flight's y reaches `y` (y falls as u grows), or null when it never does.
function uAtY(flight, y, hi) {
  if (flight.at(hi)[1] > y) return null
  let [lo, up] = [0, hi]
  for (let i = 0; i < 40; i++) {
    const mid = (lo + up) / 2
    if (flight.at(mid)[1] > y) lo = mid
    else up = mid
  }
  return (lo + up) / 2
}

// Where the bat meets the pitch: `flight` is camera.js realFlight { T, at(u) }, u in [0, 1] from
// release to the plate's front (not seconds). { tc: s from release, K: [x, y, z] at y = YC,
// tMitt: s from release to the mitt (the whiff's end) }, or null when the path never reaches YC.
export function contactPoint(flight) {
  const u = uAtY(flight, YC, 1)
  if (u == null) return null
  const m = uAtY(flight, MITT_Y, 2)
  return { tc: u * flight.T, K: flight.at(u), tMitt: m == null ? null : m * flight.T }
}

// The beats of one pitch, in ms from release (§8.2). `slow` is the scene's slow factor; `figCount` the
// quality line's figures. A pitch with no swing (or no contact point) is a take: its whole slot is the one
// sceneFrame gives it, (T x slow + HOLD).
export function pitchBeats(pitch, slow, figCount = 1) {
  const { T, swing, contact, hit, batSide } = pitch
  if (swing == null || !contact) return { totalMs: (T * slow + HOLD) * 1000 }
  const ms = slow * 1000
  const freezeMs = FREEZE_MS[swing]
  const path = swing === 'inplay' ? battedPath(hit, contact.K) : swing === 'foul' ? foulPath(contact.K, batSide) : null
  const exitSec = path?.exitSec ?? 0
  const contactMs = contact.tc * ms
  const sceneEndMs = (swing === 'whiff' ? contact.tMitt ?? contact.tc + FOLLOW : contact.tc + Math.max(exitSec, FOLLOW)) * ms + freezeMs
  const exitMs = contactMs + freezeMs + exitSec * ms
  const side = swing === 'inplay' && path
  const sideStartMs = side ? exitMs + SIDE_DELAY_MS : null
  const sideMs = side ? clamp(path.T * 500, 700, 2800) : null
  const landMs = side ? sideStartMs + sideMs : sceneEndMs
  const figsStartMs = side ? landMs + FIG_AFTER_LAND_MS : sceneEndMs + FIG_AFTER_SCENE_MS
  const verdictMs = figsStartMs + figCount * FIG_STEP_MS + VERDICT_AFTER_MS
  return { contactMs, freezeMs, exitMs, sceneEndMs, sideStartMs, sideMs, landMs, figsStartMs, verdictMs, totalMs: verdictMs + VERDICT_MS + REST_MS }
}

// The scene's own time in ms: the clock holds at contact for the freeze, then runs on.
export function sceneClock(beats, tau) {
  const { contactMs, freezeMs } = beats
  return contactMs != null && tau > contactMs ? Math.max(contactMs, tau - freezeMs) : tau
}

// Plays the pitches ONCE, in order, each in its own totalMs slot: { idx, tau: ms inside that slot, done }.
// `picked` (an index) plays only that pitch. With no clock yet (`elapsed` null) it rests on the last pitch.
export function replayFrame(beatsList, elapsed, picked) {
  const one = Number.isInteger(picked) && picked >= 0 && picked < beatsList.length
  const [from, to] = one ? [picked, picked + 1] : [0, beatsList.length]
  let left = elapsed ?? Infinity
  for (let idx = from; idx < to; idx++) {
    const { totalMs } = beatsList[idx]
    if (left < totalMs) return { idx, tau: left, done: false }
    left -= totalMs
  }
  return { idx: Math.max(to - 1, 0), tau: beatsList[to - 1]?.totalMs ?? 0, done: true }
}
