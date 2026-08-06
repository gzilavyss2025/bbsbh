Status: needs-triage
Blocked by: 01-data-layer.md

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
