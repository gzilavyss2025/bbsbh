# Scores Unlocked — an ephemeral render override, never a persisted reveal

ADR-0025 landed the copy store that both new spoiler departures share. This is
the first of the two departures themselves: **Scores Unlocked**, a site-wide,
opt-in "day pass" that un-gates every score for TODAY only, after an explicit
consent tap, and resets on its own at 8:00am local.

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
- **8am local, and honest about it.** The consent copy (Task F, registry
  `scoresUnlocked.*`) states plainly that turning the pass on does not track or
  advance your by-hand scoring — it only shows today's numbers — and that *no
  matter what*, at the reset time the app returns to sealed-by-default. The
  reset is an expiry timestamp, not a flag someone has to remember to clear.
- **All of today on the slate; anything you open in-game.** The two surfaces are
  scoped differently, deliberately. The **slate** line is gated on
  `scoresUnlocked && isToday`: today's games show score + inning from a separate,
  toggle-gated fetch whose data never touches the default slate model (the
  default stays byte-identical and score-free), while a paged-back past day keeps
  its own tap-to-reveal-all treatment rather than being unsealed by a pass turned
  on for today. **In-game**, the render override is *not* date-gated: any game
  opened while the pass is live renders every half unsealed, and the box score
  with it (`BoxScore.jsx` hands the pass to `SealBox`'s existing `forceRevealed`,
  so the consent copy's "no seals, no tapping" holds for every score surface
  inside a game, not just the innings view). That asymmetry answers the spec's
  open question §11 Q1 in favor of the simpler mental model — "while the pass is
  on, nothing I open is sealed". A stricter today-only in-game rule would hand a
  user seals again on yesterday's game mid-pass with no explanation, which reads
  as a bug. The window is bounded by the same expiry either way, and the banner
  is itself the off switch.

## Why this doesn't violate the spirit of the spoiler rule

- **Consented and time-scoped.** A score DOM node appears only after an explicit
  tap on a consent modal that names the exact trade, and only inside the pass's
  window; the expiry guarantees it does not survive into tomorrow. The scope is
  *the window*, not the calendar date of the game being viewed — see the
  slate/in-game split above.
- **The default path is byte-identical.** With the pass off, `effectiveReveal`
  is the identity, the slate carries no score fields, and every sealed surface
  behaves exactly as before. Nothing about the feature changes the app for a
  user who never flips it on.
- **Nothing persists, nothing propagates.** The override is render-local. It is
  never merged into the ratchet, never written to `localStorage`'s reveal key,
  and never sent to the cloud sync — so it cannot leak past the session, the
  device, or the day. The one thing stored is an expiry timestamp, which carries
  no game information.
- **Fails closed by construction.** Every path that could go wrong — a mangled
  storage value, a suspended timer, a clock skew, a value from a past day —
  resolves to "sealed", never "unlocked".

## Cost accepted

Scores Unlocked has **no server component** — it is pure client state
(`localStorage` + render), so it is deliberately absent from the Architecture
"no backend" exceptions list (only the copy store it shares with Follow Live,
ADR-0025, is a backend exception). It does widen the DOM contract: for the first
time a score-bearing node can exist without a per-value reveal — but only behind
an explicit, expiry-bounded, fail-closed consent. The invariant that protects the
app is no longer "no score in the DOM, ever" but "no score in the DOM except
behind a reveal, a consented pass, or Follow Live" — and the render/persist split
keeps the *persisted* reveal mechanism exactly as strict as it was. See ADR-0027
for Follow Live, the second departure, which unlike this one is a genuine
reveal-ratchet source.

## Known gaps (deliberately recorded, not yet closed)

- **No in-game banner.** The active-pass banner — which is also the off switch —
  exists only on the slate. Open a game (or land on one from a shared link) while
  the pass is on and every seal is lifted with nothing on screen saying why, and
  no way to re-seal without navigating back to the slate. The design spec called
  for the strip on the slate **and** every game view; only half of that shipped.
  This is the largest user-visible gap in the feature.
- **No live-game browser verification yet.** The slate score line and the in-game
  unseal are pinned by the pure suites and by `e2e/invariants/
  scores-unlocked.spec.js` (which holds the never-writes-the-reveal-mark
  invariant), but neither has been watched against a real in-progress game.
