# Offseason home — design canvas

The merged proposal, after two reviews. One concept, two versions: MLB and the
minor-league levels. Published as a Claude Design canvas:

https://claude.ai/code/artifact/ec497031-116e-4788-b490-a005e6f326bd

`../research.md` holds the evidence and the season rules. `../README.md` covers the
first pass (concepts A, B and C), whose boards are on page 2 of the canvas.

## The artboards

Page 1 — the merged page:

| File | Board |
| --- | --- |
| `Main.dc.html` | MiLB, desktop (High-A, October) |
| `MilbPhone.dc.html` | MiLB, phone |
| `MlbDesktop.dc.html` | MLB, desktop (December) |
| `MlbPhone.dc.html` | MLB, phone |
| `Review.dc.html` | What the two reviews changed, and the open decisions |

Page 2 — superseded: `BRecord`, `BMobile`, `CNotebook`, `CMobile`, `Changes`.
Both B and C are single rows on the merged page; these are the shape the
follow-up work takes if either is built out.

`canvas.json` places every board and holds the sticky notes and the two pages.

## Regenerating

The seeded `tally-offseason-home.html` is a ~2.6 MB build output and is
gitignored. To rebuild it, run the `design` skill's helper over the artboards:

```
node "<design skill base dir>/seed-canvas.mjs" \
  --template "<design skill base dir>/payload.template.html" \
  --out tally-offseason-home.html --title "Tally Offseason Home" \
  --artboard Main.dc.html --artboard MilbPhone.dc.html \
  --artboard MlbDesktop.dc.html --artboard MlbPhone.dc.html \
  --artboard Review.dc.html --artboard BRecord.dc.html \
  --artboard BMobile.dc.html --artboard CNotebook.dc.html \
  --artboard CMobile.dc.html --artboard Changes.dc.html \
  --canvas canvas.json
```

Then publish that file to the URL above with the Artifact tool (`contract: 0.1.31`).
Edit the `.dc.html` files, never the seeded output.

## What the boards are

Annotated mockups, not implemented screens. Every figure is illustrative. Player
names and level paths on the MiLB boards are real rows from
`public/data/minors-leaders.json`; ages, counts and dates are placeholders. Club
marks stand in as paper tiles — the real ones come from the logo CDN keyed on
`teamId`.

No application file has been changed by this study.
