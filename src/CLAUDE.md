# src — the app shell

React 18 + Vite SPA, phone-first, no backend. This file covers screens, routing,
fetching, and the design system. The data layer has its own file
(`src/api/CLAUDE.md`), as does club identity — colours, logo treatments, the
`src/lib/data/*.json` stores, and their two editors: the dev-only lab
(`src/lib/CLAUDE.md`) and the team hub's gear, whose runtime overlay is
`docs/identity-overrides.md`. Root `CLAUDE.md` has the spoiler rule and the map.

## Screens (`src/screens/`)

`GameSelect` (slate with the MLB/AAA/AA/A+/A level toggle) → `GameView` (owns the
site-home bar + away@home masthead of uniform-treatment tiles — the same
`TeamTreatmentMark` square the slate card shows — each opening the grayscale
sketch modal) →
`TeamInfo` (×2, away then home) → `InningViewer`. `LogoSheet` is a standalone
printable grayscale logo sheet for pencil-sketching, reached from the slate header.

`TeamInfo`'s club-name bar and section mastheads are **themed** to the jersey that
club wears that game (ADR-0030) — three CSS properties from `lib/headerTheme.js`,
whose only inputs are `(teamId, treatment)`: identity, never game state
(`src/lib/CLAUDE.md`). The Starting pitcher card resolves the triad a second time
against the OTHER club (it shows the opposing starter), scoped to its `<section>`.
Themed surfaces are picked per ELEMENT, not per page: **a club may colour a card
that identifies the club** (box score and innings view included), never a control,
cover, or seal-state report — ADR-0030's 2026-08-10 addendum replaces that rule.

### The team hub (`/team/{id}`, `src/screens/team/`)

Not one page — a pinned identity header (`TeamHubShell`, fed by the deliberately
cheap `loadTeamIdentity`) plus **five tabs, each a real route**: Overview
(`TeamPage.jsx`, the bare `/team/{id}`), Roster, Games, Numbers, Minors
(`MinorsTab.jsx`, formerly "Org"), plus the pre-existing `/team/{id}/leaders`.
**Each tab loads only its own data** — one `data/load{Tab}.js` per tab, never
a shared mega-fetch; that is the whole point, not an implementation detail
(ADR-0034, which also records why the old twenty-module scroll was split and
why the loaders were briefly duplicated).

Where things live: roster projection / 40-man / injured list → Roster; schedule,
every decided game, photos, transactions → Games; standings, batting + pitching
ranks, leaders, jerseys, day-of-week, comebacks → Numbers; affiliates, prospects,
affiliation history → Minors. The Overview holds **previews only**, each ending in
a `.thub-door` link to the tab that owns it, and each is a `preview`/`limit` prop
on the same module the tab renders in full — never a parallel component. The one
pair that isn't literally the same component still lives in one module:
`modules/TeamGames.jsx` exports the Overview's `LastTenGames` rail and the Games
tab's `AllGames` grid over one shared ticket-stub card, since a sideways rail is
the wrong shape for a whole season and a grid is the wrong shape for a preview.

A tab's secondary modules render as full cards, same as its headline module —
no collapsed/shelved state. Every tab path goes through `teamTabPath` →
`linkQuery`, so a dated link keeps its `?d=` across a tab switch. The hub itself
opens on **current** stats — links out of a game stopped stamping that cutoff on
(ADR-0034's "The cutoff is opt-in now"); `?d=` still applies when a URL carries
one, and `components/seal/AsOfBanner.jsx` is the way IN (a date picker on a live
page), the way to CHANGE it, and the way back to live — see ADR-0034's "The gap
gets a way in." Same component on the player page and both leader-board pages.

## Routing (`src/lib/route.js`, `src/App.jsx`)

A tiny dependency-free layer over the History API (deliberately *not* react-router).
Anchored on `/` (today's MLB slate; a league prefix and/or `/{MMDDYYYY}` name
any other — `/aaa`, `/aa/08152026`, both defaulting by absence, ADR-0056, and
`GameSelect` navigates them) and `/{MMDDYYYY}/{matchup}/{section}` (a deep-linkable
game section), plus many standalone pages (`/logos`, `/leaders`, `/standings`,
player/team/umpire/manager, postseason, …) — `route.js`'s `parseRoute` header is
the authoritative, order-sensitive list of every route name. For a game section `matchup`
is the away+home team abbreviations lowercased (`milaz`; game 2 of a doubleheader
appends `-2`, game 1 stays bare so old links keep working) and `section` is
`lineup1` / `lineup2` / `top{n}` / `bottom{n}` (one half-inning per page; legacy
`inning{n}` parses as the top half) / `boxscore` (sealed, also reachable from a past
game's slate card) / `preview` (the poster studio, `docs/preview-poster.md`) /
`sheet` (printable, grid EMPTY — `docs/print-sheet.md`) / `scorecard` (live #22 sheet, ADR-0047).

`src/App.jsx` parses `location.pathname` into a route, listens on `popstate`, and
`pushState`s on navigation; the URL is the single source of truth for which game
section shows. `GameRoute` resolves a route to a game object — instantly from the
slate-provided seed, else via `resolveGame` (scans the date's slate across levels
and matches the abbreviation slug) for cold loads / shared links. `vercel.json`
rewrites all non-asset paths to `index.html` so those links resolve on Vercel.

## My Tally (`/profile`, `src/screens/profile/`, ADR-0039)

The page that reports on **you** rather than on baseball: club, device
behaviour, your ledger, what syncs, and what you consented to see. One sentence
governs it —

> **`/profile` renders no game data at all.**

No feed fetch, no `src/api/*` game-module import, no linescore, no stamp fact,
no number that came out of a ballpark. Counts of your own things are the only
numbers on it, which is why this screen needs no seal reasoning at all. Two
mechanical checks hold the line and both must keep passing:
`src/screens/profile/` and `src/components/profile/` are on
`check-stamp-surfaces.mjs`'s **forbidden** directory list (narrowed to
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

**`ClubPicker.jsx` (`components/account/`) is the one club strip.** It takes
`teams` as a prop and fetches nothing; `/profile` and the first-visit intro both
render it, from different sources on purpose. Do not grow a second one.

**The sync seam.** `components/sync/SyncStatusProvider.jsx` mounts
unconditionally in `App.jsx` (it touches no Clerk API) as an external store, so
a sync report re-renders only what reads it; the four headless `*CloudSync`
components `report()` from the `catch` blocks they already had — the catches
still swallow, they just stopped being silent. The reducer and the
`unavailable` (501, a supported deploy state) vs `error` distinction live in
`src/lib/account/syncStatus.js` (see `src/api/CLAUDE.md`). One trap:
`ProfilePage`'s **`normalizeStatus`** exists because `RevealCloudSync` mounts
inside `InningViewer`, so on `/profile` the `reveal` channel has never spoken —
and `rollupSync` (worst channel wins) would turn that into "This device." for a
signed-in user. A channel that never reported (`at == null`) is given the
account's own **phase, and only its phase**, never a `syncedAt`, so nothing
claims a "last checked" it never had. Read that function's header before
touching the receipt.

Onboarding is the same subsystem's other half: `lib/account/intro.js`
(`bbsbh:intro`, the first-visit flag that replaced the old
"`bbsbh:favoriteTeam` exists" proxy) and `lib/account/prompts.js`
(`bbsbh:prompts`, the bounded one-shot map behind the contextual prompts).
Both are pure, both return the **same object reference** when nothing changed,
and both are one-directional — a dismissal never re-fires. Nothing about them
syncs: a dismissal is a fact about this browser, not the account.

## Admin-editable copy (`src/copy/`)

The wording of the spoiler-consent surfaces is admin-editable, not hard-coded.
`src/copy/registry.js` is the closed source of truth (ids, defaults, length caps,
`sanitizeOverrides`, and `TOKENS` — the closed `{time}`/`{inning}` substitution
set, whose header records why a score-bearing token may never join it);
`CopyProvider.jsx` + `copyContext.js` resolve
`defaults ← localStorage cache ← live /api/copy` and expose
`useCopy().t(id, tokens)`, always falling back to defaults. Every substitution
goes through `fillTokens` — never an ad hoc `.replace` at a call site, which
skips both the closed-set check and the drop-the-token-and-tidy-the-gap path.
The unlinked `/admin` route (`screens/AdminCopy.jsx`) is the Clerk-admin-gated
editor (with version history). It stores UI text only — never a score — see
ADR-0025 and the "no backend exceptions" prose in the root `CLAUDE.md`. When
adding a new consent string, add a registry field; never inline the literal in a
component.

## Fetching (`src/hooks/useAsync.js`)

The `useAsync` hook runs a promise on mount/deps-change and exposes
`{ loading, error, data, reload }`. Two seams it guards: a per-run token discards
out-of-order completions (a slow request left in flight across a deps change must
not clobber newer data), and a deps change resets `data` to null while `reload`
(same deps) keeps the last-good data — stale-while-revalidate for the live-game
Refresh, never across games/dates.

## UI-side spoiler enforcement

The spoiler rule governs the **scoring surfaces** (root `CLAUDE.md`): the slate's
score cells, the two lineup pages, the innings viewer, the box score. It is
enforced structurally in the components below — read the linked ADRs before
refactoring. Nothing on an open surface (player and team pages, leader boards,
standings) is gated here, and **adding a gate there is a regression, not a
hardening** — that is the mistake ADR-0034's "The cutoff is opt-in now" undid.

- **`src/components/SealBox.jsx`** takes `children` as a render function, invoked
  only once revealed; reveal is one-directional, and re-sealing on inning
  navigation works by the parent remounting with `key={`${inning}-${half}`}`
  (see `InningViewer.jsx`/`screens/innings/InningPage.jsx`) (ADR-0002).
- The **defense diamond** and both teams' **lineup cards** render *outside* the
  seal as the pre-scoring reference (above it while sealed, below the play-by-play
  once revealed), gated to `revealed || isNextToReveal` (ADR-0010). The data comes
  from the caller-gated pre-pitch selectors in `src/api/` (see `src/api/CLAUDE.md`).
- **The Pitchers table** (`src/api/pitchers.js` → `computePitcherLines`, rendered by
  `PitchersSection` in `InningViewer.jsx`) is gated by the same `revealedThrough`
  high-water mark as the seals rather than wrapped in a `SealBox` (ADR-0009). A
  pure numeric stat grid — the season-context/health prose now lives in **Margin Notes**
  (`MarginNotes.jsx`, same reveal-clamp footing), a ranked digest over both teams' arms that
  demotes what this reader already saw (`hooks/useCalloutLedger.js`; rules `docs/callouts.md`).
- **The "Now Pitching" card** (`HalfInning.jsx`) names the arm the half OPENS
  with, from `select.js`'s `selectHalfStartingPitcher` (spoiler-safe, callable
  before reveal), gated `revealed || isNextToReveal` (ADR-0010). It names that
  pitcher and keeps naming him — a **mid-half change belongs in the feed**, where
  `PlayByPlay` renders it as this same `PitcherNotice` in chronological place. A
  live "who's on the mound now" override used to put the reliever's card in two
  places at once; same header-not-feed split as `computeHalfInningFeed` dropping
  a *pre*-pitch change (`anyPitchInHalf`) and `PrePitchChanges` dropping one from
  the staged list. **Windowed, it is an announcement, not a header** — only a
  half opening with a fresh arm (`selectIsFreshPitcher`), only until the first
  at-bat is unveiled. Those two omissions make it the ONLY announcement of a
  between-innings change, so it may not be dropped there: ADR-0043's second.
- **Extra innings never spoil** — `InningViewer` and `RollingLine` show only
  `regulation` innings up front, unlocking extras one at a time as `revealedThrough`
  advances (ADR-0008). `RollingLine`'s run cells double as the half-inning navigator
  (away row = tops, home row = bottoms, current half inked as selected); its
  Back/Next controls cover the full unlocked range. Each extra half opens with the
  **placed runner's own card** (`PlacedRunnerCard.jsx`, `kind: 'placed'`) — the
  at-bat frame minus the pitch ladder and RBI chip, an `AR` pill where a batting
  result would go, and `PlayDiamond`'s `placedAt` dotting the bases he was given.
  Deliberately a THIRD entry kind: `nextStepBoundary` and this file's `hasAtBat`
  guard both key on `kind === 'atbat'` and stay correct only if a placement doesn't
  answer to it. Never surface the placement above the seal — he is by rule the
  previous half's last batter.
- **At-bat stepping**: a sealed half's floating-bar button splits into "Next at-bat" /
  "Rest of half", stepping `PlayByPlay`'s cards one plate appearance at a time via a
  transient cursor (`atBatCountFor`, `useRevealProgress`) that collapses into a normal
  `revealTo` commit, not a second spoiler boundary (ADR-0016) — but NOT while the half
  is still being PLAYED (ADR-0055), where the entry list is only the half SO FAR:
  `stepCommitReady` withholds the commit, the bar drops "Rest of half", and the live edge
  reads "Caught up" (`selectLiveHalf`, `api/liveEdge.js`). The lineup page's "Catch up to
  live" (`catchUpPlan`) is its sibling: it ratchets to the half BEFORE the live one and
  lands there sealed. One step is an at-bat **plus the notes trailing it** — the feed
  nests a stoppage at the head of the PA that follows it, so they announce what followed
  the batter you just charted, not a preface to the next. The exception is a stoppage
  between pitches (`midAtBat`), which leads its own at-bat's step. A step therefore ends
  mid-play, which is why the pinch-runner pencil-in keys on its notice's index rather
  than the play's `visible` gate — read ADR-0016 before touching `nextStepBoundary`.
  Either choice's **tap target is the dead space around it**: `.pagenav` is click-through,
  so a missed thumb landed on the card under the fade. `.pagenav--innings .btn::after`
  (`styles/24-floating-nav-and-hud.css`) claims the bar around each button — split between
  the pair, Refresh excepted — offsets from the button, not the bar (else the area
  re-collapses mid-tap under `.btn:active`). `e2e/reveal-hit-area.spec.js` pins it.
- **The console** (ADR-0043): anchored scorebug band, wrapping trail, tabbed
  reference, `RollingLine` demoted but NEVER removed — every half, live or
  historical. Only the play-by-play varies: **windowed** (one at-bat) vs.
  **stacked** (the whole half); rules in `styles/focus/*`.
- **Two opt-in departures** ride through `InningViewer` without touching its guarantees.
  `GameView` resolves `spoilersOffFor(officialDate)` — the Scores Unlocked pass is running, or
  this day was consented to (ADR-0026) — and hands it down; the reader's own **stamp** on this
  game (ADR-0048, from `useStamps`) opens it too. `effectiveReveal` takes both, substituting a render-only
  `renderRevealedThrough`/`renderUnlocked` for every render consumer while the
  persisted `revealedThrough` (what feeds `useRevealProgress`, `RevealCloudSync`,
  and localStorage) stays untouched. Its `commitReveals` is the other half of that
  and must not be dropped: `SealBox` fires `onReveal` on a force-revealed mount as
  well as a tap, so without it every half merely LOOKED at ratchets the real mark.
  `selectLiveEdge` drives navigation only — under the pass everything already
  renders open, so there is nothing for a ratchet to advance.
- **"Logbook" is the CODE name only — the UI says "Game Log."** Route
  (`/logbook`), modules, CSS classes, and storage keys all keep `logbook`; every
  user-visible string says Game Log. Renaming the route would break every shared
  stamped-game deep link and its cached OG card, so don't. **`docs/game-log.md`**
  is the full scope: the naming contract, every display-copy location, and the
  voice rules — read it before writing any copy this feature shows.
- **The Logbook stamp** (ADR-0035) is the one thing reachable from a *scoring
  surface* that renders a final score plainly, and it is safe for a structural
  reason rather than a careful one — but the structure is **where it may
  render**, not a permission check at mint time. The server-side reveal gate was retired in ADR-0035's
  second amendment (it refused the ordinary flow, for the `onReveal` reason
  below); read that before adding any mint-time evidence back.
  `StampGameButton.jsx` renders **inside** the box score's `SealBox` reveal
  render function (`screens/BoxScore.jsx`), which is what puts a stamp out of
  reach until you open the box score — ADR-0002 again, used a third time. That
  gate is the render **function**, not a position on the page: the affordance is
  a thin strip across the HEAD of the revealed sheet (ADR-0035's third
  amendment), and it stays ONE row — mount, a line of copy, one action — with
  everything a minted stamp additionally offers behind its `Details` disclosure.
  Its two positions are CSS, not two renders: first child of the Highlights
  section, with `48-stamp-strip.css` floating that section's title and the
  R/H/E/LOB totals above it below the wide breakpoint. That
  host `SealBox` has an `onReveal` since ADR-0049, but only for a real TAP: it writes
  `bbsbh:boxreveal:{gamePk}`, one bit that re-opens this page and nothing else, withheld under
  the pass and under a stamp — either would record a permanent mark for a seal nobody touched,
  and neither may ever reach `revealedThrough`. `GameStamp.jsx` (the art) and
  `StampGameButton.jsx` may be imported only from their allowlists —
  `scripts/check-stamp-surfaces.mjs` fails `npm run lint` otherwise, and
  `e2e/invariants/logbook-stamp.spec.js` is its runtime half. The collection
  (`screens/LogbookCollection.jsx`, `/logbook` + `/logbook/{season}` — a user
  may hold more than one book, ADR-0041) and its store
  (`hooks/useStamps.js` over the pure `lib/stamps.js`) are **local-first**: a
  signed-out user has a real Logbook on that device, holding no scores at all —
  the facts are resolved at render time by `api/logbook.js`. `StampsCloudSync`
  mirrors the collection across a signed-in user's devices; its header records
  why the old pre-mint reveal-mark push could never satisfy the retired gate.
  The stamp ART is locked (PR #502) and lives as pure math in `lib/stampArt.js`,
  with **one tunable part**: where a club's knockout mark sits in its slot
  (`lib/stampLogoTuning.js` + `data/stamp-logo-tuning.json`, tuned in
  `/identity-lab`'s Stamp placement editor — the third name on the containment
  guard's allowlist, and the only one whose game is a fabricated literal). Read
  ADR-0035's amendment first: that store is consulted on every render, so
  retuning a club restyles its stamps in every Logbook that already holds one.
  The stamp's **ink** is the winning club's darkest brand colour
  (`lib/stampInk.js` → the `--stamp-ink` property `.gamestamp` falls back from) —
  the one module in `src/lib/` that colours anything from game state, contained
  by the same allowlist and safe for the same reason (ADR-0036's second
  addendum); do not import it anywhere else. A **minor-league** game inverts the
  ring band — same ink, same silhouette (`stampRingInverted`, ADR-0036's fourth).
- **The forward page-turn transition** (`src/components/page-turn/`) mounts an
  inert preview of the destination half — real (possibly still-sealed)
  content — underneath the active one during the animation. `SealBox`'s own
  render-function gate (ADR-0002) is what keeps that preview spoiler-safe;
  `InningPage.jsx`'s `presentationOnly` flag only mutes side-effecting
  callbacks (`onReveal`/`onStepInfo`) so the preview can't
  itself advance `revealedThrough` or double-report a step. Not a second
  reveal boundary — see ADR-0024.

## The Logbook's passport book (`src/components/passport/`, ADR-0036)

`/logbook` is a passport book: a club-coloured cover, cream pages, and stamps
you place by tapping the page. Three rules, each with a reason:

- **Geometry lives in `src/lib/passportLayout.js`**, not in these components.
  Capacity, page aspect, margins, the deterministic per-game tilt, the
  collision nudge and the auto-layout are all pure and unit-tested
  (`test/passport-layout.test.js`). A component that types a coordinate has put
  it somewhere nothing can check. Two conversions in that module are easy to
  invert and one already was: a y-fraction converts to width-units by
  **dividing** by `PAGE_ASPECT`, while a stamp's width-fraction converts to a
  height-fraction by **multiplying**.
- **A placement is `{ bookId, page, x, y, tilt }` with x/y as FRACTIONS**,
  stored on the stamp record and synced (`src/lib/stamps.js`). Pixels would be
  a fact about one screen; the same book has to render on a phone page and a
  desktop spread, and on both of one user's devices. A book is separate
  metadata (`src/lib/books.js` + `hooks/useBooks.js`) never holding the
  collection itself — every device always has at least one (`DEFAULT_BOOK_ID`),
  so `/logbook` opens it directly for as long as it's the only one; two or more
  surface `LogbookShelf.jsx` instead. `passportLayout.js` needed no bookId
  awareness at all — every function there already took a `stamps` array, and
  the caller pre-filters it to one book first. ADR-0041.
- **Minting and placing are separate.** The mint stays in the box score's
  `SealBox` (ADR-0035); placing happens here via `?place={gamePk}`. An unplaced
  stamp waits in the book's tray, so abandoning the flow never loses a keepsake.
- **A placement is editable, and a move IS the placing flow.** Tapping a placed
  stamp opens its options bar (open the game, move it, back to the tray) instead
  of navigating; "Move it" re-enters placing mode on a stamp that already has a
  placement. `placeStamp` was always a move as much as a first placement, so the
  only things a move adds are `otherPlacementsOn`/`pageIsFullFor` in
  `passportLayout.js` — the stamp must not collide with, or be counted against,
  its OWN current spot. Do not build a second placement path.
- **One thing in this book moves on its own**: the stamp you just confirmed
  plays `passport-stamp-land` once — held above the paper, accelerating down
  (`--ease-press`, the system's only ease-IN, because a stamp is *pushed*),
  compressing 4% on impact, releasing to rest. Cleared by `animationend` so the
  duration lives in the CSS alone, skipped rather than slowed under reduced
  motion, and deliberately NOT fired by "place them all for me".
- **The page is RULED into eight boxes** (`pageSlots()`, 2 across × 4 down),
  drawn faintly so a blank page says where a stamp goes; it comes up while
  placing and settles back after. `PAGE_CAPACITY` is `PAGE_COLUMNS * PAGE_ROWS`
  and auto-layout fills those same boxes, so the guide, the tidy-up and "this
  page holds 8" cannot disagree. It is a **guide, not a snap** — the tap still
  decides (ADR-0036 rejected snapping and still does). The grid also absorbed
  the dashed margin guide that used to be drawn on the tap target.
- **A stamp is pressed in the winner's ink** — `lib/stampInk.js`, published as
  `--stamp-ink` so any rule that sets `color` outright still wins (the mint
  card's un-minted preview stays graphite). No winner, or a club with no colour
  on file, means no property and the book's own navy.

`PassportPage.jsx` is the ONE name added to `scripts/check-stamp-surfaces.mjs`'s
allowlist since that guard was written — justified because a page's entire input
is the user's own collection. `/logbook/stats` renders no stamp art and stays
off it. Read ADR-0036 before adding a third name; the multi-book split
(ADR-0041) renamed the `LogbookPage.jsx` entry to `LogbookCollection.jsx` rather
than adding one, and `StampCollection.jsx` joined it the same way (read that
script). `LogbookShelf.jsx`/`BookManagementSheet.jsx` draw no stamp art.

## Notification cards, casing, color, and button copy (ADR-0017)

Every mid-inning "something happened" moment in `PlayByPlay.jsx` sorts into one
of three tiers — a fresh/changed actor (`PitcherNotice`/`FielderNotice`/
`PinchRunNotice`/`BatterNotice` — a mid-inning pinch hitter gets the same "now
batting" notice the pre-pitch staged list shows, for symmetry with every other
substitution type), a team/administrative event (mound visit, ejection), or a
baserunning/misc event with no plate appearance of its own (steal, wild pitch,
balk, …) — and all three render in the *same* kraft-amber
`.pitchernotice.pitchernotice--pbp` card, distinguished by what's inside (a
headshot vs. a scorer's-shorthand code) rather than a colored accent rail.
Read ADR-0017 before touching any of `PlayByPlay.jsx`'s notification
components, `MoundVisitPips`, or `HalfInning.jsx`'s `PrePitchChanges` — it
also covers the casing rule (no per-component `.toUpperCase()`, guarded by
`scripts/check-name-casing.mjs`), the `--accent-positive`/`--accent-negative`
color pairing, and the button/label conventions (chevron vs. destination-named
link, "Reveal" always visible, accessible name contains the visible word).

## Site search is the one dialog that isn't a sheet (ADR-0037)

`SiteSearchModal` (`components/chrome/SiteSearch.jsx`) is a full-screen, top-anchored
surface (`.searchoverlay`), **not** the shared `.scrim`/`.sheet` bottom sheet
every other dialog here uses. Not a style choice: a docked sheet is positioned
against the layout viewport, which an on-screen keyboard does not shrink, so the
field and every result sat behind the keyboard the moment the field auto-focused.
Read ADR-0037 before consolidating it back. Three things there are load-bearing —
`useVisualViewport` sizing the overlay to the visible rectangle (no CSS unit
reports where a keyboard starts; `100dvh` tracks browser chrome, not the
keyboard), the document scroll lock, and a result row cancelling its own
`pointerdown` so the keyboard can't retract mid-tap and reflow a different row
under the finger. It is deliberately **not** portalled: the ALL-CAPS invariant is
a `#root *` rule, and a portal to `<body>` lands outside it. `--fs-field` (16px)
is the iOS auto-zoom floor, not a taste call. The recents shelf is pure and
shape-gated in `lib/recentSearches.js` (identity fields only, never a score) with
`hooks/useRecentSearches.js` over it; `e2e/site-search.spec.js` is the guard.

## Design system (`src/styles/*` + `src/tokens/*`)

`src/index.css` holds **no rules** — a banner comment and `@import`s: the six
`src/tokens/*.css` files, then the `src/styles/NN-name.css` partials in cascade
order. It is the **core** sheet, not every partial: `main.jsx` imports it, so every
line render-blocks every route, and a partial only one lazy screen uses is imported
by that screen instead (a per-route chunk; 521 KB blocking → 368 KB). Files stay in
`src/styles/`, guards unchanged; index.css says which left, who owns each, and the two rules for leaving.

**Order is the contract.** The numeric prefix IS the cascade — later partials
override earlier ones at equal specificity, exactly as later lines did in the
old file. Never reorder the `@import` list to tidy it, and add a new partial at
the position its rules belong in, not at the end. To find a rule, grep
`src/styles/`; the file names say which surface each covers.

`check-typography.mjs` and `check-focus-ring.mjs` read the whole directory (not
a fixed list), so a new partial is covered the moment it exists — and both fail
loudly if they are ever pointed at something with no rules in it, which is what
caught this split rather than letting it silently disable them.

The tiers are layered Carbon-style
(ADR-0023): a **primitive** tier of raw values — `spacing.css` is the generic 4px
scale + radii + border widths, `colors.css`'s `--paper-*`/`--ink-*`/`--seal` — and
a **semantic alias** tier components consume (`--bg-canvas`, `--text-body`,
`--seal-cover`). App-specific component geometry (the `--cell-size`, the `--shot-*`
headshot rungs, the `--app-width` frame) lives in `tokens/layout.css`, kept OUT of
the primitive scale. There is deliberately **no** third component tier — stay
two-tier, promoting a value to a named component-scoped token only on high reuse or
a guardable invariant (ADR-0023). The visual metaphor is a paper scorebook: manila
paper, navy ink, pencil graphite, kraft-tape amber for seals. Use the semantic CSS
variables (`--surface-card`, `--accent-negative`, `--seal-cover`, etc.) rather than
raw hex. Numbers render as mono tabular figures; structural labels are condensed
uppercase.

**Team marks on a dark surface are ART, not a filter.** The navy section
mastheads (`SectionMasthead`'s `logo` prop — Batting order, Starting pitcher,
Defense, Due up next) ask `TeamLogo` for the `mono` variant: a one-color
knockout mark precomputed per club by `scripts/gen-mono-logos.mjs` into
`public/data/logos/mono/`. Don't reach for `filter: brightness(0) invert(1)` to
whiten a logo — that's what this replaced, and it flattens every mark whose
interior detail is drawn in a light fill into an unreadable blob. Read ADR-0031
before changing how any of these render; the conversion itself lives in
`src/lib/logoMono.js`.

Type size, weight, leading, and tracking must use the semantic roles in
`tokens/typography.css`; `scripts/check-typography.mjs` rejects new ad hoc values in
`src/styles/*.css`. Focus rings must use `var(--focus-ring)`/`var(--ring)`
(`check-focus-ring.mjs`), and the documented text-on-background token pairings must
hold WCAG AA (`check-contrast.mjs`) — see ADR-0023. The global ALL-CAPS invariant
(see the block comment in `src/styles/01-base.css`) is guarded by `scripts/check-caps.mjs`
(the CSS half) and `scripts/check-name-casing.mjs` (the JS half — no per-component
`.toUpperCase()`/`.toLowerCase()` on rendered text; see ADR-0017) via `npm run lint`.
