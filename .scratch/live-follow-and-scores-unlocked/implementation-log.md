# Implementation log — Follow Live + Scores Unlocked

Tracks the build of the feature specced in `design-spec.md`. Decisions locked
with the owner on 2026-07-24.

## Locked decisions

- **Admin-editable consent copy**, stored **globally in Redis** (amends "no
  backend" — accepted by the owner as the project matures), Clerk-admin-gated.
  The owner wants to tune the pop-up wording/humor without a deploy or an agent.
- **Build order:** admin copy panel FIRST, then Scores Unlocked (home), then
  Follow Live (in-game).
- **Scores Unlocked scope:** when on, ALL of today's games show score + inning
  on the slate cards (finals show final, live show runs + half), keeping the
  card's colors/cap treatment.
- **8am local reset**, stated explicitly in both consent boxes ("no matter what,
  at 8am the app goes back to assuming you want nothing spoiled").

## Phase 0 — Admin copy panel (DONE)

- `src/copy/registry.js` — closed registry: every editable consent string with a
  stable id, shipped default (scorebook voice + humor), maxLength, admin-form
  metadata. `sanitizeOverrides`/`resolveCopy`/`fillTokens` (only `{time}` token).
- `api/copy.js` — Node serverless. Public cacheable GET; allowlisted
  (`COPY_ADMIN_USER_IDS`) + Clerk-verified POST. 501 when unconfigured.
- `src/copy/CopyProvider.jsx` + `copyContext.js` — provider resolving
  defaults ← localStorage cache ← live GET; `useCopy().t(id, { time })`. Always
  falls back to defaults; wired into `main.jsx` (inside ClerkProvider when on).
- `src/screens/AdminCopy.jsx` + `/admin` route — mobile editor, Clerk-admin
  gated UI (API is the real boundary), grouped fields + counters + reset +
  live modal preview.
- `test/copy-registry.test.js` — 14 unit tests pinning the sanitize/resolve/
  token invariants. Full suite 524/524, lint + build clean.
- `docs/adr/0025-admin-editable-copy-store.md`; root `CLAUDE.md` now names three
  `api/` exceptions.

Verified `/admin` renders + degrades gracefully with no Clerk in dev.

## Phase 1 — Scores Unlocked (NEXT)

Per spec §2b/§3/§7: `src/lib/scoresUnlocked.js` (expiry-not-boolean, 8am local,
MAX_WINDOW clamp) + hook + the home toggle/consent (copy from the registry) +
slate score wiring (separate toggle-gated fetch) + banner. ADR-0026.
