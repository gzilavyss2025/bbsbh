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
  the nightly batch's Monday-only weekly block, right behind `gen-teams.mjs`,
  so coverage tracks `teams.json`, and it is the cheapest
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

## Amendment (2026-08-07): the CDN source is also pickable, per club

The ink/knockout pins above fix a bad CLASSIFICATION of a club's real art.
They can't fix bad ART — and mlbstatic's plain `base` mark is sometimes worse
than it needs to be, mostly at the lower MiLB levels: a busier crest that
converts to a knockout worse than the cleaner mark the same CDN already
carries under a different path. `TeamLogo`'s sketcher already draws from three
other marks per club (`primary`, `cap`, `wordmark` — verified live to be real,
distinct art at every level, not the base logo echoed back), so the fix isn't
new art, it's pointing the existing pipeline at art that was already there.

A club's mono-ink.json entry may now carry a `source` field alongside its
pins — `'base'` (the default, needing no entry at all) or one of the three
`LOGO_VARIANTS` keys. Three decisions worth recording, same shape as the pins
amendment above:

- **A fetch-URL choice, not art applied to shapes.** `sourceVariantFor`
  (`scripts/lib/mono-logo-art.mjs`) has no fingerprint check the way `pinsFor`
  does — there's no shape list that could point at the wrong shapes if the
  source moved, only a different URL to fetch before the same conversion runs.
  Both the nightly generator and the dev regenerate route read it from the
  same store, so they can't disagree about which mark a club wears.
- **One base URL, in one place.** `src/lib/logoCdn.js` is a dependency-free
  leaf module now shared by `teams.js` (the browser) and
  `scripts/lib/mono-logo-art.mjs` (plain Node, run outside Vite) — the two
  paths that must build byte-identical CDN URLs can't drift into building them
  two different ways.
- **Picked by eye, next to the pins.** The Knockout mark editor's source
  picker (`MonoInkEditor.jsx`) refetches and reconverts on every click, so
  comparing Base against Primary against Cap is immediate — the same
  judgment-by-looking the pins amendment already established for this editor,
  one level up the pipeline. Switching sources drops any in-progress
  (unsaved) pins: shape indices from the old source's art don't mean anything
  against the new source's, so they'd otherwise misapply to whichever shape
  happens to share that index.

Game Log stamps (`GameStamp.jsx`) need no separate change: they already draw
the one file this generator produces (`hasMonoLogo` + `teamLogoUrl(id,
'mono')`), so a better source for the masthead mark is a better source for
the stamp mark for free.

## Amendment (2026-08-07, second): a club may swap the City Connect bar's mark for its own PNG

Both amendments above still answer the same question — which SOURCE feeds
the automatic one-color conversion — for one club-wide mark every bar shares.
This one is different in kind: a club may now REPLACE that mark, wholesale,
for exactly one bar.

**Why one bar, not the mark itself.** A club's City Connect identity is
sometimes its own thing entirely — a wordmark, an alternate crest — that no
amount of ink/knockout tuning of the base CDN mark will reproduce, because
the source art it would tune simply isn't that design. Rather than stretch
the knockout pipeline to cover art it was never given, a club may drop in a
finished PNG that draws on the City Connect bar ONLY; every other bar (Main,
every alternate) keeps drawing the one club-wide knockout mark untouched.

- **Read straight off disk presence, same discipline as `mainOverrideLogoUrl`.**
  `teams.js`'s `cityConnectMastheadUrl(teamId)` checks `logo-art.json`'s
  `masthead-city-connect` entries — the manifest `scripts/lib/dev-logo-upload.mjs`
  already rebuilds from disk on every upload — and answers `null` for a club
  with no file there. Null is not a placeholder to fill in later; it's the
  overwhelming default, and it is exactly what makes "don't give me one and
  it falls back to the automatic mark" true without any code path that
  treats "no override" as a special case.
- **A NEW synthetic upload destination, same shape as the `-wpa` family.**
  `'city-connect-masthead'` in `logoArt.js`'s `LOGO_TREATMENT_DIRS` is never a
  real treatment (it appears in no jersey record, no `mlb-treatment-tuning.json`
  entry) — only here and in the Identity Lab's upload control — so it rides
  the existing upload endpoint, its existing 512×512/400 KB PNG standard, and
  its existing traversal-proof path resolution with no server change at all.
- **`TeamLogo`'s `overrideUrl` prop tries the override FIRST, then falls
  through to the normal chain on failure** — the same self-healing shape the
  variant→base→monogram chain already had, just with one more rung ahead of
  it. A club whose override file goes missing (a bad deploy, a hand-deleted
  file) quietly gets its ordinary knockout mark back instead of a broken
  image; nothing has to notice or handle that case specially.
- **Never re-inked.** The knockout mark is re-inked dark on a light bar
  (`.is-themed--dark .metricbar__logo`) because it is a flat silhouette with
  nothing left to lose by filtering. An uploaded override is finished art —
  the club's own deliberate color choice for that specific bar — so
  `.metricbar__logo--custom` (a second class, beating the re-ink rule on
  specificity rather than `!important`) turns the filter back off. This is
  why the upload standard tells the owner to paint it in whatever color
  reads against that exact bar rather than leaving it white: nothing recolors
  it at render time the way the mono mark's mask does.
- **Identity-only inputs, same invariant as the theme it rides on.**
  `TeamInfo.jsx` only reaches for the override when `treatment === 'city-connect'`
  for THIS specific side (own club or opponent, computed once beside `theme`/
  `oppTheme`) — the same `(teamId, treatment)`-only rule `headerThemeFor`
  documents at the top of `headerTheme.js`. MiLB has no City Connect
  vocabulary at all, hence the `isMlbTeamId` guard alongside it.
- **Uploaded from the bar itself.** The Identity Lab's Header bars panel
  (`TwoBarsPanel.jsx`) wraps the City Connect bar's own live mock in
  `LogoDropZone` — drop a PNG directly onto the bar you're judging it
  against, not a separate upload panel elsewhere on the page. The mock's
  `HeaderBarMock` carries the exact same `overrideUrl`/no-re-ink treatment
  the real masthead does, so what's approved there is what ships.

### Addendum (2026-08-07): that override may also be pasted in as SVG source

The amendment above gives the City Connect bar one way in — drop a finished
512×512 PNG on the bar itself. This adds a second, for the same slot and under
the same rules: paste the mark's SVG source into the lab's **City Connect bar
mark** panel, name it, and pick it.

**Why a second way.** Club art arrives as often as markup as it does as a file,
and a PNG is a fixed 512 px where this bar bleeds the mark to its full height —
vector stays crisp there. Nothing about the slot changes; only how the bytes
get in.

- **No new machinery, and no new store.** A paste rides the two dev endpoints
  the Logo art editor's recolors already ride
  (`scripts/lib/dev-custom-marks.mjs`): SAVE writes
  `public/team-logos/custom/{teamId}-{slug}.svg` and adds it to the club's
  library; ASSIGN points one key at one library mark. The key is the same
  synthetic `'city-connect-masthead'` the amendment introduced, which
  `assignCustomMark` already accepts because it is in `LOGO_TREATMENT_DIRS`.
  Server-side: unchanged.
- **The library's two rules carry over intact.** Saving never overwrites (a
  taken name is a 409), and wearing a mark is a POINTER — clearing it hands back
  whatever the bar had before, an uploaded PNG or the club-wide knockout mark.
- **An assignment outranks the uploaded PNG**, and that ordering is deliberate:
  the pointer is the one a click can undo, so letting a PNG beat it would make
  the pointer unusable on any club that ever had one dropped on it.
  `pickCityConnectMasthead` (`teams.js`) is that precedence on its own, pinned in
  `test/teams.test.js` without needing a real entry in the committed store — the
  same split `customMarks.js` makes for `parseMarkAssignmentKey`.
- **A `cdn:` assignment is ignored here, not resolved.** The library's other
  assignment kind points at one of the CDN's stock vectors, and that is exactly
  the art the knockout pipeline already converts — resolving one into this slot
  would put a full-color mark on a bar nothing re-inks.
- **Parsed, not filtered, before it is posted.** The pasted markup goes through
  `src/lib/svgSanitize.js` (a real `DOMParser` pass, see that file's header) in
  the browser, so what previews is what posts, and markup that isn't SVG says so
  before a request is made. `describeMarkRejection` server-side is still the
  backstop for a hand-crafted POST.
- **Judged against the bar, like its PNG sibling.** The panel draws the same
  `HeaderBarMock` the Header bars panel does, showing the paste in progress on
  this club's own City Connect colours with the same no-re-ink treatment the
  real masthead uses. It sits stacked directly under the Knockout mark editor
  (`.idlab__markstack`) because it is the exception to exactly that rule, and it
  renders for no club without a City Connect bar — every MiLB affiliate, and the
  two `NO_CITY_CONNECT` clubs.

**A paste may also be CONVERTED, not just kept.** The panel offers the same
shape-by-shape ink/knockout verdicts the Knockout mark editor does, applied to
the paste instead of to the club's CDN art — for City Connect art that arrives
in full colour but wants to read as one colour on that bar. Three things make
that safe to bolt on rather than a second pipeline:

- **One picker, shared.** `editors/ShapeInkPicker.jsx` is the clickable art and
  the numbered verdict list, used by both editors; `logoMono.js` already numbers
  shapes once, so shape 3 means the same thing in each. Neither editor holds the
  other's pins — this one's are per paste and are dropped with it, since an index
  into one mark's shapes means nothing against another's.
- **The ink is BAKED IN at save time.** `logoMono.js` emits `fill="#fff"` because
  the club-wide mono mark is re-inked by CSS at render; this slot's contract is
  the exact opposite (`.metricbar__logo--custom` turns that filter off), so a
  white silhouette saved here would vanish on a light bar. The panel swaps that
  one attribute for a colour picked against the bar — defaulting to its own
  `onBar` — and what lands on disk is finished art either way. `logoMono.js` gains
  no option the generator would then have to carry, and the renderer learns
  nothing new.
- **An empty conversion is refused, never quietly downgraded.** Pin away the last
  ink shape and `monoLogoSvg` rightly bails; in that state the panel saves
  NOTHING and says why, rather than falling back to the full-colour paste — which
  is the one result turning the mode on was meant to avoid.

**Every bar gets one, not just City Connect — and the key is the BAR.** The
addendum above shipped on the one bar that already had an override slot. The
same panel now mounts inside every bar unit: MLB's Main, MLB's City Connect,
and MiLB's single bar. `teams.js`'s `mastheadMarkUrl(teamId, bar)` is the one
resolver behind all three, and `cityConnectMastheadUrl` is gone rather than kept
as a second name for it.

- **A club has fewer BARS than jerseys, and that is the whole grouping.**
  `treatmentHeaderColorOverride` already sends Main and every alternate to one
  bar and City Connect to the other; `milbHeaderColorOverride` already sends Home
  and Away to a single bar. `mastheadBarFor(teamId, treatment)` collapses a
  jersey onto its bar the same way, so dressing "the Main bar" dresses Main and
  every alternate at once — the same answer the colour triad above it gives.
  Anything finer would be a promise the header theming itself doesn't make.
- **`TeamInfo.jsx` needed no MiLB special case any more.** It used to guard the
  override with `isMlbTeamId(...) && treatment === 'city-connect'` because City
  Connect is an MLB-only vocabulary. MiLB is now simply the third bar, so both
  sides resolve through one call and the guard came out.
- **Two of the three keys are assignment-only.** `city-connect-masthead` is both
  a `LOGO_TREATMENT_DIRS` upload destination (from the second amendment) and a
  masthead key; `main-masthead` and `milb-masthead` are keys with no directory,
  so a paste is the only way into them. The dev assign endpoint therefore accepts
  `MASTHEAD_MARK_ASSIGN_KEYS` alongside the real treatment directories — the one
  server change the whole feature needed.
- **The keys live in `teams.js`, not `logoArt.js`**, even though one of them is
  also an upload directory there. `logoArt.js` imports `teams.js`; declaring them
  the other way round would close an import cycle for a constant neither the
  manifest builder nor the disk sweep reads.
- **Bars stay isolated, and a test says so.** The two MLB bars read different
  keys, so a club wearing a pasted City Connect mark still draws the automatic
  knockout mark on Main. `test/teams.test.js` asserts that over whichever clubs
  are actually dressed in the committed store, rather than over a fixture.
