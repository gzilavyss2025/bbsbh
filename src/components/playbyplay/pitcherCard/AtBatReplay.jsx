import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PitchScene } from './PitchScene.jsx'
import { Button } from '../../ui/control/Button.jsx'
import { PitchList, StrikeZone, ZoneSheet } from '../../scoring/StrikeZone.jsx'
import { HOVER_CARD_QUERY, useMediaQuery } from '../../../hooks/useMediaQuery.js'
import { motionIsReduced } from '../../../hooks/preferences/motionIsReduced.js'
import { atBatScenePitches, atBatZone } from '../../../lib/pitcherCard/atBat.js'
import { Cluster } from '../../ui/layout/Cluster.jsx'

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
// ONE PLACE AT A TIME. Wide: the top of the focus reference rail (ReplayRail
// below), with the card's zone plot and pitch list left in .pbp__zonecell —
// or, with the whole half laid out (`inCard`), under them in the card the
// reader picked, since the rail can sit a screen above it (#1539).
// Phone: a sheet opened on demand (ReplaySheet); closed, it mounts nothing, so
// a stacked half on a phone holds no scene per at-bat.

// THE RAIL. The rail is InningViewer's, a sibling of the half's pages and
// outside their seal, so the scene is never rendered BY it: a revealed card
// portals its own scene into the rail's empty slot. One card owns the slot:
// the last at-bat on screen, until a pick in another card's list moves it
// there. The owner resets with each half (ReplayRail is keyed per page), when
// a new at-bat arrives, and when the owning card unmounts (a windowed step).
// `slot` is null on the page-turn's inert preview and before the rail mounts:
// then no card draws a scene at all.
const RailContext = createContext(null)
export function ReplayRail({ slot, inCard, children }) {
  const [owner, setOwner] = useState(null)
  const value = useMemo(() => ({ slot, inCard, owner, setOwner }), [slot, inCard, owner])
  return <RailContext.Provider value={value}>{children}</RailContext.Provider>
}

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

// Wide: the card's zone cell, its pitch list's number dots the picks (hover
// picks too, only with a real mouse). The scene goes to the rail while this
// card owns it: `id` is the at-bat, `last` says it is the last one on screen.
export function ReplayCell({ pitchDetails, batSide, pitcher, pitches, id, last }) {
  const { slot, inCard, owner, setOwner } = useContext(RailContext)
  const [play, setPlay] = useState(null)
  const mouse = useMediaQuery(HOVER_CARD_QUERY)
  const dwell = useRef(0)
  useEffect(() => () => clearTimeout(dwell.current), [])
  // A new last at-bat takes the rail; a card that leaves hands it back.
  useEffect(() => {
    if (last) setOwner((o) => (o === id ? o : null))
  }, [last, id, setOwner])
  useEffect(() => () => setOwner((o) => (o === id ? null : o)), [setOwner, id])
  const inRail = owner === id || (owner == null && last)
  // Losing the rail drops the pick, so the scene plays whole when it returns.
  const [wasInRail, setWasInRail] = useState(inRail)
  if (wasInRail !== inRail) {
    setWasInRail(inRail)
    if (!inRail) setPlay(null)
  }
  const playPitch = (no) => {
    clearTimeout(dwell.current)
    setOwner(id)
    setPlay({ no })
  }
  const pick = {
    nos: new Set(pitches.map((p) => p.no)),
    picked: inRail ? play?.no : undefined,
    onPick: playPitch,
    onHover: mouse
      ? (no) => {
          clearTimeout(dwell.current)
          if (no != null) dwell.current = setTimeout(() => playPitch(no), DWELL_MS)
        }
      : undefined,
  }
  const scene = inRail && slot && <ReplayScene pitches={pitches} pitchDetails={pitchDetails} pitcher={pitcher} play={play} />
  return (
    <>
      <PitchList pitchDetails={pitchDetails} pick={pick} />
      <StrikeZone pitchDetails={pitchDetails} batSide={batSide} className="strikezone--inline" />
      {/* A pick plays where it was made; the unpicked last at-bat keeps the rail. */}
      {scene && (inCard && owner === id ? scene : createPortal(scene, slot))}
    </>
  )
}

// Phone: the scene in a sheet like the zone's, with one numbered chip per pitch.
export function ReplaySheet({ pitchDetails, pitches, batter, pitcher, onClose }) {
  const [play, setPlay] = useState(null)
  return (
    <ZoneSheet note="Replay" batter={batter} pitcher={pitcher?.last} onClose={onClose}>
      <ReplayScene pitches={pitches} pitchDetails={pitchDetails} pitcher={pitcher} play={play}>
        <Cluster gap="tight" className="pbp__replaypicks">
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
        </Cluster>
      </ReplayScene>
    </ZoneSheet>
  )
}
