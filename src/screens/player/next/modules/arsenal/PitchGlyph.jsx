// A pitch's mark as the pitchMark(code) table draws it (docs/pitch-types.md): the family is the shape, the
// pitch is the colour, a ring is hollow. Colour and shape come from the mark passed in; this file picks neither.
const SHAPES = {
  circle: (r) => `M${r} 0A${r} ${r} 0 1 0 ${-r} 0A${r} ${r} 0 1 0 ${r} 0Z`,
  diamond: (r) => `M0 ${-1.3 * r}L${1.3 * r} 0L0 ${1.3 * r}L${-1.3 * r} 0Z`,
  square: (r) => `M${-0.9 * r} ${-0.9 * r}H${0.9 * r}V${0.9 * r}H${-0.9 * r}Z`,
  triangle: (r) => `M0 ${-1.2 * r}L${1.1 * r} ${0.9 * r}H${-1.1 * r}Z`,
  hexagon: (r) => `M${r} 0L${r / 2} ${0.87 * r}H${-r / 2}L${-r} 0L${-r / 2} ${-0.87 * r}H${r / 2}Z`,
}

export const glyphD = (shape, r) => (SHAPES[shape] ?? SHAPES.hexagon)(r)

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
