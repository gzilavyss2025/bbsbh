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
`--rule-soft` or `--rule-grid`: use the alias (ADR-0107). Small
text is split BY JOB: `--fs-label` 12px display labels, `--fs-cell` 11px mono figures,
`--fs-small` 13px running copy; `--fs-caption` is short body-face text only, and
`scripts/check-caption-budget.mjs` only ever lets its count shrink.
A small attribute line under a name (position, hand, club, school) is the `.t-label` recipe, as in `.phcard__meta`: display face, semibold, `--fs-compact`, `--ls-label`, `--text-caption`.

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
