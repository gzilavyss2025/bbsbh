# The team page is five tabs, not one scroll

`/team/{id}` had grown to twenty top-level modules. Every one of them wore the
same `.thub-card` chrome, they ran in one uninterrupted vertical scroll, and
there was no navigation of any kind — no tabs, no anchors, not so much as a
contents list. `TeamPage.jsx` was 2,205 lines and its single `loadTeam` was one
`Promise.all` of ~20 fetches, plus a game-log lookup per pitcher, plus a
boxscore window for recent form, plus a photo walk-back, plus an affiliate
roster fan-out — all before first paint, whether or not the visitor wanted any
of it. A cold load of the Brewers' page issued **192 data requests**.

Three failures, in the order they hurt:

1. **No hierarchy.** A two-line injured list and the full 40-man roster claimed
   identical weight.
2. **Related things sat far apart.** Standings, team score, day-of-week record
   and comeback wins all answer "how is the season going" and were cards 2, 5,
   10 and 13, with photos and jerseys in between. The three different answers to
   "who plays here" (roster projection, current roster, injured list) were
   stacked in identical cards with nothing saying how they differed.
3. **You always paid for everything.** See the request count above.

Plus five sideways-scrolling tracks (club strip, jerseys, last ten, photos,
leaders) nested inside one vertical scroll.

## The shape

A pinned identity header and five tabs, each a **real route** — the URL changes,
browser back/forward step through tabs, any tab is shareable — and each loading
only its own data:

```
/team/{id}            Overview   six previews, each a door into a tab
/team/{id}/roster     Roster     projection, 40-man, injured list
/team/{id}/games      Games      schedule, last ten, photos, transactions
/team/{id}/numbers    Numbers    standings, batting, pitching, leaders, jerseys, splits
/team/{id}/minors     Minors     affiliates, prospects, history (was "Org")
/team/{id}/leaders    (predates the rebuild — the pattern being copied)
```

Nothing was deleted. Every one of the twenty modules still renders; it renders
somewhere a visitor can name.

The Overview is a **summary, not a smaller version of the old page**. Each of
its previews ends in a link to where the full thing now lives, and its loader
buys only the cheap shape of each module: the standings rows but not the league
stat tables, the precomputed score files but not the comeback file, the 40-man
roster for the lineup diamond but not the per-pitcher game-log fan-out behind
the Roster tab's projection, the first transactions page but not its paging.
That took first load from 192 requests to **24** — an 87% cut — and it is the
number that says whether the effort worked. If a future change makes the front
door re-fetch everything, the front door has become the old page again.

Two behaviours carry the hierarchy inside a tab:

- **Shelves** (`TeamShelf.jsx`, removed 2026-08-04). A tab's secondary modules
  originally rendered collapsed to one row carrying their headline figure
  ("Injured · 4"), expanding in place; a shelf took its children as a render
  function, so a closed shelf never mounted them and never fired their
  fetches. Superseded — every module now renders as a full card, same as the
  tab's headline module, with no collapsed state. The Games tab's photo
  walk-back (previously deferred until a shelf opened) now fires on tab load.
- **An index grid** (`.orgindex`, removed 2026-08-04) originally opened the
  Org tab (`OrgTab.jsx` → `MinorsTab.jsx`, renamed the same day), because
  affiliates / prospects / history genuinely were a browse-by-tile list
  rather than a reading order. Jersey combos moved to the Numbers tab (below
  Team Leaders) the same day — they read as "the club's numbers" more than as
  an org-browse tile, and Numbers' own `loadNumbers.js` already fetched that
  tab's schedule, which the jersey-record join reuses instead of re-fetching
  it. Affiliates and Prospects then dropped their own index tiles, leaving
  Affiliation History (MiLB-only) as the grid's one tile — at which point the
  grid itself was removed too: Affiliation History now leads the tab as a
  plain section, ahead of Affiliates and Prospects, with no jump-tile at all.

## Why ownership-by-file, and why the loaders were duplicated on purpose

The rebuild ran as eight issues across parallel agents. Collisions were
prevented by **assigning every file to exactly one issue** — the shell and
routes to one, the module extraction to another, one tab each to four more —
rather than by coordination. `src/index.css` is a single 27k-line file, so it
got five empty, widely separated banner regions, one per issue, and each agent
wrote only inside its own; non-adjacent regions merge cleanly.

The consequence worth recording: **each tab agent wrote its own loader by
copying out of `loadTeam`, and was told not to share code with it.** That looks
like the wrong instinct, and as a steady state it would be. As a build order it
was the right one — sharing would have put four agents inside one function, and
the merge conflicts would have cost more than the duplication. The duplication
was time-boxed to the parallel phase: the final issue deleted `loadTeam`,
collapsed the genuinely-shared pieces into `screens/team/data/shared.js` (date
cutoffs, the standings row shaper, the IL filter, the roster stat splits, the
preferred-lineup derivation), and deliberately left apart two fetches that only
*looked* alike. If you are reading this because two loaders seem redundant,
check whether they answer the same question before parameterising them into one.

## `?d=` and `?s=` on every tab path is a spoiler requirement

> **Amended 2026-08-06.** A team page opened from a game no longer carries `?d=`
> at all — the team hub opens LIVE, like every other stats surface. See "The
> cutoff is opt-in now" below; the propagation rule this section states is still
> correct for a link that *does* carry one, and that is why it stays.

A team page opened from a game carries `?d=` (the game's `officialDate`) and
`?s=` (the sportId). `fetchTeamSchedule` uses that cutoff, so a visitor
mid-scoring never sees a result they have not reached, and `fetchStandings` is
asked for the day *before* it, so the record line never folds in tonight's game.

Every tab path therefore goes through `teamTabPath` → `linkQuery`, every tab
renders inside `<LinkScope asOf sportId>`, and `TeamTabBar` is handed the
route's own hints rather than reading them off context — so a bare `/team/158`
stays bare instead of growing a `?s=` the address never had. **A tab switch or a
preview door that drops `?d=` is a spoiler bug, not a cosmetic one.** Nothing on
the team page is sealed and nothing became sealed here; this cutoff is the only
spoiler-relevant mechanism on the surface, which is exactly why it has no
redundancy to fall back on.

## What was not done

No visual redesign. Existing card chrome, tokens and typography carry over
untouched; the new chrome was exactly four things — the tab bar, the shelf row
(since removed, see above), the Org/Minors index tile, and the Overview's
preview door (`.thub-door`, a text link built from the shared `.chevron-link`
primitive, not a card). This effort moved modules; it did not restyle them.

Previews are **props on the existing modules** (`preview` on `StandingsCard` and
`RosterProjection`, `previewCount` on `LastTenGames`, `limit` on
`TeamTransactionsCard`), never parallel components. One source of truth per
module, and the diff stays reviewable.

MiLB degrades as it does everywhere else in the app: minor-league feeds
routinely lack uniforms, prospects, transactions, coaches and precomputed
scores, so those previews and shelves resolve to null/empty and simply do not
render.

## Amendment (2026-08-05): the Games tab shows the whole season, in a grid

The Games tab shipped with the Overview's Last 10 strip repeated in full — the
same sideways rail, growing older ten games at a time as you scrolled back
toward Opening Day. It was the wrong shape for the tab that OWNS games: a
season is ~160 decided games, and reaching June meant a hundred-odd swipes
inside a page that scrolls the other way.

The tab now renders `AllGames` instead: every decided game as the same
ticket-stub card, in a `repeat(auto-fill, minmax(100px, 1fr))` grid — three
columns on a phone, more as the frame widens — newest first, capped at 24 with a
"Show more" underneath. The cap is client-side only; the whole season was
already in memory from the tab's single schedule fetch, so paging costs no
request. The rail keeps its job on the Overview, where ten cards is exactly what
a preview should hold, and the growth machinery it needed for the old Games-tab
role is gone.

That makes one pair of surfaces that are **not** literally the same component
with a `preview` prop — the exception this ADR's "props on the existing modules"
rule didn't anticipate. The rule's intent survives: `LastTenGames` and
`AllGames` are two exports of one module (`modules/TeamGames.jsx`) over one
shared `GameStubCard`, so there is still a single source of truth for what a
game card is. Reach for a second export only when the two surfaces genuinely
need different LAYOUTS, as here; a preview that differs only in how much it
shows is still a prop.

### The cutoff is opt-in now (2026-08-06)

`GameView` no longer stamps `?d=` onto the links out of a game, so the team hub —
and the player page, and the leader boards — open on **current** stats whichever
way you arrive. The propagation rule above is unchanged and still enforced: a
path that carries `?d=` must keep carrying it through every tab switch and
preview door, because dropping it halfway would show two different answers on one
visit. What changed is only whether anything puts it there to begin with.

Why: the cutoff was the spoiler rule reaching past the surfaces it exists to
protect. A season stat line is not a score. It moves by fractions, it is the same
number the back of a baseball card has carried for a century, and reading one
tells you nothing about the game you are currently scoring. Freezing it by
default meant the same team page showed different numbers depending on whether
you reached it from a game or from search — a real cost, for a spoiler risk close
to zero. The scoring surfaces (slate, lineups, innings, box score) are untouched
and stay sealed; that is where the rule earns its keep.

**This leaves the historical view with no way in from the UI.** `?d=` still works
by hand (`/team/158?d=2026-04-01` shows the club as it stood entering that day)
and the banner offers the way back out, but nothing offers the way IN any more.
That is a known, deliberate gap: "show me this team as of April 1" deserves a
real date control rather than a side effect of how you happened to navigate, and
it is worth designing on its own. Recorded here so the next context does not
mistake it for an oversight.

### The gap gets a way in (2026-08-06)

`AsOfBanner` (`components/seal/AsOfBanner.jsx`) now carries the cutoff's whole
lifecycle, not just the way out. On a live page it renders a plain-text "View
as of a date" button that opens an inline `<input type="date">`; picking one
navigates to the SAME pathname with `?d=` (and `?s=`) appended — reusing the
exact loaders and propagation rule this ADR already established, not a parallel
mechanism. On a dated page, "Change date" reopens the same picker pre-filled
with the URL's own date, and "Show current" still drops the cutoff entirely.

Where it lives: this one shared component, not five separate controls. All
four stats surfaces (team hub, player page, both leader-board pages) already
rendered `<AsOfBanner asOf={asOf} />` unconditionally as the exit mechanism, so
extending it to also be the entry mechanism reaches all four for free — the
player page and leader boards were never a "follow-up," because withholding the
control from them would have meant special-casing three call sites for no
reason, not saving work.

Bounds: the picker's `min`/`max` (and a defensive `clampAsOfDate` re-check on
apply, `lib/dates.js`) span January 1st of the current year through today. That
floor is a stand-in for "the season opener," not the real thing — MLB and each
MiLB level open on their own date most years, and resolving the exact one would
cost a fetch just to police an HTML attribute. A pick that lands before a real
opener still resolves fine through the existing loaders (season-to-date zeros),
so the imprecision costs nothing. An out-of-range pick CLAMPS to the nearer
bound rather than being refused outright or silently discarded — the picker's
own attributes stop most of these before they happen, so this is a defensive
backstop, and landing on the boundary is closer to what was asked for than
doing nothing.

**The default still opens live.** Nothing pre-fills the picker on a live page —
picking a date is the only way a page becomes dated, same as before this
change. Pre-filling "Change date" with the URL's own existing value isn't an
exception to that: it reflects what the address already explicitly says, not a
remembered or invented default.

One thing this surfaced rather than caused: two labels — the team hub's record
line and `StandingsCard`'s division header — read the literal string "entering
today" regardless of the actual `asOf` date, a leftover from when `asOf` was
always effectively "today" (GameView stamped the *current* game's own date).
Once a real date control made other dates reachable, both would have read
"entering today" while showing a April number. Fixed alongside this control
(`humanDate(asOf)` in both places, and `PlayerPage`'s game-log note and
frozen-data caveat, same bug).
