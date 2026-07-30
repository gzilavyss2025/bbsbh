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
the `.teaminfo` subtree, resolved by `lib/headerTheme.js`. The innings viewer and
box score are deliberately excluded: navy-and-kraft there *is* the seal metaphor.
The theme's only inputs are `(teamId, treatment)` — identity, never game state;
see `src/lib/CLAUDE.md`.

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
- **The forward page-turn transition** (`src/components/page-turn/`) mounts an
  inert preview of the destination half — real (possibly still-sealed)
  content — underneath the active one during the animation. `SealBox`'s own
  render-function gate (ADR-0002) is what keeps that preview spoiler-safe;
  `InningPage.jsx`'s `presentationOnly` flag only mutes side-effecting
  callbacks (`onReveal`/`onStepInfo`) so the preview can't
  itself advance `revealedThrough` or double-report a step. Not a second
  reveal boundary — see ADR-0024.

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

## Design system (`src/index.css` + `src/tokens/*`)

All CSS lives in `src/index.css`, which imports `src/tokens/*.css` (colors,
typography, spacing, layout, effects, fonts). The tiers are layered Carbon-style
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
`index.css`. Focus rings must use `var(--focus-ring)`/`var(--ring)`
(`check-focus-ring.mjs`), and the documented text-on-background token pairings must
hold WCAG AA (`check-contrast.mjs`) — see ADR-0023. The global ALL-CAPS invariant
(see the block comment in `src/index.css`) is guarded by `scripts/check-caps.mjs`
(the CSS half) and `scripts/check-name-casing.mjs` (the JS half — no per-component
`.toUpperCase()`/`.toLowerCase()` on rendered text; see ADR-0017) via `npm run lint`.
