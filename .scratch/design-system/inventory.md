# Card and pill inventory

The input to issue #1113. One row per card block and pill block, with the partial
that owns it, the modules that consume it, and a proposed verdict.

Written for issue #1112, step 1 of three. Read this cold: it does not assume you
have the page open. `/design-lab` renders every block below, in the same order,
so you can check a verdict by looking instead of by reading.

Measured on `main` at `8b4e1f63c`. Regenerate with
`.scratch/design-system/inventory.mjs`.

**Corrected in #1127**, after the lab was fixed and the census was re-run: the
card count is **31, not 32** (`.pin-card` was prose in a comment, never a rule),
and every "selector hits" figure here was inflated by comment text. The two
verdicts that had been signed off against unstyled specimens — `.seedcard` and
`.pswscard` — were re-checked against the real boxes and both stand. Each
correction is marked below.

---

## The counts are higher than #1112 says

| | #1112 | Measured |
| --- | --- | --- |
| Card blocks | 31 | **31** (#1127; **32** as first measured) |
| Pill blocks | 9 | **10** |
| CSS partials under `src/styles/` | 136 | 136 ✓ |
| Shared components in `src/components/ui/` | 12 | 12 ✓ |

The issue's own prose lists 33 card and 10 pill classes while its table says 31
and 9, so the table was the stale half. The figure is 31 cards and 10 pills.
`.gamecardstack` is the 33rd name in that prose list and is **not a card** — it
is the slate's stack container. It is excluded here and counted in the "not a
card" group below.

**#1127:** the first pass measured 32 because it counted `.pin-card`, which has
no rule and never has had one — the name appears once in this repo, inside a
comment in `12-sealbox.css` citing an example. #1112's own table was right about
the count, for the wrong reason.

**Whoever counts these next: do not use `\b`.** A word boundary does not exist
between `card` and `__element`, because `_` is a word character. A `\b`-anchored
regex silently drops every block that only ever appears as `.block__element` —
here that hid `.ballparkcard`, `.chalcard`, `.rvcard` and `.radarpill`, four of
the seven blocks in the most interesting group in this document. Use
`(?![a-z0-9-])`.

**And strip the comments first (#1127).** This file's comments are long and they
name classes. Matched as text, that prose invented a block (`.pin-card`) and
inflated every rule count in this document — `.gamecard` by 66 hits, `.txcard`
by 10, `.thub-card` by 6. `inventory.mjs` now blanks `/* … */` before it matches
anything. Step 3's guard (#1114) has to do the same, or it will count sentences.

---

## The headline: there are not 31 cards

Of 31 card blocks, **13 draw the same box**. Six draw no box at all. Five are
not cards. The real question step 2 answers is much smaller than 32 rows.

The recipe those 13 share, declaration for declaration:

```css
border: var(--bw-hair) solid var(--border-rule);
border-radius: var(--radius-md);
background: var(--surface-card);
box-shadow: var(--shadow-card);
```

Call it **the sheet**. It is the paper-scorebook card, and it is already the
house style — it just has no name and no component.

### The app has already invented the right pattern, in one corner

`.thub-card` is the team hub's card. Sixteen modules consume it. Four of those
modules put a **second class beside it** that carries no box of its own:

```jsx
<section className="thub-card chalcard">   // TeamChallengeCard.jsx
<section className="thub-card rvclub">     // TeamRunValueCard.jsx
```

`.chalcard` and `.rvcard` have **no base rule anywhere** — every one of their
rules is a `__element`. They are namespaces for inner parts, sitting on a shared
card that draws the box.

That is exactly the canonical-card-with-variants pattern #1113 proposes, built
and shipped and working, in one directory, under a name nobody generalized. Step
2 does not need to invent a pattern. It needs to **name the one the team hub
already uses and move the other twelve sheets onto it.**

---

## Cards — the five groups

### Group A — the sheet (13). Verdict: merge.

Same box, same four tokens. Differences are margin, padding and layout, which are
what a variant or a wrapper is for.

| Class | Owning partial | Consumers | Difference from the sheet | Verdict |
| --- | --- | --- | --- | --- |
| `.thub-card` | `09-team-info.css` | **16 modules** | `+ overflow:hidden`, `margin-top` | **canonical** — most consumers, already carries co-class variants |
| `.abscard` | `12-sealbox.css` + `25-wide-layout.css` | `gamehud/StatBox.jsx` | `display:none` until 740px, `+ overflow:hidden` | merge into Card |
| `.lineupcard` | `12-sealbox.css` | `inning/EnteringReference.jsx` | `margin`, `+ overflow:hidden` | merge into Card |
| `.metriccard` | `44-pre-game-cards.css` | 5 modules | `margin-top` only | merge into Card |
| `.startercard` | `44-pre-game-cards.css` | `TeamInfo.jsx` | none — shares its rule with `.lineup, .opp` | merge into Card |
| `.teammatecard` | `10-lineup.css` | `TeamInfo.jsx` | `+ grid`, `break-inside:avoid` | merge into Card |
| `.tradecard` | `47-trade-deadline.css` | `transactions/TradeCard.jsx` | `padding` | merge into Card |
| `.stampcard` | `48-logbook.css` | `logbook/StampCollection.jsx` | **no shadow** | merge — but read the bespoke section first |
| `.rehabcard` | `31-wild-card.css` | `RehabPage.jsx` | **no shadow**, flex centred | merge into Card, `flat` variant |
| `.gamecard` | `06-loader-and-cards.css` | 4 modules | border is `color-mix(--border-rule 35%, --text-muted 65%)` — deliberately darker | **stays bespoke** — see below |
| `.offdaycard` | `06b-offday-cards.css` | `team/OffDaySection.jsx` | interactive; hover/focus tint from `--offday-accent` | merge as `interactive` + identity variant |
| `.phcard` | `72-player-hover-card.css` | `player/PlayerHoverCard.jsx` | `position:fixed`, `--border-hairline`, `--shadow-raised`, `pointer-events:none` | **stays bespoke** — it is a popover, not a card |
| `.tally-cl-card` | `04-site-bar.css` | `lib/clerkAppearance.js` | every declaration `!important` | **stays bespoke** — see below |

### Group B — the tight sheet (4). Verdict: merge as one `dense` variant.

`--radius-sm` instead of `--radius-md`, and no shadow. A consistent second size,
not four accidents.

| Class | Owning partial | Consumers | Difference | Verdict |
| --- | --- | --- | --- | --- |
| `.playercard` | `22-box-score-tables.css` | 5 modules | `padding:8px`, flex row | merge — `dense` |
| `.seedcard` | `34-postseason.css` | `PostseasonHistoryPage.jsx`, `PostseasonRacePage.jsx` | interactive, `padding:5px 8px` | merge — `dense` + `interactive` |
| `.tstats-card` | `31-wild-card.css` | 4 team-hub modules | `+ overflow:hidden` | merge — `dense` |
| `.prospectcard` | `31d-prospect-card.css` | `playerstats/ProspectCard.jsx` | `border-top: 3px solid --accent-primary` | merge — `dense` + `accent` |

**#1112 asks specifically whether `.seedcard` and `.prospectcard` are one card.**
They are. Both are the tight sheet. `.prospectcard` adds a 3px accent rule on
top; `.seedcard` adds a pointer. Neither difference is a reason for two blocks.

**`.seedcard` re-checked against the drawn box (#1127) — the verdict stands.**
It had been read off the source, because the lab was not loading
`34-postseason.css` and drew it as bare text. Drawn, it is the tight sheet to
the pixel: a `--border-rule` hairline, `--radius-sm`, `--surface-card`, no
shadow — the same box `.playercard` and `.tstats-card` draw, differing only in
its 5px 8px padding and its pointer. Merge as `dense` + `interactive`.

### Group C — namespace only, no base rule (6). Verdict: nothing to merge.

**These blocks draw no box.** Every rule they own is a `__element`. They are BEM
prefixes, and most already sit on a card from Group A.

| Class | Owning partial | Sits on | Verdict |
| --- | --- | --- | --- |
| `.chalcard` | `report/challenge-card.css` | `.thub-card` (co-class) | **already correct** — the pattern to copy |
| `.rvcard` | `75-run-value.css` | `.thub-card` (co-class, as `.rvclub`) | **already correct** |
| `.ballparkcard` | `57-ballpark-card.css` | `.thub-card` (BallparkCard.jsx) | already correct |
| `.horizoncard` | `31-wild-card.css` | `.thub-card` | already correct |
| `.advcard` | `26-player-page.css` | its parent block on the player page | leave — rename to `.adv` at most |
| `.foulcard` | `26-player-page.css` | its parent block | leave — rename to `.foul` at most |

**`.pin-card` is not here any more, and there was nothing to delete (#1127).**
The row above it read "one selector, zero consumers — dead code". Git says
otherwise: `git log -G'\.pin-card *\{' --all` returns nothing, so no rule of
that name has existed at any commit in this repo. The single hit was the phrase
`(e.g. .pin-card)` inside a comment in `12-sealbox.css`, citing a colour-mix
example that was never written. The comment now cites `.pitchernotice--pbp`,
which is real, and the census skips comments. **The finding worth keeping is
about the instrument, not the class**: a name census reads prose as code, and
this one nearly deleted a rule that did not exist while reporting counts up to
1.6x their true size.

**The naming finding.** Six blocks are called `…card` and are not cards. A
namespace that ends in `card` reads as a card to the next agent that greps, and
it is how the 32nd block gets written. Step 2 should rename these, or step 3's
guard will keep counting them.

### Group D — not a card (5). Verdict: leave alone, rename if cheap.

| Class | What it actually is | Verdict |
| --- | --- | --- |
| `.scorecard` | The scoring grid's custom-property block — `--sc-cell-w`, `--sc-name-w`, and nine more. No box, no border. | **never merge** — see bespoke |
| `.flipcard` | `perspective: 1400px`. A 3D transform container. | leave |
| `.delaycard` | A notice: `border-left: 3px solid --navy`, tinted fill, pop-in animation. | leave — it is a banner |
| `.txcard` | `display: grid` and a margin. A transaction row. | leave |
| `.derbycard` | `text-decoration:none; cursor:pointer` — link behaviour applied **on top of a `.gamecard`**. | leave — it is a modifier |
| `.gamecardstack` | The slate's stack container. Not in the 32. | leave |

### Group E — margin only (2). Verdict: leave alone.

`.contractcard` (`margin-top`) and `.moundcard` (`margin-block-start`). One
declaration each, both spacing. They are section wrappers that were given a card
name. Not cards, not worth a migration.

### The one left over

`.pswscard` (`34-postseason.css`, `PostseasonHistoryPage.jsx`) —
`border: 1.5px solid var(--seal)` on `var(--surface-inset)`. It is the **seal**
treatment, not the sheet. See bespoke.

**Re-checked against the drawn box (#1127) — the verdict stands.** This one had
been judged from the source alone, because the lab drew it as bare text. Drawn,
it is unmistakably not the paper sheet: a kraft-amber outline on a ground
(`--surface-inset`, #FFFDF6) that is *lighter* than the sheet's `--surface-card`,
with no shadow. One correction to the reasoning: at 1x the 1.5px border is used
as 1px, the same width the hairline draws, so the difference a reader actually
sees is the **colour and the ground**, not the border width. It also takes the
sheet's `--radius-md`, not the tight sheet's `--radius-sm` — it belongs in
neither group, which is why it is filed here.

---

## Pills — much simpler than the cards

Four pills are the same pill. They are identical, declaration for declaration,
except for **three** values: `background`, `color`, `border`.

```css
display: inline-flex;  align-items: center;
font-family: var(--font-display);  font-size: var(--fs-caption);
font-weight: var(--w-bold);  letter-spacing: var(--ls-label);
text-transform: uppercase;
padding: 2px 7px;  border-radius: var(--radius-pill);
```

| Class | Owning partial | Consumers | background / color / border | Verdict |
| --- | --- | --- | --- | --- |
| `.milestonepill` | `31-wild-card.css` | `badges/MilestonePill.jsx` | `--bg-page` / `--accent-primary` / `--accent-primary` | **canonical** — `tone="accent"` |
| `.rookiepill` | `31-wild-card.css` | `badges/RookiePill.jsx` | `--bg-page` / `--field` / `--field` | merge — `tone="positive"` |
| `.prospectpill` | `31-wild-card.css` | `badges/ProspectPill.jsx`, `PlayerHubShell.jsx` | `--bg-page` / `--text-muted` / `--border-hairline` (`+gap:4px`) | merge — `tone="muted"` |
| `.duepill` | `31-wild-card.css` | `inning/EnteringReference.jsx` | `--seal-cover` / `--seal-cover-ink` / `--seal-deep` | merge — `tone="seal"` |

Three more are the same pill with their own padding and a pointer:

| Class | Owning partial | Consumers | Difference | Verdict |
| --- | --- | --- | --- | --- |
| `.mastheadpill` | `10-lineup.css` | 4 modules | `padding:3px 9px`, `--ls-caps`, `--surface-card`, `cursor:pointer` | merge — `tone="outline"` + `interactive` |
| `.psodds-pill` | `39-manager-page.css` | 2 team-hub modules | `padding:4px 10px`, filled `--seal`, `cursor:pointer` | merge — `tone="seal-filled"` + `interactive` |
| `.tierpill` | `09-team-info.css` | `badges/TierPill.jsx` | `inline-block`, `--ls-caps`, `+line-height`, `+white-space` | merge — `tone="outline"` |

Three are not pills:

| Class | Why not | Verdict |
| --- | --- | --- |
| `.reg-pill` | `border-radius: var(--radius-xs)` — 3px. A **tag**, not a capsule. | **leave** — and rename. It is the clearest mis-name in the system. |
| `.debutpill` | Carries the shell only, no typography. It holds an icon. | leave, or merge as `tone="bare"` |
| `.radarpill` | **No base rule.** Namespace only, like Group C. | leave |

### A dead declaration, in eight of the ten

`font-weight: var(--w-bold)` on `--font-display` is a **no-op**. Barlow
Condensed is registered at weight 700 only (`src/tokens/fonts.css`), so every
weight renders identically. It is not a bug and it costs nothing at runtime, but
it implies a choice that does not exist, and it has cost time twice. The
canonical `Pill` should not carry it. `/design-lab` states this on the page,
beside the three faces.

---

## What should stay bespoke, and why

Deliverable 2 of #1112. **A merge that flattens one of these is a regression,
not a cleanup.** Step 2 must not touch them.

**1. `.scorecard` — the scoring grid.** Not a card in any sense. It is a block of
thirteen custom properties that size the paper grid: cell width and height, the
position column, the name column, the summary column, the line height, the strike
fill. Thirty-nine modules read it, including `src/api/`. It is the app's reason
to exist. Leave it entirely alone, and rename nothing about it.

**2. The stamp surfaces — `.stampcard` and the Game Log.** ADR-0035 is explicit
that stamp art is safe because of **where it may render**, enforced by
`scripts/check-stamp-surfaces.mjs`, and not by a check at mint time. A stamp
carries a score. Moving stamp geometry into a shared `Card` that any surface may
use is exactly the move that guard exists to prevent. `.stampcard` is listed as
*merge* in Group A on geometry alone; **do not act on that** until
`check-stamp-surfaces` has been read and its surface list confirmed to still
hold. If in doubt, leave it bespoke — the cleanup is worth far less than the
invariant.

**3. `.pswscard` — the seal treatment.** `1.5px solid var(--seal)` on
`--surface-inset` is the kraft-tape vocabulary, not the paper-sheet vocabulary.
The seal means something in this app. Folding it into a generic card variant
turns a metaphor into a border width.

**4. `.gamecard` — the slate card.** Its border is
`color-mix(in srgb, var(--border-rule) 35%, var(--text-muted) 65%)`, deliberately
darker than the sheet. It also carries park art, the `@` watermark in a
one-purpose typeface, and the largest rule count of any block (112 selector
hits — 178 before comments stopped being counted, #1127). It is the app's front door. It can consume shared inner parts; its box
should stay its own.

**5. `.offdaycard`'s identity tint.** Its hover and focus states mix
`--offday-accent` into the border. That is club identity reaching the card
surface, which is gated twice on WCAG AA elsewhere in the app (ADR-0050). A
generic `interactive` variant must not drop it.

**6. `.tally-cl-card` — Clerk's DOM.** Every declaration is `!important` because
it overrides a third party's stylesheet inside a component this app does not
render. It has to keep winning. Leave it.

**7. `.phcard` — the hover card.** `position:fixed`, `pointer-events:none`,
`z-index:100`. It is a popover. Popovers and cards diverge the moment either
grows.

---

## What step 2 should build

On the evidence above, not on invention:

**`Card`**, canonical geometry from `.thub-card`, with:
- `dense` — `--radius-sm`, no shadow (Group B's four)
- `flat` — no shadow (`.rehabcard`)
- `interactive` — hover lift, focus ring, pointer (`.offdaycard`, `.seedcard`)
- `accent` — a 3px top rule in a passed accent (`.prospectcard`)

That is **four variants covering 17 of the 31 blocks.** Six more need nothing
(Group C). Eight are not cards (Groups D, E). Six stay bespoke.

**`Pill`**, canonical geometry from `.milestonepill`, with a `tone` axis
(`accent`, `positive`, `muted`, `seal`, `outline`, `seal-filled`) and an
`interactive` flag. That covers **7 of the 10**. Two are not pills, one is a
namespace.

**Do not add a variant no current surface needs.**

---

## What the page found on its first run

Not planned findings — these are what showed up the moment the catalog rendered.
They are the argument for the page existing.

**1. Four component dimensions bypass the token tier.** `/design-lab` reads every
custom property declared on `:root` and files it by token file. Four landed in
"Unfiled", because they are not in `src/tokens/` at all — a component partial
declares them globally:

| Property | Declared in |
| --- | --- |
| `--xl-box-w`, `--xl-box-h`, `--xl-batter-scale` | `src/styles/77c-express-lane-deck.css` |
| `--refrail-w` | `src/styles/focus/stage.css` |

`src/CLAUDE.md` says app-specific component geometry — "the `--cell-size`, the
`--shot-*` headshot rungs, the `--app-width` frame" — lives in
`tokens/layout.css`. These four are the same class of value and are somewhere
else, where nothing lists them and nothing enforces them. They are also on
`:root`, so they cost every route, not just the two that use them. Worth folding
into `layout.css` or scoping to their block; not urgent, and not this issue.

**Done in #1127.** All four moved to `tokens/layout.css`, carrying the reasoning
that was written beside them, and each partial keeps a line saying where its
dimension now lives. The lab files tokens by NAME, not by file, so its `layout`
matcher gained `refrail` and `xl` in the same change — a token has to be both
moved and matched before the page stops calling it unfiled. "Unfiled" is now
empty and the group no longer renders.

**2. `MasonryColumns` supplies no key.** It calls `children(item, i)` inside a
`.map()` without a key, so every consumer must remember to key the element it
returns. Nothing says so, and the lab's own first call got it wrong. A one-line
fix in the component would remove the trap for every future caller.

**Done in #1127.** The component wraps what `children()` returns in a keyed
`<Fragment>`, keyed on the item's index in the original `items` array — unique
across columns, stable while the list is. Callers may still key their own
element; they no longer have to.

**3. `UmpireTierPill.jsx` is a four-line re-export of `TierPill.jsx`.** So
`badges/` is eleven files and ten components. The alias is deliberate and
documented; it just means the "11 components" figure in #1112 overstates by one.

**4. The page was not drawing two of the blocks it was being read for (#1127).**
`blocks.jsx` hand-imports the per-route partials that own a listed block's base
rule, and it missed `34-postseason.css`, so `.seedcard` and `.pswscard` rendered
as bare text while their verdicts were being signed off. Both were re-checked
against the real box afterwards and both stand — but a catalog that can draw
nothing and say nothing is an instrument that reports a blank as a finding. The
import is added, the header comment carries the count to keep true, and the
check is cheap to run: every class the page lists now matches a rule in
`document.styleSheets`. `.phcard` was also escaping its entry, being
`position: fixed`; its stage is now the containing block, with none of its own
declarations overridden.

---

## Open questions for Gary

1. ~~**`.pin-card` has zero consumers.** Delete it, or is it a hook set outside
   `src/`?~~ **Answered in #1127: neither.** It has never been a rule. The census
   was reading a comment. Nothing was deleted; the census was fixed.
2. **`.stampcard`** — merge on geometry, or hold it bespoke with the other stamp
   surfaces? This document recommends holding it. It is the one row where the
   cleanup and the spoiler rule point in different directions.
3. **The seven `…card` namespaces that are not cards** — rename them in step 2,
   or leave the names and let step 3's guard carry an allowlist? Renaming is more
   work now and less work forever.
4. **`.reg-pill`** is a 3px tag wearing a pill's name. Rename it to `.regtag`?
