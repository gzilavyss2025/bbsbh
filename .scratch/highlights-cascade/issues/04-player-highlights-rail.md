Status: needs-triage
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
