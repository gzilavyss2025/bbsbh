# Hand-off — home-feed redesign canvas (PR #857)

Written 23 Aug 2026, for the next agent who picks this up. Read
`README.md` beside this file first; this file records state, decisions,
and how to continue safely.

## Where things stand

- **Branch**: `claude/home-feed-design`, in the worktree
  `/Users/garyzilavy/bbsbh-home-feed`. Up to date with `origin/main`
  (merged at `2614a31e`).
- **PR**: #857, open. Two things on it:
  1. A small product change that ships: the sheen softening in
     `src/styles/06a-gamecard-parkart.css`.
  2. The design canvas under `.scratch/homefeed/` — **nothing in
     `.scratch/` ships**.
- **Commits on the branch, newest first**: `44113ff2` (second-pass
  fixes), `94390abf` (owner-review revision), `2614a31e` (merge main),
  `513fcc66` (original canvas), `8f0911d2` (sheen softening).
- **The canvas is a published Artifact**:
  `https://claude.ai/code/artifact/d189aff5-2f66-4b1d-8e35-8d7d8d42381c`
  (title "Tally Game Feed"). The committed
  `canvas/tally-game-feed.html` is the same content and is the only
  copy that does not depend on the hosted artifact. The artifact can be
  edited and Saved in its own GUI — if the owner saves changes there,
  **read the artifact back before you regenerate anything**, or you
  will overwrite their edits (the Claude Design skill documents the
  extract flow).
- CI (`lint-and-build`) and the pre-commit unit suite pass on the
  branch. All changes since `513fcc66` are `.scratch/`-only plus the
  already-reviewed CSS commit.

## Decisions the owner made in review (do not re-litigate)

1. **One flat list.** No "Your Club / On Now / First Pitch to Come /
   Earlier Today" grouping — the grouping itself is a spoiler. Order is
   favourite club pinned, then first-pitch time. Every band the same
   width and height. This applies at every level (MLB, MiLB) and at
   desktop width.
2. **Light and dark both ship.** One builder (`feed(theme)` in
   `canvas/build.mjs`) draws both. Bands are club colour and identical
   in both; the chrome, seals and tables carry the theme.
3. **Abbreviation over MASCOT** — MIL over BREWERS, never the city.
4. **The base behind each mark is photo-real** — the SVG in
   `build.mjs` (`baseArtSvg`): feDiffuseLighting-lit pebbled rubber,
   beveled walls, displaced slide scuffs, corner clay, stepped-clean
   middle. Marks print with `mix-blend-mode: multiply`. White-knockout
   jersey art prints as ink (`ink` option in `baseTileSrc`).
5. **Keep the network PNG logos** (`public/broadcast-logos/`) on the
   band rail, and **keep the jersey treatment**: when tonight's jersey
   is known (live uniforms feed same-day, `jerseys.json` ahead), the
   band's field takes the jersey tile tint and the bag prints that
   jersey's art. Demo: SF@BOS in City Connect green `#5A8D84` (the
   repo's own `city-connect-colors.json` value).
6. **The band sheen stays** — same soft-light blend and softened stops
   as the shipping `06a-gamecard-parkart.css`; scroll-driven
   (view timeline) in the app, looped in the mock.
7. **Favourite club front and centre** (pinned band with ring + star).
8. **The club strip and the transaction Wire return** to the home
   feed (they exist in the shipping app as `TeamFilterStrip` and
   `WireDock`; the first canvas cut had dropped them).
9. **Screens 4–6b carry the shipping pages' real furniture**:
   headshots, the hover card, the defense diamond, PlayDiamond's
   advance notations.

## The canvas, briefly

18 artboards, 3 pages. Page 1 is the flow: feed dark (1) and light
(1L), opening motion (2), poster (3), lineups (4), hover card (4b),
innings sealed/opened (5, 5b), box sealed/opened (6, 6b), desktop.
Page 2: edge cases + the Double-A boards. Page 3: the four original
direction sketches, kept as drawn.

Sample-data conventions (kept mutually consistent — if you touch one,
re-check the others): the walked game is ATH at HOU, live, opened
through the **top of the 2nd**, timestamps **7:04 PM**; the opened
half is six batters, two runs on Heim's double, one left on; the box
tables sum to their totals. Headshots are real MLB silo cutouts
(`h-*.png`) fetched from `img.mlbstatic.com` by person id — ids came
from the live ATH/HOU active rosters (Bolte 703607, Williams 675961,
Gelof 680869, Lopez 682052, Heim 641680, Brown 686613).

## How to regenerate and republish

```sh
node .scratch/homefeed/canvas/build.mjs          # artboards + canvas.json
node .scratch/homefeed/canvas/render-all.mjs /tmp/r   # PNGs + clip report
```

Re-seeding `tally-game-feed.html` needs the Claude Design skill
(`/design`) — its `seed-canvas.mjs` helper is not vendored here. Pass
every `*.dc.html`, every image (`*.svg`, `h-*.png`, `tv-*.png`,
`cc-bos.png`), and `canvas.json`. Then update the EXISTING artifact by
its URL (above) so the owner's link stays stable; do not publish a new
one. If the hosted canvas may have GUI edits, extract it first and
diff against the committed files before regenerating.

## If the next step is implementation

Nothing is committed to implementing this; that is the owner's call.
If asked, the relevant shipping code:

- Slate order today: `src/screens/GameSelect.jsx` (`sortGames`,
  `gamesForDisplay`) and `src/lib/resultCards.js`
  (`reorderLiveGames`, `reorderNationalBroadcasts`,
  `reorderGameOfTheNight`). The flat pin-then-first-pitch order means
  retiring those reorder passes — a real behaviour change; land it
  deliberately, with tests.
- Names: `splitName` in `src/lib/teamSplits.js` already yields the
  mascot (`teamName`); the schedule API carries `abbreviation`.
- TV logos: `src/lib/broadcastLogos.js` + `GameCardParts.jsx`
  (`NationalTvIcon`). Jerseys: `resolveTreatment` in
  `GameCardParts.jsx` (live uniforms → `jerseys.json` → default).
- Sheen: already shipping, softened on this branch.
- The spoiler rule governs everything on the slate: no scores,
  records, or odds pre-reveal. Read `CLAUDE.md` and `docs/adr/` before
  moving any surface.

## Known loose ends

- The light mode's signal colour is `#B8A800` in the mock (the bulb
  dimmed to hold contrast on `#E7E6E1`); nobody has ratified that
  exact value.
- The Athletics "city" is the repo's deliberate joke (`"It's just"`);
  the lineups bar prints `VISITOR · IT'S JUST` over `ATHLETICS` — the
  owner has not commented on it.
- `h-gelof.png` is embedded but currently unused (the standouts strip
  changed in the second pass). Harmless; drop it or use it.
- The Opening board's resting frame shows the tapped game's band above
  five non-pinned bands — a motion demo, not the literal feed top.
