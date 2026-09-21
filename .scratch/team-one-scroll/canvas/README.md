# Team page one-scroll — the design canvas

The design for #1106, step 2 of the team-page one-scroll. Published as a Claude
Design canvas:

**https://claude.ai/artifact/NV6fz4ywi3d3nvX5rdRa8s**

`../design.md` holds the decisions, the system numbers and the harmonization
list. `../scope.md` is the step-1 wireframe this designs. The step-1 canvas is
https://claude.ai/artifact/88kCApvXGHrRKYMur6VBUB — its source was never saved,
which is why this directory exists.

## The artboards

Four columns, one per version of the STANDING band on Milwaukee, each stacked
**loaded → loading → no data**. A fifth column holds the reduced band.

| File | Board |
| --- | --- |
| `Main.dc.html` | v1 · the plain promotion — `BroadcastSection` dropped in, nothing else |
| `V1-Loading.dc.html` · `V1-Empty.dc.html` | v1's two other states |
| `V2-Loaded.dc.html` + 2 | v2 · the band tint 1D.4 asked step 2 to decide, drawn so its rejection is visible |
| `V3-Loaded.dc.html` + 2 | v3 · over-corrected on purpose — a rule above, a folio, a closing mark |
| `V4-Loaded.dc.html` + 2 | **v4 · settled** — v3's rule, minus v3's three accessories |
| `V4-Reduced.dc.html` | v4 · Standing at Single-A: three cards, Wilson's own figures |

`canvas.json` places every board and holds the title and the nine sticky notes,
which carry the three-bullet critique of each version.

## Regenerating

**The artboards are generated, not hand-written.** Records is 61 door rows plus
a 10×2 inning table plus 18 season counts and has to be drawn at its true
3,238px; and the four versions differ only in the band furniture, so the cards
are written once and the furniture varies by version.

```
node .scratch/team-one-scroll/canvas/build.mjs
```

That writes every `project/*.dc.html` and `project/canvas.json`. Edit
`build.mjs` (the furniture and the card renderers) or `data.mjs` (the values),
never the generated `.dc.html` files.

To publish, copy `project/` into the session scratchpad — the Artifact tool
refuses a `root` outside the working directory — and send it in one call:

```
Artifact  url: https://claude.ai/artifact/NV6fz4ywi3d3nvX5rdRa8s
          root: <scratchpad>/canvas
          file_path: <scratchpad>/canvas/project/canvas.json
          files: every project/*.dc.html
```

Send `canvas.json` only when the layout, the notes or the title change.

## Looking at the boards without publishing

```
node .scratch/team-one-scroll/canvas/look.mjs <outDir> V4-Loaded.dc.html ...
```

Renders an artboard at 390px and slices it into readable strips. The `.dc.html`
files are plain HTML apart from the `<x-dc>`/`<helmet>` wrapper, so the script
strips those three tags and screenshots what is left. Every version here was
looked at this way and revised before it was published.

## What the boards are

**Every figure is real**, scraped off a running dev server on 2026-09-21 with
`../scrape-standing.mjs`, and every colour is the value the app computes, read
with `../computed.mjs`. Milwaukee's card heads are navy `#12284B` under a gold
`#A6801F` edge; Wilson's are navy `#00274d` under crimson `#98002e`; Los Mochis
is **unthemed** — `headerThemeFor` returns null for it, so its heads are
graphite on transparent.

Records is drawn at **true proportion**. A placeholder would hide the crowding
that is the whole problem in this band.

No application file has been changed by this study.
