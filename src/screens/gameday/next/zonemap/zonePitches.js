import { openAtBat } from '../../../../api/gameday/subSteps.js'
import { pitchCardInfo } from '../../../../api/playbyplay/pitchInfo.js'
import { normalizePitch } from '../../../../lib/zone/zoneGeometry.js'
import { selectPlayBattedBall } from '../../../../api/hitchart.js'

// The pitches the zone card plots over its grid (Gary, 2026-10-28): the open at-bat's pitches up to
// the sub-step on screen, or every pitch of the at-bat on screen in a half read back. Reveal-only:
// call it inside a SealBox reveal function. Each is placed in the grid's own box (catcher's view,
// pX as it comes; 0-100 spans the zone, a ball outside lands past the edge).
const TOP = [-28, 145], LEFT = [-100, 300] // the raised grid leaves about a third of itself above it
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
    return [{ no: p.no, cat: p.cat, off, left: clamp(left, LEFT), top: clamp(top, TOP),
      ball: ball && { ...ball, venue: g?.venue?.name ?? '', venueId: g?.venue?.id ?? null, gameDate: g?.datetime?.officialDate ?? null },
      playId: ball ? play.playEvents?.findLast((e) => e.details?.isInPlay)?.playId ?? null : null }]
  })
}
