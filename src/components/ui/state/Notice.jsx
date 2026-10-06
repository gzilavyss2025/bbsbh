import { noticeParts } from '../../../lib/design/noticeClass.js'

// THE NOTICE — the one block that tells the reader the state of the page or the
// game (#1132). Drawn once, in styles/system/notice.css: a thin solid edge all
// round and a pale tint (the "wash"), the same for every tone. It is the box and
// the copy faces, never the space around it (the parent's) and never WHEN a
// message shows (the caller's test decides that).
//
//   children   the text: the one sentence.
//   tone       'info' (the default), 'event', 'caution' or 'error': a role, not
//              a colour. error is for a fetch or an action that failed.
//   label      a caps word before the text ("Unsealed").
//   icon       ONE leading mark, drawn aria-hidden (the words carry the meaning).
//   action     ONE control after the text: a Button that acts here, or a Door
//              that leads on (src/CLAUDE.md, "One control, one door").
//   size       'block' (the default) or 'compact', for a line inside a card.
//   className  the block's NAMESPACE ("gamephotos__notice"), on the root, where
//              a family rule may set a margin or a motion. Never a second frame.
//   role       the error tone says role="alert" unless the caller passes one:
//              role="status" for a message that appears after the reader acts or
//              for stale data, role="note" for one on the page at load.
//   ...rest    passed to the root: aria-live, id.
//
// The label, the icon and the action render only when given.
//
// It fetches nothing, computes nothing and gates nothing, and it has no reveal
// prop: a sealed value is never a notice (ADR-0002). Inside the spoiler scope
// its copy says what is missing or what state the page is in, never what
// happened in the game. It reads no --seal token and no club colour. This file
// imports no api/ module and no stamp module (ADR-0035).
export function Notice({ tone, label, icon, action, size, className, role, children, ...rest }) {
  const parts = noticeParts({ tone, size, className, label, icon, action })
  return (
    <div className={parts.root} role={role ?? parts.role} {...rest}>
      {parts.icon && <span className="notice__icon" aria-hidden="true">{icon}</span>}
      <div className="notice__body">
        {parts.label && <span className="notice__label">{label}</span>}
        <p className="notice__text">{children}</p>
      </div>
      {parts.action && <div className="notice__action">{action}</div>}
    </div>
  )
}
