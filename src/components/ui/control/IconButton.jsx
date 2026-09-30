import { iconButtonClassName } from '../../../lib/design/buttonClass.js'

// THE ICON-ONLY BUTTON (#1209) — a close ✕, a clear ✕, an (i): the Button
// family's glyph-with-no-label member, drawn once in styles/system/button.css
// (.btn--icon). It wears the Button's skins and states, so a pressed, focused
// or disabled icon reads like every other control.
//
//   label  the accessible name, and required: with no visible text, an icon
//          button that has none is a control a screen reader cannot announce.
//          It throws instead of shipping a nameless button.
//   mark   the size of the round mark you SEE: 'tap' (44, the default), 'md'
//          (32) or 'sm' (18). The TAP AREA is 44x44 for every one of them: the
//          mark stays small, the invisible hit area does not.
//   skin   as Button. The default is 'ghost', a bare glyph.
//
// The glyph is decoration (aria-hidden); the label is the name. A ref, an
// onPointerDown and any other prop pass straight through to the <button>.
export function IconButton({
  label,
  mark = 'tap',
  skin = 'ghost',
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  if (!label) throw new Error('IconButton: a label is required (it is the only name)')
  return (
    <button
      type={type}
      className={iconButtonClassName({ mark, skin, className })}
      aria-label={label}
      {...rest}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  )
}
