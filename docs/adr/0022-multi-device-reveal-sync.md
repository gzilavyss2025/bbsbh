# Multi-device reveal sync — the second, narrower exception to "no backend"

ADR-0012 established the first exception (a crawler-only edge layer for link
previews, invisible to the app itself). This is the second, and the first one
that's a real, opt-in **feature**: syncing `revealedThrough` — the reveal
high-water mark — across a signed-in user's own devices.

## The problem

`revealedThrough` lives in `localStorage` under `bbsbh:reveal:{gamePk}` (see
`useRevealProgress.js`, `CONTEXT.md`). That's correct and sufficient for a
single device, and a prior fix (cross-tab `storage` event sync) covers
multiple tabs on the *same* device. But a phone and an iPad are different
`localStorage` origins entirely — no client-only mechanism can bridge them.
Bridging requires somewhere off-device to hold the mark, which requires
knowing which devices belong to the same person, which requires an account.

## The decision

- **Clerk** (`@clerk/clerk-react` + `@clerk/backend`) for identity — a
  lightweight, opt-in account (email or OAuth), not required to use the app.
  `ClerkProvider` only mounts when `VITE_CLERK_PUBLISHABLE_KEY` is set (see
  `src/lib/clerkConfig.js`); unset, the app is byte-for-byte what it was
  before this ADR — no sign-in UI, no `/api/reveal` calls, no new dependency
  actually exercised at runtime.
- **`api/reveal.js`** — one Vercel edge function, `GET`/`POST`, storing a
  single integer per `(Clerk userId, gamePk)` in Upstash Redis (the
  "Vercel KV" successor product). Never a score — the same high-water mark
  already in `localStorage`, just mirrored. Authenticated by verifying the
  Clerk session JWT server-side (`verifyToken`); a user can only read/write
  their own key, derived from their verified `sub` claim, never a client-
  supplied id.
- **The ratchet is enforced on both ends.** `useRevealProgress.js`'s
  `mergeRevealedThrough` — the same function the cross-tab `storage`
  listener uses — is the only way a remote value reaches local state, so a
  sync can only ever advance the mark, never move it backward or let a
  compromised/stale client regress another device. The server independently
  does the same `max(current, incoming)` before writing, so even a
  malformed or adversarial POST body can't lower another device's stored
  value.
- **`src/components/RevealCloudSync.jsx`** is a headless component (renders
  `null`), mounted by `InningViewer.jsx` only when `isClerkEnabled` — not a
  hook called unconditionally, because Clerk's hooks (`useAuth`) throw
  outright with no `ClerkProvider` ancestor. Signed-out users never trigger
  a single network call to `/api/reveal`.

## Why this doesn't violate the spirit of "no backend"

- **Off by default, and inert until configured.** Three separate env vars
  (`VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
  `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`) all have to be set for
  any part of this to activate. Missing any of them, the feature disappears
  cleanly (client-side: no sign-in UI at all; server-side: `api/reveal.js`
  itself returns `501` rather than erroring).
- **Never a score.** The stored value is the same integer that already lives
  in `localStorage` and is already sent to no one — this only mirrors it to
  a second device belonging to the same authenticated user, nothing else.
- **The core spoiler rule is untouched.** `SealBox`, the reveal-only module
  isolation, and the render-time DOM guarantee (root `CLAUDE.md`) don't
  change at all; this only changes *where a high-water mark advance can
  originate from* (a tap, a same-device tab, or now a signed-in second
  device), never *what* gets revealed or *how*.
- **Signing in is entirely optional.** Every feature in the app keeps
  working, unauthenticated, exactly as before — this is additive, not a
  requirement layered onto the existing experience.

## Cost accepted

Three new dependencies (`@clerk/clerk-react`, `@clerk/backend`,
`@upstash/redis`) and two new pieces of infrastructure to provision (a Clerk
application, an Upstash Redis store via the Vercel Marketplace) — both free
at this project's scale. `api/reveal.js` is the first `api/` function that
authenticates a real end user rather than serving a crawler; unlike
`api/og.js`/`api/preview.js` (ADR-0012), it can't fail purely into a generic
static fallback — an auth or KV outage means that request's sync attempt is
skipped, caught by `RevealCloudSync.jsx`'s try/catch, and the device simply
falls back to whatever `localStorage` already has.
