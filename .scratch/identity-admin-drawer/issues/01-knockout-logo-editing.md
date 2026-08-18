# Knockout (mono) mark editing from the team-hub identity drawer

Status: resolved — filed as gzilavyss2025/bbsbh#767

## Where this came from

Gary reviewed the team-hub identity drawer (`/team/{id}`, admin gear, PR #735)
and asked why it has no control for a club's knockout (one-color) mark — the
silhouette that draws on the navy section mastheads (Batting order, Starting
pitcher, Defense, Due up next) and on a themed lineup-page bar. Every other
piece of a club's identity is editable from the drawer with no deploy
(`docs/identity-overrides.md`, ADR-0050). The knockout mark is not, and it
can't be added the same way the other fields were — this ticket exists to
scope why, and lay out the real options.

## Why this one field doesn't fit the drawer's model

Every field the drawer writes today is a **runtime override**: an admin saves
a value, `src/lib/identity/overlay.js` layers it over the shipped store, and
every resolver answers with it immediately, no deploy (ADR-0050,
`src/lib/CLAUDE.md`'s "Editing a value — two paths, one set of stores").

The knockout mark doesn't work that way. It is **precomputed at build time**:
`scripts/gen-mono-logos.mjs` fetches a club's CDN art, converts it to a
one-color SVG mask (`src/lib/logoMono.js`), and writes a static file to
`public/data/logos/mono/{teamId}.svg` — the file `TeamLogo`'s `mono` variant
requests directly (ADR-0031). What a club can tune today (`/identity-lab`'s
Knockout mark editor, `MonoInkEditor.jsx`) is not the mark itself but the
**pins** that steer that conversion — a `{ shapeIndex: 'ink' | 'knockout' }`
map plus a `source` CDN-variant pick, saved to
`src/lib/data/mono-ink.json`. Saving a pin only changes what the *next*
generator run produces; the dev-only save endpoint additionally asks the
local server to regenerate that one club's file immediately, but that's a
`vite dev`-only convenience with no equivalent in production.

So "add knockout-logo editing to the drawer" is really a choice between two
different features:

### Option A — pins as a runtime override, mark still precomputed

Add a `mono` dimension to `src/lib/identity/fields.js` that stores the pin map
(and source pick) as a runtime override, the same shape every other field
uses. The drawer would need a new field kind for it — every existing kind
(`color`, `number`, `pick`, `originY`, `url`) is a scalar; a pin set is a
small JSON object — plus a shape-picker UI, which `editors/ShapeInkPicker.jsx`
already has and could plausibly be shared.

The catch: **the mark visitors actually see is still the static file.** An
override here would change what the *pins* say without changing the SVG
`TeamLogo` requests, until `gen-mono-logos.mjs` runs again (the nightly
`update-teams.yml` cron, or a manual deploy) and regenerates it from the
override. That's a real gap from every other field in this drawer, where Save
means "visitors see this now" — here Save would mean "visitors see this
after the next generator run," silently, with nothing in the UI saying so.
Worth deciding explicitly whether that's an acceptable exception or a
dealbreaker.

### Option B — convert live, in the browser, like the drawer's other previews

Drop the precomputed file for the *overridden* club only: when a mono
override exists, resolve the mark by fetching the CDN source and running
`monoLogoSvg` client-side (the same function the generator and the lab both
already call), instead of requesting the static SVG. This makes Save behave
like every other field — instant, no deploy — but it's a bigger change:

- `TeamLogo` would need a code path that knows to check for an override and,
  if present, fetch+convert instead of requesting a static URL — the "why
  precompute" argument in ADR-0031 (no round trip, no pop-in, no remote
  markup injected into the DOM) would apply only to the *unoverridden* case.
- Every masthead that currently renders a knockout mark as a plain
  `<img src>` would need to become conditional on whether this club carries
  an override, which touches `SectionMasthead`'s `logo` prop and every
  caller.
- The version-in-the-URL cache-busting scheme (ADR-0031's second amendment)
  exists precisely because these are cached `CacheFirst` at the service-worker
  level; a live-converted override would need its own cache story, since it's
  no longer a stable URL the SW can key on.

### What's NOT in question

- The **pin data model and picker UI already exist and work** — reuse them
  (`logoMono.js`, `ShapeInkPicker.jsx`/`MonoInkEditor.jsx`), don't rebuild.
- **Coverage stays partial by design** — a club with no mono file falls back
  to its full-color mark today (ADR-0031's "coverage is allowed to be
  partial"); that fallback rule doesn't change under either option.
- Neither option needs a new server endpoint from scratch: Option A rides the
  existing generic `/api/identity` write path (`identityIdsForClub`,
  `saveIdentityPatch`) once a `mono` dimension exists; Option B needs no
  server write at all beyond what already stores the pins.

## Recommendation

Option A, with the gap surfaced rather than hidden: ship the pin override
plus an explicit note in the drawer ("takes effect on the next data refresh,
not immediately") rather than silently promising instant like every sibling
field. Option B is the more honest fix but is a real architecture change to
`TeamLogo`/`SectionMasthead`/the service-worker caching story, not a drawer
addition — worth a separate spike if Option A's caveat proves unacceptable in
practice.

## Comments
