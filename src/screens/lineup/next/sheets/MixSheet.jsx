import { PitchMix } from '../../../../components/playbyplay/pitcherCard/PitchMix.jsx'
import { SheetFrame } from './SheetFrame.jsx'

// The pitch scene and one tile per pitch, in the page's sheet: opened from "Watch" on the pitch
// mix card on a phone. A season total of finished games, the same footing as the Now Pitching
// card, so nothing here is reveal-only.
export function MixSheet({ tiles, lefty, name, onClose }) {
  return (
    <SheetFrame title="Pitch mix" label={`${name}, pitch mix`} onClose={onClose}>
      <div className="pcard">
        <PitchMix tiles={tiles} lefty={lefty} name={name} />
      </div>
    </SheetFrame>
  )
}
