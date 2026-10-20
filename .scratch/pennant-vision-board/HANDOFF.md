# Pennant vision board: handoff

## The original ask (Gary, verbatim)

> I want to work to create a vision board of design feedback and ideas to create a
> "pennant" for the annual winners of the NLCS and ALCS historically. The vision I have in
> my head is similar to what ballparks put up to celebrate past champions. The goal would be
> to create a visual that is malleable with the year team and league and reusable for
> multiple seasons on the team and player detail pages.

What that sets as the goal:
- A **vision board** (design feedback + ideas), not app code yet.
- A **pennant** for each season's **ALCS and NLCS winner**, across history.
- The feel of **ballpark championship displays** for past champions.
- **Malleable**: one design that any year, club and league can feed.
- **Reusable** on the **team page** and the **player page**, season after season.

Later asks in the same session, in order:
1. "Polish the souvenir felt one with texture and make it look more realistic."
2. The lettering "looks propped on top" / "doesn't look printed into the felt" / "maybe we
   need to try a different font?"
3. "If I had to pick one, the Yellowtail script. Can we also include the single color logo?
   Do some graphic design research on how to make text look part of a textured object."

Design exploration for a league-champion **pennant** (ALCS and NLCS winners) that can be
reused on the team page and the player page. Nothing is in the app yet. This is a
design canvas and a render harness only. No branch, no PR.

- **Canvas (claude.ai Design artifact, private):** https://claude.ai/artifact/GQAEcgeNYn9AmkQp6jDPxV
  Read its files with the Artifact tool (`action: "read"`, `path: "project/<file>"`), never WebFetch.
- **Design system used:** "Tally Baseball", https://claude.ai/artifact/LC1nH3QEJ5BFpK4briDanu
  (its `tokens.json` is installed on the canvas under `project/ds/tally-baseball/`).
- **This folder:** the render harness, the texture and mask generators, and reference renders.

## Decisions Gary made

1. **Direction:** the **souvenir felt** pennant (direction A). Rafter banner (B) and house
   stamp (C) stay on the canvas as alternatives only.
2. **Nickname font:** **Yellowtail** (script, Google Fonts). City and "1982 · AL champions"
   stay in Barlow Condensed (house font).
3. **Logo:** include the club's **one-colour logo** at the wide end of the pennant.
4. **Look:** realistic: felt texture, sag, sewn sleeve, the lettering must look
   **printed into the felt**, not laid on top. He rejected three rounds before the
   current one (see "Lessons").

Open questions (not answered yet):
- Soft shading and a blurred wall shadow break the house rules (flat colour, hard 4px ink
  shadow, no gradients). Proposed: an ADR that makes the pennant a narrow exception.
- Era colours and era logos: the stores hold today's colours and marks only.
- Player-pennant rule: does a player "own" a pennant if he was on the postseason roster,
  or on the club at any time that season? Marked `[Rule to confirm]` on the canvas.
- "Came close" ghosts (LCS losses) on the team page: keep or drop.

## What is on the canvas

| Artboard | What it shows |
| --- | --- |
| `Main.dc.html` | Interactive builder: nine real pennants, tap one, see it in all three directions. |
| `Felt.dc.html` | Direction A: hero Brewers 1982 + a wall of four (LAD 2025, TOR 2025, CWS 2005, ARI 2001) + a parts list. |
| `FeltPennant.dc.html` | **The reusable part.** Every felt pennant on the canvas is this file via `<dc-import>`. Tweaks: year, lg, city, nick, ws, logo, fill, trim, ink, w, tilt, ties. |
| `Rafter.dc.html`, `Stamp.dc.html` | Directions B and C (not chosen). |
| `TeamPage.dc.html` | 390px About band with a Pennants card (Brewers) and "came close" ghosts. Still uses the old rafter drawing. |
| `PlayerPage.dc.html` | 390px Mookie Betts: four pennants, two clubs, both leagues. |
| `Matrix.dc.html` | Eight edge cases (league of that year, era name, relocated club, long name, two-blue club, near-black club, no pennant, zero pennants). |
| Sticky notes | Rule checks (ADR-0030 club colour, ADR-0034 open surface, `?d=` cutoff), data gaps, ballpark references, and the research note. |

## The felt pennant part: how it works

- **Shape:** CSS `clip-path: path(...)` with cubic curves, so the edges sag and the tip droops.
- **Felt:** `felt.png` (384px seamless tile, mid-grey, made by `felt_texture.py`) laid over
  the club colour with `mix-blend-mode: soft-light`, a mirrored copy at 0.55, and a multiply
  copy at 0.18. Fold light is two `linear-gradient` layers above the text.
- **Sleeve:** trim colour, tube shading gradient, dashed running stitch, optional WS star.
- **Print filter** (`#felt-print`, inline SVG in the part), in this order:
  1. `feImage` felt tile → `feTile` → `feGaussianBlur 1` → `feDisplacementMap scale 1.5`
     (the felt bends the ink edge).
  2. `feTurbulence 0.003 0.006` → `feDisplacementMap scale 9×(w/460)` (a broad cloth wave;
     the whole word bends together).
  3. `feImage` fibre mask (`fibre-f1.png`) → `feTile` → `feComposite operator="in"`
     (about 1% of the finest felt fibres break the ink).
  The filter is applied to the text block and the logo. **Off below 240px wide.**
- **Lettering:** Yellowtail nickname with a hard offset print shadow in the trim colour;
  Barlow city and year line. Slight `perspective() rotateY(8deg)` so it shrinks toward the tip.
- **Logo:** the app's mono logo (`public/data/logos/mono/{teamId}.svg`, ADR-0031), which
  is a white `<rect>` drawn through a `<mask>`. Tinted by repainting that rect's `fill`
  to the ink colour, then uploaded as a canvas asset. In the app, use CSS `mask-image` with
  `background-color: <ink>` instead.
- **Asset ids on the canvas:** felt `2ff9185945b2cfc52d4b0ab507841d06`, fibre mask
  `2fdda1f62d2fe0e3f869125f38fa03fa`, logos 158 `402d8ce0…`, 119 `984f623a…`, 141 `ca0366b2…`,
  145 `3f0ac192…`, 109 `e808b2cf…`, 117 `63b8ed03…`, 111 `b5596ab9…` (full ids in the part
  and importer files).

## Render harness (how to see what you change)

The canvas cannot be rendered from a cloud container (claude.ai needs auth), so the look
was tuned in a plain-HTML copy of the part:

```bash
cd .scratch/pennant-vision-board/harness
DSF=2 NODE_PATH=/home/user/bbsbh/node_modules node shoot.cjs out.png variants-final.json params-final.json
```

- `harness.html` draws one pennant per entry in the variants JSON (the same CSS as the part,
  plus levers: `surface`, `logo`, `nickFont`, `nickScale`, `fold`, `multiplyTex`, ...).
- Params JSON sets the filter: `sd` (edge bend), `sw` (wave), `pct` (fibre mask file suffix).
- `shoot.cjs` must launch `/opt/pw-browsers/chromium` (the repo's Playwright build wants a
  browser that is not installed). Never run `playwright install`.
- Crop and view renders as JPEG under 250 KB; the Read hook refuses larger files.
- `assets/final-render.jpg` is the approved look. `round1-glitter.jpg` and `overworn.jpg`
  are failures to avoid.

## Lessons learned (read before you change the lettering)

1. **Look before you claim.** The first two "printed" versions were made blind and both
   failed. Render, crop at 2x, and judge every change.
2. **Random noise reads as dirt, not felt.** Ink gaps from `feTurbulence` looked like
   glitter or pepper. Gaps must come from the felt's own texture (research: displace and
   blend with the surface itself).
3. **Use only the fine fibres.** The felt's broad mottling knocked out whole letters
   ("MILWAUKEF"). High-pass the texture (subtract a 5px blur) before you threshold it.
4. **Precompute the mask; don't tune it in the filter.** Thresholds inside SVG filters hit a
   premultiplied-alpha trap (`feComposite arithmetic` with `k4` doubles the values after
   unpremultiply) and a very narrow working band. A percentile mask from `fibre_mask.py`
   is exact and easy to adjust (0.6/2.5 is right; 3% and up is too worn).
5. **`feImage` at negative x/y renders nothing.** An empty tile made the filter a no-op, or
   hid the text entirely. Keep `x="0" y="0"` and pad the filtered element instead, so
   letters at the box edge do not get clipped.
6. **No blur, no fuzz on the ink.** A blurred edge made the letters grey and smudged.
   Pennant ink is opaque and crisp; realism comes from bending with the cloth, sharing its
   light, and fibres breaking through.
7. **Dark blurred text shadows lift text off the surface.** Use a hard offset shadow in the
   trim colour, which reads as a second print colour.
8. **Bend words, not letters.** A high-frequency wave makes small type look like a broken
   font. Use a very low frequency (0.003 to 0.006) so the whole word bends.
9. **Small sizes need less.** Below about 240px the filter and the city line cost legibility;
   the part turns them off.
10. **Outline strokes + displacement tear.** `-webkit-text-stroke` under the filter made
    sliced glyphs. It was dropped.
11. **A part's default must not leak.** The logo prop once defaulted to the Brewers mark,
    so any importer that passed none showed the wrong club. Default to none for importers.
12. **Era check for marks.** Today's mark can contradict the era (Guardians "G" on a 2016
    "Indians" pennant). Those pennants show no logo.

## Canvas gotchas

- A child `.dc.html` `<helmet>` may hold only font links and `body{margin:0}`; a `url(...)`
  rule cannot go there. Use `<img src="/_blob/...">` for textures, and inline SVG for filters.
- `{{hole}}` booleans must be passed as holes (`ws="{{yes}}"`); a literal `"false"` is truthy.
- Sticky-note colours: gray, red, orange, green, teal, blue, purple, pink only (no yellow).
- The SVG filter on the canvas is **not verified** in the canvas runtime (it was verified
  in the harness only). If the board shows plain lettering, check how the runtime passes
  SVG filter attributes (`stdDeviation`, `xChannelSelector`, `preserveAspectRatio`, `href`).

## Data facts the board relies on

- LCS winners 2000 to 2025: `public/data/postseason-history.json` (rounds key `lcs`, with MVPs).
- Name and league per era: `public/data/franchise-history/{teamId}.json` (`spans`).
- Club colours: `src/lib/data/mlb-team-colors.json` (Toronto needs `accent` for trim:
  its primary and secondary are both blue).
- Pre-2000 pennants (for example Brewers 1982, Braves 1957) are not in the repo; a new
  generator is needed. The MLB Stats API as the source is an assumption, not checked.

## Suggested next steps

1. Gary checks the canvas. If the lettering is plain there, fix the runtime filter issue (above).
2. Port the new part look to `TeamPage.dc.html` (it still shows the old rafter drawing).
3. Decide the open questions, then write the ADR (pennant exception to the flat-style rules).
4. Build path in the app: a `Pennant` component (CSS + one inline SVG filter, `mask-image` for
   the mono logo), a pennant generator for pre-2000 history, and the `?d=` cutoff on the
   pennant list.

## Sources (research)

- Envato Tuts+, creased text with Displace: https://design.tutsplus.com/tutorials/how-to-create-a-realistic-creased-text-effect-using-the-displace-filter--cms-26494
- Adobe, displacement maps: https://www.adobe.com/products/photoshop/displacement-map.html
- Photoshop Cafe, displacement maps: https://photoshopcafe.com/best-way-to-make-displacement-maps-in-photoshop-wrap-anything-around-any-surface/
- Medialoot, text on a shirt texture: https://medialoot.com/blog/how-to-put-anything-on-a-shirt-texture-background/
- Codrops, text conforming with feDisplacementMap: https://tympanus.net/codrops/?p=37687 (blocked fetch; summary from search only)
- bwillcreative, Blend If: https://www.bwillcreative.com/?p=95381
- tutvid, blending text into photos: https://tutvid.com/photoshop/5-techniques-blend-text-photos-photoshop/
- SportsLogos.net forum, old pennant ink (secondhand): https://boards.sportslogos.net/topic/51668-old-pennants/
- Oxford Pennant, modern process: https://www.oxfordpennant.com/products/arizona-pennant
- Ballpark displays: https://lelands.com/bids/busch-stadium-roof-national-league-pennants , https://greyflannelauctions.com/?p=153606 , https://www.washingtontimes.com/news/2017/apr/10/banner-moment-cubs-finally-raise-championship-flag/ , https://crwflags.com/fotw/flags/us@b-.html
