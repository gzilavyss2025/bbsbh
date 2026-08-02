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

## Amendment (2026-07-31): the heuristic gets an escape hatch, per shape

The bands above are right about most clubs and wrong about specific SHAPES of a
few — and that wrongness is not the kind a threshold fixes, because moving a
band to rescue one club's cream ground knocks out another club's gold. Retuning
is a global act; the errors are local.

So a club may now PIN individual shapes: `src/lib/data/mono-ink.json` maps a
shape's ordinal in the art to `ink` or `knockout`, applied by `monoLogoSvg`
AFTER the automatic pass — a pin set stays a short list of corrections rather
than a transcription of the whole mark, so a later improvement to the bands
still reaches every shape nobody pinned. Four decisions worth recording:

- **Pins, not hand-edited art.** `gen-mono-logos.mjs` rewrites
  `public/data/logos/mono/` from scratch on every run (a rebrand must not leave
  a stale mark behind), so a hand-edited file would survive exactly until the
  next nightly. The pins are the durable artifact; the SVG stays generated.
- **Picked by eye, in the lab.** `/identity-lab`'s Knockout mark editor loads
  the club's real CDN art, stamps every shape with the index a pin uses
  (`monoLogoPickerSvg`), and previews the converted mark on that club's own
  header bars. Save writes the store and asks the dev server to regenerate that
  one file through the same `scripts/lib/mono-logo-art.mjs` the generator uses,
  so what was approved on screen is what lands on disk. Judging a knockout mark
  is a looking problem; the tool had to be a looking tool.
- **Pins expire when the art moves.** A saved set carries a
  `monoLogoFingerprint` of the source it was picked against — shape count and
  geometry, so a recolor keeps the pins and a redraw doesn't. Different art
  means the pins are dropped, the club converts automatically, and the run
  reports it. Shape 3 of a rebranded logo is not the shape anybody looked at,
  and a confidently wrong mark is worse than an unreviewed one.
- **A pin lands as an inline `style`**, because a CSS rule in the art's own
  `<style>` block beats a `fill=` attribute — it's the one paint that reliably
  wins. A stroke is repainted only when the shape already draws one: handing a
  stroke color to a shape without one turns SVG's 1px default on and outlines
  something that was never outlined.

The same shape-picking machinery grew a second use immediately: the **Logo art**
editor beside it repaints shapes in FULL color to build the alternate / City
Connect art the CDN doesn't carry (`src/lib/logoRecolor.js`,
`src/lib/customMarks.js`). Both editors index shapes by the same ordinal, so a
shape means one thing across the row; only the verdict differs — ink-vs-paper
for a one-color mask, versus a hex. Wearing a recolored mark is an assignment
teams.js resolves ahead of disk presence, never a copy over procured art; see
`src/lib/CLAUDE.md`.

This is also the one place the app inlines remote SVG markup into a document
rather than pointing an `<img>` at it — the thing the "why precompute" section
above lists as a cost of converting in the browser. It has to: a shape can't be
clicked through an `<img>`.

**Sanitizing that markup is a PARSE, not a filter** (`src/lib/svgSanitize.js`),
and the first version got this wrong. It stripped `<script>` elements and `on*`
handlers with two regex replaces, which CodeQL flagged on the way in with two
concrete holes: `</script\t\n foo>` is a valid closing tag no such pattern
matches, and a single replace pass can CREATE what it removes
(`<scr<script>ipt>` becomes `<script>`). Neither is fixable with a better
pattern — the technique is the bug. `DOMParser` resolves the real tree first, so
there is nothing left to smuggle past a pattern, and unparseable markup returns
null rather than a best-effort string. Do not reintroduce a regex here.

One consequence worth keeping straight: the knockout editor holds BOTH forms of
the art. The fingerprint, the shape list, and the converted preview are taken
from the RAW markup, because the generator converts raw CDN bytes and a
fingerprint taken from anything else could read as stale server-side and
silently drop that club's pins. Only the markup actually inlined is the
sanitized form. The two enumerate the same shapes because sanitizing removes
only script- and `foreignObject`-class elements, none of which are drawable.

The one remaining `brightness(0) invert(1)` in the app is `.gamestory__link`'s
pointer-hover treatment, which recolors a card's logo to match a team-colored
row. It has the same blind spot, but it's a transient desktop-hover state
(`@media (hover: hover)`, so never on the phone this app is built for) on a
surface whose fallback is simply the plain card look.

## Amendment (2026-08-02): a version in the URL, so a deploy doesn't wait on cache expiry

The deployed PWA serves these SVGs `CacheFirst` (`vite.config.js`) so a
revisited club's mark works offline at the park. That collided with the pin
workflow above: a browser that had already cached a club's mark kept serving
the OLD file until that cache entry's own 30-day expiry, even though the
corrected art (approved in the lab, landed via `mono-ink.json`, regenerated,
and deployed) was already sitting on the server. The lab itself never showed
this — it fetches and converts fresh in the browser on every load — so the
divergence only ever showed up as "the site doesn't match the lab," and only
on a device that had visited before.

`scripts/gen-mono-logos.mjs` now also writes `src/lib/data/mono-logo-manifest.json`,
a `teamId -> content hash` of that club's converted SVG. `teamLogoUrl`
(`teams.js`) appends it to the `mono` URL as `?v=`. Workbox keys its cache on
the full request URL including the query string, so a club whose art changed
gets a new URL and therefore a guaranteed cache MISS — the old entry is
simply never requested again — while a club whose art didn't change keeps the
same URL and stays a cache HIT, costing nothing. The version in the URL IS
the cache-busting mechanism; nothing reaches for `skipWaiting`, `clientsClaim`,
or an `ignoreSearch` override. The dev-only regenerate route (`writeMonoLogo`,
`scripts/lib/mono-logo-art.mjs`) updates the same manifest for the one club it
touches, so a local save and a full generator run can never disagree about a
hash.
