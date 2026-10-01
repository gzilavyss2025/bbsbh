import { useCallback, useMemo, useState } from 'react'
import { tileColumns } from '../../../lib/pitcherCard/card.js'
import { scenePitches } from '../../../lib/pitcherCard/scene.js'
import { PitchScene } from './PitchScene.jsx'

const NOTE =
  'Arcs are drawn from behind the plate. Each shape uses the 2026 MLB average movement for that pitch type ' +
  '(Baseball Savant), mirrored for a left-hander, at his speeds. End spots are typical locations, not his.'

// The pitch scene, the "Pitch mix" label with its (i) note, and one tile per
// pitch in order of use. The scene plays the pitches by itself; the tile of
// the pitch in flight gets the active border. `activeCode` is React state, but
// it changes once per pitch (about every 1.5 s), never per frame — the scene
// draws its frames through refs (PitchScene.jsx).
export function PitchMix({ tiles, lefty, name }) {
  const pitches = useMemo(() => scenePitches(tiles, lefty), [tiles, lefty])
  const [activeCode, setActiveCode] = useState(pitches[0]?.code ?? null)
  const [noteOpen, setNoteOpen] = useState(false)
  const onActive = useCallback((idx) => setActiveCode(pitches[idx]?.code ?? null), [pitches])

  return (
    <div className="pcard__sec pcard__sec--mix">
      {pitches.length > 0 && <PitchScene pitches={pitches} lefty={lefty} name={name} onActive={onActive} />}
      <span className="pcard__lbl pcard__mixlabel">
        Pitch mix
        <span className="pcard__info">
          <button
            type="button"
            className="pcard__infobtn"
            aria-label="About these arcs"
            aria-expanded={noteOpen}
            onClick={() => setNoteOpen((v) => !v)}
          >
            <span aria-hidden="true">i</span>
          </button>
          <span className={`pcard__tip${noteOpen ? ' is-open' : ''}`} role="note">
            {NOTE}
          </span>
        </span>
      </span>
      <div className="pcard__tiles" style={{ '--pcard-tile-cols': tileColumns(tiles.length) }}>
        {tiles.map((t) => (
          <div key={t.code ?? 'other'} className={`pcard__tile${t.code && t.code === activeCode ? ' is-active' : ''}`}>
            <span className={`pcard__swatch fill--${t.family}`} />
            <span className="pcard__tname">{t.name}</span>
            <span className="pcard__pct">{t.pct}%</span>
            <span className="pcard__mph">
              {t.mph}
              {!t.other && <span className="pcard__unit"> mph</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
