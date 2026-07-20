# Token layering discipline — and why we stop at two tiers, not three

The design system in `src/tokens/*` follows a layered-token model in the spirit
of Carbon: a **primitive** tier of raw, app-agnostic values and a **semantic
alias** tier that gives those values a role. `colors.css` is the clearest case —
`--paper-0 … --ink-2 … --seal` are primitives, and `--bg-canvas: var(--paper-0)`,
`--text-body: var(--ink-1)`, `--seal-cover: var(--seal)` are the semantic aliases
components actually consume. Components reference the alias, never the raw hex, so
a palette change happens in one place. This ADR records two decisions that keep
that discipline honest.

## The primitive tier must stay app-agnostic (the spacing/layout split)

`spacing.css` had drifted: alongside the generic 4px step scale (`--space-*`),
the radii, and the border widths — all reusable primitives — it also held
one-off component dimensions: the linescore `--cell-size`, the six `--shot-*`
headshot rungs, and the `--app-width` phone-column frame. Those aren't scale
steps; they're the measurements of specific components. Mixing them into the
primitive file made the "scale" look like it had ~40 members when it has ~11, and
invited new one-off sizes to land there too.

So they now live in `src/tokens/layout.css` (imported right after `spacing.css`).
The rule: `spacing.css` is the reusable primitive scale; `layout.css` is
app-specific component geometry and *may* reference the primitives, never the
reverse. This is the same primitive-vs-application separation the color file
already models, applied to dimensions.

## Two enforced invariants replace two informal comments

Two conventions were real but only asserted in prose next to a token:

- **Focus rings** come from one of two shared tokens — `var(--focus-ring)` for an
  outline ring, `var(--ring)` for the inset box-shadow ring — yet one rule had
  drifted to a hand-rolled `outline: 2px solid var(--accent-primary)`.
  `scripts/check-focus-ring.mjs` now flags any `:focus-visible` rule that paints a
  ring from anything else. A rule may still indicate focus *without* a ring (reusing
  its own `:hover` border/background change carries no `outline`/`box-shadow` and is
  left alone); a deliberate bespoke ring opts out with a `focus-ring-exempt` comment
  (the dense team-score dot rail is the one current case).
- **Contrast** of the known text-on-background pairings (seal ink on both kraft
  stripes, white on both IL clay stripes, the core semantic text roles on their
  surfaces) was documented as "holds WCAG AA" in a comment. `scripts/check-contrast.mjs`
  resolves the tokens to hex and computes the ratios, so a later nudge to a paper or
  ink value can't silently drop a pairing below 4.5:1 (text) / 3:1 (UI).

Both run in `npm run lint`. They matter more than any amount of new token
structure would: they guard the *behavior* the tokens exist to guarantee.

## Recommendation: do NOT add a blanket component tier

Carbon's third tier maps semantic tokens down to per-component knobs
(`--button-primary-bg`, `--card-border-focus`, …). Evaluated for this app, it is
not worth introducing, and this is a recommendation rather than a deferral:

- **The app is single-theme, single-brand, solo-maintained.** The payoffs of a
  component tier — swapping one component's values independently of others, or
  white-labeling — don't apply here. What remains is pure cost: every color would
  sit three `var()` hops from its hex, and there'd be a third set of names to keep
  in sync.
- **The semantic tier isn't overstretched.** Card focus is already handled by a
  `border-color` change reusing `--text-heading`; a dedicated `--card-border-focus`
  token would just alias `--text-heading` with an extra hop and zero present
  benefit. That's the tell that the two-tier system is still sufficient.
- **The few component-scoped tokens we *do* have earned their place bottom-up,
  not from a top-down tier.** `--ring`/`--focus-ring` (reused by ~40 rules),
  `--seal-cover`/`--seal-cover-ink` (a load-bearing spoiler-mechanism name), and
  `--winprob-*` (a chart's named parts) each exist because of high reuse or high
  semantic significance — the exact conditions under which a named component token
  pays for itself.

**The standing rule going forward:** stay two-tier by default. Promote a value to
a named component-scoped token only when it is reused across many rules *or* is an
invariant worth guarding — and when you do, add the guard (as the focus ring now
has). Reach for the third tier the day this app grows a second theme, not before.
