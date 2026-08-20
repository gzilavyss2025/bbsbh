# ADR-0054 — A precomputed store can carry a runtime override too, if the generator fetches it

Status: accepted (2026-08-20)

## Context

Issue #767: the team-hub identity drawer (ADR-0050) has a control for every
piece of a club's identity except its knockout (one-color) mark — the
silhouette the navy section mastheads draw. Every other field the drawer
writes is a **runtime override**, layered by `src/lib/identity/overlay.js`
onto a bundled `src/lib/data/*.json` store that a **pure, synchronous
resolver** reads on every render. The knockout mark doesn't fit that shape:
`public/data/logos/mono/{teamId}.svg` is a file
`scripts/gen-mono-logos.mjs` precomputes (ADR-0031), and nothing at
render time reads `mono-ink.json` at all — the file only ever fed that one
generator, run weekly by `.github/workflows/update-teams.yml`. What the lab's
Knockout mark editor (`MonoInkEditor.jsx`) tunes is a *pin set* — which shapes
of a club's art are ink vs. paper — not the art itself, and saving one only
changes what the generator's *next run* produces.

Two shapes were considered for the drawer control (`.scratch/identity-admin-drawer/issues/01-knockout-logo-editing.md`):

- **Convert live in the browser** per club when an override exists, matching
  every other field's instant save. Rejected: `TeamLogo`/`SectionMasthead`
  would need an override-aware code path only for this one variant, undoing
  ADR-0031's whole argument for precomputing (no round trip, no pop-in, no
  remote SVG markup in the DOM) for exactly the clubs someone tuned — and the
  service-worker `CacheFirst` cache-busting scheme (`?v=` from
  `mono-logo-manifest.json`) has no equivalent for a URL that isn't static.
- **Store the pin map as a runtime override anyway**, and accept that Save
  here does not mean "visitors see this now." This is the shape ADR-0050
  already has a seam for.

## Decision

**A `mono` dimension joins the field catalog, and the generator learns to
fetch it.**

`src/lib/identity/fields.js` gets a `mono` dimension exactly like `wpa`'s or
`colors`' team-level shape (`identity.mono.{teamId}.{parts|source|art}`,
store `mono-ink`), with one new field kind: `monoPins`. Every other kind here
is a scalar coerced from a string (`color`, `number`, `pick`…); `parts` is a
`{ [shapeIndex]: 'ink' | 'knockout' }` map — the first non-scalar value this
catalog stores. It travels the wire the same way everything else does (a
string in `sanitizeIdentityOverrides`/`mergeIdentityOverrides`), just
JSON-encoded; `coerceIdentityValue` parses and validates it against the exact
shape `dev-data-stores.mjs`'s `isMonoInkStore` already enforces for the file,
so an override and a lab-authored entry can never disagree about what a pin
set is allowed to look like. `source` (which CDN mark the pins were picked
against) and `art` (that art's fingerprint, for the staleness check
`src/lib/monoInk.js` already applies to file-authored pins) ride along as two
sibling fields, the same three values `MonoInkEditor.jsx` already tracks.

The drawer's Knockout mark group (`IdentityMonoField.jsx`) reuses
`identity-lab/editors/ShapeInkPicker.jsx` outright rather than
reimplementing the click-a-shape interaction — the component already exists
*because* a shape must mean the same thing everywhere it's offered, and a
third consumer is exactly the case it was built for. `src/lib/monoInk.js`'s
`monoInkFor` now reads through `effectiveStore()` (registered with the
overlay like every other consuming module), so the group's landed pins,
and the drawer's own live-converted preview, already reflect a
previously-saved override — the same "landed = what this club has right now"
rule every other field keeps.

**`scripts/lib/mono-logo-art.mjs` gets a second reader,
`readMonoInkStoreWithOverrides`, used only by the full nightly run
(`scripts/gen-mono-logos.mjs`).** It reads the file, `fetch`es
`{SITE_URL}/api/identity` (public, edge-cached, no auth needed — the same GET
every page already trusts), and layers the result on with
`applyIdentityOverrides('mono-ink', file, overrides)` — the identical
function `api/identity.js`'s own write-validator runs, so what the generator
converts is what the drawer's save actually validated. A fetch failure (no
network in a sandboxed run, or an unconfigured deploy answering `{}`)
degrades to the file alone, the same "inert when unconfigured" rule every
other identity exception keeps — never a reason to fail the run.

**The dev-only regenerate-one-club route (`vite.config.js`, behind
`MonoInkEditor.jsx`'s own Save) does NOT gain this fetch.** It keeps calling
the plain, file-only `readMonoInkStore`. `docs/identity-overrides.md`
already promises the lab stays byte-for-byte the file under `vite dev`
(`/api/identity` is a Vercel function; the dev server serves none) — layering
a live fetch to *production* into a local dev save would have quietly broken
that promise the moment a developer's machine had network access, which it
almost always does.

## Consequences

**This is the one field in the drawer where Save is not instant, and it says
so.** Every sibling field's caveat is "none" — the overlay is read on the
next render, full stop. This one's caveat is real and is rendered as its own
paragraph in `IdentityMonoField.jsx`: what visitors see updates on
`update-teams.yml`'s weekly cadence, not the moment you save. An admin who
expects instant feedback here would ship a false negative ("I saved it and
nothing changed") without that sentence.

**A precompute generator now makes one network call to this app's own API
mid-run**, a pattern nothing else in `scripts/gen-*.mjs` does today (every
other generator's own-app dependency is a local import, per
`scripts/CLAUDE.md`'s "a generator that needs app logic imports it"). It is
scoped to exactly one call, to a public cached GET, with a hard fallback to
"proceed as if unconfigured" on any failure — the same posture every other
identity exception takes toward its own absence, applied one layer further
out.

**Coverage stays partial by the same rule ADR-0031 already set.** A club
with no file entry and no override still falls back to its full-color mark;
nothing about the override changes that fallback or bypasses it.

**The spoiler rule is untouched.** A knockout mark is identity, the same
argument `src/lib/CLAUDE.md`'s "rule that must not drift" already makes for
every other field this overlay carries — nothing here reads a score, an
inning, or a win probability.
