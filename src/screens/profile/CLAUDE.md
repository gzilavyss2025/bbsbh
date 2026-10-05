# src/screens/profile — My Tally (`/profile`, ADR-0039)

The page that reports on **you** rather than on baseball: club, device
behaviour, your ledger, what syncs, and what you consented to see. One sentence
governs it —

> **`/profile` renders no game data at all.**

No feed fetch, no `src/api/*` game-module import, no linescore, no stamp fact,
no number that came out of a ballpark. Counts of your own things are the only
numbers on it, which is why this screen needs no seal reasoning at all. Two
mechanical checks hold the line and both must keep passing:
`src/screens/profile/`, `src/components/profile/`, and `src/components/account/` are on
`check-stamp-surfaces.mjs`'s **forbidden** directory list (`FORBIDDEN_ART_DIRS`, narrowed to
`GameStamp` / `StampGameButton`, so a stamp COUNT stays legal and stamp ART does
not — ADR-0035's containment argument), and
`e2e/invariants/profile-no-scores.spec.js` asserts the rendered DOM carries no
score-shaped token and that the page issues **zero** requests to
`statsapi.mlb.com`. That last one is why the club strip here reads the
same-origin static club file (`api/teams-static.js`) instead of statsapi.

Shape: `ProfilePage.jsx` is the shell and owns every hook read; the four
`sections/*` are presentational. `components/profile/ProfileAccount.jsx` is the
**only** file under either directory that touches Clerk — dynamically imported
behind `isClerkEnabled`, the same pattern `RevealCloudSync` and
`LogbookAccountGate` use, never a conditionally-called hook (Clerk's hooks throw
with no provider ancestor). Clerk's `<UserProfile routing="virtual" />` mounts
*inside* the page behind a collapsed disclosure: `route.js` has no wildcard and
path routing would need Clerk to own `/profile/*`, so virtual routing is a
constraint, not a preference.

## The receipt trap

`normalizeSilentChannels` (`lib/account/syncStatus.js`) exists because `RevealCloudSync` mounts
inside `InningViewer`, so on `/profile` the `reveal` channel has never spoken —
and `rollupSync` (worst channel wins) would turn that into "This device." for a
signed-in user. A channel that never reported (`at == null`) is given the
account's own **phase, and only its phase**, never a `syncedAt`, so nothing
claims a "last checked" it never had. Read that function's header before
touching the receipt. `components/account/MergeReceiptStrip.jsx` calls it too.
