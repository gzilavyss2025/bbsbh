import { useEffect, useMemo, useRef, useState } from 'react'
import { PitchScene } from './PitchScene.jsx'
import { Button } from '../../ui/control/Button.jsx'
import { PitchList, StrikeZone, ZoneSheet } from '../../scoring/StrikeZone.jsx'
import { HOVER_CARD_QUERY, useMediaQuery } from '../../../hooks/useMediaQuery.js'
import { motionIsReduced } from '../../../hooks/preferences/motionIsReduced.js'
import { atBatScenePitches, atBatZone } from '../../../lib/pitcherCard/atBat.js'

// WHAT THE AT-BAT LOOKED LIKE: every pitch of one plate appearance, thrown in
// order from behind the plate, each along its own measured path. The Now
// Pitching card's scene (PitchScene, in its `atBat` look) does the drawing;
// this only hands it real flights (lib/pitcherCard/atBat.js). It plays the
// at-bat through once and rests. A pick (a pitch-list row on wide, a numbered
// chip in the phone sheet) plays that one pitch and holds it.
//
// Reveal-only by construction, like the zone plot beside it: `pitchDetails`
// arrives on an at-bat card that is only built inside its half's SealBox reveal.
//
// ONE PLACE AT A TIME: inside .pbp__zonecell on wide (ReplayCell), in a sheet
// a phone opens on demand (ReplaySheet). Closed, the sheet mounts nothing, so a
// stacked half on a phone holds no scene per at-bat.

// Hover plays a pitch after this dwell, so a mouse crossing the list does not
// start every row it passes.
const DWELL_MS = 250

// The at-bat's flights, or null where there is no replay. No tracked flight
// (most MiLB parks) and a reader who asked for less motion both fall back to
// the static zone plot and pitch list: PitchScene's own reduced-motion path
// would freeze on the first pitch, which says nothing about an at-bat.
//
// Keyed on the pitches' CONTENT: a live game's poll rebuilds `pitchDetails`
// every 15-60 s, and a new array would restart every replay on the page.
export function useReplayPitches(pitchDetails) {
  const key = JSON.stringify(pitchDetails ?? [])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is pitchDetails' content
  const pitches = useMemo(() => atBatScenePitches(pitchDetails), [key])
  return pitches.length > 0 && !motionIsReduced() ? pitches : null
}

function ReplayScene({ pitches, pitchDetails, pitcher, play, children }) {
  const zone = useMemo(() => atBatZone(pitchDetails), [pitchDetails])
  return (
    <div className="pcard pbp__replay">
      <PitchScene
        pitches={pitches}
        lefty={pitcher?.hand === 'L'}
        name={pitcher?.last ?? 'the pitcher'}
        zone={zone}
        atBat={pitchDetails.length}
        play={play}
      />
      {children}
    </div>
  )
}

// Wide: the zone plot and the scene side by side, the pitch list full width
// under both, its number dots the picks. Hover picks too, only with a real mouse.
export function ReplayCell({ pitchDetails, batSide, pitcher, pitches }) {
  const [play, setPlay] = useState(null)
  const mouse = useMediaQuery(HOVER_CARD_QUERY)
  const dwell = useRef(0)
  useEffect(() => () => clearTimeout(dwell.current), [])
  const pick = {
    nos: new Set(pitches.map((p) => p.no)),
    picked: play?.no,
    onPick: (no) => {
      clearTimeout(dwell.current)
      setPlay({ no })
    },
    onHover: mouse
      ? (no) => {
          clearTimeout(dwell.current)
          if (no != null) dwell.current = setTimeout(() => setPlay({ no }), DWELL_MS)
        }
      : undefined,
  }
  return (
    <>
      <StrikeZone pitchDetails={pitchDetails} batSide={batSide} className="strikezone--inline" />
      <ReplayScene pitches={pitches} pitchDetails={pitchDetails} pitcher={pitcher} play={play} />
      <PitchList pitchDetails={pitchDetails} pick={pick} />
    </>
  )
}

// Phone: the scene in a sheet like the zone's, with one numbered chip per pitch.
export function ReplaySheet({ pitchDetails, pitches, batter, pitcher, onClose }) {
  const [play, setPlay] = useState(null)
  return (
    <ZoneSheet note="Replay" batter={batter} pitcher={pitcher?.last} onClose={onClose}>
      <ReplayScene pitches={pitches} pitchDetails={pitchDetails} pitcher={pitcher} play={play}>
        <div className="pbp__replaypicks">
          {pitches.map((p) => (
            <Button
              key={p.no}
              size="control"
              pressed={play?.no === p.no}
              onClick={() => setPlay({ no: p.no })}
              aria-label={`Play pitch ${p.no}`}
            >
              {p.no}
            </Button>
          ))}
        </div>
      </ReplayScene>
    </ZoneSheet>
  )
}
