Not built, and fully derivable from rows already on file. Order a player's challenges by `(date, game_pk, seq)` and walk them for runs of the same `outcome`.

Two boards, because both were asked for:

- **Across the season** — a player's longest run of wins, and longest run of losses
- **Inside one game** — the same, bounded to one `game_pk`

Group by role. Batters, catchers and pitchers were asked for separately.

## What the season looks like (MLB, from the rows on file)

- Longest run of wins: **Carson Kelly, 16**, from 88 challenges all year
- Longest run of losses: **Jimmy Crooks, 9**, who won 2 of 15 all season
- Inside one game the longest run of wins is **5** — only two men reached it

## Two traps

**Small samples.** Isaac Paredes went 10 in a row from 14 challenges all season; Carson Kelly went 16 from 88. Those are not the same fact. Print each player's season total beside the streak, in a column that says what it is ("Won of called, all season"), not in a sentence under the table.

**The in-game loss board is capped by the rulebook at 2**, because the second loss takes the club's last challenge. That is not a record and must not be presented as one. State it once, beside the 2, and nowhere else in the report.

## Acceptance

- Derivation in `scripts/lib/abs/export.js`; role grouping and any minimum in the reader
- Tests: a player whose streak crosses two games, a player with one challenge, a run broken by a game with no challenges, and an assertion that no in-game loss streak exceeds 2 across the whole fixture
- The board reads the `summary` it is given, so the page's level chip works without further work
