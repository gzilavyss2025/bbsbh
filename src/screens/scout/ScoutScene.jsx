import { PitchScene } from '../../components/playbyplay/pitcherCard/PitchScene.jsx'
import { Pill } from '../../components/ui/control/Pill.jsx'

// THE SCOUT'S PITCH SCENE (#1490, ADR-0099): the Now Pitching card's scene, in
// BOTH views, with a control bar under it. The page plays the pitcher's mix in
// typical shapes; the pitch modal plays one real flight. The bar's caption
// says which, and its right end holds the choices that change the picture
// first: the speed in the modal (the page has none).
//
// `options` [[value, label], ...], `value`, `onChange` and `label` name that
// one choice; the rest goes to PitchScene unchanged.
export function ScoutScene({ caption, label, options, value, onChange, ...scene }) {
  return (
    <div className="pcard scout__scene">
      <PitchScene {...scene} />
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
