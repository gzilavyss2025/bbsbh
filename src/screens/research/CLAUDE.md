# src/screens/research/

The `/research` page: ask the play-by-play store a question. Data lives in
`src/api/research/`; this folder is only the UI.

## Three modes

- **Plays** — plate appearances that match the filters. `plays/AnswerView.jsx`.
- **Games** — whole games by a total or a way of winning. `games/GameAnswer.jsx`, `games/GameCards.jsx`.
- **Streaks** — runs of games. `streaks/StreakView.jsx`.

`diary/` holds the admin research diary (`ResearchDiaryPage.jsx`) and the page it
shares with the contender diary (`DiaryPage.jsx`).

## Rule

A new part that more than one mode uses goes at the root: `ResearchPage.jsx`,
`FilterBar.jsx`, `AskBar.jsx`, `useResearch.js`, `useEraClubNames.js`. Two older
helpers still live in a mode file and are imported across modes (the split was
move-only): `BoxDate` and `plural` in `plays/AnswerView.jsx` (used by Games and
Streaks), and `RangeCard` in `games/GameCards.jsx` (used by Streaks). Check those
callers before you change them.
