import { openAtBat } from '../../../../api/gameday/subSteps.js'
import { pitchCardInfo } from '../../../../api/playbyplay/pitchInfo.js'
import { normalizePitch } from '../../../../lib/zone/zoneGeometry.js'
import { selectPlayBattedBall } from '../../../../api/hitchart.js'

// The pitches the zone card plots over its grid (Gary, 2026-10-28): the open at-bat's pitches up to
// the sub-step on screen, or every pitch of the at-bat on screen in a half read back. Reveal-only:
// call it inside a SealBox reveal function. Each is placed in the grid's own box (catcher's view,
// pX as it comes; 0-100 spans the zone, a ball outside lands past the edge).
// Widened with the 15% smaller zone (Gary, 2026-10-29): the stage now holds more of the grid's own size around it.
const TOP = [-70, 175], LEFT = [-150, 350] // the raised grid leaves about two-thirds of itself above it
const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v))

export function zonePitches(feed, { inning, half, open, last, committed }) {
  let thrown = []
  let play = null
  // A walked-back at-bat (pitch-mode replay) counts its pitches one tap at a time, as the hero does.
  if (open?.sub > 0) {
    const o = openAtBat(feed, inning, half, open.count)
    thrown = (o?.steps ?? []).slice(0, open.sub).filter((s) => s.kind === 'pitch' && s.pitch).map((s) => s.pitch)
  } else if (committed) {
    play = feed?.liveData?.plays?.allPlays?.[last]
    thrown = play ? pitchCardInfo(feed, play).pitchDetails : []
  }
  return thrown.flatMap((p) => {
    const n = normalizePitch(p.px, p.pz, p.szTop, p.szBottom)
    // The ball in play carries its flight (the hero diamond's card) and its Savant playId.
    const ball = p.cat === 'inplay' && play ? selectPlayBattedBall(play) : null
    const g = feed?.gameData
    if (!n) return []
    // A pitch past the stage's edge pins to it and points the way it went (Gary, 2026-10-28). The
    // bounds are shares of the grid: the stage leaves about this much room around the zone.
    const left = ((n.xn + 1) / 2) * 100, top = (1 - n.zn) * 100
    const off = top < TOP[0] ? 'up' : top > TOP[1] ? 'down' : left < LEFT[0] ? 'left' : left > LEFT[1] ? 'right' : null
    // Its type, speed and call, for the dot's hover card (Gary, 2026-10-29): a pitch already on screen.
    return [{ no: p.no, cat: p.cat, off, left: clamp(left, LEFT), top: clamp(top, TOP), type: p.type ?? '', mph: p.mph ?? null, call: p.callDesc ?? '',
      ball: ball && { ...ball, venue: g?.venue?.name ?? '', venueId: g?.venue?.id ?? null, gameDate: g?.datetime?.officialDate ?? null },
      playId: ball ? play.playEvents?.findLast((e) => e.details?.isInPlay)?.playId ?? null : null }]
  })
}
