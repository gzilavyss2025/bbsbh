# One-color club marks are precomputed knockout art, not a CSS filter

The navy section mastheads on the lineup, innings, and box score pages
(`SectionMasthead`'s `logo` prop — Batting order, Starting pitcher, Defense,
Due up next) carry the club's mark in a single ink color against the bar. That
mark is now a **precomputed knockout SVG** — `public/data/logos/mono/{teamId}.svg`,
built by `scripts/gen-mono-logos.mjs` from `src/lib/logoMono.js` — served
same-origin and requested through `TeamLogo`'s `mono` variant.

It used to be the full-color mlbstatic mark under
`filter: brightness(0) invert(1)`. That filter crushes every opaque pixel to
the same white, and a filter has no way to tell a logo's own shapes apart from
the paper those shapes are drawn against. Any mark whose interior detail is
defined by a light fill — an outline ring, knocked-out lettering, negative
space painted white rather than left transparent — flattened into an
unreadable solid blob. The escape hatch was a hand-listed set of four MLB
clubs (`MASTHEAD_LOGO_NATURAL_COLOR`: Cubs, Astros, Blue Jays, Brewers) that
rendered in full color instead. That list was never going to hold: it covered
MLB only, and the same failure hits the MiLB levels the app also scores, where
mascot marks with cream or white grounds are the norm and there are hundreds
of clubs to enumerate.

**Re-ink the art instead of filtering it.** Each fill in the source SVG is
classified as INK (part of the mark) or KNOCKOUT (paper it sits on), and the
file is rebuilt as an SVG `<mask>` — ink opaque, knockout punched out — with
one `currentColor`-equivalent rect drawn through it. Stacking order carries
the meaning it already had: a knockout shape erases the ink beneath it exactly
as it overpainted it in the original, so the navy bar shows through the holes
and the mark reads as one color with its structure intact. The rebuilt art's
own alpha *is* the mark, so the same file also works as a CSS `mask-image` if
a surface ever needs the mark in a different ink.

Three things about this shape are deliberate:

- **Precomputed, not converted in the browser.** The conversion needs the SVG
  source, and fetching it per logo would add a round trip to a page already
  waiting on a live feed, pop the mark in after paint, and mean injecting
  remote markup into the DOM. Following the build-time-fetch pattern
  (`src/api/CLAUDE.md`) makes it a plain `<img src>` at runtime. It rides
  `update-teams.yml` so coverage tracks `teams.json`, and it is the cheapest
  generator here: one CDN fetch per club, no statsapi enumeration of its own.
- **Coverage is allowed to be partial.** A club with no knockout file — new
  affiliate, art that can't be re-inked — falls through `TeamLogo`'s existing
  variant → base chain to its full-color mark, which is what the four
  exception ids did before and reads acceptably. No manifest, no gate, no
  code change to light a club up: the file existing is the whole mechanism.
  `MASTHEAD_LOGO_NATURAL_COLOR` and `mastheadLogoClass` are gone.
- **The ink/paper split is a heuristic over art nobody controls**, so it is
  tuned by looking, not by reasoning: `--sheet` renders every club's original
  beside its knockout. Two bands classify as paper — near-white at any
  saturation (the creams and pale peaches MiLB art grounds its mascots on),
  and light-but-unsaturated (greys and silvers used as outline). A light
  SATURATED color stays ink, because that's a brand color — the Brewers' gold,
  the tans in Biloxi's oyster — and knocking those out would punch the same
  holes the old filter did, only inverted. Both thresholds are named constants
  in `logoMono.js` with the clubs that pin them named in the tests.

A mark drawn entirely in mid-tone colors with no light ground at all (Bowling
Green's navy-on-orange monogram) still renders as a silhouette — one color
genuinely cannot separate two mid-tones. That's the floor of the approach, not
a regression: those marks flattened identically under the old filter.

The one remaining `brightness(0) invert(1)` in the app is `.gamestory__link`'s
pointer-hover treatment, which recolors a card's logo to match a team-colored
row. It has the same blind spot, but it's a transient desktop-hover state
(`@media (hover: hover)`, so never on the phone this app is built for) on a
surface whose fallback is simply the plain card look.
