import { emptyStateParts } from '../../../lib/design/emptyStateClass.js'

// THE EMPTY STATE — the one block that says "nothing here" (#1132). Drawn once,
// in styles/system/empty-state.css: a dashed hairline inset with no ground of
// its own, and graphite copy. It is the box and the copy faces, never the
// space around it (the parent's) and never WHEN a thing is empty (the
// caller's test decides that).
//
//   children   the text: the one line that says what is missing.
//   label      a caps line above the text that names the empty slot.
//   note       a smaller line under the text: why, or what would fill it.
//   action     ONE control under the copy: a Button that acts here, or a Door
//              that leads on (src/CLAUDE.md, "One control, one door").
//   size       'block' (the default): the full inset. 'compact': the small
//              one, for an empty tile or chart slot.
//   className  the block's NAMESPACE ("txpage__empty"), on the root, where a
//              family rule may set a margin. Never a second frame.
//   ...rest    passed to the root: role="status" for an empty that appears
//              after the reader acts, aria-live, id.
//
// The label, the note and the action render only when given.
//
// It fetches nothing, computes nothing and gates nothing, and it has no reveal
// prop: a sealed value is never "empty" (ADR-0002). Inside the spoiler scope
// its copy says what is missing, never what happened. This file imports no
// api/ module and no stamp module (ADR-0035).
export function EmptyState({ label, note, action, size, className, children, ...rest }) {
  const parts = emptyStateParts({ size, className, label, note, action })
  return (
    <div className={parts.root} {...rest}>
      {parts.label && <span className="emptystate__label">{label}</span>}
      <p className="emptystate__text">{children}</p>
      {parts.note && <p className="emptystate__note">{note}</p>}
      {parts.action && <div className="emptystate__action">{action}</div>}
    </div>
  )
}
