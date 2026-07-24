# Admin-editable copy store — the third exception to "no backend"

ADR-0012 established the first exception (a crawler-only edge layer for link
previews). ADR-0022 added the second (multi-device reveal sync). This is the
third: a global, admin-editable store for the wording of the spoiler-consent
surfaces, so the site owner can tune those strings — and their humor — as the
site matures, without a code change, a deploy, or an AI agent.

## The problem

Two new opt-in spoiler departures are being built (see ADR-0026 for Scores
Unlocked; Follow Live to follow): a home-screen "just show me the scores" pass
and an in-game "follow live" mode. Each puts a consent pop-up in front of the
user at the exact moment they trade away the spoiler protection the whole app
exists to provide. The owner wants to iterate on that copy — the explanation,
the tone, the joke — frequently and independently of engineering. Hard-coding
the strings in components makes every wording tweak a code change + a Vercel
deploy (which this project deliberately minimizes — see the root `CLAUDE.md`
workflow section).

## The decision

- **A closed registry, not free-form strings.** `src/copy/registry.js` is the
  single source of truth: every editable string is a `FIELD` with a stable
  dotted id, a shipped `default`, a `maxLength`, and admin-form metadata. Three
  consumers share this one definition — the runtime, the admin panel, and the
  write endpoint — so "what strings exist and what is a valid value" is defined
  once. `sanitizeOverrides()` is the choke point: any override map (a POST body
  or a cached blob) is reduced to known ids with in-budget string values;
  everything else is dropped. An unknown key can never be stored or served, and
  no value can exceed its cap.
- **`api/copy.js`** — one Vercel **Node.js** serverless function (same runtime
  reason as `api/reveal.js`: `@clerk/backend`'s `verifyToken` needs internals
  the edge sandbox rejects). `GET` is **public and edge-cacheable** (copy is
  global, non-secret, and contains no score) and returns the sanitized override
  map. `POST` replaces the stored map and is gated **twice**: a valid Clerk
  session JWT AND membership in the `COPY_ADMIN_USER_IDS` env allowlist. An
  unset allowlist means no one can write — fail closed.
- **`src/copy/CopyProvider.jsx` + `copyContext.js`** — an app-wide provider
  that resolves copy as `defaults <- localStorage cache <- live GET`, each
  layer re-sanitized. Components read `useCopy().t('id', { time })`. The one
  honored interpolation token is `{time}` (the local reset time); no markup, no
  other substitution. Copy ALWAYS resolves to a renderable default, so a
  network/store outage is a cosmetic wording lag, never a blank modal.
- **`src/screens/AdminCopy.jsx`** — the unlinked `/admin` editor. The UI unlocks
  only for a signed-in Clerk user whose `publicMetadata.role === 'admin'`, but
  that client check is convenience: the API's allowlist is the real security
  boundary. Grouped fields with char counters, per-field reset-to-default, and a
  live preview of each modal.

## Why this doesn't violate the spirit of "no backend"

- **Off by default, inert until configured.** With no Clerk / no Upstash, `GET`
  returns an empty override map and the app renders shipped defaults; `POST`
  returns 501; `/admin` shows a "not configured" notice. The app is byte-for-
  byte its previous self.
- **Never a score.** The store holds UI text only — the wording of consent
  pop-ups and banners. It never reads, fetches, or stores any game value, so it
  is categorically outside the spoiler rule's DOM guarantee. This is why the
  `GET` can be public and cacheable, unlike the private, `no-store`
  `api/reveal.js`.
- **The core spoiler rule is untouched.** `SealBox`, the reveal-only module
  isolation, and the render-time DOM guarantee don't change. This ADR changes
  only *where the words in a consent modal come from*, never what gets revealed.
- **Bounded and closed.** Because the registry is a fixed set and every value is
  length-clamped on both ends, admin-editable copy cannot grow new keys, inject
  markup, or carry an oversized payload into the UI.

## Cost accepted

`api/copy.js` is the second end-user-authenticated `api/` function and reuses
the ADR-0022 stack (Clerk + Upstash) with no new dependencies. One new env var,
`COPY_ADMIN_USER_IDS` (comma-separated Clerk user ids), gates writes. A write
outage returns an error to the admin panel and changes nothing; a read outage
falls back to cache-then-defaults in the provider's try/catch. The `/admin`
route is parsed and rendered but linked from nowhere, matching the existing
unlinked QA/dev pages (`scorecard-lab`, `team-color-lab`).
