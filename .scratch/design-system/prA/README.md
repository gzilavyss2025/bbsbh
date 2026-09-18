# PR A — token values (#1128)

Verification for the first slice. Three scripts, each an A/B **inside the live
page**: they override one token back to its pre-#1128 value, shoot, drop the
override, shoot, and diff the pixels in a canvas. One token at a time, no
rebuild in between, so nothing else can move.

Run them against your own dev port:

    E2E_PORT=5173 node .scratch/design-system/prA/ab.mjs
    E2E_PORT=5173 node .scratch/design-system/prA/shadowcrop.mjs
    E2E_PORT=5173 node .scratch/design-system/prA/inkcrop.mjs

## What they measured

`ab.mjs`, three routes at 390x844:

| route | --paper-1 fold | --ink-0 darker | --shadow-raised |
| --- | --- | --- | --- |
| slate | 0.21%, max delta 4 | 3.81%, max delta 13 | 0.66%, max delta 5 |
| standings | 0.00% | 0.65%, max delta 13 | 0.00% |
| team hub | 0.00% | 0.14%, max delta 13 | 0.00% |

**The paper fold is invisible, measured rather than assumed.** Two of the three
routes do not change by a single pixel. The slate's 0.21% is one bounding box,
203,438 87x275 — `img.teamlogo`, the club marks on the game cards, whose
antialiased edges composite against the page behind them. A 4/255 channel
delta on an image's edge pixels is below anything an eye resolves.

**--shadow-raised is not on those three routes**, which is why two of them read
0.00%. Its live callers on the slate are `.wiredock__sheet` (the wire dock's
bottom sheet, present at the rail detent) and, in a game, `.btn--next`.
`shadowcrop.mjs` shoots the sheet's top edge — where a bottom sheet's shadow
falls — at 3x: `crop-sheet-compare.png`.

**--ink-0**: `crop-ink-compare.png`, the team hub's Team Leaders card. The
heading ink darkens and stays navy; the graphite caption beside it and the
green "SEE ALL" link are pixel-identical, which is the point — the split is
between heading and body, not a wash over the page.
