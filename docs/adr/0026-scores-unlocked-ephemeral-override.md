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
- **All of today, both surfaces.** While the pass is on, the slate shows each
  of today's games' score + inning (a separate, toggle-gated fetch whose data
  never touches the default slate model — the default stays byte-identical and
  score-free), and opening any game renders every half unsealed via the render
  override above. The banner is itself the off switch.

## Why this doesn't violate the spirit of the spoiler rule

- **Consented and scoped to today.** A score DOM node appears only after an
  explicit tap on a consent modal that names the exact trade, and only for
  today's games; the expiry guarantees it does not survive into tomorrow.
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
an explicit, today-scoped, expiry-bounded, fail-closed consent. The invariant
that protects the app is no longer "no score in the DOM, ever" but "no score in
the DOM except behind a reveal, a consented pass, or Follow Live" — and the
render/persist split keeps the *persisted* reveal mechanism exactly as strict as
it was. See ADR-0027 for Follow Live, the second departure, which unlike this
one is a genuine reveal-ratchet source.
