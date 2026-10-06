# src/components/ui — context-free primitives

No baseball knowledge: no `api/` import, no feed access, no team or game concept. Safe
to reach for from anywhere. At the top level: `Loader`, `SectionMasthead`, `CopyBox`,
`ModalPortal`, `InfoPopover`, `MasonryColumns`, `FlipCard`, `BreakableLocation`,
`AsyncGate`, `BuildStamp`. The subfolders:

- **`dock/`** — `SheetDock`, the phone's bottom sheet (rail / half / full) that the wire
  and the postseason bracket both sit in, and its pure `dockPhysics.js`.
- **`control/`** — `Button`, `Door` and `Pill` (#1130, #1131): a button acts here, a door
  leaves, a pill is a capsule.
- **`frame/`** — `SectionHead`, the one head a section or card wears (#1113;
  `SectionMasthead` is its thin band wrapper), and `Card`, the one box a section sits on:
  `frame` sheet or ledger, `head` a SectionHead, `body` padded or flush, `className` the
  block's namespace. It owns no margin.
- **`table/`** — `Table`, the one grid of figures with column names (#1132): `frame` sheet
  or bare, `density` row, tight or keep (keep pads no cell: the namespace sets its own),
  `sticky` first column, `label` makes the scroll region a Tab stop, `className` the
  block's namespace on the `<table>`. It owns no margin, takes `children`, and fetches and
  gates nothing, so a reveal gate stays where the caller put it.
- **`state/`** — `EmptyState` (#1132), the one "nothing here" block: a dashed inset, no
  ground, graphite copy; `label`, `note` and one `action` only when given; `size` block or
  compact; `className` the namespace. It owns no margin, and the caller's test decides
  when it shows: it has no reveal prop. `Notice` (#1132) is the one message about the page
  or the game: `tone` info, event, caution or error (a role, never a colour; error says
  `role="alert"` unless the caller passes one), `label`, `icon` and one `action` only when
  given, `size` block or compact, `className` the namespace. It reads no seal token (ADR-0083) and no
  club colour, owns no margin, and has no reveal prop. A loading line or a footnote is still
  a `.hint`.
- **`layout/`** — `Stack` (#1180), a column with one of four gap steps between its
  children, plus `gap="section"` for a page's top-level sections (`--space-section`). It
  owns the space BETWEEN children and nothing else. `Cluster` (#1180) is its row: a
  wrapping line with a `gap`, an optional `rowGap` and an optional `align`. `Grid` (#1180)
  is the third: as many columns of at least `min` as fit, no breakpoint, filling by default
  or collapsing with `fit`. It is NOT the grid for a layout you author (label and value,
  named areas, a fixed count) — those keep their own namespace rule.
