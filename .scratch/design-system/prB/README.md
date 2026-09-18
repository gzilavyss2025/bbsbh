# PR B — splitting `--fs-caption` (#1128)

793 declarations set `font-size: var(--fs-caption)`. One 11px role did every
small-text job in the app, which is exactly why it could not be changed: a
value that suits a figure in a table cell is wrong for a paragraph.

## Why the browser, and not just the stylesheet

`src/styles/01-base.css` sets `font-family: var(--font-body)` on `:root`, so a
rule that does not state a family inherits one — and **122 of the 793 do not
state one.** A static read of the stylesheet cannot say what face those render
in, and the face is the whole basis of the split.

`probe.mjs` walks 50+ routes and records, for every element rendering at 11px,
the face the browser resolved and the longest text that element ever held. The
sweep uses the rule's own `font-family` where it has one and the browser's
answer where it does not.

## The scripts

    E2E_PORT=5173 node .scratch/design-system/prB/probe.mjs     # ground truth
    E2E_PORT=5173 node .scratch/design-system/prB/sweep.mjs      # classify + apply
    E2E_PORT=5173 node .scratch/design-system/prB/overflow.mjs   # regression hunt
    E2E_PORT=5173 node .scratch/design-system/prB/wraps.mjs      # crop each wrap
    node .scratch/design-system/prB/sheet.mjs                    # compose the sheets

`decisions.json` records every one of the 793 rules with its face, how the face
was established, where it went and why. That file is the review surface — a
wrong call is findable in it without re-running anything.

## Where they went

| destination | rules | size |
| --- | --- | --- |
| `--fs-label` | 422 | 11px -> **12px** |
| `--fs-cell` (new) | 195 | 11px, unchanged |
| `--fs-small` | 52 | 11px -> **13px** |
| `--fs-caption` kept | 124 | unchanged |

Running copy is decided by EVIDENCE, not by name: the longest text the probe
saw a rule render, 25 characters being the line between a sentence and a
position, a count or a venue. A role-name suffix decides only where nothing
ever rendered.

The 124 kept are the honest residue — about half never rendered on any route
walked, and a rule that might sit inside a mono table was left at its own size
rather than moved on a guess. `scripts/check-caption-budget.mjs` ratchets it.

## What the regression hunt found

47 routes at 390px, each A/B'd against the old sizes injected back over the
live page, so a finding only counts when the old size did not do it:

- **zero** new horizontal page scroll
- **zero** new clipped text
- **60 label wraps** across 10 classes — `wrapshots/sheet-1.png`, `sheet-2.png`
- 295 copy wraps across 14 classes — intended; that is 11px -> 13px

Two notes on the method, both of which produced false positives first:

- Line count must come from `Range.getClientRects()`, one rect per line box.
  `scrollHeight / lineHeight` moves with padding when the font size changes and
  reported a wrap on `.rv__num`, which carries `white-space: nowrap` and cannot
  wrap. That one artifact was 95 of the original 683 findings.
- Only leaf elements whose OWN size moved count, or a container is reported
  again for every child that grew inside it.

## The 10 wraps, and the call on each

All accepted. Each is a correct classification — a display-face, tracked,
uppercase label going to the label role — and no layout breaks; they get a
second line, which the flex rows they sit in absorb.

`.dirhd__label` is 30 of the 60 (`wrapshots/dirhd-context.png`). In the site
menu's two-column directory, "PROSPECTS & INJURIES" breaks after the ampersand
while the hairline rule beside it shortens. The 12px column is materially
easier to read, which is what the split was for.

The others: `.tradecard__cutline` (11), `.allstarlegacy__leaderyears` (5),
`.slab__label` (3), `.allstarlegacy__honoreeyears` (3), `.hlclip__title` (2), a
`th` on `/fouls` (2) and one each of `.plink` on `/rehab` ("Sugar Land Space
Cowboys", a genuinely long club name) and `.aboutfigs__k`. Several of these
already wrapped at 11px and only reflow.
