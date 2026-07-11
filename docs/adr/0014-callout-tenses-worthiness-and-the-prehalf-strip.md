# Callouts: two tenses gated by surface, a shared worthiness score, and the caller-gated pre-half strip

The callout families (see `docs/callouts.md` for the full catalog) originally
spoke only in "entering tonight" season aggregates — a 14-game on-base streak
read "14" even on the card for the single that made it 15, and "the Brewers
are 5-1 when he goes deep" never learned that tonight became 6-1 (or, more
interestingly, 5-2). Folding the current game in is what a reader expects a
second screen to do, but *how much* of tonight a note may fold in is exactly
the spoiler question, so the rule is now explicit and structural:

- **Innings-view play cards fold in revealed plays only.** A note on a play
  card may count what happened *through that play* — "that's No. 16 this
  season", "extends his on-base streak to 15 straight games" — because every
  play at or before it is, by construction, already revealed (the card lives
  inside the half's SealBox). It may never reference the game's *outcome*:
  a result-aware "moved to 6-1" on a 3rd-inning homer card would tell a
  reader revealing the 3rd that the Brewers win tonight. The per-play counts
  come from `computeCalloutProgress` (`callout-notes.js`), whose snapshots
  are cumulative *through each play, inclusive* — nothing later leaks
  backward.
- **Result-aware wording exists only in the box score's Insights roll-up.**
  `computeGameCalloutNotes` runs inside the box score's single SealBox, where
  the final score is already exposed, so only there do records fold tonight
  in ("moved to 18-2 when leading after the 8th", "just the 2nd loss in 7
  games when he goes deep", "his 10-game on-base streak came to an end").
  Even there it's gated on `gameResult` reporting a decided Final — an
  in-progress box-score view stays in entering-tense, and a suspended tie
  folds nothing.

**The pre-half strip** (`prehalf-callouts.js`, rendered by `PreHalfCallouts`
above each half's seal) is a third surface with the ADR-0003/0010 contract: it
stages the half like the pre-pitch change list, rendered outside the seal and
caller-gated to a reached half (`revealed || isNextToReveal`). Two of its
families are pure season aggregates (the club's record in tonight's starter's
starts, an inning's season run differential) and lean only on that outer gate.
The third — "the Brewers are 17-2 this season when leading after the 8th",
shown entering the top of the 9th — must read *tonight's* score to know who
leads, so it additionally gates itself, inside the builder, on every inning
through N−1 sitting at or under `revealedThrough`. It restates only a score
the reader has already revealed; a reader who navigated ahead without
revealing gets no note. The gate lives in the module, not the component, so a
future caller can't skip it.

**Worthiness.** Every note now carries a 0–100 `score` (family base +
magnitude bonus — the callouts sibling of ADR-0013's blended performance
score; rubric in `docs/callouts.md`). The Insights roll-up sorts by it and
shows the top few with the tail behind a Show-more; the pre-half strip caps
itself with it. Alongside it, `dedupeKey` marks "the same fact, restated" so
the roll-up keeps a count note's *final* number (latest wording wins in
place) instead of one card per occurrence — which is also what lets the
first-PA "riding a 14-game streak" card and the later "extends it to 15" card
coexist in the innings view but collapse to one in the roll-up.

Data-layer support: `gen-callouts.mjs` writes the leading-after record twice —
`leadAfter` (lopsided-only display strings, still the blown-lead reversal
note's floor) and `leadAfterFull` (raw `{w,l}` past the sample floor, for the
strip and the fold) — plus `inningRuns` (per-inning runs for/against) and
`starterRecords[id].teamStarts` (the *club's* W-L in his starts; game-log
`isWin` is the team's result, not the pitcher's decision). Records that fold
tonight in are stored as numbers, not display strings, for exactly that
reason. Older committed date files simply lack the new fields and every
consumer null-guards — fewer notes, never a crash.
