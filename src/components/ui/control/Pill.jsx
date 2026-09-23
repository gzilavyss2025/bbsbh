import { pillClassName, pillInkStyle } from '../../../lib/design/pillClass.js'
import { buttonAria } from '../../../lib/design/buttonClass.js'

// THE PILL — the app's one capsule (#1131). Rookie, Top 100, a milestone chase,
// a rank, the due-up marker, a filter you flip: one shape, drawn once in
// styles/system/pill.css. It sits beside the other two controls on purpose:
// a BUTTON (./Button.jsx) is a ruled box that acts on the page, a DOOR
// (./Door.jsx) is a link that leaves it, and a pill is a capsule. The capsule
// is how a reader tells a pill from a button; the height is how a thumb tells
// a tag from a control.
//
//   role   'tag' (the default) — a label you read. A <span>, never focusable,
//          about 20px tall.
//          'control' — a pill you press. A <button> at --control-min (34px),
//          with the button's own state contract: pressed, focus ring,
//          disabled. A tag and a control never share a height.
//   fill   'outline' (the default: the ground shows through, the ink draws
//          the edge), 'paper' (a paper chip — the one that rides a coloured
//          band), 'ink' (navy, paper text) or 'seal' (kraft — ONLY a sealed
//          thing, ADR-0083).
//   ink    a colour token by NAME, '--field', for an outline or paper pill.
//          This is where a pill's meaning goes: the copy says what it is, the
//          ink says which kind. There is no tone prop. See lib/design/pillClass.js
//          for the three token families it refuses, and why.
//   pressed  control only: makes it a TOGGLE (aria-pressed), which draws the
//          selected state. Leave it undefined for an ordinary action.
//   href   control only: renders an anchor, for a pill that is an address.
//
// WHEN A CONTROL IS A PILL AND NOT A BUTTON (signed off for #1131). A pill
// control does one of two jobs: it FILTERS the list under it ("MLB only", the
// slate's filter chips), or it is the one action a coloured BAND carries
// ("Postseason odds"). Anything else that acts on the page is a Button. Both
// are 34px; the capsule is what tells them apart.
//
// A tag takes no onClick. A tappable tag is a control wearing the wrong height,
// which is the exact confusion #1131 exists to remove, so it throws instead.
export function Pill({
  role = 'tag',
  fill = 'outline',
  ink,
  pressed,
  href,
  type = 'button',
  className = '',
  style,
  children,
  ...rest
}) {
  const cls = pillClassName({ fill, role, className })
  const inkStyle = pillInkStyle({ fill, ink })
  const merged = inkStyle || style ? { ...inkStyle, ...style } : undefined

  if (role === 'tag') {
    if (rest.onClick || href !== undefined || pressed !== undefined) {
      throw new Error('Pill: a tag is read, not pressed — use role="control"')
    }
    return (
      <span className={cls} style={merged} {...rest}>
        {children}
      </span>
    )
  }

  const aria = buttonAria({ pressed })
  if (href !== undefined) {
    return (
      <a className={cls} href={href} style={merged} {...aria} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <button type={type} className={cls} style={merged} {...aria} {...rest}>
      {children}
    </button>
  )
}
