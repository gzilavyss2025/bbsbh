# Team page one-scroll — the wireframe

**Issue:** #1105, step 1 of three (#1106 designs it, #1107 builds it)
**Status:** section list, order and every open call SIGNED OFF 2026-09-21.
One question outstanding — winter ball (#1143), see 2E.
**Draft ADR:** `docs/adr/0082-the-team-page-is-one-scroll-of-named-bands.md`

This document is in two halves, and the order is the point. **Pass 1 is what was
measured.** **Pass 2 is what was decided.** Everything in pass 2 cites pass 1. No
section was named before the measuring was done, because naming sections off the
tab structure and then measuring to justify them is the failure this order
exists to prevent.

Two bugs were found while measuring. Both are filed, both are linked below, and
both mark a section decision **provisional**: **#1142** and **#1143**.

---
---

# PASS 1 — WHAT WAS MEASURED

## 1A. The instrument, and how to re-run it

Every number below comes from one script, so every number compares to every
other one:

```bash
npm run build && npm run preview           # port 4173 — see "why production" below
MSYS_NO_PATHCONV=1 PORT=4173 node .scratch/team-one-scroll/count-requests.mjs
MSYS_NO_PATHCONV=1 PORT=4173 DETAIL=1 node .scratch/team-one-scroll/count-requests.mjs "/team/158"
MSYS_NO_PATHCONV=1 PORT=4173 UNION=1  node .scratch/team-one-scroll/count-requests.mjs "/team/158" "/team/158/roster" ...
```

`.scratch/team-one-scroll/count-requests.mjs` uses `page.on('request', …)` — the
same instrument `e2e/salaries.spec.js:148`, `e2e/invariants/spoiler-dom.spec.js:90`
and `e2e/gamecard-parkart.spec.js:27` already use. It counts two things and
nothing else: **`statsapi.mlb.com`**, and **`/data/*.json`**. Images, fonts and
JS chunks are not data. Phone viewport (iPhone 13). `?nointro` on every URL.
statsapi needs the Bash sandbox off. `MSYS_NO_PATHCONV=1` stops Git Bash
rewriting `/team/158` into a Windows path.

Two companion scripts were written for the same pass:

- `page-shape.mjs` — what a route actually **draws**: its tab buttons, its level
  badge, its parent chip, every card heading in document order with its height,
  and the page height. Reading a module list out of a tab's JSX is not the same
  thing, because half these modules self-hide on empty data and three self-fetch.
- `probe-reach.mjs` — walks the slate to a winter-ball club's team page by
  clicking, to settle 1C by evidence rather than by inference.

### Two things about the instrument that change the numbers

**Measure against a production build, not the dev server.** `src/main.jsx` mounts
in `<StrictMode>`, and React double-invokes effects in development. Every
`useAsync` fetch therefore fires twice on `npm run dev`, while static files
deduplicate through their own module caches. The Brewers Overview reads **39 on
the dev server and 28 on a production build**. ADR-0034's headline for the same
page is 24. The instrument and the ADR agree; the dev server does not. **#1107
must measure on `npm run preview`, or its before/after will not compare with
anything here.**

**Wait for quiet, never for a fixed timeout.** The first version of the script
used a 4-second settle window and read the same page as `25 cold / 64 scrolled`
on one run and `39 / 39` on the next — the wait was expiring mid-fan-out rather
than after it. That is issue #1095's trap, the one `e2e/fixtures.js` documents.
The script now warms each route once, uncounted, then treats a count as final
after 3 seconds with no data request. Three consecutive runs return identical
numbers.

---

## 1B. The request count — the hard constraint

### The Brewers (158), MLB, everything present

Production build, phone viewport, cold load, no scroll:

| Route | requests | of which statsapi | page height |
| --- | ---: | ---: | ---: |
| `/team/158` (Overview) | **28** | 19 | 4,340px |
| `/team/158/roster` | **50** | 44 | 3,843px |
| `/team/158/games` | **20** | 15 | 3,421px |
| `/team/158/numbers` | **22** | 13 | 7,513px |
| `/team/158/contracts` | **6** | 2 | 2,867px |
| `/team/158/minors` | **33** | 27 | 3,717px |

**Cold equals scrolled on every one of these routes.** Not one module on the team
hub defers its first fetch until it is on screen. That is worth stating plainly,
because #1107's whole budget rests on machinery that does not exist yet — see 1D.

### The number ADR-0034 did not have

ADR-0034 measured the front door. It never measured the club.

```
UNION over the six Brewers tabs
  requests fired in total : 159
  distinct URLs           : 109
  paid more than once     :  50
```

**Seeing everything the Brewers page holds costs 159 requests today, for 109
distinct URLs.** Thirty-one percent of the traffic buys nothing. The repeats are
not scattered — they are the shell, paid once per tab:

```
  ×7  /api/v1/standings?leagueId=104&season=2026&standingsTypes=regularSeason
  ×6  /data/teams.json
  ×6  /api/v1/teams/158/coaches?season=2026
  ×6  /data/game-notes/158.json
  ×4  /api/v1/schedule?sportId=1&teamId=158&season=2026&gameType=R&hydrate=…
  ×3  /api/v1/teams/158/roster?rosterType=40Man&season=2026
  ×3  /api/v1/stats?stats=season&group=hitting&…&teamId=158
  ×3  /api/v1/stats?stats=season&group=pitching&…&teamId=158
```

The identity header alone accounts for 25 of the 50. This is ADR-0034's
"deliberately duplicated loaders" seen from the network instead of from the
source, and it is the cost the tabs charge for the saving they make.

### The three affiliates

| Route | requests | statsapi | height |
| --- | ---: | ---: | ---: |
| `/team/556` Nashville, AAA | 19 | 17 | 3,287px |
| `/team/556/roster` | 42 | 38 | 3,821px |
| `/team/556/games` | **154** | 153 | 2,544px |
| `/team/556/numbers` | 11 | 8 | 6,150px |
| `/team/556/minors` | 33 | 27 | 3,966px |
| `/team/572` Wisconsin, A+ | 19 | 17 | 3,178px |
| `/team/572/roster` | 40 | 36 | 3,296px |
| `/team/572/games` | **136** | 135 | 2,514px |
| `/team/572/numbers` | 10 | 8 | 4,855px |
| `/team/572/minors` | 33 | 27 | 3,905px |
| `/team/249` Wilson, A | 19 | 17 | 3,158px |
| `/team/249/roster` | 40 | 36 | 3,506px |
| `/team/249/games` | **136** | 135 | 2,526px |
| `/team/249/numbers` | 10 | 8 | 4,848px |
| `/team/249/minors` | 33 | 27 | 3,869px |

Union, with the Games tab left out (see the bug below): **556 → 83 distinct of
105 fired. 572 → 80 of 102. 249 → 80 of 102.**

### ⚠ The bug in that table — #1142

**Every MiLB club's Games tab fires 136 to 154 requests and draws nothing for
them.** Around 132 of those are `/api/v1/game/{pk}/content`.

`TeamPhotosRail` walks the season backward until it has ten photographer stills,
and its stop condition is "ran out of games". MiLB games carry no professional
camera stills at all, so the walk consumes the club's entire decided season and
then the card self-hides. The reader sees nothing and pays for everything. The
Overview escapes it because its copy passes `limit`, which caps the walk to one
batch of eight games.

For scale: ADR-0034's headline — the number the whole five-tab rebuild exists to
have cut — is **192 on the old one-scroll page**. One tab, on the three clubs
least able to afford it, is within a third of it.

Filed as **#1142** (`bug`, `needs-triage`). **The Games section's Photos
placement below is provisional on it.**

### The four standalone pages

| Route | requests | height | note |
| --- | ---: | ---: | --- |
| `/team/158/leaders` | 3 | 14,323px | |
| `/team/158/transactions` | 5 | 24,134px | |
| `/team/158/photos` | 10 → **18** | 26,841px | the only route in the hub where cold ≠ scrolled |
| `/team/158/stamp-in` | **0** | 664px | fetches nothing until you consent — ADR-0042 |

All four are long. All four stay pages. Nothing in this wireframe absorbs them.

---

## 1C. Is a parentless club reachable at `/team/{id}`?

**Yes. And the answer is worse than "parentless".** Two page shapes fall out of
it, and both are reachable from a slate the app ships.

### What proved it

Not `affiliates.json`. `probe-reach.mjs` clicked the path a reader takes:

1. `/11152025?nointro` — the slate. The level rail reads
   **`MLB · WINTER · AAA · AA · A+ · A`**. Winter ball shipped in PR #1104 /
   ADR-0078.
2. The WINTER tab lists five game cards.
3. Reveal the day, open a card. `GameResultFace`'s `TeamLine` renders a
   `<TeamLink>` on **both** sides of any decided game — so does
   `GameResultFace.jsx:244`, and so do 40 other callers.
4. Tapping the club name lands on **`/team/los-mochis-675`**.

`fetchTeam()` (`src/api/team.js:15`) resolves it straight out of
`public/data/teams.json`, which carries all 30 winter clubs under
`bySportId["17"]`. `scripts/gen-teams.mjs` writes them on purpose, because the
slate's club strip reads that file. There is no fall-through to
`/api/v1/teams/{id}` at all for these clubs.

`grep -rn -i winter src/screens/team/` returns nothing. The team hub has never
heard of sportId 17.

### Shape 4 — the winter-ball club (`/team/675`)

```
tabs    : Overview · Roster · Games · Numbers · Minors
level   : —            parent: AffiliateO
record  : (none)
height  : 664px    blocks: 2
      91px  Ballpark
      28px  (the as-of banner)
```

Three separate faults, all confirmed:

- **It asks for the wrong season, so it is permanently empty.** `seasonOf(asOf)`
  takes the calendar year. A winter league's season is named for the year it
  **opens** in — the rule `winterSeasonFor()` already states in
  `src/lib/winter/window.js`, which the hub does not call. Verified live against
  Los Mochis: `rosterType=fullSeason&season=2025` returns **55 players**;
  `season=2026` returns **0**. `/team/675?d=2026-01-15` — a date squarely inside
  the 2025-26 winter — still renders the same empty 664px.
- **The level badge prints a dash.** `SPORT_LABEL` has no key for 17.
- **The Affiliate chip points at something that is not a club.** Every winter club
  carries `parentOrgId: 11` — **"Office of the Commissioner"**.

### Shape 5 — `/team/11`, one tap further

```
tabs    : Overview · Roster · Games · Numbers · Contracts · Minors
height  : 664px    blocks: 2      (Ballpark, as-of banner)
```

`/team/11` is not in `teams.json`, so `fetchTeam` does fall through to live
statsapi, which answers:

```json
{ "id": 11, "name": "Office of the Commissioner",
  "league": { "link": "/api/v1/league/null" },   // NO id
  "sport":  { "id": 1 } }                        // reads as MLB
```

`hiddenTeamTabs()` early-returns on `!isMilb` **before** it reaches its own
`if (!team.league?.id) hidden.add('numbers')` guard. The guard written for
exactly this case never fires. So a league-less, roster-less, schedule-less
entity gets **all six tabs, Contracts included**.

Filed as **#1143** (`bug`, `needs-triage`). **The affiliate section rules below
are provisional for sportId 17.**

### Rookie level — reachable, and healthy

`SPORT_IDS.ROK` is 16, it is absent from `SEARCHABLE_SPORT_IDS`, and it is absent
from `teams.json`. So `fetchTeam` falls through to live statsapi, which returns a
real `parentOrgId`, `league.id` **and** `division.id`. `src/api/team.js:285`
(`fetchComplexAffiliates`) pulls ROK clubs onto an MLB club's Minors tab as real
affiliate cards, which is the door in.

`/team/404` (ACL Angels) renders a thin but **genuine** page: 2,137px, five tabs,
a correct `ROK` badge, standings, ballpark, last ten, roster projection and the
leaders ledger. It needs no special handling. It is a thin club, not a broken one.

### So the wireframe designs for how many missing sections?

**Three, not one.** An affiliate can lose Money (always), Ranks (below Triple-A)
and Farm (no parent org). Shapes 4 and 5 are not "one more edge case to soften" —
they are a club with **nothing under the tab bar at all**, and no page shape can
rescue a page with no data on it. They belong to #1143, not to this wireframe.
The wireframe's job is to make sure the *rule* that hides a section is one the
long page can apply honestly; see 2E.

---

## 1D. Four things #1105's text predates

### 1. `/design-lab` exists

`#1112` shipped in PR #1123. `node .scratch/design-system/inventory.mjs` reports
the live counts:

```
41 blocks — 31 card, 10 pill
namespace-only (no base rule): 7
zero consumers: (none)
```

The header comment in `src/screens/designlab/catalog.js` is stale and the script
is the source of truth, as #1105 says.

Two facts from that catalog bear directly on this page. **`.thub-card` is the
canonical sheet and the most-used box in the app** — 16 consumers, and four of
them already put a second, box-less class beside it, which is the variant pattern
#1113 proposes, already shipped. And **`.seedcard` and `.pswscard` render
unstyled on `/design-lab`** (#1113 says so); neither appears on the team page, so
no verdict here was read off a blank box.

Every module this wireframe places is already one of those blocks. The page is an
arrangement of boxes that exist. It introduces none.

### 2. `SectionHead` does not exist

`#1113` is open and blocked by `#1129`, `#1130` and `#1131` — all three open.
`SectionMasthead` and `SectionTitle` are still two components:

| Component | Draws | Uses |
| --- | --- | ---: |
| `SectionMasthead` (`components/ui/`) | `.metricbar` — navy bar, kraft-gold bottom border, condensed uppercase title, right slot, optional club mark | 36 |
| `SectionTitle` (`components/ui/`) | `.section__title` — uppercase `<h3>`, optional `note`, optional `action` | 38 |

**Assume no component draws a band head.** The six this page needs are listed in
2G, with what each one has to carry. That list is also the evidence #1113 asked
for: it is what a merged `SectionHead` has to cover.

### 3. #928 decided the band grammar on 2026-09-21 — and handed it here

#928 settled that `/player/{id}` gets **one Money band holding two sections under
one head**: "the deal he is on now", then "before this deal". It also says, in
the decision comment:

> The band's design also depends on the team page's bands (#1105–#1107) and on
> `SectionHead` (#1113), none of which exist yet.

So the shared rule already points at this document. **Adopted, and this ADR is
its home.** #928 is a consumer of the rule, not a second copy of it.

> **A band is one question. A band may hold more than one section when the
> question has two halves that a reader asks in one breath, and it carries one
> head for both.**

The team page uses it exactly once (the **Standing** band; see 2B), and the
restraint is the point. Two sections under one head is a device for a question
with two halves. It is not a way to fit seven bands into six anchors.

### 4. The token tier collapsed — and the band tint has nowhere to land

#1128 is open; PRs #1135 and #1136 merged; #1137 and #1138 are still open. What
merged changes what step 2 can draw:

- **`--paper-1` is folded into `--paper-0`.** Both are `#F6EFDC`. `--bg-page`
  aliases `--bg-canvas`. The app shipped four papers and showed three.
- The rest of the ladder runs **upward** from the canvas:
  `--surface-card` = `--paper-2` `#FBF6E9`, `--surface-inset` = `--paper-3`
  `#FFFDF6`. **There is no step below the canvas, and there is no longer a step
  just above it.**
- `--fs-caption` split into `--fs-label` (12px, display) and `--fs-cell`
  (11px, mono).
- **The primitive tier is guarded.** 155 rules read `--paper-*` directly and 104
  read `--rule*`; #1128 adds both prefixes to the guard that rejects ad-hoc type
  values. A band tint must be an **alias-tier token**, not a `--paper-*` read.

And the constraint that matters most, from **#1138, still open**:

> Kraft-tape amber means **sealed** — the app's whole idea. It now appears in 62
> partials, and rank chips wear it. Move rank and highlight emphasis to
> `--marker` and give the seal back to the reveal vocabulary.

So: **`--seal` (`#B5824A`) is not available to a band.** Neither is
`--kraft-board` (`#6B4A22`, the Game Log board). Both warm browns on the manila
ladder are spoken for, and #1138 is actively taking one of them *back*.

**Per #1105's instruction, this document proposes no tint — not even a
suggestion.** It states the box step 2 has to draw inside: a new alias-tier
token, in a hue the ladder does not use, that reads as neither tape nor board,
holds AA against the ink on it, and passes `check-contrast`.

---
---

# PASS 2 — WHAT WAS DECIDED

## 2A. The Overview, settled first

**The Overview does not survive. It dissolves.** Every other answer follows from
this one, so it is made first.

`page-shape.mjs` says today's Overview is ten blocks. Six are previews of a tab.
**Four are not previews of anything** — the Overview is the only place they
exist:

| Overview block | What it is |
| --- | --- |
| Division standings + Postseason Odds | **owned** — the whole division, no door |
| Ballpark | **owned** — this IS the full detail view |
| Team Score (grade + form rails) | **owned** — nothing lives behind it |
| Made The Show (MiLB) | **owned** — nothing else in the app holds it |
| Last 10 rail | preview → Games |
| Highlights rail (capped 6) | preview → Games |
| Photos rail (capped 6) | preview → Games, and `/photos` |
| Roster projection | preview → Roster |
| Leaders ledger (3 + 3) | preview → Numbers, and `/leaders` |
| Transactions (capped 3) | preview → Games, and `/transactions` |

On six tabs a preview is a **door** — you cannot see the full thing without
leaving. On one page the full thing is in the same scroll, so a preview above it
is the same content twice, a few thousand pixels apart. That is not a summary.
That is failure 1 and failure 2 of ADR-0034 rebuilt by hand.

So:

> **A preview either becomes its section, or becomes its section's cap with a
> door to a standalone page. It never sits above the thing it previews.**

- **Its four owned modules move** to the section whose question they answer.
  They stop being "the Overview's" and become Standing's, Games' and Farm's.
- **Five previews are deleted** and the full module renders once, in its section:
  standings, roster projection, highlights, leaders (6+6), transactions deck.
- **Two previews survive as the section's cap**, because the full thing is a
  14,000-to-27,000-pixel page of its own: **Photos** (capped, door to
  `/team/{id}/photos`) and **Leaders** (6+6, door to `/team/{id}/leaders` — which
  is exactly what the Numbers tab does today).
- **The six `PreviewDoor` links go**, because there is no tab to open. Three of
  their targets survive as doors to standalone pages; three had no target but a
  tab.

One consequence worth having on purpose: the long page uses
`TeamPhotosRail`'s **capped** copy, which is the one that does not trip #1142.

---

## 2B. The sections — an MLB club

**Seven bands.** Six answer a question about the club's SEASON. The seventh,
**About**, answers a question about the club itself, and it is last.

> **Decided 2026-09-21 (Gary).** About is a band of its own, at the foot of the
> page, and the Ballpark lives in it. It replaces the three placements this
> document originally offered for the Ballpark card, all of which put it inside
> a season band.

One anchor more than today's six tabs. That is a real cost on a phone jump bar
and it buys two things: the Ballpark stops being a photograph wedged between two
season cards, and **every club's page now ends the same way**, because About is
the one band no club can fail to fill — every club has a ballpark. A Single-A
page and a Milwaukee page close on the same note. See 2E.

### 1 · STANDING — "How is the season going?"

**One band, two sections, one head** (the #928 rule, used once):

*Where they stand*
- Division standings + the Postseason Odds pill and its modal
- Team Score — season grade and form rails (MLB only)

*Record, split every way*
- Records — ~50 W-L splits, every row a door to `/situational-records`
- Record by day of week
- Logos & jerseys — record by jersey (MLB) / home and away (MiLB)
- Comebacks (MLB only)
- Last Time — droughts (MLB only)

**Why this band exists in this shape.** ADR-0034 names the old page's second
failure by naming these exact cards: *"Standings, team score, day-of-week record
and comeback wins all answer 'how is the season going' and were cards 2, 5, 10
and 13, with photos and jerseys in between."* Putting all four in one band, with
nothing between them, is the demonstration that a long page fixes that failure
without tabs. If this band does not work, the whole idea does not.

**Why one band and not two.** ADR-0034's complaint is *interleaving*, not length —
"with photos and jerseys in between". Two adjacent bands on one subject would not
be failure 2. But it would be seven anchors, and the jump bar is a phone control.
One band, two sections is the #928 rule doing real work rather than decorating.

**The scale problem, named honestly.** The Records card is **3,238px and 61
rows** — 68% of this band and the largest single object on the page by a factor
of three. It has a door on every row, but that door goes to
`/situational-records`, which ranks *one* split across the level; it is not
"this club's other fifty splits", so capping the card loses content with nowhere
to send it. > **Decided 2026-09-21 (Gary): Records stays full.** Nothing is lost, no shipped
> module changes, and no new scope opens. The cost is accepted — the first band
> opens with about four phone screens of W-L splits.

The alternative was measured and rejected: capping the card drops the band to
~2,183px, but the ~45 rows that fall off have **nowhere to go**. The card's only
door today is `/situational-records`, which ranks ONE split across thirty clubs —
it is not "this club's other fifty splits". So a cap either builds a page that
does not exist (new scope for both #1106 and #1107) or deletes content, which the
PRD forbids.

**#1106 still owns the rhythm**, and this is the page's one scale outlier: 61
rows, 68% of the band, the largest object on the page by a factor of three. If
the drawing genuinely cannot hold it, the way out is the half/month toggle the
card already has doing more work — not a cap.

### 2 · RANKS — "Where does this club sit among the rest?"

- Team batting ranks (MLB only)
- Team pitching ranks (MLB only)
- Run value (MLB only — Savant runs no minor-league board)
- ABS challenges (MLB and Triple-A only)

**Why it is called Ranks and not Numbers.** Every card here answers one question:
where is this club against its league. Today's "Numbers" tab is a bag holding
that *plus* the standings, the leaders and five record cards. With those moved to
where their question is asked, "Numbers" would name a bag that no longer exists.
`Ranks` is short enough for a jump bar and honest about what is under it.

**This is the section an affiliate loses whole**, below Triple-A. See 2E.

### 3 · GAMES — "What have they played, and where?"

- Season schedule — carrying the **Stamp In** door to `/team/{id}/stamp-in`
- The season's games, `AllGames` grid, newest first, "Show more" beneath
- Highlights rail (MLB only — `isMlbTeamId`, as both callers already gate it)
- Photos rail, **capped**, with its "Full season ›" door to `/team/{id}/photos`

**The Ballpark is not here.** An earlier draft opened this band with it. It is
in **About** instead — see the seventh band below.

**`LastTenGames` is proposed for a cut.** See 2D.

**Provisional on #1142** — see 1B.

### 4 · ROSTER — "Who plays here?"

- Roster projection, with its Season / Current toggle
- Bullpen health (MLB only — `workload.json` has no MiLB rows; self-fetching and
  self-hiding today, and it stays that way)
- Team leaders ledger, six categories a side, with both its doors:
  "See all ›" → `/team/{id}/leaders`, "Org leaders ›" → `/team/{orgId}/leaders`
- Current roster (40-man)
- Injured list
- Transactions deck, **capped**, with "All transactions ›" → `/team/{id}/transactions`

**Leaders moves off Numbers, and this is the least obvious call here.** "Who is
the best hitter on this club" is a question about *people*, not about the season
measured. The ledger names players, and the 40-man list is directly beneath it.
It is stat-shaped, which is why it ended up on a tab called Numbers, but a reader
does not go looking for it there. The move also has a measured consequence: with
leaders on Numbers, a Single-A club's Ranks section would be one lone card;
without it, that section is honestly **empty and absent** (2E). That is the
cleaner page.

**Transactions moves off Games.** A transaction is a roster move. It answers "who
arrived and who left", which is the same question as "who plays here" one tense
back. It costs something rather than saving something: Roster is already the
longer of the two (3,843px against Games' 3,421px today), so this move makes the
page's longest band longer still. It is worth it on the question, not on the
balance.

This is the page's longest band (~4,050px on an MLB club). It is also the page's
biggest subject.

### 5 · FARM — "Who is coming, and where does this club sit in the org?"

- Affiliation history (MiLB only — leads the band, as it does today)
- Affiliates
- On the horizon
- Prospects (uncapped — `showAllProspects`, as the Minors tab already does)
- Depth chart
- Made The Show (MiLB only — closes the band)

**Made The Show closes it.** It is the top of the org ladder seen from below: the
players who came through this club and went up. Nothing else in the app holds it.
It belongs at the end of the org band, not orphaned at the foot of the page.

### 6 · MONEY — "What does it cost?" — MLB only

- Four payroll tiles
- Commitment cliff
- Contract grid
- Key
- Source line

**Called Money, not Contracts**, to match the band #928 named on the player page.
That is the point of writing rules the player page can take: the same question
should wear the same word on both hubs.

### 7 · ABOUT — "What is this club?" — every club

- Ballpark — the diagram, the dimensions, the photo, capacity and attendance

**Why it is its own band and not a card inside one.** A ballpark is not a
season. It does not move with `?d=`, it does not rank, and it is not a result.
Every season band on this page answers a question whose answer changed
yesterday; this one does not. Putting it inside Games, Standing or Roster makes
some season band carry a thing that is not about the season, which is exactly
the complaint ADR-0034 recorded about the old page.

**Why last.** It is the least urgent question a visitor brings, and putting it at
the foot gives the page a close rather than a stop.

**Why it is the band that matters most to a thin club.** It is the only band on
this page that **no club can fail to fill**. Money needs Cot's. Ranks needs a
league board. Farm needs a parent org. Standing needs a division. A ballpark is
a building, and every club in the app plays in one. So every page — Milwaukee's
20,050px and a Single-A club's 13,570px alike — ends on the same band, in the
same place, with the same head. That is worth more to the short page than to the
long one, and it is the single best answer this wireframe has to #1106's
question about whether a short page reads as broken.

**It is also nearly free.** One static file, already fetched for the header's
venue name. On an affiliate it is 93px rather than 1,014px, because nobody has
hand-verified a MiLB park's outfield dimensions — so a MiLB About band is one
small card. That is thin, and it is the one thing about this decision worth
revisiting; see the open question at the end of 2E.

---

**This band does not date.** `loadContracts` is deliberately not keyed on `asOf`,
and the Contracts tab passes `datable={false}` to suppress the as-of banner. On
one page there is one banner for the whole page, so this band carries its
`SourceLine` note — *"A season's book, not a day's"* — as the thing that says so.
> **Decided 2026-09-21 (Gary): accepted.** One date control for the page. The
> Money band's own `SourceLine` note is what says the band does not move with it.

**It is a real loss of precision and #1107 should know about it**: today a reader
who opens `/contracts` sees no date control at all; tomorrow they will see one at
the foot of a page that includes a band the control does not move. The two
alternatives were weighed and rejected — leaving Money as its own route would
contradict #1105's "mostly everything gets a presence on the page", and greying
the control out as the reader scrolls into the band would be a control that
changes state on scroll, which nothing else in this app does.

---

## 2C. The order

```
STANDING  →  RANKS  →  GAMES  →  ROSTER  →  FARM  →  MONEY  →  ABOUT
```

**Between the bands**, two rules decide it:

1. **It steps outward from the one-line answer.** Standing is the headline every
   visitor came for. Ranks is the same season one level deeper. Games is the
   season event by event. Roster is the people. Farm is the people who are not
   here yet. Money is the least-asked question on the page.

2. **The bands an affiliate loses are at the end.** An affiliate always loses
   Money (6). With no parent org it loses Farm (5). **About (7) is never lost**,
   so the page still ends where every other club's page ends — the missing band
   is a gap the reader cannot see, not a page that stops early.

Rule 2 is the one that earns its place, and it is the answer to #1106's question
— *does a short page read as a club with a quieter season, or as a broken page?*
Losing the **tail** of a book reads as a shorter book. Losing its **middle** reads
as missing pages. Adding About at 7 strengthens this: the last thing a reader
sees is a band that every club fills, so no page ends on an absence.

Since team leaders stayed in Ranks (2D), **Ranks is never empty either** — a
Single-A club keeps it with the leaders ledger alone. So the only band any real
affiliate loses is Money, at 6, with About still to come after it.

**Inside each band**, one rule: **the thing that answers the band's question in
one line goes first; everything that qualifies the answer follows; the door out
goes last.** Standings before the splits. The ballpark before the schedule.
The projection before the 40-man. The affiliate ladder before the prospects on it.

---

## 2D. Cuts — proposals, for Gary to approve

The PRD says nothing is deleted, so these are **proposals and nothing has been
designed as though they are already gone.** One line each.

> **Cut 1 — `LastTenGames`, the last-ten rail, from the team page.**
> On one page the last-ten rail and the `AllGames` grid are the same ten games,
> about 1,500px apart, and the grid's first row already *is* the last three.
> ADR-0034's own 2026-08-05 amendment kept the rail only "on the Overview, where
> ten cards is exactly what a preview should hold" — with no Overview, that job
> is gone. **Counter-argument:** the rail and the grid read differently — sideways
> ticket stubs, newest last, against a three-across tile grid. If the rail's shape
> is worth keeping for its own sake, keep it and drop the grid's first row
> instead. `TeamPage.jsx` is its only caller, so a cut here retires it.
> **Recommendation: cut.**

Nothing else is proposed for a cut. Every other module answers a question no
other module answers.

**Not cuts, though they look like cuts.** These are duplicates collapsing,
decided by 2A: standings once instead of twice, the roster projection once, the
leaders ledger once at 6+6, the highlights rail once uncapped, the transactions
deck once. And the six `PreviewDoor` links, which are the tab mechanism rather
than content.

---

## 2E. The affiliate — the same four questions, answered again

**Not the same page with fewer cards.** Here is what each of the four clubs
actually renders today, measured with `page-shape.mjs`, and the bands proposed
for it.

### 158 · Milwaukee Brewers — MLB, everything present

| Band | Modules |
| --- | --- |
| Standing | standings + odds · Team Score · Records · day-of-week · jersey records · Comebacks · Last Time\* |
| Ranks | batting · pitching · run value · ABS challenges |
| Games | Schedule (+ Stamp In) · games grid · Highlights · Photos (capped → door) |
| Roster | projection · bullpen health · leaders 6+6 (→ 2 doors) · 40-man · IL · transactions (capped → door) |
| Farm | Affiliates · Horizon · Prospects · Depth chart |
| Money | tiles · cliff · grid · key · source |
| About | Ballpark |

\* **Last Time does not render on the Brewers today**, and that is correct
behaviour, not a bug: `LastTimeCard` returns null when `droughtsFor()` finds no
qualifying drought, and a 98-58 club has none. The data file exists and is
fetched. Recorded because a reader of this table would otherwise chase it.

**Seven bands. Seven anchors.**

### 556 · Nashville Sounds — Triple-A, keeps nearly everything

| Band | Modules | Against MLB |
| --- | --- | --- |
| Standing | standings · Records · day-of-week · home/away uniform strip | **loses** Team Score, Comebacks, Last Time (all MLB-only files) |
| Ranks | **ABS challenges · team leaders** | loses batting, pitching, run value |
| Games | Schedule (+ Stamp In) · games grid | loses Highlights (`isMlbTeamId`), and see #1142 |
| Roster | projection · leaders 6+6 · 40-man · IL | loses bullpen health, transactions |
| Farm | **Affiliation history** · Affiliates · Horizon · Prospects · Depth chart · **Made The Show** | **gains** two |
| ~~Money~~ | — | **absent** |
| About | Ballpark | 93px, not 1,014 — no MiLB park has verified dimensions |

**Six bands. Six anchors.** Nashville is the club the level identity works
hardest for: it is the only affiliate that keeps a Ranks band, and it keeps it
because of ABS. One card is a thin band, but it is a *true* one — it is the only
place in the app that says this club argues with the plate umpire more than its
league does.

### 572 · Wisconsin Timber Rattlers — High-A

| Band | Modules |
| --- | --- |
| Standing | standings · Records · day-of-week · home/away uniform strip |
| Ranks | **team leaders only** — batting, pitching, run value and ABS all absent |
| Games | Schedule (+ Stamp In) · games grid |
| Roster | projection · 40-man · IL |
| Farm | Affiliation history · Affiliates · Horizon · Prospects · Depth chart · Made The Show |
| About | Ballpark, 93px |

**Six bands. Six anchors.** Only Money is absent.

### 249 · Wilson Warbirds — Single-A, "the thinnest real page"

Identical band set and identical module list to 572. **Six bands, six anchors.**

**And it is not thin.** `/team/249` is 3,158px today against Milwaukee's 4,340px —
73% of it — and its Minors tab (3,869px) is *longer* than Milwaukee's (3,717px),
because all three affiliates share one org's farm system. The measured thinnest
real page in the hub is not a Single-A club at all. It is the winter-ball club at
**664px** (1C, #1143).

So #1106's worry — *does a short page read as a club with a quieter season, or as
a broken page?* — has a measured answer for these three clubs: **they are not
short.** They are 73–90% of an MLB club by height, and every band they keep is
full. The band they lose from the middle is Ranks, and that is one artboard, not
a rhythm problem across the whole page.

### The fifth shape — winter ball (675) and `/team/11`

**Provisional on #1143.** Today: 664px, one Ballpark card, a dash for a level,
and a chip to a non-club. There is no page shape that rescues a page with no data
on it, and the fix is a season resolution, a label and a guard — all in #1143,
none in this wireframe.

Once #1143 lands, the shape is **four bands** — Standing, Games, Roster, About —
with Ranks, Farm and Money absent (no league board at that level,
`parentOrgId: 11` is not a parent, no Cot's coverage). Four anchors. **That is
the floor this design has to hold**, and it is the page #1106 should draw
*second*, after the Single-A one.

Worth noting what About buys here: today this page renders exactly one card, the
Ballpark, adrift under a tab bar with nothing above it. Under this wireframe that
same card is a named band with a head, in the place every other club's page also
ends. It does not make the page full. It does make it look finished rather than
broken.

### The one open question About raises

On an affiliate the Ballpark is **93px** — no MiLB park has hand-verified
outfield dimensions, so the band is one small card under a full-width head. Three
other modules are club-identity rather than season material and could join it:
**Logos & jerseys / the uniform strip**, **Affiliation history**, and **Made The
Show**. All three sit in other bands today, and moving any of them has a cost —
the jersey card is a *record by X* card that belongs with its siblings in
Standing, and the other two are the org ladder seen from this club, which is
Farm. **Not moved. Raised for Gary rather than decided here.**

### Absent, not disabled — confirmed

**#1107's assumption is right and stays right.** A band a club cannot fill does
not render and does not appear in the jump bar. Three reasons:

1. It is already the rule. The PRD's non-negotiable 3: *"A tab with nothing in it
   should not render its tab button at all rather than opening an empty screen."*
2. A jump bar's only promise is "tap this and you land there". A disabled anchor
   breaks the control's one contract, and it does it on the page of the club
   least able to argue back.
3. A disabled anchor is an apology. #1106 says it plainly: *the level identity is
   real, use it rather than apologising for it.*

**But the rule needs a new function.** `hiddenTeamTabs()` is not enough:

- It decides at **tab** grain; bands are finer. Nothing in it can express "Ranks
  is absent below Triple-A", which is the single most common absence on the new
  page.
- It has a hole, proved in 1C: the `league?.id` guard sits **behind** an `isMilb`
  early return, so it never fires for `/team/11`.

**#1107 writes `hiddenTeamSections(team)`**, in `data/shared.js` beside the
function it replaces, decided off the same cheap identity data
`loadTeamIdentity` already has — never by fetching a band's payload to find out
whether to show it. That is PRD non-negotiable 2, and it is what keeps the cold
load cheap.

---

## 2F. When each band is fetched, and what it costs

### The machinery does not exist yet — say so first

**Cold equals scrolled on every team-hub route** (1B). `IntersectionObserver` is
hand-rolled in six places, and **not one of them defers a first fetch until the
module is on screen**: `GameCard` arms park art, `TeamPhotosRail` and
`TeamTransactionsCard` page *sideways* (the rail's observer has the track itself
as `root`), `GameSelect` tracks sticky-bar state, and the two standalone pages
grow a list with a 600px `rootMargin`.

So #1107's deferred-load hook is **new machinery, not a pattern being reused**,
and the whole request budget below rests on it. The one route in the hub that
already behaves this way is `/team/158/photos` (10 → 18), and it is a standalone
page, not a section.

### The loader per band

Each band keeps its own loader and fires it when it scrolls into view. The
loaders are today's tab loaders with the duplication removed:

| Band | Loader | Fires |
| --- | --- | --- |
| *(header)* | `loadTeamIdentity` | **page load** |
| Standing | new `loadStanding.js` — lifted out of `loadNumbers` + `loadOverview` | **page load** — it is the first screen |
| Ranks | new `loadRanks.js` — league team stats, run value, ABS exposure | on scroll |
| Games | `loadGames.js`, minus transactions | on scroll |
| Roster | `loadRoster.js`, plus the leader pool and transactions | on scroll |
| Farm | `loadMinors.js`, unchanged | on scroll |
| Money | `loadContracts.js`, unchanged | on scroll |
| About | none — the venue is already in the header's `fetchTeam` response | **free** |

### Two things the working assumption gets wrong

**1. The header must not fetch the standings twice.** `loadTeamIdentity` fetches
standings for the record line; `loadStanding` fetches the same response for the
table. That is the single most repeated request today — **×7 across six tabs**.
The Overview already solves it: `loadOverview` does not call `loadTeamIdentity`
at all, and shapes the header's three fields off its own standings response
through the shared `teamRecordFor`. **The long page does the same**, and the
shaping stays in `shared.js` so the two cannot drift.

**2. The schedule is the one request more than one band needs.** Three bands read
it — Standing (the day-of-week and jersey-record joins), Games (the schedule card
and the grid), Roster (the recent-form window). It is fetched **×4** today.

> **The schedule is a page-level fetch, not a band's. It is the only request
> more than one band needs, and every other request belongs to exactly one band.**

That is a statement #1107 can check with `UNION=1` and fail on.

### The numbers this is judged on

| Club | Cold, before any scroll | Fully scrolled | Anchors |
| --- | ---: | ---: | ---: |
| **158** Milwaukee, MLB | **≤ 20** (today's Overview: **28**) | **≤ 110** (today, all six tabs: 159 fired / 109 distinct) | **7** |
| **556** Nashville, AAA | **≤ 18** (today: 19) | **≤ 85** (today, minus Games: 105 / 83) | **6** |
| **572** Wisconsin, A+ | **≤ 18** (today: 19) | **≤ 80** (today, minus Games: 102 / 80) | **6** |
| **249** Wilson, A | **≤ 18** (today: 19) | **≤ 80** (today, minus Games: 102 / 80) | **6** |
| **675** winter ball | — provisional on #1143 — | | **4** |

**About costs nothing.** `fetchTeam` already returns `venue`, and the header
already reads it. The band adds a head and a card, not a request. So the seventh
anchor is free against both numbers above.

**The cold target is deliberately below today's Overview, not level with it.**
#1107 says the page must fire "no more than today's Overview". That is the floor,
not the target. One page that pays for its identity header once instead of six
times should be **cheaper** than the summary page it replaces, and the arithmetic
says it can be: the Standing band is a strict subset of today's Numbers tab (22
requests) plus two static score files, and the shell is four.

**Why the fully-scrolled ceiling is the distinct-URL union.** 109 is what the
Brewers' six tabs ask for *without* the repeats. A page that fetches each band
once and shares the schedule cannot exceed it, and should come in under it,
because five of the Overview's previews no longer fetch anything separately.

**The affiliate ceilings leave the Games tab out on purpose.** With #1142's walk
included, `/team/249/games` alone is 136 requests and the union is 204. The long
page uses the **capped** photo rail, which costs one batch of eight. If #1142 is
fixed before #1107 ships, these ceilings hold as written. If it is not, #1107
must pass `limit` explicitly and say so in the PR.

---

## 2G. The band heads the page needs — evidence for #1113

No component draws these. Six heads, and what each must carry:

| Band | Head text | Must carry |
| --- | --- | --- |
| Standing | **Standing** | a sub-head for the band's *second* section ("Record, split every way") — the #928 two-section case |
| Ranks | **Ranks** | a level qualifier on an affiliate ("Triple-A only" is the honest note when one card is all there is) |
| Games | **Games** | nothing beyond the title |
| Roster | **Roster** | nothing beyond the title |
| Farm | **Farm** | the org's name on an affiliate, since the ladder shown is the parent's |
| Money | **Money** | a "not dated" note, because this band alone does not move with `?d=` |
| About | **About** | nothing beyond the title — and it must read as a close, not as another section |

So a merged `SectionHead` needs: **a title, an optional note, an optional
right-aligned action, and a sub-head level.** `SectionTitle` has the first three
(`title` / `note` / `action`, 38 uses). `SectionMasthead` has a title, a right
slot and a decorative mark, and draws a navy bar (36 uses). **Neither has a
sub-head.** That is the one genuinely new requirement this page puts on #1113,
and it comes from #928's rule, not from the team page's taste.

---

## 2H. Doors out, and the cutoff

Every door out of the long page, and where it goes:

| Door | Band | Target |
| --- | --- | --- |
| every Records row | Standing | `/situational-records` |
| Postseason Odds pill | Standing | modal, stays on the page |
| League run value board › | Ranks | the league board |
| League challenge board › | Ranks | the league board |
| Stamp In | Games | `/team/{id}/stamp-in` |
| Photos "Full season ›" | Games | `/team/{id}/photos` |
| Leaders "See all ›" | Roster | `/team/{id}/leaders` |
| "Org leaders ›" | Roster | `/team/{orgId}/leaders` |
| "All transactions ›" | Roster | `/team/{id}/transactions` |
| Affiliate cards, standings rows, club strip | several | `/team/{otherId}` |
| every player name | several | `/player/{id}` |

**All of them go through `linkQuery(opts)` with `{ d: asOf, s: sportId }`, and the
page renders inside `<LinkScope asOf sportId>`.** That is ADR-0034's rule
unchanged.

**The rule's surface shrinks.** Today it covers six tab paths *plus* these doors.
Tomorrow there are no tab paths, because there are no tab switches. The mechanism
with no redundancy has fewer places to fail.

**One new obligation, though:** #1107 redirects the five old tab routes to
anchors, and **a redirect that drops the query string is the same spoiler bug a
tab switch would have been.** `/team/158/roster?d=2026-04-01` must land on
`/team/158?d=2026-04-01#roster`, not on `/team/158#roster`.

| Old route | New anchor | |
| --- | --- | --- |
| `/team/{id}/roster` | `#roster` | |
| `/team/{id}/games` | `#games` | |
| `/team/{id}/numbers` | **`#standing`** | not `#ranks` — the tab's lead module was the standings table, and a redirect should land where the tab's lead content went |
| `/team/{id}/contracts` | `#money` | |
| `/team/{id}/minors` | `#farm` | |

---

## 2I. What this hands the player hub

#1105 asks for rules written so `/player/{id}` can take them. Four generalise;
one does not.

1. **A band is one question. A band may hold more than one section when the
   question has two halves, and it carries one head for both.** #928 already
   depends on this. → generalises.
2. **A preview either becomes its section, or becomes its section's cap with a
   door to a standalone page. It never sits above the thing it previews.** The
   player hub's Overview tab is the same shape of problem. → generalises.
3. **A band a subject cannot fill is absent, never disabled** — and the rule that
   hides it is decided off cheap identity data, never by fetching the band to
   find out. → generalises.
4. **Order the bands so the ones a thin subject loses are at the end.** A pitcher
   with no hitting line, a rookie with no career register: same shape as an
   affiliate with no Money band. → generalises.
5. **A last band that no subject can fail to fill.** About is the team page's;
   the player hub needs its own (a biography band — born, drafted, debut, height
   and bats/throws — is the obvious candidate, since every player has all of it).
   The rule is the transferable part: **end every page on the one band that is
   never absent, so no page ends on a gap.** → generalises.
6. **The band names.** Standing / Ranks / Games / Roster / Farm / Money / About
   are this club's questions. Only **Money** carries over, because #928 already
   named it that. → does not generalise, and should not.

---

## Appendix — files

**Written by this pass** (all under `.scratch/team-one-scroll/`):
`scope.md` · `count-requests.mjs` · `page-shape.mjs` · `probe-reach.mjs`

**Read:** `#1105` `#1106` `#1107` `#928` `#1113` `#1128` `#1138` ·
`.scratch/team-page-ia/PRD.md` ·
`docs/adr/0034-the-team-page-is-five-tabs-not-one-scroll.md` ·
`src/screens/TeamPage.jsx` · `src/screens/team/*Tab.jsx` ·
`src/screens/team/TeamHubShell.jsx` · `src/screens/team/TeamTabBar.jsx` ·
`src/screens/team/data/*` · `src/components/chrome/HubTabBar.jsx` ·
`src/api/team.js` · `src/lib/teams.js` · `src/lib/winter/*` · `src/tokens/*`

**Filed by this pass:** **#1142** (MiLB Photos rail) · **#1143** (winter ball)
