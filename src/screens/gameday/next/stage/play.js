// One at-bat as a timeline: stagePlay() reads a revealed feed play once; stateAt(play, t) is a pure
// function of that play and the time since the tap. Nothing here reads a clock or draws.
//
// SPOILER FOOTING. A play carries the result (a ball in the seats, an out), so a caller builds it only
// from a REVEALED play, inside a SealBox reveal render function (ADR-0001, ADR-0002). The stage
// plays from the tap and never on a cold load (#2568, "Spoiler-rule check"); that rule is the mount's.
//
// DATA. Measured pitch and batted-ball paths keep their feed coordinates, but the overhead
// stage abbreviates their timing. The camera and runner routes do not follow the ball.
import { realFlight } from '../../../../lib/pitch/pitchFlight.js'
import { flightPath } from '../../../../lib/gameday/flightPath.js'
import { BASES, POS, clamp, lerp, polar, smooth, v3 } from './scene.js'

const BEAT = { ready: 0.08, pitch: 0.22, settle: 0.16, result: 0.5 }
const RUN_SPEED = 200 // feet per second of the abbreviated basepath sequence
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
      out.push({ id: es[0].details?.runner?.id ?? null, start: a?.start ?? a?.originBase ?? null, end: move.at(-1).movement?.end ?? null, out: move.some((r) => r.movement?.isOut), outAt: move.find((r) => r.movement?.isOut)?.movement?.outBase })
    } else if (!es.some((r) => r.movement?.isOut)) {
      const b = es.at(-1).movement?.end ?? null
      out.push({ id: es[0].details?.runner?.id ?? null, start: b, end: b, out: false })
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
  const runners = runnersOf(p.runners ?? [], last?.index ?? 0)
  const t = { dots: 0, windup: BEAT.ready }
  t.pitch = t.windup + (last ? BEAT.pitch : 0)
  t.contact = t.pitch
  // A hit and its throw share one short beat. Running can outlast it, including a full homer.
  t.chase = t.contact + (ball ? clamp(ball.T * 0.15, 0.4, 0.85) : 0)
  const runTime = Math.max(0, ...runners.map((r) => runnerDistance(r, ball) / RUN_SPEED))
  t.advance = Math.max(t.chase, t.contact + runTime)
  t.settle = t.advance + BEAT.settle
  t.end = t.settle + BEAT.result
  return {
    pitches, last, ball, t, wall, end: t.end, runners,
    batterId: p.matchup?.batter?.id ?? null, pitcherId: p.matchup?.pitcher?.id ?? null,
    batter: p.matchup?.batSide?.code === 'L' ? 'L' : 'R',
    pitcher: p.matchup?.pitchHand?.code === 'L' ? 'L' : 'R',
    fielder: credits[0]?.pos ?? null,
  }
}

// Outs stop short of the bag; a strikeout never sends the batter running.
function runnerDistance(r, ball) {
  const a = baseIndex(r.start) * 90
  if (r.out) {
    if (!ball && r.start == null) return 0
    const bag = r.outAt ? baseIndex(r.outAt) * 90 : a + (r.start == null && ball?.throw ? 90 : 45)
    return Math.max(0, bag - a - 6)
  }
  return r.end ? Math.max(0, baseIndex(r.end) * 90 - a) : 0
}

const onPath = (d) => {
  const c = clamp(d, 0, 360), i = Math.min(3, Math.floor(c / 90))
  return v3.lerp(BASES[ORDER[i]], BASES[ORDER[i + 1]], (c - i * 90) / 90)
}

// Everything the drawing needs at t seconds after the tap. The field is always overhead.
export function stateAt(play, t) {
  const { t: T, last, ball } = play
  const phase = t < T.windup ? 'ready' : t < T.pitch ? 'pitch' : t < T.chase ? 'chase' : t < T.advance ? 'advance' : t < T.settle ? 'settle' : 'result'
  const pitchU = clamp((t - T.windup) / BEAT.pitch, 0, 1)
  const ballU = clamp((t - T.contact) / (T.chase - T.contact || 1), 0, 1)
  const ballT = ball ? ballU * ball.T : 0
  const runners = play.runners.map((r) => {
    const a = baseIndex(r.start) * 90, distance = runnerDistance(r, ball)
    const travelled = Math.min(distance, Math.max(0, t - T.contact) * RUN_SPEED)
    const moving = travelled < distance && t >= T.contact
    return { id: r.id, pos: onPath(a + travelled), batter: r.start == null, moving,
      gone: (r.out && !ball && r.start == null) || (r.out && t >= T.advance) || a + travelled >= 360 }
  })
  const fielders = { ...POS }
  if (ball && play.fielder && POS[play.fielder] && t >= T.contact) {
    const to = [...ball.field.slice(0, 2), 0]
    fielders[play.fielder] = v3.lerp(POS[play.fielder], to, smooth(ballU))
  }
  if (ball?.throw && POS[ball.throw.to] && t >= T.contact) {
    const bag = ball.throw.target
    fielders[ball.throw.to] = v3.lerp(POS[ball.throw.to], [bag[0] - Math.sign(bag[0]) * 1.5, bag[1], 0], smooth(ballU))
  }
  return {
    t, phase, play, pitchU, ballT, runners, fielders, view: 'field',
    pitchPos: last && t >= T.windup && t < T.pitch
      ? (last.at ? last.at(pitchU) : v3.lerp([0, 60.5, 0], BASES.home, pitchU)) : null,
    ballPos: ball && t >= T.contact ? ball.at(ballT) : null,
  }
}
