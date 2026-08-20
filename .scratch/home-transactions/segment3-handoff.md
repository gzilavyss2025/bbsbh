# Segment 3 — the home slate's 48-hour roster-move card

**Status: the card is built, mounted, and verified in a browser. Docs are not
updated yet.** Everything under "What is left" below is the remaining work.

**Branch** `claude/home-txn-card` · **Worktree** `C:\Users\gzilavy\bbsbh-txn-card`
· **Based on** `origin/main` at `8f7790cd` (segments 1 and 2 both merged: #806,
#809).

Read `gh issue view 772 --comments` and `docs/transactions-wire.md` §11 first.
Segment 2 settled what `groupLeagueWide` returns; this segment is the browser
half — what a live reader has to fetch, and what the card looks like.

---

## What the card is

A vertical **wire ledger** at the top of the slate, above the game list, on
today's MLB slate only. One row per move: a club-colour spine, up to two
headshots with their banners, the club's mark and abbreviation, and the same
cutline the team page prints. It sizes itself to the space it has, ends on a
whole row, and leaves the first game card showing.

**The direction was chosen by the maintainer** from three mocked options
(Wire / Shelf / Board) — <https://claude.ai/code/artifact/4ea9b02f-b0a4-4b8c-8648-ff9fffd53697>.
Do not re-open that choice.

---

## Files changed

| File | What |
| --- | --- |
| `src/api/transactions/leagueFeed.js` | **new** — the live reader: window arithmetic + the fetch chain |
| `src/api/transactions/league.js` | refactored to share one `keptRowsByOrg` walk; **new export** `leagueCandidateIds` |
| `src/components/transactions/LeagueMovesCard.jsx` | **new** — the card |
| `src/styles/04-site-bar.css` | **new** `.wirecard` / `.wire__*` rules (now 600/600 lines — at the cap) |
| `src/styles/01-base.css` | registered the two new caps exemptions in the ALL-CAPS INVARIANT list |
| `src/screens/GameSelect.jsx` | mounts the card after `ContinueScoring` |
| `src/api/spoiler-manifest.json` | `leagueFeed.js` classified `spoiler-free` |
| `scripts/check-file-size.mjs` | `GameSelect.jsx` budget 1000 → 1100 (see below) |
| `test/home-transactions.test.js` | **new** — 11 tests, all verbatim fixtures |

Probes, all committed, all re-runnable:
`probe-card-fetch.mjs` (the fetch chain), `probe-card-shape.mjs` (fetch width +
the two-pass proof + the card's shape), `probe-retro-il.mjs` (the retroactive-IL
question), `dump-48h.mjs` and `shot-wire-card.mjs` (working tools).
Their caches and screenshots are gitignored — re-run to regenerate.

---

## The measurements that drove every decision

All from a 30-day league-wide pull on 2026-08-20 (8,184 raw rows).

**Fetch four days, show two.** The endpoint filters on `date`; the grouper
buckets by `txnDate` (`effectiveDate || date`), and 108 rows disagree.
Backtested over 22 consecutive 48-hour windows against an unbounded-back
reference:

| Fetch width | Windows complete | Stories missed |
| --- | --- | --- |
| 2 days | 18 / 22 | 12 |
| 3 days | 21 / 22 | 1 |
| **4 days** | **22 / 22** | **0** |

**The chain is two round trips, ~160 ms** — transactions (640 rows, 52 ms), then
`/people` (114 ids, 2 batches, 106 ms). The second cannot start until the first
lands, which is why the id list is prefiltered.

**`leagueCandidateIds` cuts `/people` to a third.** Running the storyworthy
filter with NO debut set is a superset of the final rows (the debut set only
suppresses), so 3,086 ids become 1,095 and the stories come out
**byte-identical**. A test pins that superset property.

**The affiliate map is free.** `public/data/affiliates.json` (120 clubs, already
shipped) gives **exactly the same 694 stories** as the generator's live 291-club
fetch. Degrades to an empty map at a cost of 7 stories (−1%).

**The debut set is not optional** — 694 → 988 stories (+42%) without it.

**Volume.** A typical 48 hours is 30–46 stories across ~20 clubs. The worst 48
hours of the month held **125** (Aug 3–4). Rails run 1 face (×18), 2 (×15),
3 (×2); cutlines median 103 chars, max 155.

---

## Decisions made in this segment (all deliberate — say so before reversing)

1. **Today's MLB slate only.** "The last 48 hours" is a claim about now; on a
   browsed-to past day a card of this week's moves reads as a bug. The
   4-day-fetch completeness result also only holds for `end = today`.
2. **The window selects on `txnDate`, not the filed date.** A move filed inside
   the window but backdated outside it ("placed C Hunter Goodman on the 10-day
   injured list retroactive to August 15") does not appear. Measured at **4.6
   rows per 48 hours**, 78 of 101 saying "retroactive", nearly all IL
   placements — and every one is still on its own club's Transactions card.
   The alternative prints a three-day-old dateline inside a card headed "Last
   48 hours". `probe-retro-il.mjs` has the numbers.
3. **The card measures its own height** (`useFittedRows`) rather than taking a
   fixed row count — the maintainer asked for it to wrap the page cleanly.
   Clamped 3–8 rows, `PEEK_PX = 108` reserved so a game card always shows.
   Verified: 390×844 → 5 rows, 375×667 → 3, 1280×900 → 5, never a clipped row,
   no horizontal overflow.
4. **"Roster move" is not printed.** It is the pipeline's default type and
   labelled 16 of 35 rows beside a banner already reading Up/Down/In/IL-60.
   Only trade / injured-list / shuffle / signing / suspension carry a label.
5. **`GameSelect.jsx`'s budget went 1000 → 1100.** The file sat exactly on its
   ceiling, so *any* addition crossed it — even a bare import plus one line
   lands at 1002. One band is the documented move (`check-file-size.mjs`'s own
   header). Not a licence to keep growing it.
6. **CSS landed in `04-site-bar.css`**, beside `.continuebar`, because
   `src/styles/` is at its directory ratchet (96/96) and
   `29-team-transactions.css` is at its file budget (900/900). That partial is
   now at **600/600** — the next person to touch it needs a new home or a
   band bump.

---

## What is left

1. **Docs — the main outstanding item.**
   - `docs/transactions-wire.md` — add a §12 (or extend §11's "What a live feed
     has to fetch") with the fetch-width table, the two-pass `/people` result,
     the static-vs-live affiliate finding, and decision 2's retroactive-IL
     omission. §11 currently ends by saying a 48-hour card holds 30–45 stories
     and stops there.
   - `src/api/CLAUDE.md` — one line pointing at `leagueFeed.js` as the live
     reader beside the build-time-fetch pattern.
   - `src/components/CLAUDE.md` and/or `src/CLAUDE.md` — one line for the card,
     and for why it does not reuse `TeamTransactionsCard`.
   - Root `CLAUDE.md` is at 200/200 lines — **do not add to it.**
2. **An ADR is probably warranted** for decision 2 (which date a windowed feed
   selects on). Highest ADR taken is **0053**; `check-adr-numbers.mjs` guards
   collisions.
3. **No e2e spec yet.** `npm run e2e` was not run. A spec asserting the card
   renders on today's slate, ends on a whole row, and is absent on a past day
   would be worth having.
4. **Not verified on a real phone**, only at phone viewports in Chromium.
5. **`--wide` / desktop layout** is untested past 1280×900.

## State of the checks

`npm run lint`, `npm test` (11 new tests + the full suite), and `npm run build`
were all green as of the last full run. The final commit changed only the
type-label rendering after that run — **re-run all three before pushing
anything further.**

## Dev server

`npm run dev:4` (port 5170) — ports 5171/5172/5173 were held by other
worktrees. <http://localhost:5170/?nointro>
