# Verification: routes and games

Add `?nointro` to every URL. API facts below were read from statsapi.mlb.com on 2026-10-19.

| Case | gamePk | Route | Expect |
| --- | --- | --- | --- |
| Past Final game | 823035 (2026-07-07 MIL @ STL, game 2, Final 10-2) | `/07072026/milstl-2/boxscore` | Box score open with no tap. `localStorage` has no `bbsbh:boxreveal:823035`. |
| Same game, innings | 823035 | `/07072026/milstl-2/top1` | Still sealed; at-bat stepping works. |
| Same game, lineup | 823035 | `/07072026/milstl-2/lineup1` | Starting pitcher card: Box Lines door lists games before 2026-07-07 only. |
| Suspended and resumed, past | 777861 (CLE @ MIN, officialDate 2025-05-19, resumed 2025-05-21, Final) | `/05192025/clemin/boxscore` | Open. |
| Today's game | 849815 (ALCS, CLE @ TB, 2026-10-19, Preview on 2026-10-19) | `/10192026/cletb/boxscore` | Sealed: "Tap to reveal the box score". After a tap, `bbsbh:boxreveal:849815` is `"1"`. |
| Slate, past date | none | `/10182026` | Cards show no score; a Final card has a "Box score ›" button that opens an open box score. |
| Player page, game played today | any starter of a game that is Final today | `/player/{id}` | The Game Log row shows score and decision. Cannot be pinned in advance: check on a day with a Final game. The unit tests pin it. |

Not covered in a browser: the stamp strip inside an open box score (it renders there by the
ADR-0035 rule). Open one past box score and confirm the stamp button shows and `npm run lint`
(`check-stamp-surfaces`) passes.

Send Gary a screenshot of each of the first, second and fifth rows, with the route and gamePk.
e2e (`npm run e2e`) only when Gary asks; `e2e/invariants/box-score-unlock.spec.js` will need a
past-game case then.
