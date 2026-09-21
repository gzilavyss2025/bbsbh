# Team page one-scroll — the wireframe

**Issue:** #1105, step 1 of three (#1106 designs it, #1107 builds it)
**Status:** SIGNED OFF 2026-09-21 — section list, order, and every open call.
Winter ball is in scope: **#1143 lands before #1107**, and #1106 draws the
winter artboard. Nothing outstanding.
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

**Two, not three — corrected after the sign-off.** An affiliate can lose Money
(always) and Farm (no parent org). This section originally counted Ranks as a
third, which was true only while this document was proposing to move the leaders
ledger out of it; the ledger stays, so Ranks renders on every club that has a
league at all. Shapes 4 and 5 are not "one more edge case to soften" —
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
- Comebacks (MLB only)
- Last Time — droughts (MLB only)

> **Decided 2026-09-21 (Gary): Logos & jerseys moves to About.** This document
> argued to keep it here, because it is a *record by X* card and its siblings
> are here. Overruled, and the reason is in About below: the card is a club's
> uniforms, and the record on it is the caption, not the subject. Standing
> loses 260px on every club (measured, all five).

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
- Team leaders ledger, six categories a side, with both its doors:
  "See all ›" → `/team/{id}/leaders`, "Org leaders ›" → `/team/{orgId}/leaders`

**Why it is called Ranks and not Numbers.** Every card here answers one question:
where is this club against its league. Today's "Numbers" tab is a bag holding
that *plus* the standings and five record cards. With those moved to where their
question is asked, "Numbers" would name a bag that no longer exists. `Ranks` is
short enough for a jump bar and honest about what is under it.

> **Decided 2026-09-21 (Gary): the leaders ledger STAYS here.** This document
> proposed moving it to Roster and argued the case at length; only the
> Transactions move was approved. The ledger closes this band. See the note
> under Roster for the argument that lost and why losing it was right.

**And it is what keeps this band from ever being empty.** Below Triple-A the
four cards above it are all absent — no league rank board, no Savant, no ABS —
so the ledger is the whole band on a High-A or Single-A club, and the band still
renders. That is the difference between this band and Money, which is the only
one a real affiliate actually loses. See 2E.

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
- Current roster (40-man)
- Injured list
- Transactions deck, **capped**, with "All transactions ›" → `/team/{id}/transactions`

> **The leaders move was proposed here and REJECTED (Gary, 2026-09-21).** The
> argument was that "who is the best hitter on this club" is a question about
> *people* rather than about the season measured — the ledger names players and
> the 40-man list would sit directly beneath it — and that a Single-A club's
> Ranks band would then be honestly empty and absent rather than one lonely
> card.
>
> **What that argument got wrong was the consequence, not the reasoning.** An
> empty Ranks band is not the cleaner page; it is a band deleted from the middle
> of the order, on the club least able to afford one. 2C's own rule says the
> bands a thin club loses belong at the END — Ranks is second. Keeping the
> ledger in Ranks costs this band its most people-shaped card and buys a page
> where **every real affiliate loses exactly one band, Money, at position 6,
> with About still to follow.** That is the rule working, rather than the rule
> with an exception written into it.

**Transactions moves off Games — the one move of the three that was approved.**
A transaction is a roster move. It answers "who arrived and who left", which is
the same question as "who plays here" one tense back. It costs something rather
than saving something: Roster is already the longer of the two tabs today
(3,843px against Games' 3,421px), so the move makes the longer one longer still.
It is worth it on the question, not on the balance.

**Roster is NOT the page's longest band, and an earlier draft of this section
said it was.** With the ledger staying in Ranks, the band is projection 1,245 +
bullpen health 467 + 40-man 1,282 + injured list 317 + the capped transactions
deck 184 = **~3,495px** on Milwaukee. **Standing** is 272 + Team Score 421 +
Records 3,238 + day-of-week 173 + Comebacks 407 = **~4,511px**, and it was
longer even before the leaders decision — this document's own "Records is 68% of
this band" figure puts Standing near 4,800px against the ~4,050px it claimed
here. Two measured numbers in the same document disagreed and neither was
checked against the other. Standing is the page's longest band; Roster is its
biggest *subject*, which is the claim actually worth making.

All card heights measured with `page-shape.mjs` at iPhone 13 width, 2026-09-21,
same run as everything else here.

### 5 · FARM — "Who is coming, and where does this club sit in the org?"

- Affiliates
- On the horizon
- Prospects (uncapped — `showAllProspects`, as the Minors tab already does)
- Depth chart

> **Decided 2026-09-21 (Gary): Affiliation history and Made The Show both move
> to About.** This document put them here and argued for it twice — the ladder
> seen from this club is the org, and the org is Farm. Overruled. Both are about
> the CLUB rather than about the system it sits in: which parent orgs this club
> has worn, and which of its own players reached the top. Neither moves with
> `?d=`. Farm loses 1,004px on a Single-A or High-A club and 1,088px on
> Nashville (measured), and keeps every module that answers "who is coming".

**What Farm keeps is now one question, not two.** With the history and the
alumni gone it is the org ladder in the present tense — the affiliates, the
players climbing it, and where they sit. The two cards that left were the same
ladder in the past tense, which is a different question and is answered in
About.

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
- Logos & jerseys — the marks this club wears (MLB: record by jersey; MiLB and
  winter: home and away)
- Affiliation history (MiLB only) — which MLB orgs this club has belonged to
- Made The Show (MiLB only) — the players who came through here and went up

> **Decided 2026-09-21 (Gary). All three move in.** 2E raised this as the one
> open question About left and recommended against two of the three moves. That
> recommendation is overruled, and the record of why is below rather than
> deleted, because the counter-arguments were real.

**The question decides it, not the card's shape.** Every band on this page is a
question a visitor asks. About asks *what is this club* — its name on a
building, its marks, its place in a system, and who it sent up. A club's
uniforms are the most literal answer to that question in the whole app, and the
W-L beside each tile is a caption on the jersey, not a split of the season. The
same is true the other way for the two farm cards: the orgs a club has belonged
to and the players it graduated are that club's biography, and both are told in
seasons that ended.

**The test the two counter-arguments fail.** *Logos & jerseys is a record-by-X
card and belongs with its siblings* — but its siblings all move with `?d=` and
it does not: change the date and the jersey tiles are the same tiles. *The
history and the alumni are the org ladder, which is Farm* — but Farm answers
"who is coming", in the present and forward. Both cards answer backward. A band
that holds the season and its own past is two questions, which is the failure
ADR-0034 recorded.

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
league. Farm needs a parent org. Standing needs a division. A ballpark is
a building, and every club in the app plays in one. So every page — Milwaukee's
20,050px and a Single-A club's 13,570px alike — ends on the same band, in the
same place, with the same head. That is worth more to the short page than to the
long one, and it is the single best answer this wireframe has to #1106's
question about whether a short page reads as broken.

**And it is no longer thin, which was the one thing worth revisiting.** The
Ballpark alone is 1,014px on Milwaukee and 93px on an affiliate, because nobody
has hand-verified a MiLB park's outfield dimensions — one small card under a
full-width head. With the three modules above it, every club's About band is
measured as:

| Club | Ballpark | Logos & jerseys | Affiliation history | Made The Show | **About** | was |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| **158** Milwaukee, MLB | 1,014 | 260 | — | — | **1,274** | 1,014 |
| **556** Nashville, AAA | 93 | 260 | 182 | 906 | **1,441** | 93 |
| **572** Wisconsin, A+ | 93 | 260 | 98 | 906 | **1,357** | 93 |
| **249** Wilson, A | 93 | 260 | 98 | 906 | **1,357** | 93 |
| **675** Los Mochis, winter | 91 | 258 | — | — | **349** | 91 |

Card heights only, no band head and no gaps, measured with `page-shape.mjs` at
iPhone 13 width on 2026-09-21 — the same instrument and the same run as every
other number in this document. An affiliate's About band is now the LONGEST it
is on any club but Milwaukee, and on Milwaukee itself it is still the page's
second-largest single card.

**The floor is the exception, and it was measured rather than assumed.** At 675
the two farm cards do not exist: Farm is absent (no parent org), so there is no
affiliation history to show, and no `milb-alumni/675.json` is generated, so
Made The Show self-hides. About gains exactly one module there, and goes 91px to
349px. That is 3.8× and it is still a third of a phone screen. **The move does
not rescue the winter page**; what it does for the winter page is give its About
band a second card, so the close is a band rather than a single tile. The honest
summary is that this decision pays on the three affiliates, pays a little on
Milwaukee, and pays least where the page is thinnest.

**It is no longer free, and 2F is corrected for it.** The Ballpark is still one
static file the header already fetched. The three that moved in bring their own:
`/data/milb-history.json` plus one logo-tint read per parent-org era, and
`/data/milb-alumni/{id}.json` — about three to five requests on an affiliate,
none at 675 — and, on an MLB club, the two `/api/v1/uniforms/game` batches that
build the jersey deck (100 gamePks a batch, so 162 decided games is two calls).
Every one of those is a request the page already made on the Numbers or Minors
tab, so the fully-scrolled union does not move. What moves is that the seventh
anchor now has a loader of its own.

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

Since team leaders stayed in Ranks (2B, decided by Gary on the sign-off rather
than by this document — it had proposed the opposite), **Ranks is never empty
either** — a
Single-A club keeps it with the leaders ledger alone. So the only band any real
affiliate loses is Money, at 6, with About still to come after it.

**Inside each band**, one rule: **the thing that answers the band's question in
one line goes first; everything that qualifies the answer follows; the door out
goes last.** Standings before the splits. The schedule before the games on it.
The projection before the 40-man. The affiliate ladder before the prospects on
it. The ballpark before the marks worn in it.

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
| Standing | standings + odds · Team Score · Records · day-of-week · Comebacks · Last Time\* |
| Ranks | batting · pitching · run value · ABS challenges · leaders 6+6 (→ 2 doors) |
| Games | Schedule (+ Stamp In) · games grid · Highlights · Photos (capped → door) |
| Roster | projection · bullpen health · 40-man · IL · transactions (capped → door) |
| Farm | Affiliates · Horizon · Prospects · Depth chart |
| Money | tiles · cliff · grid · key · source |
| About | Ballpark · **Logos & jerseys** (record by jersey) |

\* **Last Time does not render on the Brewers today**, and that is correct
behaviour, not a bug: `LastTimeCard` returns null when `droughtsFor()` finds no
qualifying drought, and a 98-58 club has none. The data file exists and is
fetched. Recorded because a reader of this table would otherwise chase it.

**Seven bands. Seven anchors.**

### 556 · Nashville Sounds — Triple-A, keeps nearly everything

| Band | Modules | Against MLB |
| --- | --- | --- |
| Standing | standings · Records · day-of-week | **loses** Team Score, Comebacks, Last Time (all MLB-only files) |
| Ranks | **ABS challenges · team leaders** | loses batting, pitching, run value |
| Games | Schedule (+ Stamp In) · games grid | loses Highlights (`isMlbTeamId`), and see #1142 |
| Roster | projection · 40-man · IL | loses bullpen health, transactions |
| Farm | Affiliates · Horizon · Prospects · Depth chart | same four as Milwaukee |
| ~~Money~~ | — | **absent** |
| About | Ballpark · **Logos & jerseys** (home and away) · **Affiliation history** · **Made The Show** | **gains** three · 1,441px against Milwaukee's 1,274 |

**Six bands. Six anchors.** Nashville is the club the level identity works
hardest for: it is the only affiliate whose Ranks band holds **two** cards, and
the second one is ABS. It is the only place in the app that says this club argues
with the plate umpire more than its league does.

> **Corrected by #1106, 2026-09-21.** This paragraph said Nashville "is the only
> affiliate that keeps a Ranks band". That stopped being true when the leaders
> ledger stayed in Ranks (2B, #1148): 572 and 249 keep the band too, with the
> ledger as its only card. Measured on the running page — `/team/556/numbers`
> renders `.chalcard` 1,014px + `.tledg` 534px = **1,548px**;
> `/team/249/numbers` renders `.tledg` alone at **534px**.

### 572 · Wisconsin Timber Rattlers — High-A

| Band | Modules |
| --- | --- |
| Standing | standings · Records · day-of-week |
| Ranks | **team leaders only** — batting, pitching, run value and ABS all absent |
| Games | Schedule (+ Stamp In) · games grid |
| Roster | projection · 40-man · IL |
| Farm | Affiliates · Horizon · Prospects · Depth chart |
| About | Ballpark · Logos & jerseys · Affiliation history · Made The Show — 1,357px |

**Six bands. Six anchors.** Only Money is absent.

### 249 · Wilson Warbirds — Single-A, "the thinnest real page"

Identical band set and identical module list to 572. **Six bands, six anchors.**

**And it is not thin.** `/team/249` is 3,158px today against Milwaukee's 4,340px —
73% of it — and its Minors tab (3,869px) is *longer* than Milwaukee's (3,717px),
because all three affiliates share one org's farm system. The measured thinnest
real page in the hub is not a Single-A club at all. It is the winter-ball club.

> **Updated by #1106, 2026-09-21.** This sentence ended "at **664px** (1C,
> #1143)". #1143 has landed, so that figure is dead. `/team/675?d=2026-01-15`
> measures **2,355px** as one tab today, and **7,110px** as five bands — 36% of
> Milwaukee's 20,006px, against 249's 68%. It is still the floor, and it is a
> real page rather than a bug.

So #1106's worry — *does a short page read as a club with a quieter season, or as
a broken page?* — has a measured answer for these three clubs: **they are not
short.** They are 73–90% of an MLB club by height, and every band they keep is
full. The band they lose from the middle is Ranks, and that is one artboard, not
a rhythm problem across the whole page.

### 675 · Caneros de los Mochis — winter ball, the fifth shape

> **In scope, decided 2026-09-21 (Gary). #1143 lands before #1107, and #1106
> draws this artboard.**

Today it is 664px: one Ballpark card, a dash where the level badge goes, and an
Affiliate chip pointing at `/team/11`. That is not a page shape to design around
— it is the bug in 1C, and the fix is a season resolution, a label and a guard,
all in #1143.

**What the page becomes once #1143 lands is better than this document first
assumed, and it was measured rather than guessed** (live, against Los Mochis,
season 2025 — the winter that a January 2026 date actually falls in):

| Check | Result |
| --- | --- |
| `/standings?leagueId=132&season=2025` | **10 clubs, one record group.** `division` is `null` on both sides, and `divisionRecordFor` already normalises that, so the table matches and renders. |
| `/stats?group=hitting&teamId=675&season=2025` | **23 splits** |
| `/stats?group=pitching&teamId=675&season=2025` | **32 splits** |
| `rosterType=fullSeason&season=2025` | **55 players** |

So the winter shape is **five bands**, not the three this document first guessed:

| Band | Holds |
| --- | --- |
| Standing | division standings (10 clubs, no division name) · day-of-week |
| Ranks | **team leaders 6+6** — the pool is real |
| Games | Schedule (+ Stamp In) · the season's games |
| Roster | projection 1,530px · 40-man 2,387px — **no injured list** |
| About | Ballpark, 91px · **Logos & jerseys** (home and away), 258px |

> **Third correction, #1106, 2026-09-21: the Injured List does not render here.**
> This table listed it. `/team/675/roster?d=2026-01-15` measures three blocks on
> two separate runs — projection 1,530px, 40-man 2,387px, the as-of banner — and
> no `InjuredListCard`. Worth recording for a second reason: at 2,387px the
> winter 40-man is a single uncapped list of 55 players, nearly twice
> Milwaukee's 1,282px, which makes **Roster the winter club's longest band at
> 3,917px — longer than Milwaukee's 3,517px.** The floor page is lopsided, not
> uniformly thin. See `design.md` §6.

**Two further corrections to this table, both found by re-measuring it on
2026-09-21 against a fixed `/team/675?d=2026-01-15`, and both errors in this
document rather than in the code.**

**1. The uniform strip renders here, and this table was the only one that said
otherwise.** `isMilb` is `sport.id !== 1` (`NumbersTab.jsx`), which is true for
sportId 17, and the strip has no data gate of its own — it draws home and away
tiles from records that degrade to 0-0. The 249, 556 and 572 tables all listed
it and this one did not. Measured on `/team/675/numbers?d=2026-01-15`: *Logos &
jerseys · home and away*, 258px. It is now in About with the rest, which is
what makes About the one band the winter club gains anything from.

**2. Record by day of week renders too, and the footnote that said it could not
was reading the wrong source.** `team-records` and `schedule-shape` ARE
precomputed per MLB club only, so **Records** and **Last Time** do resolve empty
below MLB and self-hide — that half was right. But day-of-week is derived from
the club's own schedule (`dayOfWeekRecord(schedule)`, `loadNumbers.js`), not
from either file, so any club with a decided game gets it. Measured at 675:
171px.

**Farm and Made The Show are both genuinely absent here**, and that is the
answer to whether the About move helps the floor. There is no parent org, so
there is no affiliation history; no `milb-alumni/675.json` is generated, so Made
The Show self-hides. About gains one card, not three: 91px to 349px.

**Five bands. Five anchors.** Farm is absent (`parentOrgId: 11` is the Office of
the Commissioner, not a parent org) and Money is absent (no Cot's coverage).

**That is the floor this design has to hold**, and it is the page #1106 should
draw *second*, after the Single-A one. It is a genuinely thin page — but it is a
thin page with five named bands and a close, not a card adrift under a tab bar.

Worth noting what About buys here: today this page renders exactly one card, the
Ballpark, adrift under a tab bar with nothing above it. Under this wireframe that
same card is a named band with a head, in the place every other club's page also
ends. It does not make the page full. It does make it look finished rather than
broken.

### The question About raised — answered 2026-09-21 (Gary)

**All three move into About.** On an affiliate the Ballpark alone is **93px** —
no MiLB park has hand-verified outfield dimensions, so the band was one small
card under a full-width head. Three other modules are club-identity rather than
season material: **Logos & jerseys / the uniform strip**, **Affiliation
history**, and **Made The Show**. This document recommended against moving two
of them. That recommendation is overruled; 2B carries the argument, and the two
costs it named were real and are recorded there rather than dropped.

**About is the identity band**, not a band that happens to end the page. Once it
is named that way the three moves are not additions to it — they are the rest of
it, and the Ballpark was only ever the first one to arrive.

**What it costs the bands they left.** Standing loses one card on every club
(260px). Farm loses two on an affiliate — 1,004px at 572 and 249, 1,088px at
556 — and loses nothing at 675, where Farm is absent already.

**What it buys, measured rather than assumed.** An affiliate's About band goes
93px to about 1,400px, which makes it that page's longest band after Roster.
Milwaukee's goes 1,014px to 1,274px. **And at the floor it buys one card**:
675 goes 91px to 349px, because the two farm cards do not exist there at all.
The full table is in 2B. The answer to "does ABOUT rescue the thin page" is no
— it makes the page's close a band with two cards on it instead of one, which
is worth having and is not the same claim.

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

- **The bands do not map one-to-one onto the tabs.** The Numbers tab alone
  splits into **two** bands, Standing and Ranks, and they are absent under
  different conditions: a club with no league id loses Ranks and keeps
  Standing. One boolean per tab cannot say that, and `numbers` is the tab it
  cannot say it about.
- It has a hole, proved in 1C: the `league?.id` guard sits **behind** an `isMilb`
  early return, so it never fires for `/team/11`. #1143 has since landed and did
  NOT close this — it is deliberately left for the function that replaces this
  one, so the guard is written in the right order once rather than twice.

> **An earlier draft argued this differently and the argument has been
> withdrawn.** It said the finest and most common absence was "Ranks is absent
> below Triple-A". That was only true while this document was proposing to move
> the leaders ledger out of Ranks. With the ledger staying (2B, Gary's call),
> **Ranks renders on every club that has a league at all**, and the band-grain
> absences reduce to the two the tab function already computes plus the split
> above. The case for a new function rests on the mapping and the hole, not on
> a count of absences.

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
| Ranks | new `loadRanks.js` — league team stats, run value, ABS exposure, the leader pool | on scroll |
| Games | `loadGames.js`, minus transactions | on scroll |
| Roster | `loadRoster.js`, plus transactions | on scroll |
| Farm | `loadMinors.js`, unchanged | on scroll |
| Money | `loadContracts.js`, unchanged | on scroll |
| About | new `loadAbout.js` — the jersey deck (MLB), the affiliation history and the alumni file (MiLB) | on scroll |

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
| **675** winter ball | — set by #1143; ≤ 18 is the working target — | | **5** |

**About no longer costs nothing, and this line is the correction.** When About
held the Ballpark alone it was free: `fetchTeam` already returns `venue` and the
header already reads it. With the three modules 2B moved in (decided
2026-09-21), the band has a loader — `/data/milb-history.json` plus one
logo-tint read per parent-org era and `/data/milb-alumni/{id}.json` on an
affiliate, about three to five requests; two `/api/v1/uniforms/game` batches on
an MLB club, which is 100 gamePks a call against 162 decided games; and nothing
at all at 675, where the uniform strip reads records the page already holds.

**The ceilings above do not move.** Every one of those requests is already in
this page's fully-scrolled union — they were the Numbers tab's and the Minors
tab's, and the union counts a distinct URL once wherever it is asked for. What
changed is the COLD number's margin: About is at the foot of the page, so none
of it is paid before a scroll, and the seventh anchor still costs nothing on
first paint.

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

No component draws these. Seven heads, and what each must carry:

| Band | Head text | Must carry |
| --- | --- | --- |
| Standing | **Standing** | a sub-head for the band's *second* section ("Record, split every way") — the #928 two-section case |
| Ranks | **Ranks** | a level qualifier on an affiliate — below Triple-A the leaders ledger is the whole band, and the head has to say that the rank boards do not exist at this level rather than let the band read as truncated |
| Games | **Games** | nothing beyond the title |
| Roster | **Roster** | nothing beyond the title |
| Farm | **Farm** | the org's name on an affiliate, since the ladder shown is the parent's |
| Money | **Money** | a "not dated" note, because this band alone does not move with `?d=` |
| About | **About** | nothing beyond the title — and it must read as a close, not as another section. It is four cards on an affiliate and two at 675, so the head has to hold a real band rather than caption one tile |

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
| Leaders "See all ›" | Ranks | `/team/{id}/leaders` |
| "Org leaders ›" | Ranks | `/team/{orgId}/leaders` |
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
