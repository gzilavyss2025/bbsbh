import { useCallback, useEffect, useRef } from 'react'
import { PitchScene } from '../../components/playbyplay/pitcherCard/PitchScene.jsx'
import { Pill } from '../../components/ui/control/Pill.jsx'

// THE SCOUT'S PITCH SCENE (#1490, ADR-0099): the Now Pitching card's scene, in
// BOTH views, with a control bar under it. The page plays the pitcher's mix in
// typical shapes; the pitch modal plays one real flight. The bar's caption
// says which, and its right end holds the choices that change the picture
// first: the speed in the modal (the page has none).
//
// `options` [[value, label], ...], `value`, `onChange` and `label` name that
// one choice, which is optional (the page has none); the rest goes to PitchScene unchanged.
//
// The pitch in flight marks its rows and chips (`data-code`) with `data-inflight`; motion.css
// pulses their pitch mark. It sets the attribute on the DOM, not React state, so the page and
// PitchScene (memo'd on `onActive`) never re-render for it.
export function ScoutScene({ caption, label, options, value, onChange, onActive, ...scene }) {
  const root = useRef(null)
  const marked = () => root.current?.closest('.scout')?.querySelectorAll('[data-code]') ?? []
  const { pitches } = scene
  const active = useCallback(
    (idx) => {
      const code = pitches[idx]?.code
      marked().forEach((el) => el.toggleAttribute('data-inflight', el.dataset.code === code))
      onActive?.(idx)
    },
    [pitches, onActive],
  )
  useEffect(() => () => marked().forEach((el) => el.removeAttribute('data-inflight')), [])
  return (
    <div className="pcard scout__scene" ref={root}>
      <PitchScene {...scene} onActive={active} />
      <div className="scout__scenebar">
        <span className="scout__scenecap">{caption}</span>
        {options && (
          <span className="scout__seg" role="group" aria-label={label}>
            {options.map(([k, text]) => (
              <Pill key={String(k)} role="control" fill="paper" pressed={value === k} onClick={() => onChange(k)}>
                {text}
              </Pill>
            ))}
          </span>
        )}
      </div>
    </div>
  )
}
