import { useMemo, useState } from 'react'
import { PitchScene } from './PitchScene.jsx'
import { motionIsReduced } from '../../../hooks/preferences/motionIsReduced.js'
import { atBatScenePitches, atBatZone } from '../../../lib/pitcherCard/atBat.js'

// WHAT THE AT-BAT LOOKED LIKE: every pitch of one plate appearance, thrown in
// order from behind the plate, each along its own measured path. The Now
// Pitching card's scene (PitchScene) does the drawing; this only hands it real
// flights (lib/pitcherCard/atBat.js) and names the pitch in flight and how the
// umpire or the batter answered it.
//
// Reveal-only by construction, like the zone plot beside it: `pitchDetails`
// arrives on an at-bat card that is only built inside its half's SealBox reveal.
//
// It draws nothing where there is nothing to draw. No tracked flight (most MiLB
// parks) and a reader who asked for less motion both fall back to the static
// zone plot and pitch list, which stay on the card either way. PitchScene's own
// reduced-motion path would freeze on the first pitch, which says nothing about
// an at-bat, so this stands down before it mounts.
export function AtBatReplay({ pitchDetails, pitcher }) {
  const pitches = useMemo(() => atBatScenePitches(pitchDetails), [pitchDetails])
  const zone = useMemo(() => atBatZone(pitchDetails), [pitchDetails])
  // `setActive` is stable, which PitchScene needs: its draw loop restarts when
  // `onActive` changes.
  const [active, setActive] = useState(0)
  if (pitches.length === 0 || motionIsReduced()) return null
  const now = pitches[active] ?? pitches[0]
  return (
    <div className="pcard pbp__replay">
      <PitchScene
        pitches={pitches}
        lefty={pitcher?.hand === 'L'}
        name={pitcher?.last ?? 'the pitcher'}
        onActive={setActive}
        zone={zone}
      />
      <p className="pbp__replaycap">
        <span>
          Pitch {now.no} of {pitchDetails.length}
        </span>
        <span>{now.call || '—'}</span>
      </p>
    </div>
  )
}
