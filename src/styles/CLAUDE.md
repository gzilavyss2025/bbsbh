# src/styles — the core sheet, partial order, exemption markers

Rules for the CSS files. The design-system rules a component author needs (one control
one door, block naming, semantic variables, `--seal` scope, mono marks) stay in
`src/CLAUDE.md`.

## The core sheet, the order, and the guards

`src/index.css` holds **no rules** — a banner comment and `@import`s: the six
`src/tokens/*.css` files, then the `src/styles/NN-name.css` partials in cascade order.
It is the **core** sheet, not every partial: `main.jsx` imports it, so every line
render-blocks every route, and a partial only one lazy screen uses is imported by that
screen instead (a per-route chunk). Files stay in `src/styles/`, guards unchanged;
index.css says which left, who owns each, and why.

**Order is the contract.** The numeric prefix IS the cascade — later partials
override earlier ones at equal specificity. Never reorder the `@import` list to
tidy it; add a new partial where its rules belong, not at the end. To find a rule,
grep `src/styles/` — the names say which surface each covers, and `motion/` is the
animation layer (motion only, before `focus/`; **`docs/motion.md`**).

`check-typography.mjs`, `check-focus-ring.mjs` and `check-strike-links.mjs` walk the
whole directory TREE (subdirectories included), so a new partial is covered the moment
it exists — and each fails loudly if pointed at rules-free files, which caught the
first split rather than silently disabling them.

## Type, focus rings, and contrast

Type size, weight, leading, and tracking must use the semantic roles in
`tokens/typography.css`; `scripts/check-typography.mjs` rejects ad hoc values. A partial never reads `--paper-N`, `--rule`,
`--rule-soft`, `--rule-grid`, `--field` or `--field-deep`: use the alias (ADR-0107, ADR-0121). Small
text is split BY JOB: `--fs-label` 12px display labels, `--fs-cell` 11px mono figures,
`--fs-small` 13px running copy; `--fs-caption` is short body-face text only, and
`scripts/check-caption-budget.mjs` only ever lets its count shrink.
A small attribute line under a name (position, hand, club, school) is the `.t-label` recipe, as in `.phcard__meta`: display face, semibold, `--fs-compact`, `--ls-label`, `--text-caption`. Use one such line under a name, never a second.
**Cut taglines, helper text, and secondary labels. If a screen needs them to make sense, fix the layout.** Explanation the reader must opt into goes in `InfoPopover` (`ui/InfoPopover.jsx`), never shown by default, and it must open by tap (the app is iPhone-first). Keep: column and stat headers, accessibility text, the cue on a sealed cell or consent step, and a short "not posted yet" for missing data. A size, colour, or space no token gives you is a design call: stop and ask Gary (an unattended session writes a `[DECISION: ...]` line).
A label that draws bold wears `t-label t-label--bold`; one that states no case wears `t-label t-label--nocaps`. Do not copy the recipe into a partial.

**Taste: tokens fix values, not layout.** For a new screen, propose a composition (hierarchy,
pacing, one moment of motion), not only a restyle, and recommend one direction. Benchmarks Gary
likes, so copy the craft and not the content: the World Series `Hero` ("Overview",
`components/worldseries/Hero.jsx`: the date between player layers, win pips, short arrival
motion), and the pitch-arsenal cards on the player page (`screens/player/next/modules/arsenal/`:
`ArsenalCard`, `FlightCard`, `FlightScene`, `PitchGlyph`). Before you call UI done, run the
`apple-design` and `design:design-critique` skills; use `emil-design-eng` for motion and polish.

Focus rings use `var(--focus-ring)`/`var(--ring)`, on a band `--focus-ring-band` +
`--ring-band` (`check-focus-ring.mjs`). Text-on-background pairings hold WCAG AA
(`check-contrast.mjs`) — ADR-0023.

## The innings bar tap target

Either choice's **tap target is the dead space around it**: `.pagenav` is click-through,
so a missed thumb landed on the card under the fade. `.pagenav--innings .btn::after`
(`styles/24-floating-nav-and-hud.css`) claims the bar around each button — split between
the pair, Refresh excepted — offsets from the button, not the bar (else the area
re-collapses mid-tap under `.btn:active`). `e2e/reveal-hit-area.spec.js` pins it.

## Exemption markers

A guard that allows a deliberate exception takes one greppable marker. A marker names its
reason. The guards are catalogued in `docs/scripts/tooling.md`.

- **`caps-exempt`** (`check-caps.mjs`). Two assertions, because the marker alone was never
  enough: a caps-defeating declaration needs a `caps-exempt` marker, AND the rule carrying it
  must out-rank the blanket uppercase it sits under. A marked rule that loses the cascade is
  a silent no-op — the marker reads as "deliberate" while the text shouts anyway, which is
  how five paragraphs shipped shouted (issue #769). Practically: prefix an exemption with
  `#root`. See the block comment in `src/styles/01-base.css`.
- **`caps-js-exempt`** (`check-name-casing.mjs`). A component that calls
  `.toUpperCase()`/`.toLowerCase()` on rendered text needs a `caps-js-exempt` marker comment
  on the same line (ADR-0017).
- **`focus-ring-exempt`** (`check-focus-ring.mjs`). A ring-less focus style (reusing a
  `:hover` border/background change) is fine, and a deliberate one-off opts out with a
  `focus-ring-exempt` comment.
- **`raw-value-exempt: <reason>`** (`check-raw-values.mjs`). A one-off takes
  `raw-value-exempt: <reason>`.
- **`component-reuse-exempt: <reason>`** (`check-component-reuse.mjs`). A rule outside
  `system/` that draws a capsule, sheet, ledger or band by hand counts against a ratchet
  (ADR-0084); a real one-off takes the marker, with a reason, inside the rule.
- **`strike-link-exempt`** (`check-strike-links.mjs`). A rule whose struck text can hold no
  name link opts out with a `strike-link-exempt` comment in the rule.
- **`layout-exempt: <reason>`** (`layout/check-layout-ratchet.mjs`). New layout uses `Stack`,
  `Cluster` or `Grid`. A hand-written column, wrap or grid rule takes this marker on the line
  before it, or the ratchet fails (ADR-0108).
- **`card-fill-exempt: <reason>`** (`layout/check-card-fill.mjs`). A rule that sizes a child or a card to
  `100%` of its parent's height ignores a named card's tab margin and runs it into the next card. Fill a cell with a
  flex column and `flex: 1`; a real exception takes the marker on the line before the rule.
- **`z-index-exempt: <reason>`** and **`breakpoint-exempt: <reason>`**: see "Layers and screen
  widths" below.

## Layers and screen widths

A `z-index` above 3 reads a layer token (`--z-raised`, `--z-sticky`, `--z-overlay`, `--z-modal`, `--z-toast`) or a
`calc()` offset from one; `scripts/layout/check-z-index.mjs` rejects a raw number (`z-index-exempt: <reason>` for a
one-off). An `@media` width must be on the guard's `WIDTHS` list (mirrored in `tokens/layout.css`); 740px is the
one wide step, and `scripts/layout/check-media-widths.mjs` stops new widths (`breakpoint-exempt: <reason>`)
(ADR-0108).

## The Claude Design project

The "Tally Baseball" project in claude.ai/design is the design system a designer picks for a new
design. It is built from `src/tokens/` and `src/styles/system/`, never edited by hand. Rebuild and
upload steps: `docs/design-sync.md`. A token change reaches the project only after a rebuild.

The project and the app agree (#2165, 2026-10-15). Body copy is JetBrains Mono 500 in both
(`--font-body` is the mono stack). A band head is square and carries the ripple rings and sheen by
default (`system/section-head.css`; a host that sets its own `position` still wins, because the
band's `position` and `isolation` sit in `:where()`). `stattile--compact` is in `system/stamped/`.
One weight rule follows from mono body: every weight of body copy draws 500. Source Sans 3 is no
longer a role; `src/lib/preview/posterPaper.js` still draws it on the poster canvas, so its font
files stay. The build copies these files verbatim; `docs/design-sync.md` lists what still differs.
