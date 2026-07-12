# Plan — Umpire plate-accuracy scorecards

A design/plan for a later implementation session. Enhancement-proposals §3.
No app code is written here — this is the plan.

---

## Context

The umpire surface already exists end to end: `scripts/gen-umpires.mjs`
sweeps the season schedule into `public/data/umpires.json` (every ump →
games worked + base), `src/api/umpires.js` reads it, `UmpirePage.jsx`
renders it, and `TeamInfo.jsx`'s Umpires card links each name to
`/umpire/{id}`. What's missing is the one fact that makes the page
interesting: how well the plate umpire calls balls and strikes. The MLB
live feed already carries per-pitch tracking (`pitchData.coordinates.pX/pZ`
vs. per-batter `strikeZoneTop/Bottom`), so we can compute the same
"Umpire Scorecard" accuracy broadcast crews cite — with zero new
infrastructure, using the repo's established nightly-cron + static-JSON
pattern.

Everything below was verified against a real feed (gamePk **823035**,
MIL@STL 2026-07-07 g2, HP Adam Hamari):
- `details.code` histogram: `C:42, B:98, *B:8, F:47, X:42, T:4, D:8, S:19, E:8, W:2, H:1`.
- Called judgments only = `C` (strike) + `B`/`*B` (ball) = 42 + 106 = 148 pitches.
- `pitchData.strikeZoneTop/Bottom` changes between batters (3.368/1.7 → 3.005/1.517).
- `matchup.batSide.code` present on every pitch (needed for in/out).
- Hand computation with the buffer below: **137/148 correct = 92.6%** (realistic; MLB plate accuracy runs ~92–95%).

---

## 1. Methodology

**Which pitches count.** Only *called* judgments, taken from
`playEvents[]` where `isPitch === true`:
- Called strike: `details.code === 'C'`.
- Ball: `details.code === 'B'` or `'*B'` (`*B` = ball in dirt — still a
  ball the ump judged; near-always trivially out of zone, negligible effect).
- **Excluded** (not umpire ball/strike judgments): swinging strike `S`,
  foul `F`/foul-tip `T`, in-play `X`/`D`/`E`, hit-by-pitch `H`, and any
  pitch missing `pitchData.coordinates.pX/pZ` or `strikeZoneTop/Bottom`
  (parks without Hawk-Eye — see data-enrichment §1; such a game contributes
  no counted pitches and effectively degrades to absent).

**Zone geometry (buffer convention).** Adopt the *Umpire Scorecards*
convention: a pitch is a strike if any part of the ball could clip the
rule-book zone, i.e. plate edge + one baseball radius on every side.
- Horizontal: `|pX| <= HALF_PLATE + BALL_R` where `HALF_PLATE = 8.5/12 =
  0.7083 ft` (17″ plate) and `BALL_R = 1.45/12 ≈ 0.121 ft` → bound ≈ **0.829 ft**.
- Vertical: `strikeZoneBottom - BALL_R <= pZ <= strikeZoneTop + BALL_R`.
- A called strike is *correct* iff the pitch is in-zone by the above; a
  called ball is *correct* iff it is out-of-zone. (These constants live as
  named consts in the script; cite the convention in a header comment.)

**Per-batter zone.** Read `pitchData.strikeZoneTop/Bottom` **per pitch** —
never a league constant. Confirmed to vary by batter/stance in the sample.

**Tendency splits (compact — no per-pitch bloat).** Per game store 8 small
ints alongside the two totals:
- `called`, `correct` — the accuracy numerator/denominator.
- `expanded` — called strike that's a ball by geometry (generous/wide zone).
- `squeezed` — called ball that's a strike by geometry (tight zone).
- `high`, `low`, `inside`, `outside` — region of each *missed* call.
  Vertical: pZ above `top+BALL_R` → high, below `bottom-BALL_R` → low.
  Horizontal: orient pX by `matchup.batSide.code` (flip sign for LHB) so a
  missed call off the plate is `inside`/`outside` from the batter's view.
Season tendency phrase is derived from these: net `expanded − squeezed`
(generous vs tight) + the dominant miss region ("squeezes the low zone",
"generous outside"). Eight ints/game is trivial; it avoids storing raw
pitch coordinates while still supporting the one-liner.

---

## 2. Pipeline shape

**Sibling script, not an extension of `gen-umpires.mjs`.** New
`scripts/gen-umpire-accuracy.mjs` → new `public/data/umpire-accuracy.json`.
Rationale: `gen-umpires.mjs` does one cheap schedule call and a full
rebuild every night; accuracy needs a **feed fetch per game** and must be
**append-only/incremental** (a Final game's accuracy is immutable, so never
re-crunch the season). Different cadence and cost → mirror the existing
`umpires.json` (full-rebuild) vs `game-notes.json` (append-only) split
rather than bolting incremental feed-fetching onto the schedule scan.

**Schema — keyed by HP umpire personId** (same id space as `umpires.json`;
season aggregate precomputed so `TeamInfo`'s one-liner needs no client
tally):
```
{
  generatedAt, season,
  umpires: {
    "503077": {
      season: { games, called, correct, accuracy, expanded, squeezed, high, low, inside, outside },
      games: [ { gamePk, date, called, correct, expanded, squeezed, high, low, inside, outside }, … ]
    }
  }
}
```

**Incremental sweep (nightly).**
1. One schedule call for the previous N days:
   `/api/v1/schedule?sportId=1&startDate=…&endDate=…&gameType=R&hydrate=officials,team`.
   Default `N = 3` (buffers a missed cron run and late-finishing games).
2. Filter `abstractGameState === 'Final'` and `d.date === g.officialDate`
   (reuse the postponed-replay dedup guard from `gen-umpires.mjs`); take the
   `Home Plate` official's id.
3. Fetch each game's `/api/v1.1/game/{gamePk}/feed/live`, compute the
   per-game row (§1). Skip games with zero counted pitches (no tracking).
4. **Upsert** the row into `umpires[hpId].games` deduped by `gamePk`
   (same merge idea as `gen-game-notes.mjs`'s dedup-by-url), then recompute
   `season` from `games[]`.
5. Load the prior file first and merge, exactly like `gen-game-notes.mjs`.

**Idempotency.** Re-running a date overwrites the same `gamePk` rows with
identical numbers (Final games are immutable) → safe repeats.

**Backfill (one-time).** A CLI flag, e.g.
`node scripts/gen-umpire-accuracy.mjs --since=2026-03-01`, sweeps the season
to date. Cost: 1 schedule call + one feed fetch per Final game (~1,500
feeds by mid-July) at a small concurrency cap (~6, like
`gen-game-notes.mjs`) → a few minutes, run by hand once; commit the seeded
`umpire-accuracy.json`. Nightly runs thereafter touch only the last N days.

**File-size budget.** ~90 plate umps × ~28 games × ~9 ints + aggregate ≈
**150–250 KB** — same ballpark as `umpires.json`. Keep it in the PWA
precache (default). It's well under the ~3 MB `vs-team-splits.json` that's
the only file explicitly excluded in `vite.config.js`; **no vite change
needed**.

**Workflow wiring** (`.github/workflows/update-nightly-data.yml`): add a
step after "Umpires" (no data dependency, just adjacency):
```
- name: Umpire accuracy
  id: umpire-accuracy
  continue-on-error: true
  run: node scripts/gen-umpire-accuracy.mjs
```
Add `public/data/umpire-accuracy.json` to the `git add` list, and add
`steps.umpire-accuracy.outcome == 'failure'` to the final "Fail if any
generator errored" condition.

---

## 3. App surfaces

**`src/api/umpires.js`.** Add a second session-memoized reader
`loadUmpireAccuracy()` (fetch `/data/umpire-accuracy.json`, degrade to `{}`
on any failure — same shape as the existing `load()`), plus:
- Extend `loadUmpire(id)` to attach the umpire's `accuracy` (`{ season,
  byGamePk }`) so `UmpirePage` gets both the card data and per-row lookups.
- A small `umpireAccuracySummary(id)` returning just `{ accuracy, called,
  tendency }` for `TeamInfo` (or `null` when absent).

**`UmpirePage.jsx`.** A new "Plate accuracy" card reusing the existing
`umpage__card` / `umpage__cardtitle` / `umpage__venuelist` classes: season
accuracy %, called-pitch count, and a one-line tendency
("Tighter low zone" / "Generous edges"). Optionally add an accuracy % cell
to each **HP** row in the game list (join by `gamePk`). Renders only when
accuracy data exists (`return null` otherwise, like the other conditional
cards).

**`TeamInfo.jsx` Umpires card.** For the official whose `role === 'HP'`,
look up `umpireAccuracySummary(o.id)` and render a one-line fact under the
name ("2026: 94.1% accuracy · squeezes the low zone"). Load it via a
`useAsync`/`useMemo` alongside the existing `selectOfficials` memo; hide the
line when the summary is `null`.

**Degradation.** MiLB games (sportId ≠ 1) never have accuracy (file is
MLB-only) → line/card simply absent. Umpires with no swept plate games →
absent. Every consumer null-guards, per the MiLB-degrades-gracefully
convention.

---

## 4. Spoiler audit

Per-game accuracy rows and season aggregates are **spoiler-free**, on the
same footing already used to judge the umpire game log safe
(`umpires.js`: *"Game dates/assignments carry no score, so the file is
spoiler-free"*):
- An accuracy figure is a count of correct ball/strike **judgments**. It
  encodes nothing about runs, hits, baserunners, or who won — it's
  orthogonal to the play outcome. This is the key distinction from the
  reveal-only modules (`derive.js`/`linescore.js`), which read `hitData`
  and play results (a 110-EV single reveals a hit); a called-strike-vs-ball
  tally does not.
- Showing a past game's accuracy row on `UmpirePage` reveals no more than
  the page already shows (that ump worked that dated matchup) — no score.
- On `TeamInfo`, the figure shown pregame is a season aggregate that
  **excludes tonight's unplayed game** (the nightly sweep ingests only Final
  games; tonight isn't Final at staging time), so it cannot leak tonight's
  result.
- No `SealBox` and no `revealedThrough` gating anywhere. The file is a
  same-origin static asset like `umpires.json`, so the `NetworkOnly`
  statsapi SW rule doesn't apply.

---

## 5. Verification plan

1. **Generator locally.** `node scripts/gen-umpire-accuracy.mjs
   --since=2026-07-06 --until=2026-07-07` (and a default-N run). Confirm it
   writes `public/data/umpire-accuracy.json` and logs games/umps counts.
2. **Hand-check one game.** gamePk **823035** (HP Adam Hamari): the row must
   read `called: 148, correct: 137` (92.6%) — matches the hand computation
   done in this plan. Spot-check pitches: called strike pX 0.589 / pZ 3.065
   (zone 3.368/1.7) → `|0.589| < 0.829` and below top+buffer ⇒ correct
   strike; ball pX 1.587 → `> 0.829` ⇒ correct ball.
3. **`npm run dev`.** Navigate `/umpire/503077` → Plate accuracy card shows.
   Stage `/07072026/milstl-2/lineup1` → Umpires card shows the HP one-liner.
   Confirm a MiLB game (`/07062025/tolcol/lineup1`) and an ump with no data
   render nothing (degrade path).
4. **`npm run lint` / `npm run build`** green.

---

## Files to touch

- **NEW** `scripts/gen-umpire-accuracy.mjs` — sibling generator (§2).
- **NEW** `public/data/umpire-accuracy.json` — committed backfill seed.
- `.github/workflows/update-nightly-data.yml` — add step + `git add` entry +
  fail-condition.
- `src/api/umpires.js` — accuracy reader, `loadUmpire` merge, summary helper.
- `src/screens/UmpirePage.jsx` — Plate accuracy summary card (+ optional
  per-HP-row cell).
- `src/screens/TeamInfo.jsx` — HP one-liner in the Umpires card.
- `src/index.css` — small styling for the card/one-liner (reuse existing
  `umpage__*` classes + tokens; minimal additions).
- `CLAUDE.md` — add a `gen-umpire-accuracy.mjs` bullet + `umpires.js`
  accuracy note, mirroring the existing umpires entry (docs consistency).
- `docs/enhancement-proposals.md` §3 — mark implemented (optional).
- `vite.config.js` — **no change** (file stays precached; noted for the
  record).
