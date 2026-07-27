# PR 6 — Team theming and uniform-set display

Read these first, in order:

1. `.scratch/team-identity-lab/PRD.md` — sections §1.4, §1.9, §6, §7, §9 govern
   this PR. **§7 (spoiler analysis) is mandatory reading before you touch
   anything.**
2. `.scratch/team-identity-lab/implementation-log.md`.
3. `CLAUDE.md` (especially the spoiler rule), `src/CLAUDE.md`,
   `src/lib/CLAUDE.md`.

**Depends on PRs 1 and 5.** Base on current `origin/main` if they have merged;
otherwise base on the latest branch and say so.

## Why this PR exists

This is the user-facing payoff. The header-colour tables
(`TREATMENT_HEADER_COLOR_OVERRIDES`, `MILB_HEADER_COLOR_OVERRIDES`) have existed
for a while explicitly commented "design-lab preview only — no real component
reads this table yet." This PR makes them drive something real.

## Correct a common misreading first

`TeamInfo.jsx` is **not** the team detail page — it is the per-game away/home
**lineup staging page** (`GameView → TeamInfo ×2 → InningViewer`). The club hub
is `TeamPage.jsx`, and it **already has** a uniform strip (`JerseyCombos`,
`TeamPage.jsx:876`) and team-colour use (`favoriteAccentColor`,
`TeamPage.jsx:856`). See PRD §1.4.

## Scope

1. **Uniform sets → `TeamPage`**, extending the existing `JerseyCombos`. Not a
   new component on `TeamInfo`. MLB already works. Add a MiLB two-card
   Home/Away strip from `milbTreatmentTile` in a `variant="static"` mode, **with
   no W-L record** — there is no per-game MiLB jersey feed to attribute games to,
   and inventing one is out of bounds (PRD §1.9).

2. **Theming → `TeamInfo`.** Theme the `.teaminfo__head` club-name bar and that
   side's `SectionMasthead` bars with the header colours for the jersey the club
   is actually wearing that game (`jerseyTreatmentFor` → `defaultTreatmentFor` →
   the header table). The payoff is that the away and home pages become visually
   distinct in a flow where you page through both.

3. **Revise the header-colour shape.** `{ blue, gold, font }` names the *default
   navy chrome's* colours, which stops making sense once a club's bar is red.
   Rename to semantic `{ bar, accent, onBar }`.

4. **Extend `scripts/check-contrast.mjs`** to assert `onBar` against `bar` at
   WCAG AA for **every entry in the store**. This guard is what makes the
   feature shippable rather than a lab preview — without it a hand-tuned pair
   can silently ship unreadable text. Coverage of the header tables is partial,
   so the resolver falls back to the default navy chrome, and the lab must show
   coverage explicitly.

5. **Write ADR-0030** recording the theming decision and its invariant (below).

## The invariant — write it down, do not violate it

**Theming's only inputs are `(teamId, treatment)`.** Never anything derived
from game state.

Uniform, logo, and colour data is *identity*, not *state* — a colour cannot
encode a score, and `jerseyTreatmentFor` already renders unsealed on the slate
today. But the tempting future violation is obvious: "tint the page by whoever
is leading" **would** be a spoiler. Write the rule into ADR-0030 and
`src/lib/CLAUDE.md` before someone proposes it.

Full reasoning in PRD §7. Restate it in the PR body.

## Scope discipline

`TeamInfo` only. **Not** the innings viewer, **not** the box score — those carry
the seal metaphor (kraft amber on manila) and recolouring them would fight the
spoiler UI's own visual language.

Also note `buildJerseyCombos`'s per-jersey W-L is already gated by the schedule
cutoff. **Do not touch that gate.**

## Verification

- `npm run lint && npm test` must pass. The extended contrast check must pass
  for every existing header-table entry — if an entry fails AA, fix the colours
  (that is the guard doing its job), do not loosen the check.
- Start a dev server and check a real game's **away** lineup page and **home**
  lineup page side by side. They should read as distinctly that club's, and the
  text must stay readable on every themed bar.
- Check a club **without** header-colour coverage falls back to default navy
  chrome cleanly.
- Check a MiLB game's lineup page and the MiLB uniform strip on `TeamPage`.
- Confirm nothing score-revealing entered the DOM: the innings viewer and box
  score must be untouched.
- Put the clickable local URLs (with `?nointro`) in the handoff.

## Workflow

Per PRD §9: fresh worktree, branch + PR, never push to `main`.

**Before opening the PR**, append a "PR 6" section to
`.scratch/team-identity-lab/implementation-log.md` and update the status board.
