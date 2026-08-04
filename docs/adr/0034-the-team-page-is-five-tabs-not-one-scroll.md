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
