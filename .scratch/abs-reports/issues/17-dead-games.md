Found while building the inning denominator for #1058. `abs_ingested_games` holds games that were never played, and one that is still not finished. Both inflate a denominator the page already prints.

## 1. Cancelled games count as games

The sweep admits a game on `abstractGameState === 'Final'` and excludes only `detailedState === 'Postponed'`. A game called off for weather comes back as **`Cancelled: Rain`** with an abstract state of `Final`, zero innings and zero challenges — and is ingested as a real game.

**23 of the 2,158 Triple-A rows are cancelled games.** MLB has none.

The effect is on every per-game figure at Triple-A:

| Figure | Published | Over games actually played |
|---|---|---|
| Challenges per game | 4.365 | 4.412 |

The slab on `/abs-challenges` also reads "N% of 2,158 games had one", over a denominator 23 too large.

**Fix:** exclude a game with no innings played. Filtering on `detailedState` alone is fragile — the string carries the reason (`Cancelled: Rain`), so match the state prefix rather than the whole string, or better, drop any game whose linescore shows no completed inning. #1058 adds exactly that column, so the two fit together.

## 2. A suspended game is stuck in the ledger, permanently incomplete

`gamePk 815811` (2026-07-05, Triple-A, 568 at 531) is in the ledger with one challenge. Its feed today says:

```
detailedState: "Suspended: Rain"
abstractGameState: "Live"
currentInning: 2, plays: 15
```

It is **not Final**, and it was swept anyway. The generator is append-only by design — "a Final game's challenges are immutable, so a swept game is never refetched" — so when this game resumes and finishes, the rest of its challenges will never be ingested. It is a permanent hole, and nothing in the pipeline will ever notice.

This is the same family as the stuck-Postponed trap in #1031: a schedule row whose status at sweep time does not match the game's real state.

**Fix:** the ledger needs a way to evict a game that is no longer Final. Cheapest version is a `--recheck` mode that re-reads the status of recently swept games with few or zero challenges and deletes the ones that are not Final, so the next ordinary run re-ingests them properly.

## Acceptance

- Cancelled games no longer counted. State the corrected Triple-A per-game figure in the PR
- 815811 either evicted or correctly re-ingested once it is genuinely Final
- Tests over fixtures for both states, so neither can come back silently
- A note in `scripts/gen-abs-challenges.mjs` about which statuses are admitted and why, beside the Postponed rule it already documents
