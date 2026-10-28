// One fixed overhead field at every point in a play. Coordinates are in feet; height never
// shifts the camera or the ball's ground position. The only paths are the ball's short trail.
import { BASES, clamp } from './scene.js'
import { KIT, S, newBuf, put, rect, sprite } from './pixels.js'

export const stageScale = (W) => Math.max(1, Math.round(W / 480))

// Small shaded figures: cream cloth, navy equipment, gold piping and brown leather,
// echoing #2675's material separation without depending on its celebration atlases.
const STAND = [
  '......hhh......', '.....hHHHh.....', '.....hHHTH.....', '......Fff......',
  '......Ff.......', '....jJJJJj.....', '...sjJJTJjs....', '...sjJJTJjs....',
  '..ss.jJTJj.ss..', '...s.jJTJj.s...', '.....jJJJj.....', '.....nnnnn.....',
  '....pPPPPPp....', '....pPP.PPp....', '....pPP.PPp....', '....pPP.PPp....',
  '....pPP.PPp....', '....pSS.SSp....', '....SSS.SSS....', '...kKKK.KKKk...',
  '...kKKK.KKKk...',
]
const MINI = {
  stand: STAND,
  run0: [...STAND.slice(0, 6), '....jJJTJjss...', '...sjJJTJj.....', '..ss.jJTJj.....',
    '.....jJTJj.....', ...STAND.slice(10, 13), '...pPP..PPp....', '..pPP...PPp....',
    '..pPP....PPp...', '..SSS.....SS...', '.kKKK.....SS...', '.kKKK....kKKk..',
    '.........kKKk..', '...............'],
  run1: [...STAND.slice(0, 6), '...ssjJTJj.....', '.....jJTJjs....', '.....jJTJjss...',
    '.....jJTJj.....', ...STAND.slice(10, 13), '.....pPP.Pp....', '......pPPPp....',
    '.......pPPp....', '.......pPPp....', '.......SSS.....', '......kKKK.....',
    '......kKKK.....', '...............'],
}
const FIELD_KIT = { ...KIT.home, H: S.kitNavy, h: S.overheadEquipment, F: S.skin, f: S.skinShade,
  J: S.overheadCloth, j: S.overheadClothShade, T: S.overheadGold, P: S.overheadCloth,
  p: S.overheadClothShade, n: S.kitNavy, B: S.overheadLeather, b: S.dirt, k: S.overheadEquipment }
const RUNNER_KIT = { ...FIELD_KIT, J: S.kitNavy, j: S.overheadEquipment, T: S.overheadGold }

function line(b, a, c, slot) {
  const dx = c[0] - a[0], dy = c[1] - a[1], n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)))
  for (let i = 0; i <= n; i++) put(b, a[0] + dx * i / (n || 1), a[1] + dy * i / (n || 1), slot)
}

// A stable base diamond, with headroom for the taller runner sprites.
// Framing depends only on slot size, never a revealed result.
export function fieldFrame(wall, w, h) {
  const fence = ['home', '1B', '2B', '3B'].map((key) => BASES[key])
  const left = -95, right = 95, top = 185, bottom = -40
  const k = Math.max(0.001, Math.min((w - 20) / (right - left), (h - 20) / (top - bottom)))
  const x0 = (w - (right - left) * k) / 2, y0 = (h - (top - bottom) * k) / 2
  const project = (p) => [x0 + (p[0] - left) * k, y0 + (top - p[1]) * k]
  const world = (x, y) => [left + (x - x0) / k, top - (y - y0) / k]
  return { fence, project, world, k }
}

function background(wall, w, h) {
  const fb = newBuf(w, h), frame = fieldFrame(wall, w, h), P = frame.project
  fb.px.fill(S.overheadNight)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [wx, wy] = frame.world(x, y)
    const edge = Math.abs(wx) + Math.abs(wy - BASES['1B'][1])
    if (edge > BASES['1B'][1] + 10) continue
    const path = edge > BASES['1B'][1] - 10
    const stripe = Math.floor(wy / 24) & 1
    const slot = path ? S.overheadClay : stripe ? S.overheadTurfLit : S.overheadTurf
    fb.px[y * w + x] = slot
  }
  const home = P(BASES.home), fence = frame.fence.map(P)
  line(fb, home, fence[0], S.overheadGold)
  for (let i = 1; i < fence.length; i++) line(fb, fence[i - 1], fence[i], S.overheadGold)
  line(fb, fence.at(-1), home, S.overheadGold)
  const bags = ['home', '1B', '2B', '3B', 'home'].map((key) => P(BASES[key]))
  for (let i = 1; i < bags.length; i++) line(fb, bags[i - 1], bags[i], S.overheadCloth)
  for (const bag of bags.slice(0, 4)) rect(fb, Math.round(bag[0]) - 1, Math.round(bag[1]) - 1, 3, 3, S.chalk)
  return { fb, frame }
}

const CACHE = new WeakMap()
function cacheOf(wall, w, h) {
  const old = CACHE.get(wall), key = w + 'x' + h
  if (old?.key === key) return old
  const next = { key, ...background(wall, w, h), out: newBuf(w, h) }
  CACHE.set(wall, next)
  return next
}

export function drawStage(st, w, h) {
  const K = cacheOf(st.play.wall, w, h), fb = K.out, P = K.frame.project
  fb.px.set(K.fb.px)
  const frame = Math.floor(st.t / 0.1) & 1, people = []
  const person = (key, p, moving, kit, flip = false) => people.push({ key, p, kit, flip, rows: moving ? MINI[frame ? 'run1' : 'run0'] : MINI.stand })
  if (!st.play.runners.some((r) => r.start == null)) person('batter', [st.play.batter === 'L' ? 32 : -32, -5, 0], false, RUNNER_KIT)
  st.runners.forEach((r, i) => { if (!r.gone) person('runner:' + i, r.pos, r.moving, RUNNER_KIT, r.pos[0] < 0) })
  people.sort((a, b) => b.p[1] - a.p[1])
  fb.sprites = []
  for (const m of people) {
    const [x, y] = P(m.p)
    rect(fb, Math.round(x) - 4, Math.round(y), 9, 2, S.shadow)
    sprite(fb, m.rows, x, y, m.kit, m.flip)
    fb.sprites.push({ key: m.key, x, y: y - m.rows.length / 2 })
  }
  // At most three trailing pixels. No full-flight arc, scrolling chase, burst or celebration.
  const ball = st.ballPos ?? st.pitchPos
  const toScreen = (p) => P(p).map((v, i) => clamp(v, 4, (i ? h : w) - 5))
  if (ball) {
    if (st.phase === 'chase') {
      for (const back of [0.12, 0.08, 0.04]) {
        if (st.ballT <= back * st.play.ball.T) continue
        const [x, y] = toScreen(st.play.ball.at(st.ballT - back * st.play.ball.T))
        put(fb, x, y, S.chalk)
      }
    } else if (st.phase === 'pitch') {
      const [x, y] = toScreen([0, 60.5 * (1 - Math.max(0, st.pitchU - 0.12)), 0])
      put(fb, x, y, S.chalk)
    }
    const [x, y] = toScreen(ball)
    rect(fb, Math.round(x) - 2, Math.round(y) - 2, 5, 5, S.outline)
    rect(fb, Math.round(x) - 1, Math.round(y) - 1, 3, 3, S.chalk)
  }
  return fb
}
