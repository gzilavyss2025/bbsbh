// The at-bat replay's model (ADR-0099's scene, fed one plate appearance): every
// pitch of the at-bat as a REAL flight, measured by the park's tracking and
// drawn by the same PitchScene the Now Pitching card uses. Pure math, no React,
// so `npm test` can pin it (test/at-bat-scene.test.js).
//
// It reads `pitchDetails` off an at-bat card, which only exists inside the
// half's reveal, so it carries the same seal as the zone plot beside it. Nothing
// here may be called from a spoiler-free surface.
//
// DEGRADES LIKE THE ZONE PLOT. A pitch with no tracked flight (a MiLB park, or a
// pitch the system lost) is left out; an at-bat with none returns [] and the
// caller draws nothing.

import { pitchFamily, pitchLabel } from '../../api/pitchArsenal.js'
import { realFlight } from './camera.js'
import { realScenePitch } from './scene.js'

// Release distance used only when the feed sent no `extension`. The path still
// ends exactly where the tracking put the pitch; this only moves its start by
// a few inches. Matches the card's own release (scene.js Y0).
const FALLBACK_RELEASE_Y = 54.2

function median(xs) {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// The scene's pitch list for one at-bat, in the order thrown. Each entry is a
// PitchScene pitch (`code` is unique per pitch, because the scene keys its
// ghost trails on it and two fastballs share a type code) plus `no` and `call`
// for the caption. `view` is the scene's camera.
export function atBatScenePitches(pitchDetails, view = 'hitter') {
  const out = []
  for (const p of pitchDetails ?? []) {
    const flight = realFlight({ ...p, release: [0, p.releaseY ?? FALLBACK_RELEASE_Y, 0] })
    if (!flight) continue
    const type = p.type || pitchLabel(p.typeCode) || 'Pitch'
    const scene = realScenePitch(
      flight,
      {
        code: `${p.typeCode || 'XX'}-${p.no}`,
        name: `${p.no} · ${type}`,
        mph: p.mph == null ? '—' : p.mph.toFixed(1),
        family: pitchFamily(p.typeCode),
      },
      view,
    )
    out.push({ ...scene, no: p.no, call: p.callDesc })
  }
  return out
}

// The zone the scene draws: the median of the at-bat's own top and bottom, the
// same steadying StrikeZone.jsx does, or undefined so the scene keeps its
// nominal zone.
export function atBatZone(pitchDetails) {
  const zones = (pitchDetails ?? []).filter((p) => typeof p.szTop === 'number' && typeof p.szBottom === 'number')
  if (zones.length === 0) return undefined
  return [median(zones.map((p) => p.szBottom)), median(zones.map((p) => p.szTop))]
}
