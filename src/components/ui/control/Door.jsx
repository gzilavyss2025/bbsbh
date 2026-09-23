// THE DOOR — the app's one "there is more behind this" control (#1130). "See
// all ›" under a preview card, "Full roster ›" closing a pregame lineup, "Show
// 12 more" at the foot of a list. It is not a button: a button acts on the page
// you are standing on, a door leaves it, and it is drawn in --accent-link
// rather than in a control's ink to say so. Fourteen blocks drew this from
// scratch before the collapse; the dress now lives in one place
// (styles/system/door.css) so a tweak to the hit target reaches every one.
//
// TWO LAYOUTS, and the chevron belongs to the layout rather than to a prop.
// `inline` is the text link and writes its own ›, so a door and its arrow can
// never disagree; it does not align itself, because where a text door sits is
// the host's business (.thub__door right-aligns one under a preview card).
// `block` is the full-width row that closes a list, and it carries no arrow —
// an arrow on "Show 12 more" reads as a link to another page, which is the one
// thing that door is not.
//
// IT RENDERS AN ANCHOR WHEN IT IS ONE. A door that goes to a URL is an <a>:
// middle-click, cmd-click and the browser's own destination preview are all
// things a reader expects from something that looks like a link, and a <button>
// has none of them. Spread `useRouteLink()`'s props (lib/nav.js) and the client
// router still handles a plain left-click. A door with no href is a
// <button type="button">, which is what a door that opens a sheet or grows a
// list in place actually is.
export function Door({ children, layout = 'inline', href, className = '', ...rest }) {
  const cls = `door door--${layout}${className ? ` ${className}` : ''}`
  const body = layout === 'inline' ? <>{children} ›</> : children
  if (href === undefined) {
    return (
      <button type="button" className={cls} {...rest}>
        {body}
      </button>
    )
  }
  return (
    <a className={cls} href={href} {...rest}>
      {body}
    </a>
  )
}
