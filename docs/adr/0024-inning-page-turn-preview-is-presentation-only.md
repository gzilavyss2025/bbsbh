# The page-turn preview renders real content; presentationOnly mutes callbacks, not spoiler-safety

Forward navigation between half-innings (`src/components/page-turn/`) plays a
curl animation: the currently active half turns away while an inert preview
of the destination half sits underneath it. That preview renders the actual
`InningPage` for the destination half — including its `SealBox` — not a fake
or blurred stand-in, so the curl always shows genuine paper rather than a
placeholder.

The temptation would be to treat this preview mount as a new place the
spoiler rule needs separate enforcement — a second gate alongside `SealBox`'s
own. It doesn't need one. `SealBox` (ADR-0002) already guarantees a sealed
half's content is never computed or placed in the DOM ahead of reveal,
regardless of who's rendering it or why; a still-sealed destination's preview
shows the same kraft cover (or, being `coverless` and driven only by
`forceRevealed`, nothing at all) that the real interactive instance would.
Nothing about the preview changes what's safe to render.

What the preview *would* otherwise get wrong is side effects: `InningPage`'s
`presentationOnly` flag exists solely to mute `onReveal`/`onStepInfo`/
`onSteppedThrough` so a preview mounting, animating, and unmounting can never
itself advance `revealedThrough`, record an at-bat step, or fire a scroll —
state that belongs only to the one interactive instance the user is actually
looking at. `onReveal` is swapped for a no-op rather than `undefined`
specifically because `HalfInning` calls it directly (not via `?.()`) from
both `SealBox`'s reveal effect and `PlayByPlay`'s `onStepComplete` — a
preview page that happens to mount already-revealed (e.g. turning forward
into a half revealed earlier while the viewer was elsewhere) would otherwise
crash on mount instead of quietly doing nothing.

`presentationOnly` must never grow into a second reveal boundary of its own —
if some future feature needs the preview to withhold content a normal
`isNextToReveal`/`revealed` render wouldn't, that's a sign the real gate
belongs in `SealBox`, `HalfInning`, or the selectors underneath them, not in
this flag.
