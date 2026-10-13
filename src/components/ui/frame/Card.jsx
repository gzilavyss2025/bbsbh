import { useId } from 'react'
import { cardAccentStyle, cardBodyClassName, cardClassName, cardHead, isInteractive } from '../../../lib/design/cardClass.js'

// THE CARD — the one box of paper a section sits on (#1113). Drawn once, in
// styles/system/card.css. It is the box, never what is in it: the space
// around it belongs to the parent, and the layout inside it to the block's
// own namespace.
//
//   frame   'sheet' (the default): the md radius with the card shadow.
//           'ledger': the sm radius with no shadow (#1113 Q1).
//           'stamped': square, a 2px ink edge and a hard ink offset shadow,
//           the player page's card (#1882). Only it takes the four below.
//   label   stamped only: the name on the ink tab across the top-left edge.
//           It is the card's heading, and names the card for a screen reader.
//   labelAs the tab's heading element: 'h2' (the default), 'h3' or 'h4'.
//   count   stamped only: the tag across the top-right edge ("6 firsts").
//   tone    stamped only: 'plain' (the default), 'tint' or 'ink'.
//   stampIn stamped only: the card drops into its shadow as it appears
//           (motion/stamp-in.css). The caller decides when that is right.
//   head    a SectionHead, or nothing. It renders first, so the card clips
//           its band to the card's corners. A link or button card takes none.
//           Its padded body is a <span>, since a link or a button holds
//           phrasing content only.
//   body    'padded' (the default) wraps the children in .card__body.
//           'flush' renders them bare: the table, list or grid runs to the
//           card's edge and owns its own rules.
//   as      the element: 'section' (the default), 'div', 'article', 'li',
//           'aside', or 'a' / 'button' for a card that is the tap target.
//   className  the block's NAMESPACE ("chal", "depthchart"), for its inner
//           parts and its own margin. Never a second frame.
//   accent  interactive cards only: the NAME of the custom property the
//           hover tint mixes in ('--offday-accent').
//   ...rest  passed to the element: href, onClick, aria-*, style.
//
// A card that computes or fetches nothing may render anywhere, inside a
// SealBox reveal too. So this file imports no api/ module and no stamp module
// (ADR-0035), and no club theme: a club colours the head that names it, never
// the card (ADR-0030).
export function Card({
  frame = 'sheet',
  head,
  body = 'padded',
  as: Tag = 'section',
  className = '',
  accent,
  label,
  labelAs: Label = 'h2',
  count,
  tone,
  stampIn = false,
  style,
  children,
  ...rest
}) {
  const labelId = useId()
  const named = label != null && label !== false
  const cls = cardClassName({ frame, as: Tag, accent, tone, named, stampIn, className })
  cardHead(Tag, head)
  if (named && head != null && head !== false) throw new Error('Card: a name tab and a head are two titles; pass one')
  if (count != null && frame !== 'stamped') throw new Error('Card: a count tag is for frame="stamped"')
  const bodyClass = cardBodyClassName(body)
  const accentStyle = cardAccentStyle(accent)
  const BodyTag = isInteractive(Tag) ? 'span' : 'div'
  return (
    <Tag
      className={cls}
      style={accentStyle ? { ...accentStyle, ...style } : style}
      {...(named ? { 'aria-labelledby': labelId } : null)}
      {...rest}
      {...(Tag === 'button' ? { type: rest.type ?? 'button' } : null)}
    >
      {named && <Label id={labelId} className="card__name">{label}</Label>}
      {count != null && <span className="card__count">{count}</span>}
      {head}
      {bodyClass ? <BodyTag className={bodyClass}>{children}</BodyTag> : children}
    </Tag>
  )
}
