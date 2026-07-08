# Historical MiLB team logos — asset manifest

`src/lib/teams.js`'s `teamLogoUrl()` pulls every current club's mark live from
the mlbstatic CDN (`https://www.mlbstatic.com/team-logos/{teamId}.svg`), keyed
by the team's CURRENT statsapi id. That CDN has no historical marks — a
pre-2020 career-timeline stop for, say, the Huntsville Stars renders today's
Rocket City Trash Pandas logo instead (same statsapi id, see
`public/data/milb-history.json`'s `nameHistory` entries and its `caveats`
field for why the id is shared). This file lists the art needed to fix that,
for whenever it gets sourced — **nothing in the app reads these files yet**;
see "Wiring it in" below for the integration point once they exist.

## Where to put the files

Create `public/logos/historical/` and drop each file there under the exact
`logo` filename already referenced by `public/data/milb-history.json`'s
`nameHistory` entries (so the eventual wiring is a one-line join, not a
rename pass). That keeps historical art alongside `public/data/*.json` as a
same-origin static asset — no new CDN dependency, consistent with the rest of
the app's "no backend" rule.

## Format & sizing

- **Format**: PNG with a transparent background (no matte/canvas color) —
  matches the "manila paper" surfaces the mark can be composited over
  (`--surface-card`, the logo-tint wash `fetchTeamLogoTint` derives, etc.).
  SVG is preferable if you can source/trace one (scales perfectly, like every
  current-day mark), but a clean transparent PNG is fine.
- **Dimensions**: **512×512px**, logo centered in a roughly square bounding
  box with a small margin (mirrors the "every club drawn to one square
  viewBox" convention in `teams.js`'s comment block). 512px covers the
  largest current on-screen use of `<TeamLogo>` at 2x pixel density — the
  sketch/print modal (`components/LogoModal.jsx`) renders at `size={240}`;
  every other caller (career timeline `42`, team page `64`, game card `56`,
  etc.) is smaller. Don't ship anything below 256×256 or it'll look soft in
  that modal.
- **Content**: the wordmark/roundel as it actually appeared during the named
  era — not a modern redraw. A scan, a press-kit PNG, or a clean vector trace
  of a period photo are all fine; legibility at small sizes (the 16-42px
  range most callers use) matters more than perfect fidelity.

## The manifest

| Filename | Represents | Years | Notes |
|---|---|---|---|
| `huntsville-stars.png` | Huntsville Stars (Southern League, Double-A) | 1985–2014 | statsapi id 559 — today's Rocket City Trash Pandas (Angels). See `milb-history.json` caveats re: this id's contested lineage. |
| `new-britain-rock-cats.png` | New Britain Rock Cats (Eastern League, Double-A) | 1997–2015 | statsapi id 538 — today's Hartford Yard Goats (Colorado Rockies). Pure rename/relocation, no parent-org change. |

That's the full list this research pass produced — deliberately short (see
`public/data/milb-history.json`'s own `scope` note: this is a thin, hand-picked
set, not every MiLB rename ever). Candidates NOT included, with why:

- **Mobile BayBears → Rocket City Trash Pandas**: real per most press
  coverage, but statsapi tracks these under TWO DIFFERENT ids (417 vs. 559) —
  a `nameHistory` entry needs one shared id, so this doesn't fit the schema as
  built. If you want a "Mobile BayBears" logo anyway (id 417 predates its own
  2019 inactive-flag), it'd need a schema change first (a `nameHistory` entry
  that spans ids) — flagged here rather than silently added.
- **Colorado Springs Sky Sox → San Antonio Missions**: same shape of problem
  (id 551 vs. 510) — see `milb-history.json` caveats.
- **Amarillo Sod Poodles**: press frames this as the San Antonio Missions'
  Double-A club relocating in 2019, but statsapi shows id 5368 with
  `firstYearOfPlay: 2018/2019` and no prior name under that id — no rename to
  depict.
- Every other MiLB rename in history (there are dozens) — simply not
  researched in this pass. Add a row here + a `nameHistory` entry in
  `milb-history.json` if/when one comes up.

## Wiring it in (not done yet — by design)

`src/api/milbHistory.js` already exposes `historicalClubName(teamId, year)`,
which resolves to `{ name, city, logo }` for a covered (team, year) — the
`logo` field is exactly the filename in the table above. Nothing calls it yet
because:

1. No image files exist yet (this doc IS the request for them).
2. Swapping which image renders needs a new `<TeamLogo>` capability (an
   explicit local-asset override), not just a CDN url swap — `TeamLogo`'s
   fallback chain (`variant` → `base` → monogram) has no notion of "render
   this local file instead," so that's a small, deliberate follow-up change,
   not a data-only one.

Once art lands in `public/logos/historical/`, the shape of the fix in
`src/components/CareerTimeline.jsx` (and optionally `TransactionTimeline.jsx`)
is: resolve `historicalClubName(e.teamId, e.minSeason)` alongside the existing
`historicalParentOrg` call in `src/api/loadPlayer.js`, and when it returns a
`logo`, pass `/logos/historical/{logo}` into a new `<TeamLogo>` prop (e.g.
`src`) that short-circuits the CDN url and skips straight to rendering it,
still falling back to the monogram on a 404. The parent-org fix already wired
in (see `loadPlayer.js`) is a good model: prefer the historical override,
fall back to today's live value, never break when nothing is covered.
