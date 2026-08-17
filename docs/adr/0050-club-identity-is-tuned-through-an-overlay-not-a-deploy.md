# ADR-0050 — Club identity is tuned through a runtime overlay, not a deploy

Status: accepted (2026-08-16)

## Context

ADR-0044 settled where content is edited: on the page that renders it. The
Ballpark card's gear proved the shape — a control in the card's masthead,
visible only to the site owner, that turns the card into a form for its own
fields and saves to a runtime store. No deploy, and the thing being judged is on
screen while you judge it.

Club identity is the obvious next candidate and the one that could not simply
copy it. A club's treatment tiles, brand colours, header triad, stamp mark
placement and win-probability band are tuned by eye — that is the whole reason
they live as `src/lib/data/*.json` rather than as JS literals (ADR-0029) — and
they are tuned in `/identity-lab`, a dev-only route. An edit needs `npm run
dev`, a file write, a commit and a deploy. For values whose only test is "does
it look right on the real page", that loop is both slow and, like the ballpark
form before ADR-0044, partly blind.

**The Ballpark gear is cheap because its data is already a runtime store.** A
field is `t('ballpark.photo.{parkKey}')`; it resolves `defaults ← localStorage ←
/api/copy` through React context; a save is an allowlisted admin write to Redis.

Identity data has the opposite shape, and the difference is not incidental:

- `src/lib/data/*.json` is imported at **module load** and rebuilt into flat
  lookup tables (`tuningStore.js` → `teams.js`, `milbColors.js`,
  `headerTheme.js`, `wpa/*`).
- Consumers are **pure, synchronous functions** — `treatmentTile()`,
  `headerThemeFor()`, `markTransform()` — called from many components and from
  outside React entirely.
- The Lab's Save posts to a **Vite dev middleware**. ADR-0029 keeps that out of
  production with four independent layers, one of which greps `dist/` for
  `/__dev` and fails the build.

So the Lab's editor could not simply be un-hidden on a team page. Making the
identity layer async to suit one gear would have rewritten half of it, and would
have made every tile resolution a thing that can be pending.

## Decision

**An override overlay under the readers, and nothing above them changes.**

`src/lib/identity/` holds a module-level override map, a version counter and a
subscribe function. `tuningStore.js`'s `treatmentRecord`/`byTreatment`/`byTeam`
consult it before the bundled JSON. The bundled JSON stays the default, exactly
as the copy registry's defaults do. Nothing below `src/lib/` became async, and
no pure resolver changed its signature.

Two mechanisms carry it, and the second is the one worth remembering:

1. **`effectiveStore(bundled)`** — the bundled store with the overrides written
   in, memoized per version, copy-on-write per node. A store nothing overrides
   is returned **by identity**, so an unconfigured deploy — and every unit test —
   behaves exactly as it did before this existed.
2. **`liveTable(build)`** — the derived lookup tables are module-level
   `export const`s read as `TABLE[teamId]?.[treatment]` at call time, so a table
   is **refilled in place** when the overlay moves. The exported object identity
   never changes, and not one call site, resolver or test had to learn about the
   overlay.

**`api/identity.js` is a sibling of `api/copy.js`**: public cached GET, admin
PATCH through the existing `api/_lib/adminAuth.js`, same Upstash instance, its
own hash, 501 when unconfigured. Field ids are keyed per field and
last-write-wins, and an empty value clears the override —
`identity.mlbTuning.158.city-connect.scale`, `identity.colors.158.primary`,
`identity.mlbHeader.158.main.onBar`, `identity.stamp.158.away.offsetY`.

**A save is validated by the validators `scripts/lib/dev-data-stores.mjs`
already owns.** ADR-0029 pulled those out of `vite.config.js` so they could be
unit-tested apart from Vite; that is now load-bearing for a second reason. The
endpoint merges a proposed save into the shipped stores and runs the store's own
validator over the result, so one implementation serves both the dev file write
and the production write and the two cannot drift.

**Hydration is synchronous from a localStorage cache, then revalidated** — the
pattern `CopyProvider` uses, for a sharper reason. A late copy override is a
sentence changing; a late identity override is a club's mark visibly rescaling.
`main.jsx` applies the cache above `mount()`, so a returning visitor paints tuned
art on the first frame.

**The gear goes at the right end of the team hub header** (`/team/{id}`), in a
small action cluster with the Affiliate chip (MiLB) and Game Notes (MLB), and
tapping it opens a drawer BELOW the header rather than a modal over it. That
placement is the argument, not a layout preference: the header is themed from
this data, and the tiles, colours and stamps being edited are on the page, so
**the page is its own preview**. Draft values paint through the overlay's
render-only layer — one render path, no editor-only mock that agrees with the
real one right up until it doesn't. Selecting a jersey in the drawer's strip
also re-dresses the hero in that jersey, so tuning a club's City Connect is
visible rather than hidden behind a Main hero.

## Consequences

**Contrast became a runtime problem, so it is checked twice.**
`scripts/check-contrast.mjs` asserts `onBar` against `bar` at WCAG AA during
lint, and `test/header-theme.test.js` repeats it. A runtime edit passes through
neither. The drawer runs the same check in the browser — instantly, with the
ratio, on the bar you are looking at — and `api/identity.js` runs it again and
refuses a failing triad. Both judge the **effective** triad, override layered on
what ships, because a save that changes only `onBar` cannot be judged from the
patch alone. The threshold does not move; retune the pair.

**Stamp placement is retroactive, and now arrives sooner.**
`stamp-logo-tuning.json` is read at render time, so retuning a club restyles
stamps already minted and placed in someone's Game Log (ADR-0035's amendment).
That was always true; through the gear it lands at once rather than on a deploy
you control. It is the same change arriving sooner, not a new kind of change, and
the drawer says so in a kraft-taped note beside those four fields rather than
leaving it to be discovered.

**The Lab stays.** It gives thirty clubs side by side, the audit view, logo-art
upload and the recolour library — things a one-club gear cannot. It renders
through the same resolvers, so the two cannot disagree about what is landed, and
the raw stores it reads and POSTs are the overlaid views. Under `vite dev` the
overlay is always empty (`/api/identity` is a Vercel function; the dev server
serves none), so in the one place the Lab's Save works, it is still editing the
file byte for byte.

**A memoized identity read needs the version as a dep.** The tables refill in
place and `App` re-renders, but a `useMemo` whose other deps did not move would
hand back the pre-override value — the "live preview" that quietly is not one.
The four sites that memoize `headerThemeFor`/`treatmentTile` take
`identityVersion()` as a dep and say why. Same class of trap as ADR-0007.

**The spoiler rule is untouched.** Colour and mark data is identity, never
state. Every field id here is keyed on `(teamId, treatment)` and holds a colour
or a number; nothing in the overlay can be derived from a score, an inning or a
win probability, so `src/lib/CLAUDE.md`'s "rule that must not drift" holds
unchanged and ADR-0029's spoiler analysis needs no revision.

**Two things stayed out of v1 on purpose.** Logo-art upload and the recolour
library take raw bytes and rebuild a manifest from disk; `api/ballpark-photo.js`
plus Vercel Blob is the precedent if that is ever wanted. And a club's
researched `extras` — plus a MiLB affiliate's colour pair, with its
`confidence`/`source`/`found: false` provenance — are not in the drawer, because
**nothing on the team hub renders them**. A control whose effect you cannot see
on the page holding it is the Lab's job, and putting one here would have broken
the one promise this placement makes.

**`api/` grew past the directory-size guard and took a budget entry.** A file in
`api/` IS a URL: subdividing renames a live endpoint, and the rename fails
silently into every client's "not configured" degrade. The twelve endpoints stay
flat and the budget records the decision, which is the deliberate exception
ADR-0038's guard asks for rather than a directory awaiting subdivision.

## Amendment (2026-08-17): the logo dimension, and the drawer became visual

The first of the two v1 exclusions above is reversed. The drawer now carries a
**`logo` dimension** (`identity.logo.{teamId}.{slot}`, slots = the MLB
treatment vocabulary plus MiLB's `home`/`away`): a URL per tile mark, layered
into a new bundled-empty store (`src/lib/data/logo-url-overrides.json`) and
consulted by `teamLogoUrl`/`mainOverrideLogoUrl` ahead of every disk/CDN rung
(`src/lib/identity/logoUrlOverrides.js`). The bytes go exactly where this ADR
predicted: **`api/identity-logo.js`**, the ballpark-photo pattern applied to a
club's mark — admin-gated, Vercel Blob, held to `src/lib/logoArt.js`'s same
512×512-PNG standard, and *uploading is not saving*: the endpoint answers a URL
and the URL only lands through the drawer's ordinary Save. The recolour
library, a club's `extras`, and an affiliate's researched pair still live only
in the Lab, for the unchanged reasons above.

The same round made the drawer visual, holding the one-render-path rule: the
jersey strip renders each treatment as its real `TeamTreatmentMark` tile, the
logo group shows the tile at judging size, and the Stamp placement group draws
two REAL `GameStamp`s (away and home slots) above its four fields — for a game
fabricated as a literal in `IdentityStampPreview.jsx`, which is why that file
could join `check-stamp-surfaces.mjs`'s allowlist even though, unlike the Lab's
editor, it ships in production (the safety case is the fabricated literal, not
the admin gating). Colour boxes gained an EyeDropper-API picker where the
browser has one. `teams.js` crossed its file-size ceiling for the two hook
sites and took a documented raise; `api/` took its budget to 14 for the new
endpoint, on the rename-is-an-outage argument already recorded above.
