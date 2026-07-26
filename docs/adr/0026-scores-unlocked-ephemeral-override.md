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
