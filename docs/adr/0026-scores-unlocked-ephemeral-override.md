# Scores Unlocked — one consented day, never a persisted reveal

ADR-0025 landed the copy store this consent surface uses. This is the departure
itself: **Scores Unlocked**, the app's single site-wide, opt-in switch that
un-gates every score after an explicit consent tap.

It began as two features — this pass plus a per-game "Follow Live" mode
(ADR-0027, now superseded). They were merged before either shipped, because the
case that justified splitting them turns out not to occur: nobody leaves a
ballpark and hand-scores four more three-hour games, so "follow this one game
live but keep the rest of today sealed" is not a thing anyone wants. One switch,
meaning *I'm fine seeing today*, covers it — and merging deleted the one
mechanism that could permanently corrupt the persisted reveal ratchet.

The whole point of the app is the spoiler rule: a score-revealing value never
exists in the DOM until the user reveals it (root `CLAUDE.md`). Scores Unlocked
is a deliberate, *consented* lift of that rule — "I'm not scoring right now, I
just want to glance at today's numbers." The design problem is to grant that
without letting it corrupt the mechanism the rest of the app depends on.

## The decision

- **An ephemeral RENDER override, not a reveal.** The pass never touches
  `revealedThrough` — the persisted, cloud-synced, forward-only high-water mark
  that records what the user has actually uncovered by hand. Instead,
  `effectiveReveal` (`src/hooks/revealProgressCore.js`) computes a *render-only*
  mark: when the pass is on it returns the game's last half-index (and unlocks
  every inning); when off it is the identity, returning the real mark unchanged.
  `InningViewer` renders from `renderRevealedThrough`/`renderUnlocked` but keeps
  feeding the **real** `revealedThrough` to `useRevealProgress`,
  `mergeRevealedThrough`, `RevealCloudSync`, and `localStorage`. So the pass
  unseals the screen for viewing while writing nothing: flip it off (or hit
  8am) and you drop straight back to the mark you earned, with nothing leaked
  into storage or across devices.
- **The render mark is only half of it — reveals must also stop committing.**
  `effectiveReveal` returns `commitReveals`, and `InningViewer` hands `revealTo`
  down only when it is true. This is not belt-and-braces; without it the whole
  decision above is undone. A half that renders revealed mounts its `SealBox`
  force-revealed, and `SealBox` fires `onReveal` on *any* transition to shown —
  by flag as much as by tap (`SealBox.jsx`). Wired straight to `revealTo`, that
  means simply *looking* at a half under the pass ratchets the real mark, writes
  it to `localStorage`, and (signed in) propagates it to every other device. The
  first build shipped exactly that: opening `/top1` with the pass on wrote
  `bbsbh:reveal:{gamePk}` = `"0"`. Nothing is lost by suppressing it — under the
  pass there are no seals to tap, so there is no genuine reveal to record, which
  is what the consent copy means by "it does not track or advance your by-hand
  scoring". **Any future force-reveal source must answer the same question: does
  it also need to stop the commit?**
- **Finite, never `Infinity`.** `effectiveReveal` returns
  `halfIndex(actualCount, 'bottom')`, an ordinary integer, not `Infinity`. An
  infinite mark could reach an array index or be stringified into a storage
  value (`parseRevealMark('Infinity')` correctly rejects it to `-1`, so it would
  fail *closed* rather than leak — but there is no reason to court it).
- **A day pass stored as an expiry, not a boolean.** `useScoresUnlocked`
  (`src/hooks/useScoresUnlocked.js`) stores the next local 8:00am as an epoch-ms
  expiry under `bbsbh:scoresUnlocked` — never a score. `isUnlocked`
  (`src/lib/scoresUnlocked.js`) is the single predicate: `unlocked` is true only
  while `now < expiry` and the value is within a sane 26-hour window, so it
  **fails closed** on anything stale, garbled, past, or overnight. State is
  recomputed at render (authoritative), not dependent on a timer having fired —
  a `storage` listener, a `visibilitychange` re-check (mobile Safari suspends
  background timers), and an armed timeout all funnel through the same
  expired-key cleanup.
- **A consented day stays consented.** This is the one place the pass is
  *durable*, and it is deliberate. The original design re-sealed everything at
  8am, which was a fiction: if you flipped the switch on Tuesday because you were
  at the ballpark and wanted the out-of-town scores, Tuesday is spoiled, and
  pretending on Wednesday morning that you might still hand-score those games is
  pretending. So consent records the DAY (`bbsbh:spoiledDays`,
  `src/lib/spoiledDays.js`) and 8am no longer means "everything re-seals" — it
  means *the pass stops applying to new days*. The whole of that date stays open,
  including games you never opened: the slate put every one of their scores in
  front of you the moment you flipped it on.
  - It is a set of **dates**, never a reveal mark, so a spoiled day still cannot
    touch, advance, or cloud-sync `revealedThrough`. The two live side by side:
    the mark says what you scored, this says which days you agreed to see.
  - It grows only by consent, is capped, and every parse failure collapses to the
    empty set — garbage can lose a day's consent (harmless) but never invent one.
  - **Turning the pass off the same day takes the consent back.** That keeps the
    best property of the ephemeral design: a mis-tap on the confirm button costs
    nothing. Once 8am passes there is no longer a caller that would name that
    date, which is exactly how a day becomes permanent.
- **8am local, and honest about it.** The consent copy (registry
  `scoresUnlocked.*`) states plainly what the pass leaves alone — your by-hand
  scoring is never advanced, on this device or any other — and what the reset
  actually does: the switch turns itself off so tomorrow starts sealed, *and
  today stays unlocked*. The old copy promised an unconditional re-seal; that
  promise stopped being true and the wording had to go with it (unit-pinned in
  `test/copy-registry.test.js`, which now rejects the old phrasing outright).
  The reset is an expiry timestamp, not a flag someone has to remember to clear.
- **Keeping up with a game in progress.** While the pass is running, a live game
  pulls the VIEW along with it: `selectLiveEdge` (`src/api/liveEdge.js`) reports
  the half the game has actually reached, `InningViewer` moves a caught-up viewer
  there with `replace:true`, the feed poll tightens from 60s to `FOLLOW_POLL_MS`
  (15s) so the current half doesn't look frozen between pitches, and the floating
  bar swaps its forward action for a calm caught-up status
  (`scoresUnlocked.liveEdgeLabel`). This is **navigation only** — it writes
  nothing. Under the pass every half already renders open, so there is nothing
  for a ratchet to advance, which is the whole reason this stopped needing to be
  a separate feature with its own consent and its own persistence rules. A viewer
  who has paged back to re-read an earlier half is left alone.
- **Every surface, and the strip says so on all of them.** While the pass runs:
  the slate shows each of that day's games' score + inning from a SEPARATE,
  consent-gated fetch whose data never touches the default slate model (the
  default stays byte-identical and score-free, so a render-gate bug has nothing
  to leak); every game opened renders every half unsealed, box score included
  (`BoxScore.jsx` hands the pass to `SealBox`'s existing `forceRevealed`, so "no
  seals, no tapping" holds for every score surface inside a game, not just the
  innings view). The kraft strip rides under the masthead on **every** section —
  both lineups, innings, box score — and is itself the off switch. Landing on an
  unsealed screen from a shared link without knowing why, and with no way back to
  sealed, was the single worst thing about the first build.
  - The strip appears only while the pass is *running*. A day locked in by an
    earlier consent renders open with **no** strip: there is nothing left to
    switch off, and offering to would be a lie.
  - Slate scoping is by DATE (`spoilersOffFor(dateStr)`): today while the pass is
    on, plus any day already consented to. A day you never agreed to keeps its
    ordinary tap-to-reveal-all. In-game, the override additionally covers
    anything opened during the live window — a peek at an older game mid-pass is
    a peek, and that day re-seals when the pass ends because it was never
    consented to.

## Why this doesn't violate the spirit of the spoiler rule

- **Consented, and scoped to what was consented to.** A score DOM node appears
  only after an explicit tap on a consent modal that names the exact trade — then
  for that day, and for whatever else is opened during the window. Nothing is
  unsealed that the user did not ask for.
- **The default path is byte-identical.** With the pass off and no day consented
  to, `effectiveReveal` is the identity, the slate carries no score fields, and
  every sealed surface behaves exactly as before. Nothing about the feature
  changes the app for a user who never flips it on.
- **The reveal ratchet is untouched, always.** The two things stored are an
  expiry timestamp and a list of dates. Neither is a reveal mark; neither is ever
  merged into the ratchet, written to `bbsbh:reveal:{gamePk}`, or sent to the
  cloud sync. A day being permanently spoiled is a *consent record*, not scoring
  progress — so no amount of using the pass can make another device think you
  scored something you didn't.
- **Fails closed by construction.** Every path that could go wrong — a mangled
  expiry, a garbled day list, a suspended timer, a clock skew, a value from a past
  day — resolves to "sealed", never "unlocked".

## Cost accepted

Scores Unlocked has **no server component** — it is pure client state
(`localStorage` + render), so it is deliberately absent from the Architecture
"no backend" exceptions list (only the copy store it uses, ADR-0025, is a backend
exception). It does widen the DOM contract: a score-bearing node can exist
without a per-value reveal — but only behind an explicit, fail-closed consent,
and only for what that consent covered. The invariant that protects the app is no
longer "no score in the DOM, ever" but "no score in the DOM except behind a
reveal or a consented day" — and the render/persist split keeps the *persisted
reveal mechanism* exactly as strict as it was.

Two costs worth naming:

- **A consented day can't be un-consented after 8am.** That is the design (you
  did agree), but it means a mis-tap discovered the next morning has no undo. The
  same-day off switch is the mitigation.
- **The day list doesn't sync.** ADR-0022 mirrors the reveal mark across a signed-in
  user's devices; the spoiled-day list is local-only, so a day spoiled on the
  phone still shows sealed on the iPad. Local-only was right when this was a
  transient pass keyed to a *local* 8am; now that it's durable consent, syncing it
  is arguable. Left local deliberately — it keeps `api/reveal.js` unchanged and
  bounds any bug to one device — and recorded here as the obvious next question.

## Known gaps (deliberately recorded, not yet closed)

- **No live-game browser verification yet.** Every state is pinned by the pure
  suites and by `e2e/invariants/scores-unlocked.spec.js`, and all of them were
  driven in a real browser against a stubbed feed (see the implementation log),
  but the live-following behaviour — the auto-nav to a new half, the 15s poll,
  the caught-up status — has never been watched against a game actually in
  progress. Do that before treating the auto-nav feel as settled.
- **No marker for a locked-in day.** A past day you spoiled renders open with
  nothing indicating that you're the reason. Correct (there's nothing to switch
  off) but a quiet note on that day's slate might read better than silence.
