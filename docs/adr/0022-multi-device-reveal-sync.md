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
- **`api/reveal.js`** — one Vercel **Node.js** serverless function (not edge,
  unlike `api/og.js`/`api/preview.js` — `@clerk/backend`'s `verifyToken`
  pulls in `@clerk/shared` internals Vercel's edge sandbox rejects outright;
  confirmed live via a failed edge deploy, `NOW_SANDBOX_WORKER_EDGE_FUNCTION_UNSUPPORTED_MODULES`),
  `GET`/`POST`, storing a single integer per `(Clerk userId, gamePk)` in
  Upstash Redis (the "Vercel KV" successor product). Never a score — the
  same high-water mark already in `localStorage`, just mirrored.
  Authenticated by verifying the Clerk session JWT server-side
  (`verifyToken`); a user can only read/write their own key, derived from
  their verified `sub` claim, never a client-supplied id.
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
authenticates a real end user rather than serving a crawler, and the first
one that runs on Node.js rather than edge (see above); unlike
`api/og.js`/`api/preview.js` (ADR-0012), it can't fail purely into a generic
static fallback — an auth or KV outage means that request's sync attempt is
skipped, caught by `RevealCloudSync.jsx`'s try/catch, and the device simply
falls back to whatever `localStorage` already has.

## Amendment: branding, the cloud scorebook index, and dev vs. production keys

- **Branding.** Every Clerk-rendered surface (sign-in modal, UserButton menu)
  is themed to the scorebook design system via `src/lib/clerkAppearance.js`
  (`variables` = concrete hex mirroring `src/tokens/colors.css`, since Clerk
  derives shades from them; `elements` = our own class names styled with the
  real tokens in `src/index.css`). Signed in, the header avatar shows the
  user's favorite-team logo instead of Clerk's photo — a visual overlay in
  `AccountButton.jsx`, nothing uploaded to Clerk.
- **The cloud scorebook index** (`scorebook:{userId}` hash in the same Redis)
  extends the exception by the same rule: alongside each ratcheted
  `revealedThrough` POST, the client sends a spoiler-free game snapshot
  (date, team abbreviations/club names, doubleheader number, regulation
  length — validated server-side, capped at 24 entries). `GET
  /api/reveal?recent=1` lists them for the slate's signed-in "Pick up your
  pencil" strip (`ContinueScoring.jsx`), which deep-links to the next half to
  reveal without fetching a feed. Still never a score.
- **"Development mode" watermark.** A Clerk *development instance*
  (`pk_test_…`/`sk_test_…` keys) watermarks its components with a
  "Development mode" banner and caps users. It is removed by creating a
  **production instance** in the Clerk dashboard (requires the real domain +
  the CNAME records Clerk prescribes), then swapping
  `VITE_CLERK_PUBLISHABLE_KEY`/`CLERK_SECRET_KEY` in Vercel's Production
  environment for the `pk_live_…`/`sk_live_…` pair. Upstash has no
  dev/production split — the same Redis database serves both.
