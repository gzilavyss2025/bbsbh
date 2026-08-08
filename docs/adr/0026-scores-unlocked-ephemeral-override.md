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
- **The day list syncs, and needed a different merge shape than the reveal mark.**
  A day spoiled on the phone shows spoiled on the iPad (`api/spoiled-days.js` +
  `SpoiledDaysCloudSync.jsx`, same Clerk + Upstash stack as ADR-0022). The reveal
  mark can sync with a monotonic ratchet because it only moves one way; a day SET
  cannot. A plain union would have been monotonic too — and would have resurrected
  a day the user just took back, because the stale remote 'on' outlives the local
  removal, silently reversing the same-day undo this design promises. So the wire
  format is a per-day STATE map (`'on' | 'off'`), a withdrawal travels as an
  explicit 'off', and last write wins per day. That is sound because a day is only
  mutable while it is "today" on some device: past days are frozen and converge,
  and any disagreement about today self-heals the next time the switch is touched.
  Absence on the wire means "no opinion", never "erase" — otherwise a fresh device
  with an empty list would wipe the user's history on first sign-in.
  - Still not a reveal mark, and still cannot become one. Separate key, separate
    shape, separate endpoint. Signed out, or on a deploy without the store, the
    endpoint is never called and the list stays local — the offline-first
    contract is unchanged.

## Verified against a live game (2026-07-25)

The live-following behaviour was watched against KC@DET (gamePk 824244) while it
was actually in progress, by proxying the browser's statsapi requests out through
the shell so each poll fetched genuinely fresh data:

- **Auto-advance.** Opened at `/top1`; the app moved itself to `/top9`, the live
  frontier.
- **Cadence.** Feed fetches landed 16/15/15/15 seconds apart — `FOLLOW_POLL_MS`,
  not the 60s default.
- **Caught-up status.** Rendered "LIVE · TOP 9TH IN PROGRESS", the `{inning}`
  token filled with the half actually on screen.
- **The paged-back guard.** After auto-navigating to top 9, paging back to top 8
  and sitting through two full poll windows left the view on top 8 — a reader who
  deliberately goes back is not yanked forward.
- **The invariant.** `bbsbh:reveal:824244` stayed unwritten across every poll, the
  auto-navigation, and the manual paging. This is the bug this ADR's
  `commitReveals` rule exists to prevent, confirmed clean against a live feed.

## Amendment (2026-08-05) — the same-tab echo must not read eagerly

Turning the pass back off did not re-seal the slate until a reload. The switch
flipped, the pass expiry was dropped, and `bbsbh:spoiledDays` was correctly
rewritten without today — but the live scores stayed painted on the cards,
because the hook's IN-MEMORY day map still held today and `spoilersOffFor` reads
that, not storage.

The mechanism: `enable`/`disable` persist the day map from inside their `setDays`
updater, which React runs at render time, but they fire `notifyLocalChange`
synchronously right after *queueing* it. `refresh` — the echo's landing point —
then read the map eagerly, before the write it was reacting to, and queued the
pre-change value behind the change. React applied the updater, then reverted it.
Reading from inside the updater (`setDays(() => parseSpoiledDays(...))`) puts the
read after the write. The expiry half never had the bug and still reads eagerly,
because both callers write that key synchronously before notifying; the hook's
header now says so, since an undocumented asymmetry is how this comes back.

Two things worth carrying forward:

- **This is a spoiler bug, and the existing specs could not see it.** They
  assert `localStorage`, which was right the whole time. The regression test
  added with the fix asserts the only thing that tells the two apart — score
  lines still in the DOM after the user said stop — and is the one spec in
  `e2e/invariants/` that STUBS the feed rather than guarding on it, because
  here "no feed" means nothing to assert rather than less.
- **`useStamps.js` had the identical defect** (ADR-0036's addendum), found
  first and fixed the same way. Any hook in this codebase that persists inside
  a state updater and echoes synchronously has it; the echo listener must read
  from inside its own updater.

## Amendment (2026-08-06) — the publish step is a comparison, not a change log

The day map never backfilled. `SpoiledDaysCloudSync` published "whatever changed
since the last list I saw", with the first observation establishing a silent
baseline — so a device holding consent from BEFORE sign-in saw no change,
published nothing, and never would. The owner's second device signed into the
same account and found an empty map. Consenting to a new day didn't rescue it
either: that one day published fine and everything behind it stayed on the one
device.

The fix is the shape ADR-0035's Logbook sync already took (`stampsToPublish`,
PR #545): the baseline is now what the SERVER said on the last pull, and the
question is "what do I have that it doesn't?" — `dayStatesToPublish`
(`src/lib/spoiledDays.js`). Answerable from the two maps alone, needing no
history, and self-healing, since a publish lost to a dead network is found again
by the next comparison.

Two details the state map forced, and both are load-bearing:

- **A withdrawal still cannot be inferred from absence.** The local list keeps no
  tombstones, so a day this device took back and a day it is merely ignorant of
  look identical from that list alone — and absence on the wire has to keep
  meaning "no opinion", or a fresh device would erase the user's history. So the
  last-observed local list is still kept, and an explicit `'off'` is published
  only where this device HELD the day, no longer does, **and** the server still
  says `'on'` — precisely the stale row a withdrawal exists to reverse.
- **That second condition replaced the old `merging` flag**, which suppressed the
  whole publish pass while a remote merge was being applied. It had to go: the
  merge is exactly the moment the new baseline arrives, so suppressing that pass
  would suppress the backfill it enables. Requiring the server to still say
  `'on'` is what keeps a day the merge itself removed from being echoed back at
  the server that sent it.

## Amendment (2026-08-08) — a consent names a GAME day, and the switch reports what the slate does

Two halves of the same defect, reported as "live scores are passing through even
with the toggle off."

**The day recorded was the wrong day between midnight and 8am.** `enable` paired
`nextResetAt()` — the next local 8am — with `toApiDate(new Date())`, the plain
calendar date. Those agree for sixteen hours a day and disagree for eight. A
consent at 1am wrote an expiry seven hours out and stamped THAT WHOLE NEW
CALENDAR DATE as consented-to. Because a consented day is durable on purpose
(the point of this ADR), from 8am onward every game on that date rendered its
score plainly — games that had not been played when the user agreed to anything.
It got the other half wrong too: the day actually being watched at 1am was never
recorded, so it re-sealed at 8am, which is precisely the fiction
`spoiledDays.js` exists to end. One line, both directions wrong.

The fix is `gameDayAt` (`src/lib/scoresUnlocked.js`): the day a pass started now
covers, measured on the same 8am-to-8am boundary the expiry already used, so
midnight-to-8am resolves to YESTERDAY. `enable` and `disable` both go through it,
which also makes a consent given at 11pm still walk-back-able at 1am. The unit
test that pins it is stated as a RELATIONSHIP between the two functions — a pass
started now must expire at the END of the day it records, at every hour — because
the bug was never in either function alone, it was in the pairing.

**And the switch could not say so.** `aria-checked` and the on-state reported
`passActive`, the local pass; the slate renders on `spoilersOffFor(date)`, which
is `passActive || the day was consented to`. Whenever the second held without the
first, the switch read "off" over a slate full of live scores and its only
affordance was a tap that opened the consent sheet for a day already consented
to. It now reports the effective state and re-seals in that state, naming the
date on screen (`disable(alsoDay)`).

That second half matters beyond the boundary bug, which is why it stayed after
the boundary bug was fixed: **cross-device sync reaches the same state by
design.** The pass is device-local, but the day map syncs (the amendment above),
so a consent on the phone unseals today's slate on the laptop with no pass there.
That is the intended durability, and the note the slate shows on consent — "Live
scores stays on this device" — is true of the pass and not of its effect. The
switch now tells the truth on the second device and can take the day back from
it. The in-game banner deliberately keeps the older rule (no banner without a
live pass, ADR text above): consent lives on the slate, so the off switch does too.

## Known gaps (deliberately recorded, not yet closed)

- **The sync component itself is untested end-to-end.** Its merge logic is pinned
  by unit tests and the endpoint now has request-level coverage against the Node
  shape Vercel really passes (`test/api-handlers.test.js`), but the actual
  two-device round trip needs a Clerk-configured deploy, which the dev sandbox
  has no way to stand up. Watch the first real sign-in.
  - The first deploy of this endpoint 500'd on every request, along with
    `api/copy.js` and the long-shipped `api/reveal.js`: all three were written
    against the Web fetch request shape while declaring the Node runtime. See
    ADR-0022's amendment and `api/_lib/nodeHandler.js`. The reason it wasn't
    caught pre-merge is worth remembering — the smoke test called the handler
    with a `Request`, which is not what production passes.
- **No marker for a locked-in day.** A past day you spoiled renders open with
  nothing indicating that you're the reason. Correct (there's nothing to switch
  off) but a quiet note on that day's slate might read better than silence.
