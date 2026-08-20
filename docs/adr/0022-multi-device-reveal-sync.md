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

**Amended by ADR-0026 (the mark still only advances by hand).** The spoilers-off
pass (ADR-0026) unseals scores without touching `revealedThrough` at all: it is a
render override, and `effectiveReveal`'s `commitReveals` stops the reveal commit
while it is on. So nothing this feature does reaches `RevealCloudSync` — a day
spent looking at scores on the phone leaves the iPad's reveal point exactly where
it was, which is correct, because looking is not scoring. `api/reveal.js` gains no
fields.

An earlier design (ADR-0027, superseded) had a per-game "Follow Live" mode that
*did* advance the real mark from the live feed, and therefore propagated
machine-advanced reveals to every signed-in device. That is gone; the mark's only
sources remain a tap, another tab's `storage` event, and this sync.

The one thing the pass does persist — the set of days consented to
(`bbsbh:spoiledDays`) — DOES sync, but on its own key, shape and endpoint
(`api/spoiled-days.js`), not through the reveal mirror. It is consent, not scoring
progress, and it needed a different merge rule: this ADR's ratchet works because a
mark only moves one way, whereas a day set has to be able to move back (the
same-day undo), so it syncs as a per-day `'on' | 'off'` state map rather than a
max or a union. See ADR-0026.

**Amended (2026-07-25): the endpoint never actually ran in production.**
`api/reveal.js` was written against the Web fetch shape — `new URL(req.url)`,
`req.headers.get()`, `await req.json()`, `return new Response()` — but declares
`export const config = { runtime: 'nodejs' }`. Vercel's Node runtime passes
Node's `(req, res)`, where `req.url` is a bare path, so every request died at the
first line of real work with `TypeError: Invalid URL` (`input:
'/api/reveal?gamePk=1'`). Multi-device sync had therefore never worked on a
deploy, from the day it shipped.

It hid for so long because the client treats sync as strictly optional:
`RevealCloudSync` swallows any error and leaves localStorage authoritative, so a
500 is indistinguishable from "this deploy has no sync configured", which is a
supported state. **A graceful degrade can mask a hard failure indefinitely** —
these endpoints need request-level tests (`test/api-handlers.test.js`) and a
post-deploy check, not just a module-level import smoke test, which exercises a
request shape production never passes.

Fixed by `api/_lib/nodeHandler.js`, a shape-agnostic adapter shared by all three
Node functions.

## Amendment (2026-08-19) — the mark needs an owner, and adopting it means removing it

**Status:** accepted.

`bbsbh:reveal:{gamePk}` is keyed by gamePk and nothing else. "Nothing else"
included the account, and nothing cleared it on sign-out. On a device two people
share, that is the worst leak in this family, because this is the mark the whole
spoiler rule rests on:

1. A signs in and scores six innings. The marks are written locally and POSTed.
2. A signs out. The marks stay — local-first, by design.
3. B signs in and opens that game. The innings viewer renders **six innings
   already unsealed**, and `RevealCloudSync` publishes A's frontier into B's
   account, where the ratchet carries it to every device B owns.

Every scoring surface reads this mark — the innings viewer, the scorecard's ink,
the slate's "pick up your pencil" strip — and it is a ratchet, so B cannot get
the seals back by signing out again. The marks have to be removed.

**The mark now carries an owner tag**, `bbsbh:revealOwner` — its own key, for the
reason every channel in this family keeps its own: the channels sync
independently, over different endpoints, and a device that reached one but not
another must not be recorded as holding both. `mergeStrategyFor` is unchanged;
the channel's rules are the React-free `src/lib/account/revealOwner.js`, over the
storage mechanics in `src/lib/account/deviceOwner.js`.

**`adopt` means clearing.** Unlike a preference document or a shelf there is
nothing to *replace* these with — one key per game, and the server holds only the
games this user actually scored — so adopting is a sweep, and each game's own
pull re-establishes B's. **The at-bat cursor (`bbsbh:reveal-atbat:*`, ADR-0016)
goes with it**: it is the same reader's position in the same game, and a cursor
left pointing into a half that just re-sealed is the leak with an extra step.

**The guard is app-wide (`OwnerGuards`), not part of `RevealCloudSync`.**
That component mounts inside one game and its pull is a network round trip, while
`useRevealProgress` reads the mark synchronously as the viewer first paints — and
the slate and the scorecard read the same mark without mounting it at all. The
publish effect still checks the tag as a second line, since the two are separate
mounts with no ordering guarantee.

**The ratchet gained exactly one door back**, and it is the key being *removed*.
No stale or hostile value can re-seal a half through it, because a removal is not
a value: this app writes nothing to the key but a non-negative integer, so its
absence can only mean "erase my Tally data" or this guard. Both must re-seal a
page that is already open — and without the echo, an open viewer would re-persist
its in-memory mark and undo the clear.

- Pinned by `test/reveal-owner.test.js`, together with ADR-0026's half of the
  same fix.
