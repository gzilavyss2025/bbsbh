# Club identity overrides — the runtime overlay behind the team hub's gear

The reference for `src/lib/identity/`, `api/identity.js` and
`src/screens/team/modules/identity/`. The *why* is **ADR-0050**; the data model
these override is **`src/lib/CLAUDE.md`**. Read both before changing anything
here.

## What it is, in one paragraph

A club's tile tuning, brand colours, header triad, stamp mark placement and
win-probability band ship as hand-tuned JSON in `src/lib/data/*.json`. The site
owner can override any of it **at runtime**, from that club's own `/team/{id}`
page, with no deploy. The bundled JSON stays the default. Everything below
`src/lib/` stayed synchronous and no pure resolver changed its signature.

## The seam

```
src/lib/identity/
  fields.js             the CLOSED field catalog: id grammar, value kinds,
                        sanitize/merge, and the WCAG threshold
  apply.js              layer an override map onto ONE bundled store (pure)
  overlay.js            module state, version counter, subscribe,
                        effectiveStore(), liveTable()
  hydrate.js            localStorage cache + the revalidating fetch
  useIdentityVersion.js the React subscription (mounted at App's root)
  stores.js             every bundled store, in one map — SERVER-ONLY
```

Three things are load-bearing:

- **`effectiveStore(bundled)`** returns `bundled` **by identity** when nothing
  overrides it. That is what keeps a deploy with no override store — and every
  unit test — byte-for-byte the app it was before this existed.
- **`liveTable(build)`** refills a derived table **in place** when the overlay
  moves. The derived tables are module-level `export const`s read as
  `TABLE[teamId]?.[treatment]` at call time, so refilling one is enough and no
  call site had to learn the overlay exists. (Mutating an exported table was
  already this layer's convention — `test/header-theme.test.js` writes into
  `MILB_HEADER_COLOR_OVERRIDES` and deletes the key after.)
- **Registration lives in the consuming module**, never in one file that imports
  every store. `src/lib/wpa/wpaDefaults.js` exists so `data/wpa-tuning.json`
  stays out of the eager entry chunk; a central registry would undo that. That
  is also why `stores.js` is server-only and says so at its top.

### Two layers, one persisted

`overrides` is what the store holds and what a reload restores. `preview` is the
drawer's unsaved draft, applied so the page being edited IS the preview, and
dropped on Cancel. Nothing ever writes `preview` anywhere.

### A memoized identity read needs the version as a dep

The tables refill in place and `App` re-renders (it subscribes through
`useIdentityVersion`), but a `useMemo` whose other deps did not move hands back
the pre-override value. `TeamHubShell`, `TeamInfo` and `BoxScore` take
`identityVersion()` as a memo dep and say why at the call site. **Any new
component that memoizes `treatmentTile`/`headerThemeFor`/`markTransform` must do
the same.** Same class of trap as ADR-0007.

## Field ids

```
identity.{dimension}.{teamId}.{…}
```

Last-write-wins per id. An **empty value clears** the override rather than
storing a blank — the same delete semantics `mergeOverrides` has for copy.

| Dimension | Store | Path in the store | Fields |
| --- | --- | --- | --- |
| `mlbTuning` | `mlb-treatment-tuning` | `{team}.treatments.{treatment}.{field}` | `scale`, `offsetX`, `offsetY`, `originY`, `pinstripeColor`, `pinstripeBg`, `bgHex` |
| `milbTuning` | `milb-treatment-tuning` | `{team}.treatments.{side}.position.{field}` | `scale`, `offsetX`, `offsetY`, `bg`, `pinstripeBg` |
| `mlbHeader` | `mlb-treatment-tuning` | `{team}.treatments.{bar}.header.{field}` | `bar`, `accent`, `onBar`, `markScale` |
| `milbHeader` | `milb-treatment-tuning` | `{team}.treatments.{side}.header.{field}` | same four |
| `tileBg` | one of the five `*-colors` stores | the `bg: true` swatch | (no field segment) |
| `colors` | `mlb-team-colors` | `{team}.{field}` | `primary`, `secondary`, `accent`, `accent2`, `offDayTreatment`, `defaultHomeTreatment`, `defaultAwayTreatment` |
| `stamp` | `stamp-logo-tuning` | `{team}.treatments.{side}.{field}` | `scale`, `offsetX`, `offsetY`, `rotation` |
| `wpa` | `wpa-tuning` | `{team}.bandColor` | `bandColor` (team-level fallback) |
| `wpaTreatment` | `wpa-tuning` | `{team}.treatments.{treatment}.{layout.field \| field}` | `size`, `rotate`, `offsetX`, `offsetY`, `paddingX`, `paddingY`, `rowShift` (all under `layout`), `band`, `wpaWordmark`, `ownArt` |
| `milbWpaTreatment` | `milb-treatment-tuning` | `{team}.treatments.{side}.{wpaLayout.field \| field}` | same seven layout numbers (under `wpaLayout`, not `layout`), `band`, `wpaWordmark` (no `ownArt`) |
| `logo` | `logo-url-overrides` | `{team}.{slot}` | (no field segment — an https URL per tile mark) |
| `mono` | `mono-ink` | `{team}.{field}` | `parts` (a shape-index pin map, JSON-encoded), `source`, `art` |
| `parkWash` | `park-wash-tuning` | `{team}.{field}` | `color` (team-level, no treatment segment) |

**`parkWash` is colour only, and it used to be colour and strength.** The wash
laid over a slate card's ballpark photo (`src/lib/ballpark/parkWash.js`,
`src/styles/06a-gamecard-parkart.css`) had an `intensity` field beside the
colour, landed at 0.55 and tuned to roughly 0.8 for most of the thirty clubs.
The site owner asked for one full-strength wash for every club, so the field
left this catalog and the CSS prints `opacity: 1` outright. **That removal is
also the migration**: this catalog is closed, so `sanitizeIdentityOverrides`
drops `identity.parkWash.{team}.intensity` on the API's read as well as its
write, and the ~30 stored values went inert with no data edit and no deploy
ordering to get right. Restoring the dial means restoring the field — the old
values are still in Redis, unread. WHICH colour a park wears stays per club,
because that is a fact about the club; how hard it is pressed is a fact about
the app.

**There are two header dimensions, not one.** MLB clubs are keyed by treatment
and MiLB affiliates by game side — the split the rest of `src/lib` keeps — and
the two triads live in two different stores. One dimension would have had to
classify a team id to know which store it meant, which is a `teams.js` import
`fields.js` must not take (`teams.js` reads the overlay, so that edge closes a
cycle). The id says which vocabulary it is in, the same way the store files do.

**`mlbHeader` accepts only `main` and `city-connect`**, because
`treatmentHeaderColorOverride` collapses every other treatment onto the club's
shared Main bar. A record filed under `alternate-3` is one no resolver reads.

**`tileBg` has no field segment and its store depends on the key.** A treatment
has exactly one background, and Main's is `bgHex` on the tuning store rather than
a swatch — which is why `TILE_BG_STORES` has five keys, not six.

**`logo` is ONE dimension for both vocabularies**, unlike the headers: its MLB
treatment keys and MiLB's `home`/`away` are disjoint sets writing one store, so
the id needs no club classification. The store ships EMPTY
(`src/lib/data/logo-url-overrides.json`); the reader and its variant mapping are
`src/lib/identity/logoUrlOverrides.js`, consulted by `teamLogoUrl` ahead of the
custom-mark assignment and the `*_USES_BASE_LOGO` early returns (which would
otherwise shadow it), and by `mainOverrideLogoUrl` — which is what routes Main's
tile through `main-recolor`. The decorative `base`/`mono` variants stay
override-blind on purpose. The value is normally what **`/api/identity-logo`**
answered after taking the bytes — admin-gated Vercel Blob, ballpark-photo's
pattern, held to `src/lib/logoArt.js`'s 512×512-PNG standard, and *uploading is
not saving*: the URL lands only through the drawer's ordinary Save. Any pasted
https URL is equally legal, which is also what keeps the field usable on a
deploy with no blob store (the endpoint answers 501 there).

**`mono` is not named after the `logo` dimension's `mono` variant** — that
variant (the knockout CDN request `teamLogoUrl(teamId, 'mono')` resolves)
stays override-blind, as the paragraph above says. This dimension is a
different thing entirely: the SHAPE PINS behind that variant's precomputed
file (`src/lib/logoMono.js`, ADR-0031), not a URL. It is also the one
dimension whose save is not instant — see ADR-0054. `parts` is this
catalog's one non-scalar value, a `{ shapeIndex: 'ink' | 'knockout' }` map
carried as a JSON string on the wire like everything else here; `source` is
which CDN mark those pins were picked against, and `art` is that art's
fingerprint, carried so a club that rebrands between a drawer save and the
next generator run drops the stale pins instead of re-inking wrong shapes —
the same staleness rule `src/lib/monoInk.js` already applies to
lab-authored pins. `scripts/gen-mono-logos.mjs` fetches this override on its
own weekly schedule (`scripts/lib/mono-logo-art.mjs`'s
`readMonoInkStoreWithOverrides`) and merges it in exactly the way a page
render would.

**`wpaTreatment`/`milbWpaTreatment` are the real per-(club, treatment) WPA
tuning** — the record most tuned clubs actually carry, and the one
`wpaBandColor`/`wpaLogoLayout`/`wpaWordmarkOn` (and their MiLB counterparts)
read FIRST. `wpa`'s team-level `bandColor` is the fallback those resolvers
fall through to only for `main`, and only when a club has no per-treatment
`band` of its own — before this dimension existed (issue #807), the drawer
edited only that fallback, which was inert for every club with a
per-treatment record on file. `path` branches on the field NAME to nest the
seven layout numbers under their own sub-object; `band`/`wpaWordmark`/
`ownArt` sit flat on the treatment record. `band` is this catalog's other
non-scalar kind (`isBandValue` in `fields.js`): a flat hex/rgb fill, or
`{ pinstripe: true, color?, bg? }`, JSON-encoded on the wire like `mono`'s
`parts`. `ownArt` (MLB only — MiLB has no separate WPA-art upload
destination) toggles tiling a separately uploaded WPA-only mark; this drawer
has no upload control for that file, so turning it on with none procured
just falls back to the treatment's normal mark. Rendered with its own live
preview (`IdentityWpaPreview.jsx`, reusing `/identity-lab`'s real
`WinProbChart` mockups against this club's last completed opponent) and its
own compound control (`IdentityWpaBandField.jsx`) — see the two "not visible
on `/team/{id}`" rules below; both exist because a flat text box can't judge
a tiled band or compose a discriminated-union value.

## Adding a field

1. Add it to the dimension's `fields` in `src/lib/identity/fields.js`, with a
   kind (`color`, `number(min,max,step)`, `pick([…])`, `originY`, `boolean`,
   or a non-scalar one like `band`/`monoPins` — see `coerceIdentityValue`).
2. If the store's own validator in `scripts/lib/dev-data-stores.mjs` has a range
   for it, restate the SAME range and pin the two against each other in
   `test/identity-overrides.test.js`.
3. Give it a label in `identityFields.js`'s `FIELD_LABELS`, and put it in the
   right group.
4. If the value is not visible on `/team/{id}`, **do not add it.** See below —
   `mono` is the one exception, and it earns it by carrying its own preview
   (`IdentityMonoField.jsx` client-converts the pins live, the same math the
   generator runs) rather than nothing at all.

## What is deliberately not here

- **The recolour library.** It repaints shapes and rebuilds a manifest from
  disk; only whole-file logo art moved here (the `logo` dimension above,
  ADR-0050's amendment).
- **A club's researched `extras`, and a MiLB affiliate's colour pair.** Nothing
  on the team hub renders either, so a control for them here would have no
  visible effect on the page holding it — which is the one promise this
  placement makes. `extras` also carries `confidence`/`source`/`found: false`
  provenance a hex box cannot hold. Both stay in `/identity-lab`.
- **Retiring `/identity-lab`.** It gives thirty clubs side by side, the audit
  view and copy-to-another-treatment.

## The two gates

**Contrast.** `scripts/check-contrast.mjs` asserts `onBar` against `bar` at WCAG
AA during lint, and `test/header-theme.test.js` repeats it; a runtime edit passes
through neither. So the drawer checks it in the browser (instantly, with the
ratio) and `api/identity.js` checks it again and refuses. Both judge the
**effective** triad — override layered on what ships — because a save that
changes only `onBar` cannot be judged from the patch alone. **Never lower
`HEADER_CONTRAST_MIN`.** Retune the pair.

**The store validators.** `api/identity.js` merges a proposed save into the
shipped stores and runs `scripts/lib/dev-data-stores.mjs`'s own validator over
the result. ADR-0029 pulled those out of `vite.config.js` so they could be
unit-tested apart from Vite; that is now what stops the dev file write and the
production write from drifting.

## The endpoint

```
GET   /api/identity   -> { identity: { id: value, … } }   public, 60s edge cache
PATCH /api/identity   -> { identity: { … } }              admin only
POST  /api/identity   -> the same
```

- **Patch bodies only.** Unlike `/api/copy` there is no "full desired map" form:
  `/admin` holds every copy field on screen and can honestly claim to know the
  complete state, while a drawer for one club never can. Accepting a full map
  would have let one club's drawer erase all thirty.
- **The merge happens on the server**, inside the request that writes, reading
  Redis directly. A browser read-merge-write cannot be made correct — the GET is
  CDN-cached and `cache: 'no-store'` governs only the browser's cache. That bug
  cost a run of ballpark photos; see `src/lib/admin/saveCopyPatch.js` and
  ADR-0025's amendment.
- **Inert when unconfigured**: no Redis means an empty map on GET and 501 on a
  write, and the app renders the JSON it shipped with.
- **A failed read is a failed write.** Treating an unreadable store as "nothing
  is stored" would compute `staleKeys` against `{}` and report a clean save that
  changed nothing.

## Operating it

- The gear is drawn only for `user.publicMetadata.role === 'admin'` and only on a
  Clerk-configured deploy. That is **convenience, not security** — the boundary
  is `COPY_ADMIN_USER_IDS` on the server (`api/_lib/adminAuth.js`). A forged role
  gets a gear that produces 403s.
- The editor's modules are lazy behind `isClerkEnabled`, so a normal visitor's
  bundle contains neither the bar, the drawer, the field catalog, nor
  `62-identity-admin.css`.
- **In dev the overlay is always empty.** `/api/identity` is a Vercel function
  and `vite dev` serves none, so `/identity-lab` is still editing the file byte
  for byte. To exercise the overlay locally, seed
  `localStorage['bbsbh:identityOverrides']` with a field-id map and reload — that
  is exactly the path a returning visitor takes.
- **Clearing everything for a club** is the drawer's Save with every box empty:
  the patch names every id the club owns, and an empty value deletes.
- **The drawer's previews are the app's own components, never mocks** — the
  jersey strip and the logo group render `TeamTreatmentMark` through
  `treatmentTile`, so they repaint from the draft's preview layer live. The
  Stamp placement group draws two real `GameStamp`s for a game FABRICATED as a
  literal in `IdentityStampPreview.jsx` — that literal (no schedule, no feed, no
  collection, no route param) is what earned the file its
  `check-stamp-surfaces.mjs` allowlist entry despite shipping in production;
  read that guard's comment and ADR-0035 before touching it.
- **Colour boxes carry an eyedropper** where the browser has the EyeDropper API
  (Chromium; feature-detected, simply absent elsewhere) — pick a hex straight
  off the club art already on the page.
