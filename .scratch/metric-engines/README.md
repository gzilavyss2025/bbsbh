# Metric engines — joint scoping

Status: scoping (no implementation)

Four candidate metrics scoped together, each in its own doc. Process, per the
request that kicked this off:

1. **First-principles pass** — 3–5 candidate engines/algorithms per idea, designed
   against this repo's real constraints *before* any external research.
2. **Research pass** — external literature/prior-art review per concept (done by
   research subagents, cited in each doc's *Research findings* section).
3. **Re-evaluation + stack rank** — engines revised where the research demanded it,
   then ranked on **effectiveness**, **ease of creation/maintenance**, and
   **understandability** (1–5 each).

| Doc | Idea |
|---|---|
| `lineup-strength.md` | Pre-game grade of the actual starting lineup vs. the best lineup the roster could plausibly field |
| `pitching-health.md` | In-game stress-adjusted pitch load ("not all pitches are created equal") |
| `foul-tracker.md` | Foul-ball counting, leaders, and outcome correlations |
| `pitch-workload.md` | Stress-weighted rolling pitch-count workload over last 1/3/10 games vs. baselines |

## Shared constraints (apply to every engine below)

- **Spoiler classes.** Pre-game metrics built from the starting nine
  (`selectLineup`, spoiler-free) + season aggregates need no gating and can render
  on `TeamInfo`. In-game per-pitcher metrics follow the Pitchers-table pattern —
  gated directly by `revealedThrough`, *not* SealBox (ADR-0009). In-game per-half
  counters live in the reveal-only `derive.js` bucket (ADR-0001). Backward-looking
  multi-game aggregates over *completed* outings are spoiler-free (same footing as
  WAR/milestones).
- **Data sources on hand.** Live feed pitch-by-pitch (`liveData.plays.allPlays[].playEvents[]`,
  already parsed by `derive.js`/`playbyplay.js`/`pitchers.js`, incl. per-pitch foul
  codes, count, runners, `pitchData.startSpeed`, pitch type); nightly FanGraphs WAR
  (`gen-war.mjs`); nightly Savant percentile CSV (`gen-savant-percentiles.mjs` —
  **`oaa` is in the fetched CSV but currently dropped**); statsapi gameLog/splits
  sweeps (`gen-callouts.mjs`, which already computes reliever `recentPitches` over a
  4-day window + peer baseline); RE288 run-expectancy table
  (`src/lib/runExpectancy.js`); SQLite incremental-sweep layer (ADR-0021).
- **New nightly data extends existing pipelines** — callout families extend
  `gen-callouts.mjs`, never a parallel path; new static payloads follow the
  `gen-*.mjs → public/data/*.json → src/api/*.js` template; ~≤100 KB stays in the
  PWA precache, big/growing files get `globIgnores`'d.
- **Grade scale.** House convention is numeric (0–10 or 0–100) + SD-based tier
  labels via `src/lib/statTiers.js` — no letter grades anywhere in the app. Docs
  recommend 0–10; A+–F stays available as a pure presentation-layer skin.
- **MiLB degradation.** Savant/FanGraphs inputs are MLB-only and MiLB feeds often
  lack `pitchData`/pitch types — every engine states its fallback (usually "not
  shown below MLB" or a reduced-input variant).

## Cross-idea build-priority recommendation

Winners per idea (full reasoning + research citations in each doc):

| Idea | Winning engine(s) | One-liner |
|---|---|---|
| Pitch workload | **W1 raw rolling buckets + W5 availability board** | Evidence-aligned (volume beats rest-days as the fatigue variable), rides the existing gameLog sweep, published thresholds to borrow |
| Foul tracker | **F1 in-game counters → F2 nightly aggregates + F5 callout family** | Trivial foundation; per-inning and starter/bullpen foul splits would be *genuinely unpublished* stats; SABR priors make the copy sing on day one |
| Pitching health | **P3 own-baseline "laboring index" + P4 velo-decay flag** | The two signals the literature actually backs; leverage-weighted stress counts were tested and refuted (Carleton/BP), windup-vs-stretch is debunked |
| Lineup strength | **L2 WAR-rate replacement delta**, presented as an L5-style itemized receipt | Runs-denominated, every constant is standard public practice; batting *order* effects (~5–15 runs/season) aren't worth a simulation engine |

**Recommended build order:**

1. **Workload (W1+W5)** — least new machinery (reshapes data `gen-callouts.mjs`
   already fetches), spoiler-free, immediately useful pregame ("who's left in
   their pen tonight?"), and the strongest prior-art trail to follow.
2. **Foul tracker (F1, then F2+F5)** — F1 is a near-free counter alongside
   `whiffs`; the F2 sweep is the only new pipeline in the whole slate, but it
   buys stats nobody publishes.
3. **Pitching health (P3, P4 flag)** — cheap once its small baseline precompute
   exists (which can ride the same sweep extension as W1); in-game surfaces need
   the ADR-0009 gating care, so it benefits from landing after the calmer
   pregame features.
4. **Lineup strength (L2)** — the flagship and the most genuinely novel product
   (no public actual-vs-optimal lineup grade exists), but also the most new
   surface area: eligibility matrix precompute, assignment solver, IL-awareness,
   and a season of calibration nerve. Scope it as its own feature
   (`.scratch/lineup-strength/` PRD) when its turn comes.

Cross-cutting notes: ideas 2 and 4 were designed to share a per-pitch stress
weight; the research collapsed that coupling (both stress-weighted engines lost
to simpler volume measures), which conveniently decouples the two builds. If
stress-weighting is ever revisited, PAP³-style per-outing tail-weighting on
`numberOfPitches` is the defensible cheap version. Everything above stays
descriptive — nothing here should ever be framed as injury prediction.
