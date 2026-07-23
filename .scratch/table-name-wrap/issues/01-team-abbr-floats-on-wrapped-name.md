Status: ready-for-agent

# A wrapped player name floats its team abbreviation mid-row — fixed on the Foul Tracker, other flex-row name+team layouts likely share it

## Summary

On a phone-width viewport, a long surname (e.g. "Pete Crow-Armstrong") wraps
onto two lines inside a name+team-abbreviation row. If that row is a flex
container with `align-items: center` and the team abbreviation is a plain
sibling (not itself pinned to the top), the abbreviation centers on the
row's full two-line height instead of riding the name's first line — it
visually "floats" with an odd gap above it, disconnected from both lines of
the name. Reported against the Foul Tracker (PR #315) with a real example:
`JACKSON MERRILL` / `SD` in the "Most fouls per game" board.

## Root cause

`.standings .team` (`src/index.css`) is:

```css
.standings .team,
.standings .team > * {
  display: flex;
  align-items: center;
  gap: 7px;
}
```

The row's children — a rank number, the `PlayerLink` name, and a
`.foulboard__team` abbreviation span — are flex items with `align-items:
center`. A single-line name makes every sibling the same height, so centering
is invisible. A two-line name grows only that one flex item's height; the
untouched siblings then center on the ROW's new height, landing at the
vertical midpoint instead of by the name's first line.

The identical shape (flex row, `align-items: center`, name + team-abbr
siblings, name never forced to one line) reproduced a second time on the same
page in `.gamehigh-who` (Single-Game Highs' player/team line) — different
CSS class, same underlying bug.

## Fix applied here

Pin the non-wrapping siblings to the top of the row instead of centering them,
so they land on the name's first line regardless of how many lines the name
wraps to. Single-line rows are unaffected (every sibling is already the same
height, so `flex-start` vs `center` looks identical):

```css
.standings .team > .umprank__rank,
.standings .team > .foulboard__team {
  align-self: flex-start;
}
.gamehigh-who .foulboard__team {
  align-self: flex-start;
}
```

Both fixes are in `src/index.css`, right after the two rules quoted above
(the "standings" one lives near the top of the `standings` block; the
`gamehigh-who` one sits right after that class's own rule in the foul-tracker
CSS block).

Verified against the live dev server with a real long name (`Pete
Crow-Armstrong`, currently #8 in "Most fouls" and appearing in Single-Game
Highs) at a 390px iPhone viewport — the team abbreviation now sits flush with
the name's first line in both spots.

## Where else to check (not audited yet — that's this ticket)

`.standings .team` is shared by every table that reuses the ledger look
(`StandingsPage.jsx`, `TeamPage.jsx`, `UmpireRankingsPage.jsx`,
`TeamScoreCard.jsx`, `GameNotesDebugPage.jsx`, plus every board on
`FoulTrackerPage.jsx`) — those are now covered by the one shared fix, for
free. What's NOT covered is any OTHER flex row, outside `.standings`, that
pairs a name with a team tag under `align-items: center` without forcing the
name to stay on one line (`white-space: nowrap` + ellipsis, which sidesteps
the bug entirely by never wrapping — e.g. `.tlead__row .tlead__rowname` and
`.sgh-top .sgh-name` already do this, confirmed bug-free). Grep for
`align-items: center` near a team-abbreviation/logo class and check whether
the adjacent name rule has `white-space: nowrap`; if not, check whether the
name can actually get long enough to wrap at the layout's narrowest supported
width. Screens with player-name-heavy tables worth a look first: `LeadersPage.jsx`,
`TopGamesPage.jsx`, `PostseasonLeadersPage.jsx`, `AwardsHistoryPage.jsx`,
`AllStarRostersPage.jsx`, `MilestoneWatchPage.jsx` — none confirmed broken,
none confirmed clean.

## Comments
