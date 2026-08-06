# src — the app shell

React 18 + Vite SPA, phone-first, no backend. This file covers screens, routing,
fetching, and the design system. The data layer has its own file
(`src/api/CLAUDE.md`), as does the club-identity data model — colours, logo
treatments, the hand-tuned `src/lib/data/*.json` stores and the dev-only lab that
writes them (`src/lib/CLAUDE.md`). The always-loaded root `CLAUDE.md` carries the
spoiler-rule summary and the high-level architecture map.

## Screens (`src/screens/`)

`GameSelect` (slate with the MLB/AAA/AA/A+/A level toggle) → `GameView` (owns the
site-home bar + away@home masthead of uniform-treatment tiles — the same
`TeamTreatmentMark` square the slate card shows — each opening the grayscale
sketch modal) →
`TeamInfo` (×2, away then home) → `InningViewer`. `LogoSheet` is a standalone
printable grayscale logo sheet for pencil-sketching, reached from the slate header.

`TeamInfo`'s club-name bar and section mastheads are **themed** to the jersey
that club is wearing that game (ADR-0030) — three CSS custom properties scoped to
the `.teaminfo` subtree, resolved by `lib/headerTheme.js`. One masthead is themed
to the OTHER club: the Starting pitcher card shows the opposing starter, so it
resolves the triad a second time against `(oppMeta.id, oppTreatment)` and scopes
it to just that `<section>`. The innings viewer and box score are deliberately
excluded: navy-and-kraft there *is* the seal metaphor. The theme's only inputs
are `(teamId, treatment)` — identity, never game state; see `src/lib/CLAUDE.md`.

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
`linkQuery`: a switch that dropped a dated link's `?d=` would be a spoiler bug.

## Routing (`src/lib/route.js`, `src/App.jsx`)

A tiny dependency-free layer over the History API (deliberately *not* react-router).
Anchored on `/` (today's slate; `/{MMDDYYYY}` alone is the slate paged to that
day — shareable, and `GameSelect`'s date arrows navigate these URLs rather than
holding local state) and `/{MMDDYYYY}/{matchup}/{section}` (a deep-linkable
game section), plus many standalone pages (`/logos`, `/leaders`, `/standings`,
player/team/umpire/manager, postseason, …) — `route.js`'s `parseRoute` header is
the authoritative, order-sensitive list of every route name. For a game section `matchup`
is the away+home team abbreviations lowercased (`milaz`; game 2 of a doubleheader
appends `-2`, game 1 stays bare so old links keep working) and `section` is
`lineup1` / `lineup2` / `top{n}` / `bottom{n}` (the innings viewer shows one
half-inning per page; legacy `inning{n}` links still parse as the top half) /
`boxscore` (the sealed full box score; also reachable straight from a past game's
slate card).

`src/App.jsx` parses `location.pathname` into a route, listens on `popstate`, and
`pushState`s on navigation; the URL is the single source of truth for which game
section shows. `GameRoute` resolves a route to a game object — instantly from the
slate-provided seed, else via `resolveGame` (scans the date's slate across levels
and matches the abbreviation slug) for cold loads / shared links. `vercel.json`
rewrites all non-asset paths to `index.html` so those links resolve on Vercel.

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

The spoiler rule (root `CLAUDE.md`) is enforced structurally in these components —
read the linked ADRs before refactoring:

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
  pure numeric stat grid — the season-context/health prose that used to stack
  under each row now lives in **Margin Notes** (`MarginNotes.jsx`, same
  reveal-clamp footing), a ranked digest spanning both teams' pitchers; see
  `docs/callouts.md`.
- **The "Now Pitching" card** (`HalfInning.jsx`) is a persistent header naming
  the arm the half OPENS with, shown for as long as the half is reachable
  (`revealed || isNextToReveal`, same ADR-0010 gate as the lineup/defense
  cards), from `select.js`'s `selectHalfStartingPitcher` (spoiler-safe,
  callable before reveal). It names that pitcher and keeps naming him — a
  **mid-half change belongs in the feed**, where `PlayByPlay` renders it as
  this same `PitcherNotice` in chronological place. The header used to be
  overridden by a live "who's on the mound now" report, which put the
  reliever's card in two places at once and, on a half revealed all at once,
  pinned the inning's LAST arm above at-bat cards the starter had pitched.
  Same header-not-feed split as `computeHalfInningFeed` dropping a *pre*-pitch
  change (its `anyPitchInHalf` guard) and `PrePitchChanges` dropping one from
  the staged list.
- **Extra innings never spoil** — `InningViewer` and `RollingLine` show only
  `regulation` innings up front, unlocking extras one at a time as `revealedThrough`
  advances (ADR-0008). `RollingLine`'s run cells double as the half-inning navigator
  (away row = tops, home row = bottoms, current half inked as selected); its
  Back/Next controls cover the full unlocked range. Each extra half opens with
  the **placed runner's own card** (`PlacedRunnerCard.jsx`, `kind: 'placed'`) —
  the at-bat frame minus the pitch ladder and RBI chip, an `AR` pill where a
  batting result would go, and `PlayDiamond`'s `placedAt` dotting the bases he
  was given. Deliberately a THIRD entry kind: `nextStepBoundary` and this file's
  `hasAtBat` guard both key on `kind === 'atbat'` and stay correct only if a
  placement doesn't answer to it. Never surface the placement above the seal —
  he is by rule the previous half's last batter.
- **At-bat stepping**: a sealed half's floating-bar button splits into "Next
  at-bat" / "Rest of half" choices, stepping `PlayByPlay`'s cards one plate
  appearance at a time via a transient cursor (`atBatCountFor`,
  `useRevealProgress`) that always collapses into a normal `revealTo` commit
  rather than becoming a second spoiler boundary (ADR-0016). One step is an
  at-bat **plus the notes trailing it** — the feed nests a stoppage at the head
  of the PA that follows it, so those notes are the announcements made after
  the batter you just charted, not a preface to the next one. The exception is
  a stoppage between pitches (`midAtBat`), which leads its own at-bat's step.
  A step therefore ends mid-play, which is why the pinch-runner pencil-in keys
  on its notice's index rather than the play's `visible` gate — read ADR-0016
  before touching `nextStepBoundary`.
  Either choice's **tap target is the dead space around it**, not just the
  button: `.pagenav` is click-through, so a missed thumb used to land on a
  player card under the fade instead. `.pagenav--innings .btn::after`
  (`styles/24-floating-nav-and-hud.css`) claims the bar around each button —
  split down the middle between the pair, Refresh excepted — and its offsets are
  measured from the
  button on purpose; anchoring them to the bar re-collapses the area mid-tap
  under `.btn:active`'s transform. `e2e/reveal-hit-area.spec.js` pins both that
  and what must stay click-through.
- **The one opt-in departure**, Scores Unlocked (ADR-0026), rides through
  `InningViewer` without touching its guarantees. `GameView` resolves
  `spoilersOffFor(officialDate)` — the pass is running, or this day was consented
  to — and hands it down; `effectiveReveal` substitutes a render-only
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
- **The Logbook stamp** (ADR-0035) is the one surface in the app that renders a
  final score *plainly*, and it is safe for a structural reason rather than a
  careful one — but the structure is **where it may render**, not a permission
  check at mint time. The server-side reveal gate was retired in ADR-0035's
  second amendment (it refused the ordinary flow, for the `onReveal` reason
  below); read that before adding any mint-time evidence back.
  `StampGameButton.jsx` renders **inside** the box score's `SealBox` reveal
  render function (`screens/BoxScore.jsx`), which is what puts a stamp out of
  reach until you open the box score — ADR-0002 again, used a third time. That
  host `SealBox` still has **no
  `onReveal` and persists nothing**, and must stay that way: give it one and a
  box score opened under the Scores Unlocked pass would silently ratchet the
  whole game's `revealedThrough`. `GameStamp.jsx` (the art) and
  `StampGameButton.jsx` may be imported only from their allowlists —
  `scripts/check-stamp-surfaces.mjs` fails `npm run lint` otherwise, and
  `e2e/invariants/logbook-stamp.spec.js` is its runtime half. The collection
  (`screens/LogbookPage.jsx`, `/logbook` + `/logbook/{season}`) and its store
  (`hooks/useStamps.js` over the pure `lib/stamps.js`) are **local-first**: a
  signed-out user has a real Logbook on that device, holding no scores at all —
  the facts are resolved at render time by `api/logbook.js`. `StampsCloudSync`
  mirrors the collection across a signed-in user's devices; it used to push the
  local reveal mark to `/api/reveal` before each mint to satisfy the gate, and
  its header records why that could never work and what replaced it.
  The stamp ART is locked (PR #502) and lives as pure math in `lib/stampArt.js`,
  with **one tunable part**: where a club's knockout mark sits in its slot
  (`lib/stampLogoTuning.js` + `data/stamp-logo-tuning.json`, tuned in
  `/identity-lab`'s Stamp placement editor — the third name on the containment
  guard's allowlist, and the only one whose game is a fabricated literal). Read
  ADR-0035's amendment first: that store is consulted on every render, so
  retuning a club restyles its stamps in every Logbook that already holds one.
  The stamp's **ink** is the winning club's darkest brand colour
  (`lib/stampInk.js` → the `--stamp-ink` custom property `.gamestamp` falls back
  from) — the one module in `src/lib/` that colours anything from game state,
  contained by the same allowlist and safe for the same reason. ADR-0036's
  second addendum has the argument; do not import it anywhere else.
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
- **A placement is `{ page, x, y, tilt }` with x/y as FRACTIONS**, stored on the
  stamp record and synced (`src/lib/stamps.js`). Pixels would be a fact about
  one screen; the same book has to render on a phone page and a desktop spread,
  and on both of one user's devices.
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
off it. Read ADR-0036 before adding a third name.

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

`src/index.css` holds **no rules** — it is a banner comment and 55 `@import`s:
the six `src/tokens/*.css` files (colors, typography, spacing, layout, effects,
fonts), then the 49 `src/styles/NN-name.css` partials in cascade order. It was a
single 30,326-line file until it was cut at verified brace-depth-0 boundaries;
`cat src/styles/*.css` still reproduces that file's body byte-for-byte, and the
built stylesheet is unchanged, because Vite inlines `@import` at build time.

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
