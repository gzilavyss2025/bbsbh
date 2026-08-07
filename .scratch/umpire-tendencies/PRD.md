# Umpire Tendencies card — PRD

Status: `ready-for-agent` (Phase 1) / `needs-triage` (Phase 2)

A broadcast-style "UMPIRE TENDENCIES" card for a home-plate umpire, modelled
structurally on the in-game TV graphic (reference image in the originating
session), rendered in the paper-scorebook system rather than the broadcast's
blue-and-yellow.

The reference graphic has six bands:

| # | Band | Reference content |
| --- | --- | --- |
| 1 | Eyebrow | `UMPIRE TENDENCIES` |
| 2 | Identity | League mark, `ERICH BACCHUS`, `5 YEARS OF SERVICE TIME` |
| 3 | Scale | 5-step vertical gradient, pointer parked on `PITCHER FRIENDLY` |
| 4 | Area to watch | `INSIDE TO LEFT-HANDED HITTERS` |
| 5 | Tiles | `CHALLENGES/GAME 3.1` · `OVERTURN% 44.8*` + league-average footnote |
| 6 | Sponsor | UI Health / UIC |

**Every band except 2 and 6 is buildable from data already committed to this
repo.** The audit is §2; the phasing that falls out of it is §5.

---

## 1. Where it goes

**One component, two hosts, no new route and no new navigation.**

`src/components/umpire/UmpireTendencies.jsx`, rendered:

1. **`/umpire/{id}`** (`UmpirePage.jsx`) — the first card in `umpage__cards`,
   above `PlateAccuracyCard`. It becomes the headline summary; the accuracy card
   stays underneath as the detail.
2. **`UmpireAccuracyModal`** — which the lineup page's `UmpireTierGlyph` already
   opens for tonight's plate umpire (`TeamInfo.jsx`'s `Umpires` card). That modal
   already calls `loadUmpire(id)`, so it gains the card for free.

**Deliberately NOT inlined into the lineup page itself.** `Umpires` is a compact
4-up crew grid; a card this tall would dominate a page whose whole job is staging
a lineup. The glyph → modal path is an already-shipped entry point that puts the
card one tap from where the user is. Revisit only if the modal proves an
insufficient destination in real use.

### Spoiler footing

Nothing here needs a `SealBox`, on exactly the footing the existing accuracy rank
already sits on (`src/api/CLAUDE.md`'s `umpires.js` entry): every figure is a
season aggregate over **Final** games only, counting ball/strike *judgments* and
their run-expectancy value — never a run, hit, or result from tonight's unplayed
game. Same argument as League Leaders and WAR.

One thing to hold onto: `public/data/umpires.json` game rows carry
`awayScore`/`homeScore` (they back `UmpirePage`'s HP team-records tally). The new
card must not render them and must not reach for them — it reads
`umpire-accuracy.json`-derived fields only, which carry no score at all.

---

## 2. Data audit — band by band

Measured against the files committed at `origin/main` on 2026-08-06:
`umpire-accuracy.json` holds 132 umpires and 3,295 game rows; 90 plate umpires
qualify at `MIN_RANK_GAMES`.

### Band 2 — "5 YEARS OF SERVICE TIME" — ✗ NOT AVAILABLE

statsapi carries no umpire service time, debut, tenure, or crew assignment.
Verified directly:

- `GET /api/v1/people/427139` (Doug Eddings) returns bio only — `birthDate`,
  `currentAge`, `height`, `weight`, `birthCity`, `active: false`,
  `primaryPosition: { code: 'X', name: 'Unknown' }`. **No `mlbDebutDate`.** Full
  field list is in issue `01`.
- `GET /api/v1/umpires` → 404. There is no umpire endpoint.
- `hydrate=xrefId,rosterEntries,education,transactions` adds nothing.

`umpires.json` can't answer it either — it is rebuilt nightly from *this
season's* schedule scan and has no history before opening day.

**Do not invent it, and do not scrape mlb.com for it.** Substitute facts we own
that serve the same "who is this guy" purpose:

> `142 GAMES · 38 BEHIND THE PLATE`

Both are already computed on `UmpirePage` (`games.length`, `hpCount`). The band
keeps its role — orienting you before the numbers — without a fabricated tenure.

### Band 3 — the pitcher/hitter friendliness scale — ✓ AVAILABLE TODAY

The useful finding: **two independent metrics for this axis are already in the
committed data, and they agree with each other.**

**Candidate A — zone lean.** `season.expanded` (called strike, out of zone —
generous to the pitcher) against `season.squeezed` (called ball, in zone —
generous to the hitter). Both already in the season aggregate.
`lean = (expanded − squeezed) / called`.

**Candidate B — net run favor.** Each game row carries `favorAway`/`favorHome`:
the signed run-expectancy swing missed calls handed the **batting** team. Summed
over an umpire's regular-season rows, that is his net runs handed to hitters. The
season aggregate keeps only `favorMagnitude` (absolute value), but the signed
per-game figures are on disk — so this is derivable **at read time, with no
generator change and no backfill.**

Across the 90 qualifying plate umpires:

| Metric | Mean | SD | Min | Max |
| --- | --- | --- | --- | --- |
| A — lean per 100 called | −0.586 | 0.799 | −2.86 | +1.60 |
| B — net runs to hitters per game | +0.179 | 0.175 | −0.44 | +0.55 |

**Correlation: −0.856.** (Opposite signs by construction — a positive lean is a
generous zone, which is a *negative* favor to hitters.) The two are measuring the
same underlying thing, which is good evidence the axis is real and has enough
spread to be worth drawing.

**Use B, net runs to hitters per game.** It is leverage-weighted — a missed 3-2
call with the bases loaded moves it more than a missed 0-0 with nobody on, where
A counts every miss identically — and it is already in run units this app speaks
elsewhere (`favorPerGame` on `PlateAccuracyCard`, `umpireFavor.js`'s live
per-game card). Keep A as the fallback for a row that predates
`run-expectancy.json` and therefore has null favor.

**Bucket by z-score against the qualifying pool, never by fixed cutoffs.** Note
the league mean is **+0.179, not zero** — umpires collectively favour hitters —
so absolute thresholds would mislabel a perfectly average umpire as
hitter-friendly. This is the same reasoning `src/lib/statTiers.js` already
records for accuracy tiers, and it should reuse that module's `meanAndSd`. Five
symmetric buckets:

| z | Label |
| --- | --- |
| ≤ −1.0 | Very pitcher friendly |
| −1.0 … −0.35 | Pitcher friendly |
| −0.35 … +0.35 | Neutral |
| +0.35 … +1.0 | Hitter friendly |
| ≥ +1.0 | Very hitter friendly |

Measured bucket occupancy across the 90 qualifiers: **14 / 21 / 22 / 19 / 14**.
Every band is populated — the extremes are real umpires, not decoration.

`tierForZ`'s existing four buckets can't be reused as-is (no neutral band, and
it is one-directional — higher is better), so this needs a sibling
`leanTierForZ` **added to `statTiers.js`, not to `umpires.js`**, so the one
module that owns z-bucketing keeps owning it.

Extremes it produces, as a sanity check:

- Most pitcher-friendly: John Bacon (−0.439 runs/game to hitters), Ron Kulpa
  (−0.208), Adrian Johnson (−0.161).
- Most hitter-friendly: Brock Ballou (+0.546), James Hoye (+0.542),
  Willie Traynor (+0.467).

**Expect disagreement with the broadcast, and do not tune to match it.** Erich
Bacchus — the umpire in the reference graphic, where he is marked *pitcher
friendly* — comes out at **+0.456 runs/game to hitters, z ≈ +1.6, "very hitter
friendly"** in our data. Different metric, different sample window, and the
broadcast's methodology is unpublished. Ours is defined, reproducible, and
measured against a stated pool; that is the standard to hold it to. If the two
ever need reconciling, the answer is to document the difference, not to reverse
-engineer someone else's number.

### Band 4 — "AREA TO WATCH" — ◐ PARTIAL

**The region half is available today.** `season.high/low/inside/outside` are
per-region missed-call tallies, already batter-oriented (`missRegion` flips the
horizontal for a left-handed batter), and `accuracyTendency()` in `umpires.js`
already turns them into a phrase — *"squeezes the up zone"*, *"generous
outside"*. The 3×3 `cellMiss` grid measured against the league baseline
(`umpireZoneCells`'s `over`) is the sharper version, and already backs the zone
map both existing surfaces draw.

**The handedness half is not.** Nothing splits misses by batter side, so
*"…to LEFT-HANDED HITTERS"* cannot be said. `missRegion` already takes `batSide`,
so the generator change is genuinely small — but the season is on disk and needs
a re-sweep (§5, Phase 2).

**The two available signals currently disagree, and the flat tallies are the
wrong one.** Putting the phrase beside the zone map in the mock exposed this.
For Erich Bacchus:

- `accuracyTendency()` picks the top of the four flat edge tallies — **low 70
  vs high 61**, a nine-call margin out of 213 missed calls. That is a coin flip
  printed as a finding.
- The league-relative 3×3 grid — the thing the map actually draws — flags
  **high-outside (+3.5 pts of his miss share over the league baseline)**,
  low-middle (+2.7), **high-inside (+2.2)**. Two of its top three are *high*.

So a card built on `accuracyTendency()` would say "low" beside a picture whose
heaviest flags are up in the zone. **Derive the phrase from the same grid the
map draws** (issue 01), or gate it on a real margin over the runner-up. Do not
ship the two side by side unreconciled.

Phase 1 copy drops the handedness clause and says only where:

> `AREA TO WATCH — HIGH AND OUTSIDE`

### Band 5 — CHALLENGES/GAME and OVERTURN% — ✗ NOT ON DISK, ✓ CHEAPLY DERIVABLE

No per-umpire challenge aggregate exists anywhere. `src/api/challenges.js` reads
ABS challenges **live, per game, reveal-only** for the box score's `StatBox`;
there is no season roll-up.

But `gen-umpire-accuracy.mjs` **already fetches every plate umpire's full game
feed**, and that is where challenge data lives. Tallying it is a few lines inside
the existing per-play walk, reusing `challenges.js`'s already-verified rule
(`reviewType === 'MJ'` **and** `challengeTeamId != null`, checked at both the
play-level and pitch-event locations — the older `MA` manager's-replay reviews
must be excluded or the counts inflate).

Validated live against real 2026 games:

- gamePk 824484 — 2 ABS challenges, 1 overturned.
- 20-game sample (Aug 3–4, 2026) — **4.50 challenges/game, 57.8% overturned.**

The reference graphic's own footnote reads *"MLB AVERAGE: 54% OF CHALLENGES
OVERTURNED"*. Landing at 57.8% is good evidence both that the extraction rule is
right and that the metric is meaningful per-umpire.

Needs a schema bump plus a backfill (§5, Phase 2).

### Band 6 — sponsor — ✗ N/A

No sponsor. Replace with the provenance line the app already uses elsewhere:
season, games behind the plate, and a `generatedAt`-derived freshness note.

---

## 3. Visual translation

Copy the structure; do not copy the palette.

**The ALL-CAPS broadcast look is free.** The `#root *` uppercase invariant
(`src/styles/01-base.css`) already renders every string on every page uppercase,
and structural labels are already condensed uppercase per the design system. The
reference graphic's shouted chrome *is* this app's default state.

| Reference | Here |
| --- | --- |
| Blue chrome, white text | `--navy` masthead, `--text-on-ink` — the existing `SectionMasthead` treatment |
| Card body | `--surface-card` on `--bg-page`, `--border-rule` hairlines |
| Blue → yellow gradient | **`--navy` → `--seal`/`--marker`** — see "The scale" below |
| Vertical 5-band scale | **Kept vertical**, as the reference has it |
| White pointer chip | An indicator on the occupied band, plus continuous position |
| `AREA TO WATCH` panel | **`--marker` highlighter wash + left rule** — NOT the kraft-seal hatch |
| Two stat tiles | The existing `umpage__acctile` tile, reused — **2×2, never 4-up** |
| Sponsor bar | Terse provenance line in `--text-caption` |

### The register: labels and numbers, not sentences

**Maintainer direction, 2026-08-06, and it overrules the first design pass:**

> "Almost no sentences or substantial superfluous text. I don't need descriptor
> text. As close to the original source as possible."

Look at the reference graphic: it is labels and numbers plus one asterisked
footnote. That is the target. No caveat paragraph, no map caption, no
explanatory prose on the card. Where a fact must survive — that the scale is
measured against a league average rather than against zero — it takes the form
of a terse label (a `LEAGUE AVG` tick) or an asterisked footnote in the source's
own idiom. Never a sentence.

Consequence worth stating: with the prose gone, essentially every string on the
card is uppercase, which is the app's default anyway. The `caps-exempt`
registration noted below shrinks to at most one footnote.

### The scale

**Vertical, as in the reference.** The first design pass converted it to a
horizontal axis and was overruled; its argument (that a vertical gradient beside
five labels reads as "a list with a highlighted row", and that the card should
show *where* on a continuum the umpire falls rather than only which bucket) is
recorded in `design-notes.md` and is worth reading before re-litigating the
geometry. The instruction stands: keep it vertical, and solve the
continuous-position problem within that arrangement.

**No red and no green on this scale.** Neither pole is good or bad, and
red/green is the app's documented good/bad signal (`--accent-positive`/
`--accent-negative`, ADR-0017). This rules out `--clay` for the hitter pole,
which the first pass used.

**The ramp is `--navy` → neutral → `--seal`/`--marker`.** The reference's own
gradient runs blue at the top to yellow at the bottom, and navy → kraft amber
maps onto that almost exactly while staying inside the palette and carrying no
valence: cool ink at one pole, warm kraft/highlighter at the other, graphite or
bare paper between.

**If the bucket geometry encodes z, specify the domain**, or two implementations
will silently diverge. Equal fifths and z-proportional bands are different
pictures; pick one and write it down. The shipped mock uses **equal-height rows**
with the caret's offset *inside* its row carrying the sub-bucket reading — see
`design-notes.md` for the piecewise mapping.

**No numeric column.** Maintainer direction, 2026-08-07: the `NET R/G` column —
the per-row figures and the `LG AVG +0.18` marker in the NEUTRAL row — is
removed. The band label and the caret are the whole reading.

The cost is worth stating once, because it is invisible on the card: **nothing
on the card now says the scale is league-relative.** The buckets are still
z-scored against the qualifying pool, whose mean is **+0.18 runs/game to hitters,
not zero**, so NEUTRAL means "an average umpire", not "favours nobody". Keep that
in the `aria-label`. If it ever needs to be visible again, the reference
graphic's own idiom is an asterisked footnote, not a column.

**No accuracy tier pill in the identity band.** Same direction: the `ACCURACY` /
`AVERAGE` unit is removed from the header. Accuracy still appears once, as a
tile. Note this is the app's existing `UmpireTierPill`/`UmpireTierGlyph`
vocabulary being deliberately *not* repeated here — the glyph still does that job
on the lineup page's Umpires card, which is where a tier belongs.

### Area to watch: `--marker`, not `--seal`

The kraft diagonal hatch means exactly one thing in this product — *a
score-revealing number is under here, sealed until you tap*. It is the visual
half of the spoiler invariant. Spending it on a panel that is neither sealed nor
tappable dilutes the one signal this app most needs to keep sharp, and a user
trained by twenty innings of SealBoxes will read a hatched panel as tappable and
be wrong. `colors.css` already documents `--marker` as *"highlighter yellow —
'watch' flag"*, and `.umprank__row--today` already uses it for "the row that
matters now". It is also the truer metaphor: a hand-scorer flags a tendency with
a highlighter, not by taping over it. `--seal` still appears once, as the
masthead's 3px underline, because that is `.metricbar`'s app-wide treatment.

### The zone map earns its place on the card

Reuse `UmpireZoneMap` verbatim inside the Area-to-watch band (~78×88px). It is
the only picture of the actual zone on the card and the sharpest form of "area
to watch". One addition: **a `--surface-inset` plate rect behind the grid**, or
the highlighter wash tints every low-opacity navy cell olive.

**If this card ships into `UmpireAccuracyModal`, drop that modal's existing
zone-map section** — it would otherwise render the same map twice.

### Caps exemptions

With the prose stripped, at most one asterisked footnote is natural-case. If any
survives, register its `caps-exempt` marker in `check-caps.mjs` in the same
commit as the CSS rather than discovering it through a failing lint.

**Do not use `--accent-positive`/`--accent-negative` (green/clay) for the
scale.** That pairing is the app's documented good/bad signal (ADR-0017), and
pitcher-friendly is not "bad" — it is a lean. Navy↔clay is a diverging axis that
carries no value judgement and is built from inks already in the palette.

**No text sits on the gradient.** The five labels sit beside the bar, exactly as
they do in the reference. That keeps `check-contrast.mjs` out of it entirely —
the only pairing needed is card ink on `--surface-inset` for the pointer chip,
which is already asserted.

Guards to clear: `check-typography.mjs` (semantic type roles only — no ad hoc
sizes), `check-focus-ring.mjs` (`var(--focus-ring)` on anything tappable),
`check-contrast.mjs`, `check-caps.mjs`, `check-dir-size.mjs` (`components/umpire/`
holds 2 files, budget is 12 — fine), `check-file-size.mjs`.

CSS goes in `src/styles/38-umpire-pages.css`, which is **381 lines today and
already carries a `check-file-size.mjs` budget entry** — check the budget before
growing it, and split the partial rather than raising the cap.

Accessibility: the scale is a `role="img"` with an `aria-label` naming the
resolved bucket in words, mirroring `UmpireZoneMap`'s existing pattern. The
pointer's vertical position must not be the only way to read the value.

---

## 4. Level and coverage

MLB only, like every other accuracy surface that fronts an MLB game. The AAA
aggregate (`seasonAAA`) has the same fields and could carry a parallel card
later, but AAA runs the ABS challenge regime differently and ranks against its
own pool — do not blend them.

Degradation, in order:

- No accuracy record (MiLB umpire, or the file hasn't caught up) → the card does
  not render at all, same as `PlateAccuracyCard`.
- Below `MIN_RANK_GAMES` → the scale renders, the rank line does not.
- Null favor (no `run-expectancy.json`) → fall back to zone lean.
- Missing challenge fields (pre-Phase-2 rows) → those two tiles are omitted, not
  zeroed.

---

## 5. Phasing

### Phase 1 — ships with zero data work (issues 01, 02)

Bands 1, 2 (substituted), 3, 4 (region only), 5 (substituted tiles: accuracy %,
rank, consistency, runs/game), 6 (provenance). All read-time derivations over
files already committed. No generator run, no backfill, no cron change.

That is most of the graphic, and it is worth shipping on its own.

### Phase 2 — DONE (issue 03, landed 2026-08-06)

The generator change and the full-season backfill have both run. All **3,361**
rows now carry `challenges`/`challengesOverturned` and `missL`/`missR`, across
**both** levels (the sweep was widened from the `--sports=1` originally planned,
since AAA runs the ABS system too and MLB-only would have banked a second
1,600-fetch backfill).

| Level | Rows | Challenges/game | Overturn% |
| --- | --- | --- | --- |
| MLB | 1,726 | 4.08 | **53.6%** |
| AAA | 1,635 | 4.42 | 51.4% |

MLB's 53.6% lands on the reference graphic's own *"MLB average: 54% of
challenges overturned"* footnote — independent confirmation the `MJ`/`MA` filter
is right. `missL + missR === the combined region tallies` on every row.

**So the card can be built against real data for every band.** The original plan
below is kept for the record.

### Phase 2 as originally planned — one generator change, one backfill (issue 03)

A single schema bump to `gen-umpire-accuracy.mjs`'s per-game row, adding both
missing pieces at once so the season is re-swept exactly **once**:

- `challenges` / `challengesOverturned` — ABS tallies per `challenges.js`'s rule.
- `missL` / `missR` region tallies — `missRegion` split by `batSide`.

Then `node scripts/gen-umpire-accuracy.mjs --since=<opening day> --sports=1`:
roughly 3,300 feed fetches. This is the documented backfill path the file has
already been through once (when the 3×3 cell grid was added), and `--sports=1`
keeps it off the immutable AAA rows.

Afterwards the card gains the true `CHALLENGES/GAME` and `OVERTURN%` tiles (with
a league-average footnote computed the same way the zone map's baseline already
is) and the handedness clause on Area to Watch.

**Do not attempt Phase 2 before Phase 1 is merged.** Combining them couples a UI
review to a multi-thousand-request data migration.

---

## Open questions

1. **Is the modal a sufficient host, or does the lineup page want the card
   inline?** Recommendation is the modal (§1) — worth seeing in use before
   building anything more intrusive.
2. **Phase 2's backfill should run by hand and land as a data-only push**, not
   folded into a code PR. Confirm before starting it.
