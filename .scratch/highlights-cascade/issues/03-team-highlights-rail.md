Status: resolved
Blocked by: 01-data-layer.md (merged, PR #586)

# Team hub → Games tab: TeamHighlightsRail

## Summary

New `TeamHighlightsRail` on `screens/team/GamesTab.jsx`, reading the
precomputed per-team file from issue 01 (`fetchTeamHighlights(teamId)`,
`src/api/gamehighlights.js`).

**Important correction vs. the PRD's own internal ordering**: the PRD's
"Surfaces" section (§2, written earlier in the doc) describes this as a
*live* walk-back fetching `fetchHighlights(gamePk)` on demand, mirroring
`TeamPhotosRail`. Its own later "Precompute shape" section explicitly
supersedes that: *"Both rails read the SAME precomputed data; the earlier
'team rail = live walk' plan is superseded."* This issue implements the
**superseding, precomputed** version — do not build the live walk-back. The
visual/interaction shape (rail styling, scroll-snap, newest-at-right
anchoring) still mirrors `TeamPhotosRail`; only the data-fetching mechanism
differs (one static-file read vs. a paginated live walk).

## 1. Component: `src/screens/team/modules/TeamHighlightsRail.jsx`

Model the shell on `TeamPhotosRail.jsx` (272 lines) for the **rendering and
scroll mechanics only** — the data-loading half is much simpler since
there's no pagination/backward-walk to manage:

```js
export function TeamHighlightsRail({ teamId }) {
  const { data, loading } = useAsync(() => fetchTeamHighlights(teamId), [teamId])
  const clips = useMemo(() => flattenPositiveClips(data), [data])
  ...
}
```

`flattenPositiveClips` (small local helper, or add to
`src/api/gamehighlights.js` if issue 01's reader ends up needing it too):
flattens `data.games[].clips[]` into one flat array, each item annotated
with its `gamePk`/`date` from the parent `games[]` entry, sorted **oldest
to newest** internally (so the right-anchor-on-mount scroll logic in §3
lands on the newest item without a separate reverse step) — reuse whatever
ordering convention `TeamPhotosRail` already uses internally, don't invent
a new one if that component already sorts this way.

- **Loading state**: plain "Loading…" text, mirroring `TeamPhotosRail`'s
  `teamphotos__loading` — but this should resolve in one request, not a
  multi-batch walk, so this state is much shorter-lived in practice.
- **Empty state** (PRD's "Drawbacks" section calls this out explicitly — a
  bench player's team having zero eligible clips for a stretch is expected,
  not a bug): if `clips.length === 0` and not loading, **render nothing**
  (`return null`), same convention `TeamPhotosRail` uses
  (`exhausted && photos.length === 0 && !loading → null`) and the same
  convention the PRD cites for "absent field ⇒ render nothing" elsewhere in
  this app.
- **Nav arrows**: only once content overflows (`canScroll`), same as
  `TeamPhotosRail`.

## 2. Wire into `GamesTab.jsx`

```js
{seasonGames.length > 0 && (
  <TeamHighlightsRail key={`highlights-${team.id}`} teamId={team.id} />
)}
```
Note this component does **not** take `games={seasonGames}` the way
`TeamPhotosRail` does — it has no live per-game walk to bound, so it doesn't
need the schedule at all, just `teamId`.

**Decided 2026-08-06: placement is right after `AllGames`, before
`TeamPhotosRail`** — highlights sit closer to the games list itself, ahead
of photos, rather than grouped with Photos as a "media" pair. Final tab
order: `SeasonSchedule` → `AllGames` → `TeamHighlightsRail` →
`TeamPhotosRail` → `TeamTransactionsCard`.

**MLB-only gate**: `isMlbTeamId(team.id)` (`src/lib/teams.js:1044`) — same
helper already used elsewhere in `PlayerPage.jsx` for the team-id form of
this gate (see issue 04 for the player-page form, which differs). Wrap the
whole render, not just an inner empty state, so a MiLB team's tab issues
zero network requests for this surface (mirrors `showRookiePill`/
`hasWhatsBrewing`'s MLB-only pattern the PRD's "mechanics" section cites).

## 3. Newest-at-right anchoring — copy the existing pattern, don't design it fresh

Per the PRD's own "Rail ordering — decided" section: newest clip anchored to
the right edge, scrolling left moves backward through the season (opposite
of this app's other rails). `TeamPhotosRail.jsx` and `PlayerPhotosRail.jsx`
each already independently implement the exact mechanics needed
(`jumpScrollLeft` helper, a `useLayoutEffect` keyed on data length that
re-snaps to `scrollWidth` until the user manually scrolls back,
`userScrolledBackRef` guard) — confirmed via research that these are
literal copy-paste duplicates between those two files already, which is
this codebase's established convention for this particular mechanic (no
shared hook exists). Copy that same ref/effect trio a third time here rather
than inventing new scroll-anchoring logic or trying to factor a shared hook
out as part of this issue — **factoring a shared `useBackwardRail` hook
across all three call sites is worth flagging as a follow-up cleanup, but
is explicitly not this issue's job** (don't let scope creep here delay
issues 03/04 landing).

One difference from the photos rails: since `TeamHighlightsRail` has no
backward-growth/pagination (`IntersectionObserver` sentinel), it only needs
the on-mount (and on-data-load) right-anchor effect — the sentinel/grow
half of the photos rails' pattern doesn't apply here; don't copy that part.

## 4. Card content per clip

Thumbnail (poster) + tap-to-open `HighlightSheet.jsx` (reused from the
already-shipped per-play feature, same component instance pattern). Confirm
`highlight-poster-not-actually-a-spoiler` reasoning (memory) applies
identically here — these are decided-games-only clips, already public,
same footing as `TeamPhotosRail`'s own photos.

## Spoiler audit checklist

- [ ] `TeamHighlightsRail` only ever receives `teamId`, never fetches or is
      handed anything that could resolve to a not-yet-decided game — since
      the source data is the issue 01 generator's output, which only ever
      contains `Final` games, this should hold by construction; confirm the
      generator's own guard (issue 01 checklist) rather than re-implementing
      a defensive check here.
- [ ] Confirm this rail renders on a fully spoiler-free page context (the
      Games tab, outside any `SealBox`) — consistent with `TeamPhotosRail`'s
      existing footing, no new precedent being set.

## Where this touches

- `src/screens/team/modules/TeamHighlightsRail.jsx` (new).
- `src/screens/team/GamesTab.jsx` — wire in.
- `src/api/gamehighlights.js` — `flattenPositiveClips` if it lands here
  instead of locally in the component (issue 01 owns this file's initial
  shape; coordinate rather than duplicating the reader).
- CSS — reuses `.teamphotos`/`.teamphotos__*` classes verbatim per the
  existing three-rail convention (`TeamPhotosRail`, `PlayerPhotosRail`,
  `LastTenGamesStrip`'s `.last10`), no new class block needed unless the
  thumbnail aspect ratio differs meaningfully from a photo tile.

## Verification plan

1. A team with several recent eligible clips: confirm the rail renders,
   right-anchored to the newest clip on load, tapping opens the correct
   video.
2. A team/period with zero eligible clips: confirm the section renders
   nothing (not a spinner, not an empty box).
3. A MiLB team's Games tab: confirm zero highlights requests fire and no
   section renders.
4. `npm run lint` and `npm run build` pass clean.

## Comments

**Shipped 2026-08-06, branch `claude/team-highlights-rail`.** Built as written,
with implementation details the issue didn't anticipate:

1. **`src/screens/team/modules` hit its 12-file directory-size budget**
   (ADR-0038) the moment `TeamHighlightsRail.jsx` landed as its 13th file.
   Moved it and `TeamPhotosRail.jsx` into a new `modules/media/` subfolder
   (both are Games-tab media rails, a genuine feature-domain split, not an
   arbitrary one) rather than editing the budget upward. `TeamPhotosRail.jsx`
   itself is otherwise untouched — only its file path and the two files that
   imported it (`GamesTab.jsx`, and a doc-comment path reference in
   `PlayerPhotosRail.jsx`) changed. Any other in-flight branch importing
   `screens/team/modules/TeamPhotosRail.jsx` directly will need to update
   that import when it rebases past this PR.
2. **Card redesign, extracted as a shared component.** The maintainer asked
   for a 16:9 thumbnail with a play affordance and a caption naming the play
   and the game — a real redesign, not what the issue originally specified
   (a bare `.teamphotos__thumb`-style square tile). Landed as
   `src/components/highlights/HighlightClipCard.jsx` (+
   `src/styles/52-highlight-clip-card.css`) — purely presentational
   (`{ clip, caption, onOpen }`, no fetching, no game-shape knowledge)
   specifically so a future player-page rail (issue 04) renders the identical
   card from its own clip list with no duplicated markup/CSS. `caption` is a
   prebuilt string the caller computes (`gameCaption`, local to
   `TeamHighlightsRail.jsx` — needs `seasonGames` for the opponent/date, which
   only the caller has loaded).
3. **Cross-branch reconciliation, done now rather than left for merge time.**
   Issue 04 (`claude/player-highlights-rail`) was being built concurrently and
   independently (not waiting on this issue's `Blocked by`, since only issue
   01 — already merged — actually gates it) and hit the same two problems
   this issue did, solving both better:
   - The precomputed clip shape's `playbacks: {hls, mp4}` doesn't match what
     `HighlightSheet`'s `highlightPlaybacks(item)` expects (`item.playbacks`
     as an array of `{name, url}`, `.find()`d by name) — passing a stored clip
     straight into `HighlightSheet` used to throw. This issue's first draft
     fixed it with a local adapter in `TeamHighlightsRail.jsx`; issue 04
     fixed it in the shared function instead — `highlightPlaybacks` now
     accepts either shape. **Adopted issue 04's fix** (better: one place,
     both callers) into `src/api/highlights.js`, deleted this issue's local
     adapter, and `TeamHighlightsRail` now hands `HighlightSheet` the clip
     object directly.
   - Both issues needed the same `games[] -> flat, oldest-first clip list`
     step. This issue kept it local; issue 04 added it to `gamehighlights.js`
     as `flattenPositiveClips`, exactly the shared home the original issue
     text floated as a possibility. **Adopted issue 04's placement** — moved
     it to `gamehighlights.js`, `TeamHighlightsRail` now imports it.

   Net effect: `claude/team-highlights-rail` now carries the shared plumbing
   issue 04 already validated (live spot checks per its own Comments), so
   when issue 04 rebases past this PR it should find `gamehighlights.js` and
   `highlights.js` already matching what it built — no design decision left,
   just dropping its own now-redundant copies — and switch its card markup
   from `.teamphotos__thumb--video`/`.teamphotos__playicon` to
   `HighlightClipCard`.

**Verification plan results:**

1. ✅ Brewers (158, several eligible clips): rail renders under "Highlights,"
   right-anchored to the newest clip on load (`scrollLeft` confirmed at the
   track's right edge), tapping a thumbnail opens `HighlightSheet` with a
   real, playable `.m3u8` src and the clip's own title in the sheet header.
   Confirmed via Playwright against the live dev server + a screenshot.
2. ⚠️ Not reproduced live — every one of the 30 MLB teams currently on file
   has at least one eligible clip (2–4 games, 10–33 clips each), so there's
   no real team/period with zero clips to load against today. Verified by
   code inspection instead: `clips.length === 0 && !loading` returns `null`,
   the same guard shape `TeamPhotosRail`'s `exhausted && photos.length === 0
   && !loading` already uses, and `flattenPositiveClips` on `{games: []}`
   (an absent-file 404, per `fetchTeamHighlights`'s catch) correctly reduces
   to `[]`.
3. ✅ Nashville Sounds (556, MiLB): confirmed via Playwright network-request
   logging that zero `/data/highlights/*` requests fire and no Highlights
   section renders — the `isMlbTeamId` gate wraps the whole component call,
   not just an inner empty state.
4. ✅ `npm run lint` and `npm run build` both pass clean (lint's only output
   is pre-existing warnings in unrelated files).

## Spoiler audit checklist — re-confirmed

- [x] `TeamHighlightsRail` only ever receives `teamId` — no gamePk, no feed,
      nothing that could resolve to an in-progress game. The precomputed file
      it reads is generator-guarded to `Final` games only (issue 01).
- [x] Renders on the Games tab, outside any `SealBox`, same footing as
      `TeamPhotosRail` right below it — no new spoiler surface, no new
      precedent.

## Comments

2026-08-18: Closed out during issue-tracker triage — this shipped (highlights-cascade PRs #586-589, #601: src/api/highlights.js, HighlightSheet.jsx, ModalPortal.jsx, HighlightClipCard.jsx, Team/PlayerHighlightsRail all present in src/). No GitHub issue needed.
