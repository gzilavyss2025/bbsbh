import { useCallback, useMemo, useRef, useState } from 'react'
import { useDialogFocus } from '../../../hooks/dialog/useDialogFocus.js'
import { useMediaQuery, WIDE_QUERY } from '../../../hooks/useMediaQuery.js'
import { pitchTiles } from '../../../lib/pitcherCard/card.js'
import { scenePitches } from '../../../lib/pitcherCard/scene.js'
import { PitchArsenalMix } from '../../charts/PitchArsenalMix.jsx'
import { Button } from '../../ui/control/Button.jsx'
import { Door } from '../../ui/control/Door.jsx'
import { PitchMix } from './PitchMix.jsx'
import { PitchScene } from './PitchScene.jsx'

// The opposing starter's pitch mix on the lineup page's Starting pitcher card:
// his season list (PitchArsenalMix) and the Now Pitching card's animated scene
// of his arcs (PitchScene), so a scorer can see how each pitch moves.
//
// Wide (WIDE_QUERY): a band under the headshot row, the list on the left and
// the scene filling the right column. The list row of the pitch in flight is
// lit (`activeCode`), so the two read as one thing. Phone: neither fits beside
// the headshot, so a "Watch his pitches" door opens a bottom sheet holding the
// Now Pitching card's own PitchMix (scene + one tile per pitch). Only one of
// the two ever mounts, so the scene's frame loop never runs hidden.
//
// SPOILER FOOTING. A season total of finished games, the same footing as the
// Now Pitching card — nothing here is reveal-only. The arcs are the league's
// average movement per pitch type at HIS speeds, not his own (PitchMix's note).
//
// No arc to draw (no pitch type the model knows, or none with a speed) keeps
// the list alone on wide and shows no door on a phone.
export function StarterMix({ arsenal, tto, sides, lefty, name }) {
  const wide = useMediaQuery(WIDE_QUERY)
  const [open, setOpen] = useState(false)
  const [activeCode, setActiveCode] = useState(null)
  const tiles = useMemo(() => pitchTiles(arsenal), [arsenal])
  const pitches = useMemo(() => scenePitches(tiles, lefty), [tiles, lefty])
  const onActive = useCallback((i) => setActiveCode(pitches[i]?.code ?? null), [pitches])
  const close = () => setOpen(false)
  const hasScene = pitches.length > 0

  if (!wide) {
    if (!hasScene) return null
    return (
      <>
        <Door layout="block" className="starter__watch" aria-haspopup="dialog" onClick={() => setOpen(true)}>
          Watch his pitches
        </Door>
        {open && <MixSheet tiles={tiles} lefty={lefty} name={name} onClose={close} />}
      </>
    )
  }
  return (
    <div className="starter__mix">
      <PitchArsenalMix arsenal={arsenal} tto={tto} sides={sides} activeCode={activeCode} />
      {hasScene && (
        <div className="pcard starter__scene">
          <PitchScene pitches={pitches} lefty={lefty} name={name} onActive={onActive} />
        </div>
      )}
    </div>
  )
}

// The phone sheet: the app's bottom sheet (.scrim/.sheet), the Now Pitching
// card's scene and tiles, and a Close button. A tap on the dimmed backdrop,
// or Escape, closes it too; focus goes back to the door.
function MixSheet({ tiles, lefty, name, onClose }) {
  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet starter__sheet" role="dialog" aria-modal="true" aria-label={`${name}, pitch mix`}>
        <div className="pcard">
          <PitchMix tiles={tiles} lefty={lefty} name={name} />
        </div>
        <Button ref={closeRef} skin="ink" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  )
}
