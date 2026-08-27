# The lab writes to disk — a dev-only, allowlisted write-back

Every screen reads `statsapi.mlb.com` or a committed JSON file directly; the
three narrow `api/` functions that exist so far (ADR-0012 link previews,
ADR-0022 reveal sync, ADR-0025 admin copy) are Vercel edge functions. This
records a fourth thing that is *not* one of them, and why
that distinction matters: a **Vite dev-server middleware that writes files in
this repo**, used only while `npm run dev` is running.

## What it's for

Several tables in `src/lib/` are hand-tuned by eye, one club at a time: a mark's
edge-bleed scale, a nudge that re-centers an off-balance logo, a WPA band color,
a jersey's display name. The Team Identity Lab (`/identity-lab`) is where that
tuning is *seen* — real tiles, the real win-probability chart, three score states
side by side.

Before this, the lab could only *propose*: every editor had a copy icon that
produced a snippet naming the table, the key, and the value, which a human then
pasted into a source file by hand. That round trip is the entire cost of a tuning
session — dozens of values, each one a manual edit in a different file, with the
transcription error rate that implies. `uniformNamesDevSave()` had already solved
this for one page (`/uniform-names`, one flat name map). This generalizes that
proven mechanism rather than inventing a new one.

## The decision

- **One plugin, one closed allowlist.** `devDataSave()` (`vite.config.js`) mounts
  at `/__dev` and resolves the rest of the path against `DEV_DATA_STORES`
  (`scripts/lib/dev-data-stores.mjs`) — a literal map of
  `key -> { file, validate }`. **A request supplies a key, never a path.** An
  unknown key is a 404; the destination always comes from the allowlist's own
  literal. That is the security boundary: there is no path from a request body to
  an arbitrary filesystem location.
- **The allowlist lives outside `vite.config.js`** so `npm test` can exercise the
  validators directly (`test/dev-data-stores.test.js`) without booting Vite. A
  security boundary that can't be unit-tested tends not to stay one.
- **Defense in depth on the destination.** `resolveStoreFile()` throws unless the
  resolved path is a file directly inside `src/lib/data/` or `public/data/`. The
  allowlist's entries are literals, so this can only fire on a careless future
  edit — which is exactly when you want it to.
- **Validated per store, not just parsed.** Each store has a validator returning
  `null` (accept) or the reason for a 400. They're structural rather than
  field-by-field — the lab grows fields as new dimensions land — but they reject
  the shapes that would actually break a reader: a non-team key, a treatment key
  outside the vocabulary, a value too deep to be a tuning field, and
  `__proto__`/`constructor` keys, which JSON can carry and an object literal
  cannot.
- **A save posts the WHOLE store**, not a patch, and the response is written with
  `serializeStore` — 2-space, trailing newline, keys sorted by team id. A tuning
  session therefore lands as a git diff that names exactly which
  team/treatment/field moved.
- **Body cap of 256 KB**, carried over from the original implementation.

## The one route that takes bytes: `/__dev/team-logo`

Curated club marks (`public/team-logos/{treatment}/{ABBR}.png`) had the same
problem the tuning tables had, one step worse: adding one meant dropping a file
into a directory by hand and hoping it matched the others. The lab now takes a
drag-and-drop onto the tile itself. Same mount, same boundary, three differences
worth recording:

- **Its own branch, not a `DEV_DATA_STORES` entry.** The JSON stores take a
  parsed object and a per-store validator; this takes raw bytes and a PNG
  header check. One allowlist whose entries meant two different things is how a
  validator eventually gets skipped, so the logo route is checked by name
  (`DEV_LOGO_ROUTE`) before the store lookup runs, and a unit test pins that the
  two never overlap. What they DO share is the body reader and its cap.
- **The destination is resolved from two allowlisted components, not one key.**
  A request carries a numeric team id and a treatment key in the query string —
  the body is the image. The directory comes from `LOGO_TREATMENT_DIRS`' own
  literal and the filename from `teamAbbr`, which returns `''` for anything that
  isn't one of the 30 MLB clubs. `resolveLogoFile()` then asserts the resolved
  path is *equal to* the one those literals spell, not merely under the art root,
  so a `..` anywhere lands somewhere else and throws. Same defense-in-depth role
  as `resolveStoreFile()`.
- **Validated without an image library.** A PNG stores width and height as
  big-endian uint32s at bytes 16 and 20 of the IHDR chunk, which is the whole of
  what the 512×512 standard needs to check — so `src/lib/logoArt.js` reads those
  bytes directly and adds no dependency. It is environment-neutral on purpose:
  the browser runs it to reject a bad file instantly with a reason, the server
  runs the same functions to decide. The standard itself (512×512, PNG, 400 KB)
  was measured off the art already committed, not chosen.

The endpoint also rewrites `src/lib/data/logo-art.json`, a coverage manifest
rebuilt from the directory rather than patched — which is what lets a unit test
catch a file added or deleted by hand. Nothing reads the manifest at runtime;
`localLogoUrl` still has no whitelist and a missing file still 404s and degrades.

## Why the tables became JSON first

Rewriting `.js` source programmatically — AST surgery, or regex codegen against a
hand-formatted literal — is fragile in a way that fails silently and mangles
prose. So the raw data literals moved to `src/lib/data/*.json` and the `.js`
modules kept every resolver and every word of their doc comments, rebuilding the
same lookup tables from the store at module load
(`src/lib/tuningStore.js`). Vite bundles a static JSON import synchronously, so
no call site became async, and no resolver's behaviour changed. The per-entry
comments those literals carried survive as `name` and `note` fields — data the
resolvers ignore and the lab renders.

Plain Node needs `with { type: 'json' }` on those imports (the unit suite imports
these modules directly), which is why `eslint.config.js` moved to
`ecmaVersion: 2025`.

## Four independent layers keep it out of production

Not one gate with three comments about it — four mechanisms, each sufficient
alone:

1. **`configureServer` only runs under `vite dev`.** Never `vite build`, never
   `vite preview`, never Vercel. The middleware does not exist in a deployed app.
2. **Every curation screen is `import.meta.env.DEV`-gated in `src/App.jsx`** —
   the lab and `/uniform-names` both. Their modules are absent from the
   production module graph, so nothing that mentions `/__dev` is even reachable
   to bundle.
3. **`lib/route.js` still parses both route names.** A stray production hit on
   `/identity-lab` resolves to `home` rather than falling through to the generic
   3-segment game route, which would try to read `identity-lab` as a date.
4. **A post-build check on the artifact.** `scripts/check-dist-dev-routes.mjs`
   greps `dist/` for the string `/__dev` and fails the build if it appears. It
   runs in CI's `lint-and-build` job right after `npm run build` (it needs the
   artifact, so it can't live in `npm run lint`). Layers 1–3 are code you have to
   read correctly; this one checks the bytes that actually ship. It also asserts
   the opposite for the logo route: `dist/team-logos/` must be non-empty. The
   endpoint that WRITES curated art is dev-only; the art itself is ordinary
   static content the deployed app renders on every slate card.

The only lab-related string that survives into `dist/` today is the route name
itself, from layer 3 — by design.

## Spoiler analysis

Nothing here touches the spoiler rule. Colour, logo, and uniform data is
*identity*, not state: every input is a static per-club table or the uniform
catalog, and none of it carries runs, hits, errors, innings, outs, or win
probability. A colour cannot encode a score. The endpoint writes only those
files, and the lab renders no reveal-gated content.

## Cost accepted

A dev server that can write to the working tree is a real capability, and the
honest mitigation is that it is scoped to five named files in two directories,
plus one `{ABBR}.png` per club per treatment directory, only while a developer is
running `npm run dev` on their own machine. The risk it replaces — dozens of
hand-transcribed values per session, and art dropped into a directory unchecked —
was not smaller.
