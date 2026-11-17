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

A part that more than one mode uses stays at the root: `ResearchPage.jsx`,
`FilterBar.jsx`, `AskBar.jsx`, `useResearch.js`, `useEraClubNames.js`. A mode folder
may import from another mode (Games and Streaks reuse `BoxDate` from Plays); move
such a helper to the root once a third mode needs it.
