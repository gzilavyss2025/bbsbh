// One at-bat as a timeline: stagePlay() reads a revealed feed play once; stateAt(play, t) is a pure
// function of that play and the time since the tap. Nothing here reads a clock or draws.
//
// SPOILER FOOTING. A play carries the result (a ball in the seats, an out), so a caller builds it only
// from a REVEALED play, inside a SealBox reveal render function (ADR-0001, ADR-0002). The stage
// plays from the tap and never on a cold load (#2568, "Spoiler-rule check"); that rule is the mount's.
//
// DATA. Pitches ride realFlight (pitch/pitchFlight.js) with the release point at 60.5 ft minus the
// feed's extension (matched the feed's plateTime on all 334 pitches of 824716). The batted ball
// rides flightPath (lib/gameday/flightPath.js): tier A measured, tier B drawn, tier C none, and a
// tier C ball has no chase, only the pitch view. The wall and the throw are drawn, not measured.
import { realFlight } from '../../../../lib/pitch/pitchFlight.js'
import { flightPath } from '../../../../lib/gameday/flightPath.js'
import { BASES, POS, clamp, lerp, polar, smooth, v3 } from './scene.js'
import { CONTACT, SWING, batterToWorld, swingPose } from './swing.js'
import { pitcherPose, pitcherToWorld, releaseOffset } from './windup.js'

const BEAT = { dots: 0.12, windup: 0.95, contact: 0.18, settle: 1.0, result: 1.6 }
const SWUNG = /[SWFLTMXDE]/
const FLY = ['fly_ball', 'line_drive', 'popup', 'bunt_popup']
// The bag a putout is made at, by the position that covers it.
const BAG = { '1B': '1B', P: '1B', '2B': '2B', SS: '2B', '3B': '3B', C: 'home' }
const ORDER = ['home', '1B', '2B', '3B', 'home']
const baseIndex = (b) => (b == null ? 0 : b === 'score' ? 4 : ORDER.indexOf(b))

function pitchOf(e) {
  const c = e.pitchData?.coordinates ?? {}, pd = e.pitchData ?? {}
  const f = realFlight({ vx0: c.vX0, vy0: c.vY0, vz0: c.vZ0, ax: c.aX, ay: c.aY, az: c.aZ, px: c.pX, pz: c.pZ, release: [c.x0, 60.5 - (pd.extension ?? 6.3), c.z0] })
  return {
    n: e.pitchNumber, index: e.index, code: e.details?.code ?? '', type: e.details?.type?.code ?? '', mph: pd.startSpeed ?? null,
    px: c.pX ?? null, pz: c.pZ ?? null, szTop: pd.strikeZoneTop ?? 3.4, szBot: pd.strikeZoneBottom ?? 1.6,
    T: f ? f.T : (pd.plateTime ?? 0.42), at: f ? f.at : null,
  }
}

// The batted ball as a function of the time since contact, or null for tier C.
function ballOf(hitData, wall, credits) {
  const fp = flightPath(hitData)
  if (!fp) return null
  const pts = fp.points, n = pts.length - 1
  let T = fp.T
  let at = (t) => {
    const f = clamp(t / fp.T, 0, 1) * n, i = Math.min(n - 1, Math.floor(f)), u = f - i
    return v3.lerp([pts[i].x, pts[i].y, pts[i].z], [pts[i + 1].x, pts[i + 1].y, pts[i + 1].z], u)
  }
  const end = at(fp.T)
  const air = FLY.includes(fp.trajectory)
  const out = { kind: air ? 'air' : 'ground', bearing: fp.bearing, tier: fp.tier, tag: fp.tag, land: end, wall: null, throw: null }
  if (air && Math.abs(fp.bearing) <= 45) {
    const w = wall(fp.bearing), i = pts.findIndex((p) => Math.hypot(p.x, p.y) >= w.ft)
    out.wall = { ...w, hit: false }
    if (i > 0) {
      const a = pts[i - 1], b = pts[i], u = (w.ft - Math.hypot(a.x, a.y)) / (Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y) || 1)
      const tc = lerp(a.t, b.t, u), zc = lerp(a.z, b.z, u), flight = at
      if (zc < w.h) {
        // Under the top: it hits the wall and drops at its foot. Over it, the path runs on to the
        // coordinate, which is in the seats.
        const drop = 0.7, foot = polar(fp.bearing, w.ft - 5)
        T = tc + drop
        at = (t) => (t <= tc ? flight(t) : v3.lerp(flight(tc), [foot[0], foot[1], 0], smooth(clamp((t - tc) / drop, 0, 1))))
        out.land = foot
        out.wall.hit = true
      }
    }
  } else if (!air) {
    // A ground out: the first credit fields it, the first putout by someone else receives the throw
    // (a 4-3: the second baseman to the first), 0.25 s to transfer, then 85 ft/s.
    const first = credits[0], put = credits.find((c) => c.credit === 'f_putout' && c.pos !== first?.pos)
    if (first && put && first.credit !== 'f_putout' && BAG[put.pos]) {
      const from = [end[0], end[1], 3.5], to = [...BASES[BAG[put.pos]].slice(0, 2), 4.5], fly = v3.len(v3.sub(to, from)) / 85
      const base = at, hold = 0.25, t0 = fp.T
      T = t0 + hold + fly
      at = (t) => {
        if (t <= t0) return base(t)
        if (t <= t0 + hold) return from
        const u = clamp((t - t0 - hold) / fly, 0, 1), q = v3.lerp(from, to, u)
        return [q[0], q[1], q[2] + 7 * u * (1 - u)]
      }
      out.throw = { by: first.pos, to: put.pos, start: t0 + hold, end: T, target: to }
      out.land = to
    }
  }
  out.field = polar(fp.bearing, fp.distance)
  return { ...out, T, at, hit: end }
}

// The feed lists one entry per movement, so a runner who moves twice (a single: 1B to 2B, then 2B
// to 3B) has two. One runner is one figure: he stands where he was before the last pitch, and moves
// at contact from his first contact entry's start to his last entry's end. A move before the last
// pitch (a steal, a wild pitch) is not a contact move: it only sets where he stands; a runner put
// out before it is not on the field.
function runnersOf(entries, lastIdx) {
  const by = new Map()
  for (const r of entries) {
    const id = r.details?.runner?.id ?? `#${by.size}`
    by.set(id, [...(by.get(id) ?? []), r])
  }
  const out = []
  for (const es of by.values()) {
    const move = es.filter((r) => (r.details?.playIndex ?? Infinity) >= lastIdx)
    if (move.length) {
      const a = move[0].movement
      out.push({ start: a?.start ?? a?.originBase ?? null, end: move.at(-1).movement?.end ?? null, out: move.some((r) => r.movement?.isOut) })
    } else if (!es.some((r) => r.movement?.isOut)) {
      const b = es.at(-1).movement?.end ?? null
      out.push({ start: b, end: b, out: false })
    }
  }
  return out
}

// Build the stage's play from one feed play (allPlays[i]) and its park's `wall(deg)` ({ ft, h }).
export function stagePlay(p, wall) {
  const pitches = (p.playEvents ?? []).filter((e) => e.isPitch).map(pitchOf)
  const last = pitches.at(-1)
  const inPlay = !!last && 'XDE'.includes(last.code)
  const hitData = p.playEvents?.findLast((e) => e.hitData)?.hitData
  const credits = (p.runners?.find((r) => r.credits?.length && r.movement?.isOut)?.credits ?? []).map((c) => ({ pos: c.position?.abbreviation, credit: c.credit }))
  const ball = inPlay && hitData ? ballOf(hitData, wall, credits) : null
  const dots = BEAT.dots * Math.max(0, pitches.length - 1)
  const t = { dots, windup: dots + BEAT.windup }
  t.pitch = t.windup + (last?.T ?? 0.42)
  t.contact = t.pitch + (ball ? BEAT.contact : 0.25)
  t.chase = t.contact + (ball ? ball.T : 0)
  t.settle = t.chase + BEAT.settle
  t.end = t.settle + BEAT.result
  return {
    pitches, last, ball, t, wall, end: t.end,
    swings: !!last && SWUNG.test(last.code),
    batter: p.matchup?.batSide?.code === 'L' ? 'L' : 'R',
    pitcher: p.matchup?.pitchHand?.code === 'L' ? 'L' : 'R',
    fielder: credits[0]?.pos ?? null,
    pOff: last?.at ? releaseOffset(last.at(0), p.matchup?.pitchHand?.code) : [0, 0, 0],
    runners: runnersOf(p.runners ?? [], last?.index ?? 0),
  }
}

const onPath = (d) => {
  const c = clamp(d, 0, 360), i = Math.min(3, Math.floor(c / 90))
  return v3.lerp(BASES[ORDER[i]], BASES[ORDER[i + 1]], (c - i * 90) / 90)
}

// Bring the bat's sweet spot to where the pitch crossed the plate, most at contact: the keyframes
// swing at a middle pitch, this bends the arms toward an inside, outside, high or low one.
function aim(w, play, s) {
  const k = Math.exp(-(((s - CONTACT) / 0.45) ** 2))
  if (!play.swings || !play.last?.at || k < 0.01) return w
  const c = batterToWorld(SWING.contact, play.batter), sweet = v3.lerp(c.hands, c.batTip, 0.72), hit = play.last.at(1)
  const d = v3.mul([hit[0] - sweet[0], 0, hit[2] - sweet[2]], k)
  return { ...w, hands: v3.add(w.hands, d), batTip: v3.add(w.batTip, d), lElb: v3.add(w.lElb, v3.mul(d, 0.55)), rElb: v3.add(w.rElb, v3.mul(d, 0.55)) }
}

// Everything the drawing needs at `t` seconds after the tap.
export function stateAt(play, t) {
  const { t: T, last, ball } = play
  const phase = t < T.dots ? 'dots' : t < T.windup ? 'windup' : t < T.pitch ? 'pitch' : t < T.contact ? 'contact' : t < T.chase ? 'chase' : t < T.settle ? 'settle' : 'result'
  const pitchU = clamp((t - T.windup) / (last?.T || 1), 0, 1)
  const pClock = clamp((t - T.dots) / BEAT.windup, 0, 1) * 2.35 + clamp((t - T.windup) / 0.6, 0, 1) * 0.65
  // The load runs through the windup, the launch through the flight: contact lands on the pitch's
  // last sample (an early engine had it 0.2 s late).
  const clock = t < T.dots ? 0 : t < T.windup ? (t - T.dots) / BEAT.windup : t < T.pitch ? 1 + (CONTACT - 1) * pitchU : CONTACT + 0.6 * clamp((t - T.pitch) / 0.6, 0, 1)
  const ballT = ball && t >= T.contact ? clamp(t - T.contact, 0, ball.T) : 0
  const runStart = ball ? T.contact : T.pitch
  const runners = play.runners.map((r) => {
    const a = baseIndex(r.start) * 90
    const b = r.out ? a + (r.start == null && ball?.throw ? 84 : 45) : r.end ? baseIndex(r.end) * 90 : a
    const d = Math.min(Math.max(a, b), a + Math.max(0, t - runStart) * 26)
    return { pos: onPath(d), batter: r.start == null, gone: (r.out && !ball && r.start == null) || (r.out && t > T.settle) || d >= 360 }
  })
  const fielders = { ...POS }
  if (ball && play.fielder && POS[play.fielder] && t > T.contact) {
    const to = ball.field, from = POS[play.fielder], dir = v3.sub([to[0], to[1], 0], from)
    fielders[play.fielder] = v3.add(from, v3.mul(v3.norm(dir), Math.min(v3.len(dir), (t - T.contact) * 24)))
  }
  if (ball?.throw && POS[ball.throw.to] && t > T.contact) {
    const bag = ball.throw.target
    fielders[ball.throw.to] = v3.lerp(POS[ball.throw.to], [bag[0] - Math.sign(bag[0]) * 1.5, bag[1], 0], smooth(clamp((t - T.contact) / 1.2, 0, 1)))
  }
  return {
    t, phase, play, clock, pitchU, ballT, runners, fielders,
    view: ball && t >= T.contact ? 'field' : 'pitch',
    marks: Math.min(play.pitches.length - 1, Math.floor(t / BEAT.dots) + (t > 0 ? 1 : 0)),
    pitchPos: last?.at && t >= T.windup && t < T.pitch + 0.05 ? last.at(pitchU) : null,
    ballPos: ball && t >= T.contact ? ball.at(ballT) : null,
    batterPose: aim(batterToWorld(swingPose(clock, play.swings), play.batter), play, clock),
    pitcherPose: pitcherToWorld(pitcherPose(pClock), play.pitcher, play.pOff),
  }
}
