// A pitch's mark as the pitchMark(code) table draws it (docs/pitch-types.md): the family is the shape, the
// pitch is the colour, a ring is hollow. Colour and shape come from the mark passed in; this file picks neither.
import { glyphD } from '../../../../../lib/pitch/pitchGlyph.js'

export { glyphD }

// The mark as a path, for use inside an <svg> at the origin. The colour rides a custom property because a
// CSS rule outranks a fill attribute.
export function GlyphPath({ mark, r = 7 }) {
  return (
    <path
      className={`arsenal__glyph${mark.ring ? ' arsenal__glyph--ring' : ''}`}
      d={glyphD(mark.shape, r)}
      style={{ '--pitch': mark.color }}
    />
  )
}

// The mark on its own, as an icon.
export function PitchGlyph({ mark, size = 22 }) {
  return (
    <svg className="arsenal__icon" width={size} height={size} viewBox="-11 -11 22 22" aria-hidden="true">
      <GlyphPath mark={mark} />
    </svg>
  )
}
