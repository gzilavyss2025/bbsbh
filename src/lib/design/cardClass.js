// THE CARD'S CLASS LIST (#1113) — the one place a frame, a body and the
// interactive state turn into class names, shared by
// components/ui/frame/Card.jsx and its tests. Pure, so node --test can pin it,
// the way sectionHeadClass.js pins the head.
//
// FRAMES. Two, and the radius decides (#1113 Q1):
//   sheet   the md radius with the card shadow: the team hub's card, and most
//           cards in the app.
//   ledger  the sm radius with no shadow: the tight card of a ledger or grid.
// An unknown frame is a caller's typo, and it throws. "plain" and "report" are
// not frames: a plain card is a sheet (its missing shadow was below the eye on
// manila), and report cards take the sheet for now (#1113 Q6).
//
// BODIES. padded wraps the children in .card__body; flush renders them bare,
// so a table, a list or a grid owns its own rules to the card's edge.
//
// THE INTERACTIVE STATE. A card that IS the tap target (as="a" or "button")
// gets the hover tint and the focus ring. Only such a card takes an accent:
// the custom property whose colour the hover tint mixes in. A still card with
// an accent would carry a colour nothing draws, so that throws too.
export const FRAMES = ['sheet', 'ledger']
export const BODIES = ['padded', 'flush']
export const CARD_TAGS = ['section', 'div', 'article', 'li', 'aside', 'a', 'button']
const INTERACTIVE = ['a', 'button']

export function cardClassName({ frame = 'sheet', as = 'section', accent, className = '' } = {}) {
  if (!FRAMES.includes(frame)) throw new Error(`Card: unknown frame "${frame}" (${FRAMES.join(', ')})`)
  const interactive = INTERACTIVE.includes(as)
  if (accent && !interactive) throw new Error('Card: accent is for an interactive card (as="a" or "button")')
  const parts = ['card', `card--${frame}`]
  if (interactive) parts.push('card--interactive')
  if (className) parts.push(className)
  return parts.join(' ')
}

export function cardBodyClassName(body = 'padded') {
  if (!BODIES.includes(body)) throw new Error(`Card: unknown body "${body}" (${BODIES.join(', ')})`)
  return body === 'padded' ? 'card__body' : null
}

export function cardTag(as = 'section') {
  if (!CARD_TAGS.includes(as)) throw new Error(`Card: as="${as}" (${CARD_TAGS.join(', ')})`)
  return as
}

// The accent is a custom property's NAME ('--offday-accent'), never a colour:
// the colour stays wherever it is set and gated today (ADR-0050).
export function cardAccentStyle(accent) {
  if (accent == null) return undefined
  if (!/^--[\w-]+$/.test(accent)) throw new Error(`Card: accent "${accent}" must name a custom property`)
  return { '--card-accent': `var(${accent})` }
}
