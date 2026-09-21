# The team page is one scroll of named bands, not six tabs

**Status:** DRAFT — awaiting sign-off on #1105. Not accepted until #1107 ships.
**Date:** 2026-09-21
**Supersedes:** ADR-0034, *The team page is five tabs, not one scroll*.

> ADR-0034 is not wrong, and it is not deleted. It holds the record of why the
> old one-scroll page failed, and those three failures are still the test any
> replacement has to pass. This ADR says how a long page passes them **without
> tabs**, and what changed to make that possible. The `superseded` mark on
> ADR-0034 lands with #1107, alongside the code.

The wireframe this records is `.scratch/team-one-scroll/scope.md`, which carries
the measurements, the per-club module lists and the section-by-section
reasoning. This file carries the decision and the argument.

## Context

ADR-0034 broke a 2,205-line `TeamPage.jsx` into a pinned identity header and
five tabs, each a real route, each loading only its own data. It took the front
door from **192 requests to 24** and it fixed three named failures:

1. **No hierarchy.** A two-line injured list and the full 40-man roster claimed
   identical weight.
2. **Related things sat far apart.** Standings, team score, day-of-week record
   and comeback wins all answer "how is the season going" and were cards 2, 5,
   10 and 13, with photos and jerseys in between.
3. **You always paid for everything.**

All three were real, and the tabs did fix them. This ADR does not reopen any of
that.

What it reopens is the price. ADR-0034 measured **the front door**. It never
measured **the club**.

## The measurement ADR-0034 did not take

Production build, phone viewport, `?nointro`, counting `statsapi.mlb.com` and
`/data/*.json` — the same instrument, re-runnable from
`.scratch/team-one-scroll/count-requests.mjs`:

```
UNION over the six Brewers tabs
  requests fired in total : 159
  distinct URLs           : 109
  paid more than once     :  50
```

**Seeing everything one club's page holds costs 159 requests for 109 distinct
URLs.** Thirty-one percent of the traffic buys nothing at all. And the waste is
not scattered — it is the shell, bought once per tab:

```
  ×7  /api/v1/standings?leagueId=104&season=2026&standingsTypes=regularSeason
  ×6  /data/teams.json
  ×6  /api/v1/teams/158/coaches?season=2026
  ×6  /data/game-notes/158.json
  ×4  /api/v1/schedule?sportId=1&teamId=158&season=2026&…
```

The identity header alone is 25 of the 50 repeats. That is the tab tax: six
doors, and the club's name, record and manager bought behind every one of them.

**This is not a flaw in the tab rebuild. It is the tab rebuild's own trade,
finally priced.** ADR-0034 traded "the whole club, once, expensively" for "one
fifth of the club, six times, cheaply". For the visitor who wanted one section
that was the right trade and it still is. For the visitor who wanted the club it
was not.

## The decision

`/team/{id}` is **one page of seven named bands**, each on its own tinted band with
a clear head, with the tab strip kept in place as a **sticky jump bar** — anchor
links that scroll to a band and mark the band you are in. No tab is a route any
more.

```
STANDING  →  RANKS  →  GAMES  →  ROSTER  →  FARM  →  MONEY  →  ABOUT
```

| Band | The question it answers |
| --- | --- |
| **Standing** | How is the season going? |
| **Ranks** | Where does this club sit among the rest? |
| **Games** | What have they played? |
| **Roster** | Who plays here? |
| **Farm** | Who is coming, and where does this club sit in the org? |
| **Money** | What does it cost? |
| **About** | What is this club? |

Six of the seven answer a question about the club's **season**. The seventh,
**About**, answers a question about the club itself, holds the Ballpark, and is
last. It costs an anchor on a phone jump bar and it buys the rule below.

> **Every page ends on a band that no subject can fail to fill.**

Money needs Cot's coverage. Ranks needs a league board. Farm needs a parent org.
Standing needs a division. A ballpark is a building, and every club in this app
plays in one — so Milwaukee's 20,050px page and a Single-A club's 13,570px page
close on the same band, with the same head, in the same place. **A page that
loses a band from its tail no longer ends on an absence.** That is worth more to
the short page than to the long one, and it is this ADR's best answer to whether
a thin club reads as quiet or as broken.

It is also free: `fetchTeam` already returns `venue`, and the header already
reads it. The seventh band adds a head and a card, not a request.

A band is a **question a visitor asks**, not a renamed tab. The clearest evidence
that the two are different: today's "Numbers" tab holds the standings table, two
rank tables, run value, ABS challenges, the leaders ledger, a 61-row records
card, the day-of-week record, the jersey records and comeback wins. That is four
different questions in one bag, and it is 7,513px long. Under this ADR its
contents land in three different bands, and the bag's name does not survive.

## How a long page passes ADR-0034's three tests

### Failure 1 — no hierarchy

**The band is the hierarchy.** ADR-0034's complaint was that every module wore
the same `.thub-card` chrome in one undifferentiated scroll. The tabs answered it
by *removing* modules from view. A band answers it by *grouping* them: seven
heads, seven tinted grounds, generous space at each join. A reader who lands mid-page can
see which question they are inside without scrolling to find out.

**Shelves are not coming back, and neither is the index grid.** Both were tried
and both were removed on 2026-08-04 (ADR-0034 records it). A collapsed row inside
a band is a second hierarchy device competing with the first, and "a long page
needs collapsing" is precisely the instinct that produced them. The band is the
device. There is one.

### Failure 2 — related things sat far apart

This is the failure the new shape is **built to demonstrate**, and the
demonstration is literal. ADR-0034 named four cards by name. Here they are, in
one band, with nothing between them:

> **Standing** — division standings + postseason odds, Team Score, Records,
> record by day of week, record by jersey, comeback wins, Last Time.

Cards 2, 5, 10 and 13 of the old page are now the first band of the new one, and
the photos and jerseys that used to sit between them are in Games and in
Standing's own record group respectively.

Note what the tabs did with this failure: they did not fix it so much as
**hide** it. Standings and comeback wins still sat nine cards apart — on the same
tab, in the same scroll, with the run-value card, the challenge card, the leaders
ledger and a 3,238px records card between them. A tab is not a grouping. It is a
door.

The band's second half — the five "record by X" cards — sits under the same head
as the standings table, because a reader asks both halves in one breath. That is
the **band grammar** this ADR settles:

> **A band is one question. A band may hold more than one section when the
> question has two halves that a reader asks in one breath, and it carries one
> head for both.**

Issue **#928** decided on 2026-09-21 that `/player/{id}` gets one **Money** band
holding "the deal he is on now" and "before this deal" under one head — and
explicitly deferred the grammar to this work: *"The band's design also depends on
the team page's bands (#1105–#1107)."* **This ADR is that rule's home.** #928 is
a consumer of it. The team page uses it exactly once, and the restraint is the
point: two sections under one head is a device for a question with two halves,
not a way to fit seven bands into six anchors.

### Failure 3 — you always paid for everything

This is the one that killed the old page, and it is the one that needs new
machinery rather than a new argument.

**Each band fetches its own data when it scrolls into view.** The loaders are
today's tab loaders — `loadRoster.js`, `loadGames.js`, `loadMinors.js`,
`loadContracts.js`, plus two lifted out of `loadNumbers.js` and `loadOverview.js`
— and the first screen costs the first band, not the page.

**What this ADR must not let anyone assume: that machinery does not exist.**
Measured, cold against scrolled, on every route in the hub:

> **Cold equals scrolled on every team-hub route today. Not one module defers
> its first fetch until it is on screen.**

`IntersectionObserver` is hand-rolled in six places and not one of them does this
job: `GameCard` arms park art, `TeamPhotosRail` and `TeamTransactionsCard` page
*sideways* (the rail's observer has the track itself as its `root`), `GameSelect`
tracks sticky-bar state, and the two standalone pages grow a list with a 600px
`rootMargin`. The one route that already behaves the way a band must is
`/team/158/photos` — 10 requests cold, 18 scrolled — and it is a page, not a
section. #1107 writes the shared hook.

Two corrections to the naive "every band owns its loader":

- **The header must not buy the standings twice.** `loadTeamIdentity` fetches
  standings for the record line and `loadStanding` fetches the same response for
  the table — the single most repeated request today, ×7. The Overview already
  solves this: `loadOverview` does not call `loadTeamIdentity`, and shapes the
  header's three fields off its own standings response through the shared
  `teamRecordFor`. The long page does the same.
- **The schedule is a page-level fetch.** Three bands read it — Standing (the
  day-of-week and jersey joins), Games (the schedule and the grid), Roster (the
  recent-form window). It is bought ×4 today.

> **The schedule is the only request more than one band needs. Every other
> request belongs to exactly one band.**

That sentence is checkable. `UNION=1` on the counting script will say whether it
is still true.

### The numbers this is judged on

| | Cold, before any scroll | Fully scrolled |
| --- | ---: | ---: |
| `/team/158` today | **28** (Overview) | 159 fired / **109 distinct**, across six tabs |
| `/team/158` under this ADR | **≤ 20** | **≤ 110** |

**The cold target is below today's Overview, not level with it.** #1107 says the
page must fire "no more than today's Overview" — that is the floor. A page that
buys its identity header once instead of six times should be *cheaper* than the
summary page it replaces, and the arithmetic says it can be: the Standing band is
a strict subset of today's Numbers tab (22 requests) plus two static score files,
over a four-request shell.

And ADR-0034's warning survives word for word, with the scope it always meant:

> *"If a future change makes the front door re-fetch everything, the front door
> has become the old page again."*

192 is still the number that says the page failed. 28 is the number to beat. The
difference between this page and the 2026-07 page is not that it is long — it is
that **length and cost have been unhooked from each other**, which is what a
deferred loader per band buys and what one `Promise.all` of twenty fetches never
could.

## What happens to ADR-0034's other four commitments

### The `?d=` / `?s=` propagation rule — kept, and its surface shrinks

ADR-0034, as amended 2026-08-06: a path that carries `?d=` must keep carrying it
through every tab switch and every preview door, because dropping it halfway
would show two different answers on one visit. Nothing on the team page is
sealed, and this cutoff is **the only spoiler-relevant mechanism on the surface**,
which is exactly why it has no redundancy.

**The rule is unchanged. The surface it has to cover gets smaller.** Today it
covers six tab paths *plus* every door out. Tomorrow there are no tab paths,
because there are no tab switches. Every door out — `/situational-records`, the
two league boards, `/team/{id}/stamp-in`, `/photos`, `/leaders`, `/{org}/leaders`,
`/transactions`, every other club, every player — still goes through
`linkQuery(opts)`, and the page still renders inside `<LinkScope asOf sportId>`.

**One new obligation.** #1107 redirects the five old tab routes to anchors, and a
redirect that drops the query string is the same spoiler bug a tab switch would
have been. `/team/158/roster?d=2026-04-01` must land on
`/team/158?d=2026-04-01#roster`.

**And one honest loss, accepted deliberately.** The Contracts tab passes
`datable={false}`, because a contract ledger is a season's book rather than a
day's and `loadContracts` is not keyed on `asOf`. One page has one as-of banner.
So a reader will now see a date control at the foot of a page containing one band
the control does not move. The Money band carries its `SourceLine` note — *"A
season's book, not a day's — these figures do not move with a date"* — as the
thing that says so.

That is weaker than withholding the control. It was put to the maintainer against
two alternatives and accepted on 2026-09-21: keeping Money as its own route would
contradict the whole point of the page, and disabling the control as the reader
scrolls into the band would be a control that changes state on scroll, which
nothing else in this app does. Recorded here rather than discovered later.

### The five tab routes — kept as redirects

| Old route | New anchor |
| --- | --- |
| `/team/{id}/roster` | `#roster` |
| `/team/{id}/games` | `#games` |
| `/team/{id}/numbers` | **`#standing`** |
| `/team/{id}/contracts` | `#money` |
| `/team/{id}/minors` | `#farm` |

`/numbers` lands on `#standing` rather than `#ranks`, although the name looks
like it should go the other way. A redirect should land where the tab's **lead
content** went, and the Numbers tab's first module is the standings table.

`/team/{id}/leaders`, `/transactions`, `/photos` and `/stamp-in` are **not**
redirects. They are pages, they stay pages, and this page links to all four.
Measured, they are 14,323px, 24,134px, 26,841px and — because its consent gate is
on the page (ADR-0042) — 664px and zero requests. Nothing here absorbs them.

### Shelves and the index grid — stay removed

Covered under failure 1 above. Both were removed on 2026-08-04 and neither
returns. The band is the hierarchy device, and there is one of it.

### The deliberately duplicated loaders — the duplication is now spent

ADR-0034 records that each tab's loader was written by copying out of `loadTeam`,
that sharing would have put four agents inside one function, and that the
duplication was time-boxed to the parallel build and collapsed afterward into
`screens/team/data/shared.js`.

That judgement was right and this ADR does not disturb it. What it adds is that
**the duplication which survived that collapse is exactly the 50 repeated
requests above** — the same fact, seen from the network rather than from the
source. One page spends it, not by parameterising the loaders into one function,
but by there being one page, so each loader runs once.

ADR-0034's parting warning still stands — *"if two loaders seem redundant, check
whether they answer the same question before parameterising them into one"* — and
it now has a second edge:

> **Two loaders that fetch the same URL are not necessarily redundant. On one
> page, they simply must not both run.**

## The affiliate is a different page, not a shorter one

`hiddenTeamTabs()` drops whole tabs a thin club cannot fill, and six tabs hide
that — you see fewer buttons and think nothing of it. One long page cannot hide
it. So the rule is stated rather than implied:

> **A band a club cannot fill does not render and does not appear in the jump
> bar. Absent, never disabled.**

A jump bar's only promise is "tap this and you land there". A disabled anchor
breaks the control's one contract, and it does it on the page of the club least
able to argue back. It is also an apology, and #1106 is right that the level
identity is real and should be used rather than apologised for.

**The order of the bands is what makes a short page read as a short book rather
than as missing pages.** An affiliate always loses **Money** (6). With no parent
org it loses **Farm** (5). Both are the page's tail, and **About (7) is never
lost**, so the page still ends where every other club's page ends.

| Club | Bands | Anchors |
| --- | --- | ---: |
| 158 Milwaukee, MLB | all seven | 7 |
| 556 Nashville, AAA | no Money; Ranks is ABS and the leaders ledger | 6 |
| 572 Wisconsin, A+ · 249 Wilson, A | no Money; Ranks is the leaders ledger alone | 6 |

**Money is the only band a real affiliate loses**, it is second from last, and
About still follows it — so the missing band is a gap the reader cannot see
rather than a page that stops early.

**And the "thin affiliate" turns out not to be thin.** `/team/249` — nominated as
the thinnest real page there is — measures 3,158px against Milwaukee's 4,340px,
and its Minors tab is *longer* than Milwaukee's, because all three affiliates
share one org's farm system. Every band a Single-A club keeps, it fills.

**`hiddenTeamTabs()` cannot express this rule and is replaced.** It decides at
tab grain, and nothing in it can say "Ranks is absent below Triple-A" — the most
common absence on the new page. It also has a hole (below). #1107 writes
`hiddenTeamSections(team)` in the same file, decided off the same cheap identity
data `loadTeamIdentity` already has — **never by fetching a band's payload to
find out whether to show it**, which is the PRD non-negotiable that keeps the
cold load cheap.

## Two things found while measuring, both filed

Neither is fixed here. Both make a decision above provisional.

**#1142 — the MiLB Photos rail walks the whole season and draws nothing.**
`/team/556/games` fires **154** requests, `/team/572/games` and `/team/249/games`
**136** each, around 132 of them `/api/v1/game/{pk}/content`. `TeamPhotosRail`
stops when it runs out of games rather than when it finds nothing; MiLB games
carry no photographer stills, so it consumes the club's entire season and then
self-hides. One tab, on the three clubs least able to afford it, is within a
third of the 192 this whole effort exists to have cut. The long page uses the
**capped** rail, which does not trip it — but the Games band's Photos placement
is provisional until #1142 lands.

**#1143 — winter-ball clubs reach the team hub, and `hiddenTeamTabs()` waves them
through.** All 30 winter clubs are in `public/data/teams.json` under
`bySportId["17"]`, and the slate's level rail reads
`MLB · WINTER · AAA · AA · A+ · A`. Three taps from a November slate lands on
`/team/675`: **664px, one Ballpark card, a dash where the level badge goes**
(`SPORT_LABEL` has no key for 17), and an Affiliate chip pointing at
`parentOrgId: 11` — the Office of the Commissioner. The page is empty because
`seasonOf()` takes the calendar year while a winter league's season is named for
the year it opens in; `rosterType=fullSeason&season=2025` returns 55 players and
`season=2026` returns 0. One tap further, `/team/11` resolves live to
`sport.id: 1` with a `league` object carrying no `id` — so `hiddenTeamTabs()`
early-returns on `!isMilb` **before** reaching its own `league?.id` guard, and a
league-less, roster-less entity gets all six tabs, Contracts included.

**Winter ball is in scope for this work (decided 2026-09-21): #1143 lands before
#1107.** The correct absent-band logic cannot be built without it — it is the
reason `hiddenTeamSections(team)` must put the `league?.id` test **ahead** of any
sport test rather than inheriting the function it replaces.

What the page becomes once that lands was measured, not guessed, against Los
Mochis for season 2025: the league standings return **10 clubs** (with `division`
null on both sides, which `divisionRecordFor` already normalises), the leader
pool returns **23 hitting and 32 pitching splits**, and the full-season roster
returns **55 players**. So the winter shape is **five bands** — Standing, Ranks,
Games, Roster, About — not the empty page it is today. Thin, but named and
closed.

## What was not decided here

**No colour.** Not the band tint, not a suggestion of one. That is #1106's, and
what this pass hands it is the box to draw inside, which the token tier collapse
(#1128) narrowed while #1105 was being written:

- `--paper-1` is folded into `--paper-0` — both `#F6EFDC`, and `--bg-page` now
  aliases `--bg-canvas`. **There is no step below the canvas, and no longer a
  step just above it.**
- The rest of the ladder runs upward: `--surface-card` = `--paper-2`,
  `--surface-inset` = `--paper-3`.
- The primitive tier is guarded — a band tint is an **alias-tier token**, never
  a `--paper-*` read.
- **`--seal` (`#B5824A`) is unavailable.** #1138 is open and is taking kraft
  amber *back* for the reveal vocabulary: *"Kraft-tape amber means sealed — the
  app's whole idea."* `--kraft-board` is the Game Log's. Both warm browns on the
  manila ladder are spoken for.

**No component.** `SectionHead` does not exist — #1113 is open and blocked by
#1129, #1130 and #1131, all open. `SectionMasthead` (36 uses) and `SectionTitle`
(38 uses) are still two components. The six band heads this page needs are listed
in `scope.md` §2G, and they put exactly one new requirement on #1113: **a
sub-head level**, which neither component has, and which comes from #928's
two-sections-under-one-head rule rather than from the team page's taste.

**ADR-0030 is untouched.** A club may colour a card that identifies the club,
never a control. The jump bar stays the app's own navy, on this hub and on the
player hub, as `HubTabBar` already enforces for both callers.

## Consequences

- `TeamPage.jsx` becomes the composition of seven bands. It does not grow back
  toward 2,205 lines; `check-file-size` and `check-dir-size` hold.
- `TeamTabBar.jsx` becomes a jump bar over the same shared `HubTabBar` control in
  `components/chrome/`, so the player hub inherits it in the same commit.
- Five rules generalise to `/player/{id}` and are written to: the band grammar,
  the preview rule, absent-never-disabled, ordering so thin subjects lose the
  tail, and ending every page on the one band that is never absent (the player
  hub's equivalent of About is a biography band — every player has a birthplace,
  a draft, a debut, a height and a handedness). The band *names* do not
  generalise, and should not — except **Money**, which #928 already named.
- `CLAUDE.md` and `src/CLAUDE.md` both say "`/team/{id}` is a six-tab hub; each
  tab is a real route". That stops being true the day #1107 merges.
