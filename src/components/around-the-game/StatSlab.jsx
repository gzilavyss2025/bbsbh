// The big-number tiles under a report's masthead — the four figures a
// broadcast puts on screen before anyone says a word.
//
// A slab is deliberately a poor place to put a small difference: the figure is
// set at display size in mono, so a reader takes it in before the label. That
// makes it right for a league total, a leader, an extreme — and wrong for a
// rate that only means something next to its neighbours, which is what the
// ranked tables further down each page are for.
//
// `value` is already formatted by the caller (a clock reading, a comma-grouped
// gate, a percentage), because the formatting rules differ per page and a
// component that tried to own all of them would end up with a `kind` prop and
// six branches.
export function Slab({ value, label, note, tone }) {
  return (
    <div className={`slab${tone ? ` slab--${tone}` : ''}`}>
      <p className="slab__value">{value}</p>
      <p className="slab__label">{label}</p>
      {note ? <p className="slab__note">{note}</p> : null}
    </div>
  )
}

// The row they sit in. Two across on a phone, four on anything wider — set in
// CSS, not here, so the count of children is the caller's business.
export function SlabRow({ children }) {
  return <div className="slabrow">{children}</div>
}
