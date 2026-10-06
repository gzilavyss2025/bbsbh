# Old games: decisions

Each decision lists the recommended option first. The reasons and numbers are in
`plan.md` and `findings.md`. A note marked **(inference)** is my reading, not a
measured value. Gary makes every decision below. Nothing here is decided until he says so.

## The decisions Gary must make first

These block build prompt 1 or 2.

- **D1. The seal** (blocks prompt 2's second half).
- **D6. Negro league games** (blocks prompt 1: the generator must know what to keep).
- **D8. What counts as a no-hitter** (blocks prompt 1).
- **D4. The shelf's name and address** (blocks prompt 3 only).

## D1. What opens a sealed old game

The full design is DRAFT ADR-0101.

1. **Recommended: seal by surface, never by age or arrival.** An old game seals like
   a new one. Teams, date, park, lineups and umpires are open. The score, the box score
   and the feat label stay sealed. One tap opens the box score, and ADR-0049 remembers
   it on every device. Cost: one tap, once per reader, for a game they already know.
2. **Open by arrival.** A link from the shelf or a callout carries a flag, and the
   page opens the box score as a render-only override. Against: a shared link carries
   the flag to a reader who did not consent. This is the gate-on-the-door hole that
   ADR-0042, part 2, rules out.
3. **Open by age.** A game before a cutoff year (for example, before the current season)
   renders open, as history does on open pages (ADR-0034). Against: it makes #1525
   (score a classic game) impossible without a second switch. A reader who wants to
   score the 1986 World Series by hand gets the score first. Any cutoff year is a guess.

## D2. Where the event index comes from

1. **Recommended: the API alone, with a Retrosheet cross-check.** Each row has a gamePk,
   so no join is needed. The cross-check against `nohitters.zip` and `tripleplays.zip`
   finds misses such as the 2023-08-18 triple play.
2. **Retrosheet lists, joined to the API.** Against: the join rate is 88.4% (175 of
   198). It needs a team-code table that is mine. Retrosheet has no cycle list, so
   cycles need a 530 MB download.
3. **The API alone, no cross-check.** Against: it keeps the known 2023-08-18 miss, and
   no check finds the next one.

## D3. The triple play that only the box score text holds

1. **Recommended: a hand-seeded additions file.** The cross-check reports each
   Retrosheet event with no API match. A person checks it and adds it to the seed. The
   generator merges the seed. Today the file has one row (gamePk 716945).
2. **Accept 99.6% recall.** Against: the shelf and the callout would both be wrong about
   that game, and the next one like it.
3. **Parse the box score `info` text for every game.** Against: one box score is about
   214 KB, and 139,366 games from 1960 cost about 24.6 GB.

## D4. The shelf's name and address (open question)

I do not recommend a name. That is Gary's call. The placeholder in the plan is
`/notable` and `public/data/notable/`. Candidate words: "Notable games", "Rare feats",
"The record book". Two constraints: the name must not be a word the house list bans,
and the route must not collide with a name in `src/lib/route.js`'s `parseRoute`.

## D5. Does a shelf row show the final score?

1. **Recommended: no.** A row names the feat, the players, the clubs and the date. The
   score is the box score's job. The file stays smaller, and a game opened from the
   shelf still has something left to reveal.
2. **Yes.** The shelf is an open page, and `FirstScorebookPage` and the postseason series
   page print scores. Against: the row then says more than the feat, and it gives a
   reader no reason to open the box score.

## D6. Negro league games (1920 to 1948)

1. **Recommended: include them, with a source line.** The API lists them in the same
   `sportId=1` schedule as the AL and NL (**15b**: 12 of the 28 games on 1927-07-04).
   The API finds 9 Negro league cycles. A row says "as the MLB Stats API records it".
   The triple-play tab says that their triple plays are not in the record (their team
   game logs return 404).
2. **Leave them out.** Against: it drops games that the app's own game pages already
   open, and the shelf then disagrees with the game route.
3. **Include them, and fix scores from Retrosheet.** Against: scores differ in 5 of 21
   sampled cases, and `findings.md` does not know which side is right.

## D7. Rows that only Retrosheet holds

1. **Recommended: leave them out.** A row must open a page. Pre-1901 games and the 28
   no-hitter rows with non-MLB codes have no API game to open (non-MLB by the codes;
   **inference**).
2. **List them with no link.** Against: a shelf row that leads nowhere, and two sources
   on one list with no way to tell them apart.

## D8. What counts as a no-hitter

`findings.md`: 7 of the 197 API candidates for 1960 to 2025 ran under 9 innings, and
Retrosheet counts them too. Both sources count a team with 0 hits.

1. **Recommended: count every game where a team had 0 hits, and mark the edge cases.**
   A row under 9 innings says "shortened". A row where the club with the no-hitter lost
   says so. A combined no-hitter names every pitcher.
2. **Use MLB's official definition.** It needs 9 or more innings, and it removes the
   shortened games. The 1991 rule is my general knowledge, not checked in this session
   (**inference**). Against: the shelf then disagrees with Retrosheet's list.

How many lost no-hitters the index holds is not measured.

## D9. When the current season refreshes

1. **Recommended: nightly, in the existing nightly workflow.** About 38 calls a night
   (**15b, estimate**). Finished seasons stay hand-run and frozen (ADR-0100, ADR-0080).
2. **Hand-run after the season ends.** Against: the callout says "first since 2019" after
   a triple play earlier the same season.

## D10. Whose "last time" the callout names

1. **Recommended: the club's.** For example: "The Brewers' first triple play since
   {date}." A club
   is what the reader follows. The club is named as it was that season.
2. **The player's** (cycles only). Against: almost every cycle is a player's first, so
   the note says little.
3. **The league's.** Against: a triple play happens about four times a season (266 in 66
   seasons), so a league span is short and says little.

## D11. Does the callout link the earlier game?

1. **Recommended: no link at first.** The note names a date and a club. Nothing more is
   needed to make it true.
2. **Link it, sealed.** The earlier game opens on its box score, sealed (ADR-0101). This
   can come later with no change to the seal.

## D12. Where a shelf row opens

1. **Recommended: the box score, sealed.** `FirstScorebookPage` and the postseason series
   page already link to `boxscore`.
2. **The first lineup page.** ADR-0081's long at-bats open there. Against: a reader who
   came for a feat wants the box score, not the lineup.

## D13. Postseason events

1. **Recommended: include them.** **(15b)** The player game log returns a postseason
   cycle with `gameType=D`. The schedule rule takes a `gameType` too. Retrosheet shows 3
   postseason events for 1960 to 2025.
2. **Regular season only.** Against: the shelf would leave out the most famous games.
