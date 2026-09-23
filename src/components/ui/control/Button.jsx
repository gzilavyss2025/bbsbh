import { buttonAria, buttonClassName } from '../../../lib/design/buttonClass.js'

// THE BUTTON — the app's one control (#1130). Scope toggles, filters, the zoom
// steps, Refresh, the footer's actions, the Game Log's strip: one ruled box,
// drawn once in styles/system/button.css. A button acts on the page you are
// standing on; a DOOR (./Door.jsx) leaves it. Reach for Door when the tap goes
// somewhere, and for this when the tap does something here.
//
//   size   'tap' (44px, the bar and the page — the default) or 'control'
//          (34px, a switch inside a card).
//   skin   'outline' (the default), 'ink' (the one primary action in a view),
//          'ghost', 'danger' (only an action that destroys something) or
//          'seal' (only the Game Log's mint strip, ADR-0083).
//   pressed  makes it a TOGGLE: writes aria-pressed, which is what draws the
//          selected state. Leave it undefined for an ordinary action.
//   busy   writes aria-busy and swallows the click while it is true, so a
//          second tap cannot start a second fetch. The skin stays: busy is
//          working, not unavailable.
//   icon   a glyph for the icon slot (↻, ↗), drawn before the label and hidden
//          from assistive tech — the label is the name.
//   href   makes it an anchor, the way Door does, for the rare control whose
//          action really is an address (a PDF). type is then not written.
//
// It defaults type="button", because a bare <button> inside a form submits it.
export function Button({
  size = 'tap',
  skin = 'outline',
  pressed,
  busy = false,
  icon,
  href,
  type = 'button',
  className = '',
  onClick,
  children,
  ...rest
}) {
  const cls = buttonClassName({ size, skin, className })
  const aria = buttonAria({ pressed, busy })
  const handle = busy ? (e) => e.preventDefault() : onClick
  const body = (
    <>
      {icon != null && (
        <span className="btn__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </>
  )
  if (href !== undefined) {
    return (
      <a className={cls} href={href} onClick={handle} {...aria} {...rest}>
        {body}
      </a>
    )
  }
  return (
    <button type={type} className={cls} onClick={handle} {...aria} {...rest}>
      {body}
    </button>
  )
}
