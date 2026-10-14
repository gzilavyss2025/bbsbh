import { glyphD } from '../../../screens/player/next/modules/arsenal/PitchGlyph.jsx'

// One pitch's mark as the pitchMark(code) table draws it (docs/pitch-types.md):
// the family is the shape, the pitch is the colour, a ring is hollow. This file
// picks neither; it only draws what the mark says. It shares the player page
// arsenal's shape paths (glyphD) but not its stylesheet, which loads with that
// page only, so the few rules it needs are `.pcard__mark` in
// styles/pitcher-card/table.css.
export function PitchMark({ mark, size = 16 }) {
  return (
    <svg className="pcard__mark" width={size} height={size} viewBox="-11 -11 22 22" aria-hidden="true">
      <path className={mark.ring ? 'pcard__mark--ring' : undefined} d={glyphD(mark.shape, 7)} style={{ '--pitch': mark.color }} />
    </svg>
  )
}
