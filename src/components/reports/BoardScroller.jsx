// The horizontally-scrolling frame every report board sits in.
//
// It is `.ledger-wrap` — the app's existing wide-ledger scroller — plus the
// three attributes that make that scroll REACHABLE, which the bare wrapper
// does not carry:
//
//   tabIndex={0}   so a keyboard can focus the region and scroll it with the
//                  arrow keys. Without it the right-hand columns are simply
//                  unreachable without a mouse: none of them contains a
//                  focusable element, so Tab walks straight past the whole
//                  board. On The Clock that is the median, both three-hour
//                  columns and the month strip — four of six columns, on a
//                  board 699px wide inside a 358px viewport.
//   role="region"  so the focus stop announces as something rather than as a
//                  bare group, and
//   aria-label     so it announces as WHICH something. A page with four of
//                  these needs them told apart.
//
// WCAG 2.1.1 (keyboard) is the rule this satisfies; the pattern — a focusable
// labelled region around a scrollable box — is the standard remedy, and
// browsers already give a focused div arrow-key scrolling for free, so no key
// handling is needed here. `.rpt-region` exists only to carry the focus ring:
// `.ledger-wrap` was never focusable before this component, so it had none.
//
// It is scoped to these four pages on purpose. Every other ledger in the app
// uses a bare `.ledger-wrap` and has the same gap; closing it everywhere is a
// pass over every board in the app and belongs in its own change, not smuggled
// in under a report page. This component is what that pass would adopt.
export function BoardScroller({ label, children }) {
  return (
    <div className="ledger-wrap rpt-region" tabIndex={0} role="region" aria-label={label}>
      {children}
    </div>
  )
}
