# #1300 — WinProbChart re-render cost on pointer move

Measured on `origin/main` f5a7e675a (2026-09-30). Every row below ran at this SHA, plus the change named in the row.

- Game: gamePk 777747, `/05272025/bosmil/boxscore?nointro`, box score revealed first. 4 swing rows.
- Viewport 390x844. CPU throttled 4x (CDP `Emulation.setCPUThrottlingRate`). Dev build.
- One sweep = 201 pointer positions across the plot, same path each time. 3 warm-up sweeps (not counted), then 5 sweeps.
- Metric: `actualDuration` of the `WinProbChart` fiber for each commit where it rendered.
  A stand-in DevTools hook read it (`measure.mjs`), so nothing was added to `src/`.
- Two runs per variant. Raw sweeps are in `runs.jsonl`.

| Variant | Median of the 5 per-sweep medians (ms/commit), run 1 / run 2 | Commits per sweep |
|---|---|---|
| before (main) | 12.2 / 12.2 | 72 |
| after: band layer memo only | 10.2 / 10.3 | 72 |
| after: band layer memo + `hasClip` memo | 9.8 / 10.0 | 72 |

Drop in median render time per commit: about 19% for the full change (12.2 to 9.9 ms), about 16% for the band layer alone.
The total render time per sweep fell by about the same amount (about 920 ms to about 735 ms).

## Decision

Gary has not fixed a threshold. This run used a 30% rule, because a smaller gap is inside the noise of five sweeps.
The full change gave about 19%, which is under the rule. No `src` change was kept.

The change that was tried is in `tried-change.patch`: the band layer in `winprob/WinProbBands.jsx`, the plot
geometry in `winprob/plot.js`, memoised layouts in `WinProbChart.jsx`, and a `hasClip` memo in `useSwingClip.js`.
The React lint rule `react-hooks/immutability` rejected the `hasClip` memo as written (it writes to a `Map`
inside the memo), so that part would need a rewrite if someone revives it.

Setup note: Chromium in this sandbox does not trust the egress proxy CA. `lib.mjs` has Node fetch each
external request and hand the body to the page, so TLS checks stay on.
