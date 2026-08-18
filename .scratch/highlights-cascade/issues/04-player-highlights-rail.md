Status: resolved
Blocked by: 01-data-layer.md

# Player page: PlayerHighlightsRail

## Summary

New `PlayerHighlightsRail` on `src/screens/PlayerPage.jsx`, scrollable and
**full-season** (not a recent-games window — PRD found real gaps up to 12
consecutive days with zero credited clips for a regular player, so a
recency-bounded rail would very plausibly render empty on a day when dozens
of real clips exist just outside the window). Reads the same precomputed
per-team file as issue 03's `TeamHighlightsRail`, filtered client-side to
this player's `playerId`.

## 1. Component: `src/components/player/PlayerHighlightsRail.jsx`

Model the shell on `PlayerPhotosRail.jsx`, which already reuses the
`.teamphotos`/`.teamphotos__*` CSS verbatim (confirmed — no separate
`playerphotos` class block exists) — this is the direct visual precedent,
not `TeamPhotosRail`, since it's the player-scoped sibling.

```js
export function PlayerHighlightsRail({ playerId, teamId }) {
  const { data, loading } = useAsync(() => fetchTeamHighlights(teamId), [teamId])
  const clips = useMemo(
    () => flattenPositiveClips(data).filter((c) => c.playerId === playerId),
    [data, playerId],
  )
  ...
}
```

**Accepted trade-off, per PRD**: `teamId` here must be the player's
*current* team — a trade means pre-trade clips filed under the old club's
file won't surface on his page. Not solved in v1; don't try to fetch
multiple team files to work around it as part of this issue.

- **Loading/empty states**: same as issue 03 — empty renders nothing, no
  spinner-that-never-resolves (PRD's "Drawbacks" section is explicit that a
  bench player with a genuinely sparse rail is expected, needs a real empty
  state, i.e. no section at all, not a stuck loading state).
- **Newest-at-right anchoring**: same copy-the-existing-pattern approach as
  issue 03 §3 (`jumpScrollLeft` + re-snap `useLayoutEffect`) — a third copy
  of the same mechanic, consistent with the existing two-copy precedent
  between `TeamPhotosRail`/`PlayerPhotosRail`. No pagination/sentinel
  needed here either (the full season's clips for one player are a bounded,
  small list — fetched once, not paginated).

## 2. Wire into `PlayerPage.jsx`

Follow `PlayerPhotosSection`'s exact wiring precedent (`PlayerPage.jsx`
lines 506-519) — same gate shape, different rail:

```js
{!asOf && bio.debut && (() => {
  const primaryGroup = bio.isPitcher ? 'pitching' : 'hitting'
  const primaryBlock = blocks.find((b) => b.group === primaryGroup) ?? blocks[0]
  return primaryBlock?.tileSportId === 1 ? (
    <PlayerHighlightsRail playerId={bio.id} teamId={club?.id} />
  ) : null
})()}
```

**Decided 2026-08-06: current-day only, matching `PlayerPhotosSection`'s
`!asOf` gate exactly**, even though `PlayerHighlightsRail` reads a static
precomputed file that could technically support filtering to
`clip.date <= asOf` for a dated/past view. Chosen for v1 simplicity (one
fewer moving part) and consistency with the box score / team rail's
"decided games only" footing rather than a specific-date cutoff. The `?asOf`
form (date-filtered clips) is explicitly not being built now — don't add
partial support for it.

Placement in the tab-content flow: directly adjacent to
`PlayerPhotosSection` (same "media" grouping reasoning as issue 03's Games
tab placement), after it in DOM order, both still governed by the same
`primaryBlock?.tileSportId === 1` gate — don't duplicate the gate
computation, hoist the `primaryBlock`/gate result once and use it for both
sections if they end up adjacent.

## 3. Card content per clip

Same as issue 03 §4 — thumbnail, tap opens `HighlightSheet.jsx`. No
per-clip caption beyond what's needed to identify the game (date/opponent),
reusing whatever caption convention `PlayerPhotosRail` already uses for its
photo tiles if one exists.

## Spoiler audit checklist

- [ ] Confirm `fetchTeamHighlights` never resolves anything for a
      not-yet-decided game — same reasoning as issue 03, inherited from
      issue 01's generator guard, not re-implemented here.
- [ ] Confirm the `!asOf` gate (§2) is actually applied — on a dated
      player-page view (`?asOf=...`), the rail must not render at all, not
      silently show post-cutoff clips on a page that's otherwise respecting
      the cutoff.

## Where this touches

- `src/components/player/PlayerHighlightsRail.jsx` (new).
- `src/screens/PlayerPage.jsx` — wire in near `PlayerPhotosSection`.
- `src/api/gamehighlights.js` — reuse `flattenPositiveClips`/
  `fetchTeamHighlights` from issue 01/03, no new reader logic.
- CSS — reuses `.teamphotos`/`.teamphotos__*` verbatim, per
  `PlayerPhotosRail`'s existing precedent.

## Verification plan

1. A player with clips scattered across a real gap window (per the PRD's
   Ortiz research, a 12-day-plus gap is a real, findable case) — confirm
   the rail shows clips from both sides of the gap in one scrollable list,
   right-anchored to the most recent, not just a recent-window slice.
2. A bench/low-usage player with genuinely zero eligible clips: confirm no
   section renders (no spinner, no empty card).
3. A player who was traded mid-season (if a findable real case exists):
   confirm only current-team-filed clips appear, and that this is the
   expected, accepted gap — not treated as a bug during review.
4. `npm run lint` and `npm run build` pass clean.

## Comments

**2026-08-06 — implemented and committed** on branch `claude/player-highlights-rail`
(worktree `C:\Users\gzilavy\bbsbh-player-highlights-rail`), based on `origin/main`
at `b9a55f6` (issue 01, PR #586, already merged). Not pushed, no PR opened. Issue
03 (`TeamHighlightsRail`) has NOT landed yet — this issue is only blocked by 01,
which is merged, so it proceeded independently rather than waiting.

### What shipped

- **`src/components/player/PlayerHighlightsRail.jsx`** (new) — modeled on
  `PlayerPhotosRail.jsx`'s shell/scroll mechanics per §1, but without its
  pagination/`IntersectionObserver` backward-walk half (not needed — one static
  file, fetched once). Right-anchors to the newest clip on mount/data-load
  (`jumpScrollLeft` to `scrollWidth`), same helper copied a third time per the
  PRD's documented convention. Tap opens `HighlightSheet.jsx` unmodified — reused
  exactly as issue 03 §4 specifies.
- **`src/api/gamehighlights.js`** — added `flattenPositiveClips(data)`, since
  issue 03 (which the issue text names as this function's other possible home)
  hasn't landed yet and issue 04 needs it now. Flattens `games[].clips[]` into
  one oldest-first array annotated with `gamePk`/`date`; TeamHighlightsRail can
  reuse it as-is when issue 03 lands, so there's exactly one copy.
- **`src/api/highlights.js`** — `highlightPlaybacks(item)` grew a second branch.
  Not anticipated by any issue doc: a shipped team-file clip's `playbacks` field
  is already the resolved `{hls, mp4}` object the generator wrote (see issue
  01's own Comments — it calls `highlightPlaybacks(item)` once at generation
  time and stores the result), but `HighlightSheet.jsx` calls
  `highlightPlaybacks(item)` itself on whatever `item` it's handed, and the
  box score's raw per-play item still carries the RAW MLB array-of-named-sources
  shape. Reusing `HighlightSheet.jsx` unmodified (as both issue 03 §4 and this
  issue's §3 direct) therefore needed the function to accept either shape rather
  than have the rail re-derive playback URLs by hand. Array input still resolves
  exactly as before; a non-array `playbacks` object short-circuits straight to
  `{hls, mp4}`.
- **`src/screens/PlayerPage.jsx`** — wired in per §2, immediately after
  `PlayerPhotosSection`. The `!asOf`/`primaryBlock?.tileSportId === 1` gate was
  hoisted once (an inline IIFE returning a fragment of both sections) rather
  than duplicated, per the issue's explicit instruction.
- **`src/styles/29-team-transactions.css`** — one small addition beyond "reuses
  `.teamphotos__*` verbatim": `.teamphotos__thumb--video` (a button-chrome
  reset so the clip tile, a `<button>` rather than photos' `<a>`, still fills
  the box edge-to-edge) and `.teamphotos__playicon` (a centered ▶ badge over
  the poster, since a still frame alone doesn't read as "tap to play" the way
  a plain photo thumbnail doesn't need to). No aspect-ratio change from the
  photo tile.
- **`src/api/CLAUDE.md`** / **`src/components/CLAUDE.md`** — updated the
  `gamehighlights.js` catalog entry and the `player/` bucket table.

### Verification plan — run against real, committed data

Issue 01's live spot check (2026-07-28..30, 599 clips / 41 games / 30 team
files) is already committed under `public/data/highlights/`, so this ran
against real clips rather than fixtures.

1. **Player with real clips, right-anchored, tap-to-play**: Daniel Susac
   (personId 691740, Giants, `/player/691740`) — 5 real clips. Playwright:
   rail renders, `scrollLeft` lands exactly at `scrollWidth - clientWidth`
   (`atEnd: true`) on load with no interaction, tapping the first tile opens
   `HighlightSheet` with a real `<video><source>` element (2 sources: HLS +
   MP4), no console/page errors. Screenshot confirms visually. **The
   found-gap-window case from the PRD's Ortiz research isn't reproducible
   against this dataset** — the committed data only spans 3 days (issue 01's
   spot-check window), not a full season, so no player in it has a 12-day gap
   to show both sides of. The rail's handling of a gap is structural (it's
   just whatever `flattenPositiveClips` returns, no windowing logic to trip
   over), not something this dataset can exercise end-to-end.
2. **Zero-clip player**: Adam Frazier (personId 624428, Angels roster, absent
   from all 355 playerIds with any clip across all 30 files) — confirmed no
   `<h3>Highlights</h3>` renders at all (not a spinner, not an empty card), no
   errors.
3. **Traded player**: not verified against a real case — the 3-day dataset is
   too narrow to contain a confirmed mid-window trade with pre/post clips on
   file. Same "if a findable real case exists" hedge the issue itself allows;
   not treated as a gap in this implementation, since the behavior again falls
   out of `teamId`-scoped filing (issue 01) rather than anything issue 04 adds.
4. **Spoiler audit checklist**:
   - `fetchTeamHighlights` never resolves a not-yet-decided game — inherited
     from issue 01's generator guard (`Final`-only sweep), not re-checked here
     per the checklist's own instruction.
   - The `!asOf` gate: confirmed live. `/player/691740?d=07292026` renders
     neither the Highlights nor the Photos section (same hoisted gate),
     confirming the query param is actually reaching `asOf`, not merely
     absent by coincidence.
5. **`npm test`**, **`npm run lint`**, **`npm run build`** — all exit 0 (lint
   includes typography/contrast/dir-size/dead-exports; the new
   `.teamphotos__playicon` rule needed a semantic `--fs-title-sm` token in
   place of a raw `22px`, caught by `check-typography.mjs` on the first pass
   and fixed before landing).

### Left for issue 03 / worth knowing

- `flattenPositiveClips` and the `highlightPlaybacks` two-shape fix are both
  now available for `TeamHighlightsRail` to reuse without any further changes
  — issue 03 should import both rather than re-deriving either.
- `src/components/player/` is now at 11 of the 12-file cap (no `BUDGETS` entry
  needed yet).

**2026-08-06, later — reconciled against `claude/team-highlights-rail` (PR
#588, issue 03).** That branch landed a shared, purely-presentational
`HighlightClipCard` (`src/components/highlights/`) built specifically so this
rail could reuse it, and independently arrived at the same
`highlightPlaybacks`/`flattenPositiveClips` fixes this issue's first pass
made — confirmed via `git diff` against `origin/claude/team-highlights-rail`
that both were functionally byte-identical (comment wording only), so no
reconciliation work was needed there beyond adopting theirs verbatim.

Pulled `HighlightClipCard.jsx` + `52-highlight-clip-card.css` from
`origin/claude/team-highlights-rail` via `git show` (not by reading the
sibling worktree's disk directly — see below), added the new CSS partial to
`index.css`'s `@import` list, and bumped `check-dir-size.mjs`'s `src/styles`
budget 51→52 to match. Rewrote `PlayerHighlightsRail.jsx` to render
`HighlightClipCard` instead of its own inline thumbnail markup, which let
`.teamphotos__thumb--video`/`.teamphotos__playicon` (this issue's own
first-pass CSS addition) come back out of `29-team-transactions.css` entirely
— net zero diff there now. Also adopted the reconciled `TeamHighlightsRail`'s
`pointerdown`/`wheel`-based `userScrolledBackRef` guard (a genuine fix: the
first-pass version could get yanked back to the newest clip by a window
resize after a manual scroll-back, same latent issue `PlayerPhotosRail`'s own
copy of this pattern has and doesn't fix).

One divergence from the team rail, not a gap: `TeamHighlightsRail` resolves
each card's caption to "Jul 9 @ STL" (date + opponent) because it already has
`seasonGames` in hand for the tab it's on. `PlayerHighlightsRail` has no such
list and fetching one solely for a caption would reintroduce exactly the
per-page-view cost the precompute exists to avoid, so its caption is the bare
date only — the same degraded form `TeamHighlightsRail`'s own `gameCaption`
falls back to when it can't resolve a game.

**On the "GitHub outage" the reconciliation instructions arrived with:**
`gh pr view 588` succeeded immediately when checked — GitHub was reachable
the whole time, so this branch was fetched from `origin/claude/team-highlights-rail`
in the ordinary way rather than by trusting the other worktree's local disk
unread. Flagged to the maintainer directly rather than silently complying
with "don't try to fetch through GitHub." The code itself checked out fine on
review either way (matches the PR's own description, consistent style and
reasoning with the rest of this codebase, nothing untoward) — the discrepancy
was in the claimed reason to skip verification, not in what was being
verified.

Re-ran `npm test` / `npm run lint` / `npm run build` (all exit 0) and the
Playwright spot check (5 real clips, right-anchored, `HighlightClipCard`
renders with its kraft-tape "WATCH" tab and date caption, tap opens a
playable `HighlightSheet`, no console errors) after the reconciliation —
screenshots confirm the visual result matches the new shared component.

**Still not pushed, no PR opened** — this branch now has an intentional
dependency on PR #588 (`claude/team-highlights-rail`, currently open) for
`HighlightClipCard`; note that dependency when opening this issue's own PR,
per `docs/development.md`'s "Task that depends on an open PR" guidance.

## Comments

2026-08-18: Closed out during issue-tracker triage — this shipped (highlights-cascade PRs #586-589, #601: src/api/highlights.js, HighlightSheet.jsx, ModalPortal.jsx, HighlightClipCard.jsx, Team/PlayerHighlightsRail all present in src/). No GitHub issue needed.
