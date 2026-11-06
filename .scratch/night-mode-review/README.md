# Night-mode screenshots (issue #2507)

Viewport 390x844, deviceScaleFactor 2, full-page, `?nointro` on every URL.
Theme set with `document.documentElement.dataset.theme` after load (light / dark).

| File | URL | HTTP | Status |
|---|---|---|---|
| `slate-light.png` | http://127.0.0.1:5173/?nointro | 200 | ok |
| `slate-dark.png` | http://127.0.0.1:5173/?nointro | 200 | ok |
| `lineup-light.png` | http://127.0.0.1:5173/07072026/milstl-2/lineup1?nointro | 200 | ok |
| `lineup-dark.png` | http://127.0.0.1:5173/07072026/milstl-2/lineup1?nointro | 200 | ok |
| `innings-light.png` | http://127.0.0.1:5173/07072026/milstl-2/top1?nointro | 200 | ok |
| `innings-dark.png` | http://127.0.0.1:5173/07072026/milstl-2/top1?nointro | 200 | ok |
| `boxscore-light.png` | http://127.0.0.1:5173/07072026/milstl-2/boxscore?nointro | 200 | ok |
| `boxscore-dark.png` | http://127.0.0.1:5173/07072026/milstl-2/boxscore?nointro | 200 | ok |
| `team-light.png` | http://127.0.0.1:5173/team/milwaukee-brewers-158?nointro | 200 | ok |
| `team-dark.png` | http://127.0.0.1:5173/team/milwaukee-brewers-158?nointro | 200 | ok |
| `player-light.png` | http://127.0.0.1:5173/player/christian-yelich-592885?nointro | 200 | ok |
| `player-dark.png` | http://127.0.0.1:5173/player/christian-yelich-592885?nointro | 200 | ok |
| `standings-light.png` | http://127.0.0.1:5173/standings?nointro | 200 | ok |
| `standings-dark.png` | http://127.0.0.1:5173/standings?nointro | 200 | ok |
| `profile-light.png` | http://127.0.0.1:5173/profile?nointro | 200 | ok |
| `profile-dark.png` | http://127.0.0.1:5173/profile?nointro | 200 | ok |
| `logbook-light.png` | http://127.0.0.1:5173/logbook?nointro | 200 | ok |
| `logbook-dark.png` | http://127.0.0.1:5173/logbook?nointro | 200 | ok |

Routes: lineup and innings use gamePk 823035 (MIL @ STL, 2026-07-07) from docs/test-games.md; player id 592885 (Christian Yelich) and team 158 (Brewers) are used as examples; Game Log = `/logbook` (newest season).
