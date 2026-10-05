# src — the app shell

React 19 + Vite SPA, phone-first. This file covers screens, routing, fetching, the
design system, and the UI half of the spoiler rule. Folder rules sit in nested files
(root `CLAUDE.md` lists them). The data layer is `src/api/CLAUDE.md`. Club identity —
colours, logo treatments, the `src/lib/data/*.json` stores — is `src/lib/CLAUDE.md`;
its two editors are the dev-only lab (`docs/identity-lab.md`) and the team hub's gear
(`docs/identity-overrides.md`). Root `CLAUDE.md` has the spoiler rule and the map.

## Screens (`src/screens/`)

`GameSelect` (slate) → `GameView` (site-home bar + away@home
masthead of uniform-treatment tiles — the `TeamTreatmentMark` square the slate card
shows — each opening the sketch modal) → `TeamInfo` (×2) → `InningViewer`.
`LogoSheet` is a printable grayscale logo sheet, off the slate header. The **Matchup Scout** (`/scout`, `screens/scout/`) is one pitcher against one hitter: spec `docs/scout-design.md`, its view toggle ADR-0093, its Savant cutoff ADR-0095. An empty slate gets a second page state (`src/components/offseason/`): `src/components/offseason/CLAUDE.md`.

`TeamInfo`'s club-name bar and section mastheads are **themed** to the jersey that
club wears that game (ADR-0030) — five CSS properties from `lib/headerTheme.js`,
which reads identity only, never game state (`src/lib/CLAUDE.md`). The Starting pitcher card resolves the triad a second time
against the OTHER club (it shows the opposing starter), scoped to its `<section>`.
Themed surfaces are picked per ELEMENT, not per page: **a club may colour a card
that identifies the club** (box score and innings view included), never a control,
cover, or seal-state report — ADR-0030's 2026-08-10 addendum replaces that rule.

### The team hub (`/team/{id}`, `src/screens/team/`)

Tabs, loaders, and where things live: `src/screens/team/CLAUDE.md`. The hub itself
opens on **current** stats — links out of a game stopped stamping that cutoff on
(ADR-0034's "The cutoff is opt-in now"); `?d=` still applies when a URL carries
one, and `components/seal/AsOfBanner.jsx` is the way IN (a date picker on a live
page), the way to CHANGE it, and the way back to live — see ADR-0034's "The gap
gets a way in." Same on the player hub (`docs/player-hub.md`) and the leader boards.

## Routing (`src/lib/route.js`, `src/App.jsx`)

A tiny dependency-free layer over the History API (deliberately *not* react-router).
Anchored on `/` (today's MLB slate; a league prefix and/or `/{MMDDYYYY}` name
any other — `/aaa`, `/aa/08152026`, both defaulting by absence, ADR-0056, and
`GameSelect` navigates them) and `/{MMDDYYYY}/{matchup}/{section}` (a deep-linkable
game section), plus many standalone pages (`/logos`, `/leaders`, `/standings`,
player/team/umpire/manager, postseason, …). A person/club page is `{slug}-{id}`
(ADR-0057); `route.js`'s `parseRoute` header lists every route name, in order. A game's
`matchup` is the away+home team abbreviations lowercased (`milaz`; game 2 of a doubleheader
appends `-2`, game 1 stays bare so old links keep working) and `section` is
`lineup1` / `lineup2` / `top{n}` / `bottom{n}` (one half-inning per page; legacy
`inning{n}` parses as the top half) / `boxscore` (sealed, also reachable from a past
game's slate card) / `preview` (the poster studio, `docs/preview-poster.md`) /
`sheet` (printable, grid EMPTY — `docs/print-sheet.md`) / `scorecard` (live #22 sheet, ADR-0047; on a phone it opens in the lens, `components/scoring/lens/`, ADR-0092).

`src/App.jsx` parses `location.pathname` into a route, listens on `popstate`, and
`pushState`s on navigation; the URL is the single source of truth for which game
section shows. `GameRoute` resolves a route to a game object — instantly from the
slate-provided seed, else via `resolveGame` (scans the date's slate across levels
and matches the abbreviation slug) for cold loads / shared links. `vercel.json`
rewrites all non-asset paths to `index.html` so those links resolve on Vercel.

## My Tally (`/profile`, `src/screens/profile/`, ADR-0039)

`/profile` renders no game data at all. Rules: `src/screens/profile/CLAUDE.md`.

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
ADR-0025 and the `api/` functions prose in the root `CLAUDE.md`. When
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

Three gotchas each caused a real spoiler bug and are now ADRs: roster-card
membership and position labels (ADR-0005); per-inning `errors` being a *fielding*
stat, not a score (ADR-0006); and `useRef` caches of reveal-only derivations that
must key on the `feed` object (ADR-0007).

- **`src/components/SealBox.jsx`** takes `children` as a render function, invoked
  only once revealed; reveal is one-directional, and re-sealing on inning
  navigation works by the parent remounting with `key={`${pageInning}-${pageHalf}`}`
  (see `src/screens/InningViewer.jsx`) (ADR-0002).
- The **defense diamond** and both teams' **lineup cards** render *outside* the
  seal as the pre-scoring reference (above it while sealed, below the play-by-play
  once revealed), gated to `revealed || isNextToReveal` (ADR-0010). The data comes
  from the caller-gated pre-pitch selectors in `src/api/` (see `src/api/CLAUDE.md`).
- **The Pitchers table** (`src/api/pitchers.js` → `computePitcherLines`, rendered by
  `components/inning/PitchersSection.jsx`) is gated by the same `revealedThrough`
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
  between pitches (`midAtBat`), or any steal/pickoff, which leads its own step and window (ADR-0016's amendment). A step therefore ends
  mid-play, which is why the pinch-runner pencil-in keys on its notice's index rather
  than the play's `visible` gate — read ADR-0016 before touching `nextStepBoundary`.
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
  gate is the render **function**, not a position on the page; the strip's layout is in
  `src/components/logbook/CLAUDE.md`. That host `SealBox` has an `onReveal` since ADR-0049, but only for a real TAP: it writes
  `bbsbh:boxreveal:{gamePk}`, one bit that re-opens this page and nothing else, withheld under
  the pass and under a stamp — either would record a permanent mark for a seal nobody touched,
  and neither may ever reach `revealedThrough`. `GameStamp.jsx` (the art) and
  `StampGameButton.jsx` may be imported only from their allowlists —
  `scripts/check-stamp-surfaces.mjs` fails `npm run lint` otherwise, and
  `e2e/invariants/logbook-stamp.spec.js` is its runtime half. The collection and its local-first store: `src/components/logbook/CLAUDE.md`.
  The stamp art, its one tunable store, and its ink: `src/lib/CLAUDE.md`.
- **The forward page-turn transition** (`src/components/page-turn/`) mounts an
  inert preview of the destination half — real (possibly still-sealed)
  content — underneath the active one during the animation. `SealBox`'s own
  render-function gate (ADR-0002) is what keeps that preview spoiler-safe;
  `InningPage.jsx`'s `presentationOnly` flag only mutes side-effecting
  callbacks (`onReveal`/`onStepInfo`) so the preview can't
  itself advance `revealedThrough` or double-report a step. Not a second
  reveal boundary — see ADR-0024. **Box Lines** (`components/boxlines/`) carries final scores on the lineup page; its gate is `api/boxlines/rows.js`, not the sheet — ADR-0069.
- **Express Lane posters** (`src/api/expresslane/`): a poster URL is safe while the
  PICTURE is not — every frame carries the broadcast scorebug burned into the pixels —
  so a poster may render only inside an already-revealed play, and never as the
  placeholder for the next clip.

## Components with folder rules

- **The Logbook's passport book** (ADR-0036): `src/components/passport/CLAUDE.md`.
- **Notification cards, casing, color, and button copy** (ADR-0017):
  `src/components/playbyplay/CLAUDE.md`.
- **Site search is the one dialog that isn't a sheet.** Do not consolidate it into
  `.scrim`/`.sheet` (ADR-0037): `src/components/chrome/CLAUDE.md`.

## Design system (`src/styles/*` + `src/tokens/*`)

**Look before you add a partial:** `/design-lab` renders every token, component and
card/pill block (verdicts: `.scratch/design-system/inventory.md`).

**Name a block for its job, never its shape:** the six-clause grammar is ADR-0084. The
157 classes that break it, with the collapse issue that renames each, are the ledger in
`docs/design-system-naming.md`.

**One control, one door:** a button acts on this page and is `.btn`
(`styles/system/button.css`, `ui/control/Button.jsx` — `size` tap/control, `skin`
outline/ink/ghost/danger/seal, selected is `aria-pressed`); a door opens more and is
`.door` (`system/door.css`). Never hand-draw a third.

`src/index.css` holds only imports; the partial order and the guards that walk it: `src/styles/CLAUDE.md`.

The tiers are layered Carbon-style (ADR-0023): a **primitive** tier of raw values —
`spacing.css` is the generic 4px scale + radii + border widths, `colors.css`'s
`--paper-*`/`--ink-*`/`--seal` — and a **semantic alias** tier components consume
(`--bg-canvas`, `--text-body`, `--seal-cover`). App-specific component geometry (the
the `--shot-*` headshot rungs, the `--app-width` frame) lives in
`tokens/layout.css`, kept OUT of the primitive scale. There is deliberately **no** third
component tier — promote a value only on high reuse or a guardable invariant. The metaphor
is a paper scorebook: manila paper, navy ink, pencil graphite, kraft-tape amber for seals.
Use the semantic variables, not raw hex; numbers are mono tabular, structural labels
condensed uppercase. **`--seal*` alone has a SCOPE** — readable only where a reveal is
possible; rank and flag emphasis takes `--marker` (ADR-0083, `check-seal-scope.mjs`).

**Team marks on a dark surface are ART, not a filter.** The navy section
mastheads (`SectionMasthead`'s `logo` prop — Batting order, Starting pitcher,
Defense, Due up next) ask `TeamLogo` for the `mono` variant: a one-color
knockout mark precomputed per club by `scripts/gen-mono-logos.mjs` into
`public/data/logos/mono/`. Don't reach for `filter: brightness(0) invert(1)` to
whiten a logo — that's what this replaced, and it flattens every mark whose
interior detail is drawn in a light fill into an unreadable blob. Read ADR-0031
before changing how any of these render; the conversion itself lives in
`src/lib/logoMono.js`.

Type, focus rings, and contrast use token roles: `src/styles/CLAUDE.md`.

The ALL-CAPS
invariant (`src/styles/01-base.css`) is guarded by `scripts/check-caps.mjs` and
`scripts/check-name-casing.mjs` (no per-component `.toUpperCase()`; ADR-0017).
