# Home feed — a redesign exploration

Working notes for a redesign of the mobile home slate, run as a Claude Design
canvas. **Nothing here ships.** The only product change from this session is
the sheen softening in `src/styles/06a-gamecard-parkart.css`, which is a normal
commit on this branch and has nothing to do with these files.

The canvas itself is a published Artifact; the files here are what generates it.

## Revised after owner review (23 Aug)

- **One flat list.** The sectioned draft ("Your Club / On Now / First Pitch to
  Come / Earlier Today") is gone — the grouping itself was a spoiler. Your club
  pinned, then first-pitch order, every band the same size. (The shipping slate
  never had those sections; the draft invented them.)
- **Light AND dark ship.** The light ground stopped being an open question;
  `feed(theme)` in `build.mjs` draws both from one builder.
- **Abbreviation over mascot** — MIL over BREWERS, not over MILWAUKEE.
- **The base is photo-real now**: one SVG (feTurbulence → feDiffuseLighting
  pebbled rubber, beveled walls, displaced slide scuffs, clay in the corners),
  drawn from reference — an 18" Hollywood base is rubber over a foam core,
  a rounded-corner pillow, not a nub grid. Marks multiply on like ink.
- **Back from the shipping page**: the club strip (TeamFilterStrip), the Wire
  dock at the fold (WireDock), and the networks' PNG logos
  (`public/broadcast-logos/`) on the rail.
- **The band sheen** loops the shipping scroll-driven sheen's exact stops.
- **Jersey-known games wear the jersey**: field takes the tile tint, the bag
  prints that jersey's art (BOS drawn in City Connect; white knockout art
  prints as ink — see `ink` in `baseTileSrc`).
- **Boards 4–6b carry the pages' real furniture**: starter-card and hover-card
  headshots (real silo cutouts, ids from the ATH/HOU rosters), the batting
  order in its shipping anatomy, the defense diamond, and PlayDiamond's
  advance notations on every at-bat of the opened half.

## The brief

Redraw the mobile game feed so it is (1) legibly designed by a person rather
than assembled from defaults, (2) not bound to the paper/manila/kraft system,
and (3) worth looking at, since the slate is the first screen anyone sees.

The constraint that shapes the whole thing: **the slate has no numbers in it.**
The spoiler rule forbids scores, records and odds there, so the feed cannot lead
with the one thing every other scores app leads with. What is left — two
identities, a place, a time, and anticipation — is exactly what a college
football gameday poster is made of, which is where the visual research went.

## What is here

| file | what it is |
| --- | --- |
| `canvas/build.mjs` | entry point. Slate data, club colours, the type/colour helpers, the Marquee band, the base tile, and `canvas.json`. Run it to regenerate everything. |
| `canvas/flow.mjs` | the chosen flow: the feed, the opening transition, the poster, and lineups / innings / box score. |
| `canvas/extras.mjs` | the light-ground comparison, the two revealed states, the edge cases, and the minor-league boards. |
| `canvas/render-all.mjs` | renders every artboard to PNG and reports, per board, whether it clips or leaves dead space. |
| `sheen-ab.mjs`, `sheen-card.mjs` | how the sheen change was checked: two dev servers, same slate, same scrollY, same card index. The band is scroll-driven, so a phase-matched capture is the only honest comparison. |
| `flow-shots.mjs` | screenshots the current shipping lineup / innings / box screens, for contrast with the redraws. |

The generated output is committed too — `canvas/*.dc.html`, `canvas.json`, the
fetched club marks, and `canvas/tally-game-feed.html`, which is the seeded
canvas itself. That last file is ~3 MB and is deliberately here rather than
gitignored: it IS the deliverable, and it is the only copy that does not depend
on a hosted artifact staying up.

To regenerate after editing a source file:

```sh
node .scratch/homefeed/canvas/build.mjs                # artboards + canvas.json
node .scratch/homefeed/canvas/render-all.mjs /tmp/dr   # look at them
```

Re-seeding `tally-game-feed.html` needs the Claude Design skill's
`seed-canvas.mjs`, which is not vendored here; `build.mjs` produces everything
that goes into it.

The club marks come from `https://www.mlbstatic.com/team-logos/{teamId}.svg`,
the same CDN `teamLogoUrl` already uses — MLB ids for the thirty clubs, and
MiLB ids for the ten in `extras.mjs`.

## Where it landed

Four directions were drawn; **A (Marquee)** was chosen as the feed and **D
(Split)** as the screen you land on after tapping one. They pair because they
are the same composition at two scales — the band's wedge and the poster's
diagonal are one four-point `clip-path`, so the opening is that path
un-clipping rather than a cross-fade.

## Things learned the hard way

Kept here because each one cost a pass, and each would cost the same pass again:

- **Club colour cannot carry the feed on a near-black ground.** 17 of 30 MLB
  primaries sit under 1.4:1 against `#0A0B0D` — Tigers and Yankees at 1.25:1 —
  and 17 of 30 are blue or navy, so a real slate is a rack of navy. The light
  ground comparison in `extras.mjs` exists because of this and the question is
  still open.
- **A seam drawn in a club colour disappears.** 173 of the league's 435
  matchups put two primaries within 1.35:1, and two pairs are byte-identical
  (Tigers/Yankees, Pirates/White Sox). The seam has to be achromatic. White
  clears 3:1 against every primary except Miami's.
- **One signal colour has to sit on its own ground.** `#E9DA00` loose on club
  colour is 1.98:1 on Miami and 1.31:1 against the A's own gold. In an ink chip
  it is 10.5:1 everywhere.
- **A logo knocked out to white is a deleted logo.** `brightness(0) invert(1)`
  turns every opaque pixel white, so any mark with a filled ground — Milwaukee's
  ball-in-glove, the Orioles bird, the Astros star — collapses into an
  identical disc. Grayscale keeps the artwork.
- **Texture has to be a surface, not a motif.** The base's traction nubs went
  through crossed lines (read as plaid) and seven-across dots (read as polka
  dots) before landing at ~24 across.
- **MiLB colour data is the untrustworthy half of MiLB identity.** 50 of the
  117 clubs in `src/lib/data/milb-colors.json` have a primary under L 0.02,
  four are literally `#000000`, and 107 of 117 are flagged
  `"confidence": "medium"`. The art is reliable where the colours are not,
  which is an argument for leaning on the marks at every level.
