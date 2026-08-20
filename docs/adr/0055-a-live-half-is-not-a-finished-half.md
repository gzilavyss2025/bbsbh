# ADR-0055 — A live half is not a finished half — the commit waits for the third out, and the lineup page offers to catch you up

At-bat stepping (ADR-0016) stages a sealed half one plate appearance at a time
and then promotes it to an ordinary full commit: `revealedThrough` advances,
one-directionally, persisted to `localStorage`, and — for a signed-in reader —
carried to every other device (ADR-0022). The promotion fires when the reveal
cap reaches the end of the entry list.

That reads the entry list as if it were the half. **On a finished half it is. On
the half the game is being played in it is the half SO FAR.**

## The defect

A reader scoring along with a live game reaches the end of the fetched entries
within a tap or two of arriving — that is what "keeping up" means. The half then
committed on the strength of however many batters had reached the feed. From
that moment on, every plate appearance that landed in that half arrived already
revealed, with no seal and no tap; the running line, the pitcher's line and the
inning's totals all opened with it; and leaving the page mid-inning and coming
back showed the whole half at once.

So the at-bat-by-at-bat reveal ended, silently and permanently, at the exact
moment the reader caught up to the game they were watching — which is the moment
it is worth the most. Reported as: *"you're clicking through revealing an
outcome and then you leave the page mid-inning, and when you re-visit the page
it shows you the entire half-inning's results."*

It was never a persistence bug. The at-bat cursor (`bbsbh:reveal-atbat:{gamePk}`)
was persisted and restored correctly the whole time; it was simply irrelevant by
then, because the half above it had already been committed.

## The decision

**1. The commit waits for the half to be over.** `stepCommitReady`
(`src/api/playbyplay/entriesView.js`) is now the single answer to "may this
staged half be promoted", and it takes three conditions, not two: the cap has
reached the end of `entries`; at least one of them is an `atbat`; **and the half
is not in progress**. A half still in play reports `atHalfEdge` instead of
committing, and the commit lands on the tap that reveals the third out — once
the half is real.

**2. "In progress" is read from the linescore, not from the plays.** A half
whose third out has just been recorded and a half whose next batter is still
walking up are *identical* in `allPlays`: both end with the same last play, and
no later half exists yet either way. Only `liveData.linescore.inningState`
separates them, so `selectLiveHalf` (`src/api/liveEdge.js`) reads it —
`Top`/`Bottom` mean a half in progress, `Middle`/`End` the gap after the top and
after the bottom respectively.

**3. The bar says so, rather than offering a tap that moves nothing.** On a
sealed half the game is currently in, `InningActionBar` drops "Rest of half" —
there is no rest of the half yet, and that tap would commit exactly what this
ADR exists to withhold — leaving "Next at-bat" alone and full width. Once every
fetched entry is stepped through, even that becomes the same calm live status
the Scores Unlocked pass's own frontier gets: *"Caught up — waiting on the next
batter."* Both states end on their own: the next plate appearance reaching the
feed brings "Next at-bat" back, and the third out turns the half into an
ordinary finished one with its usual pair.

**4. "Catch up to live", on the home lineup page.** The other half of the same
ask. A reader who opens a game already in progress had to reveal every half by
hand to reach the one being played. The lineup page's floating bar now offers a
second button — a kraft seal beside the ordinary "Innings ›" — that ratchets the
mark to the half BEFORE the live one and lands there **still sealed**. Every
half up to there opens; the half you arrive in you step through at-bat by at-bat,
which is the whole point: you are picking the pencil up where the game is, not
being handed the game. Between halves the target is the half just *finished*, so
you land on the last real baseball that happened rather than on a half with
nothing in it yet.

## Why catching up is not a fifth departure from the spoiler rule

The four departures the root `CLAUDE.md` names (ADR-0026, 0042, 0048, 0049) all
lift a seal the reader did not open. This one does not lift anything: it moves
the ordinary reveal mark forward, through the ordinary ratchet, on an explicit
tap. It is the bulk form of tapping "Rest of half" on each half in turn, and it
reveals exactly what those taps would have. So it needs no consent modal of its
own, for the same reason "Rest of half" has never needed one.

Three properties keep that true, and all three are load-bearing:

- **It goes through `mergeMark`.** `catchUpMarkIn` (`hooks/revealProgressCore.js`)
  merges rather than sets, so it cannot walk a mark backward — a reader further
  along than the game (a suspended game resumed later) keeps their place — and a
  hand-mangled stored value cannot make it, since `parseRevealMark` collapses
  anything that is not a non-negative integer to -1 and -1 loses the merge. What
  it skips is only React: there is no mounted `useRevealProgress` to call, because
  the reader is on the lineup page and the innings viewer mounts a moment later
  and reads the key fresh. A synthetic `storage` echo covers anything already
  mounted in the same tab, exactly as `clearRevealMarks` does.
- **It leaves the target half sealed.** `catchUpPlan` reveals through `idx - 1`,
  never `idx`. Landing revealed would hand the reader the half they came to
  score.
- **The label names no inning.** A game in the 12th offers the same three words
  as a game in the 2nd. A label like "Catch up to Bot 12th ›" would announce that
  this game went to extras before the reader ever tapped — ADR-0008's protection
  spent by an *offer* rather than by a choice. The offer is also withheld
  entirely when the tap would move nothing (`offerCatchUp`): a reader already at
  or past the target, or a game still in the top of the 1st, sees "Innings ›"
  alone.

## Cost accepted, and how it fails

- **The reveal `idx` is not clamped by `unlocked`.** It does not need to be —
  `unlockedInnings` derives the unlock count FROM the mark, so ratcheting into
  an extra inning unlocks the innings under it as a consequence. A reader who
  taps "Catch up to live" on a game in the 12th is told it went to extras. That
  is the choice they made; ADR-0008 protects a reader who has not made it.
- **MiLB degrades gracefully, in the safe direction.** A feed that posts no
  `currentInning`/`inningState` reads as "no live half", so no half is ever
  treated as in progress and the commit behaves exactly as it did before this
  ADR. That is the right way to fail: the alternative — assuming a half is live
  because we cannot prove otherwise — would leave a half that can never commit,
  and a reader who can never move forward. The same fallback drops the catch-up
  offer, which is the correct answer when there is no live half to name.
- **The status is not a timer.** "Caught up" clears on the next feed the poll or
  the Refresh brings, not on a schedule of its own. Nothing here reads the clock,
  so ADR-0046's rule is untouched.

## The scorecard already held, by a different test — deliberately left alone

`scorecardStep` (`src/api/scorecardGame.js`) has always carried a `halfOver`
flag and refused to commit without it, so the live sheet never had this defect.
Its test is `idx < lastPlayedHalfIndex(feed) || selectIsFinal(feed)` — read from
the PLAYS, which means it holds until the NEXT half's first play lands rather
than until the third out. That is the conservative direction of wrong (it waits
too long, never too little) and it self-corrects on the next pitch, so it is not
reconciled here: the two surfaces read one mark and one cursor, and the more
precise reading simply arrives from the innings viewer first. Worth knowing
before anyone "fixes" one of them to match the other — the right merge, if it is
ever wanted, is `|| (live != null && live.idx === idx && !live.inProgress)`,
which keeps the plays-based answer as the fallback a feed with no `inningState`
still needs.

**Amends ADR-0016**, whose `onStepComplete` promotion is what gained the third
condition. Everything else there stands: the cursor is still a transient staging
layer over `revealedThrough`, still keyed by half-index, still collapsing into a
normal full commit — just not before the half exists.
