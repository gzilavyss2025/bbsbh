# Toggle-consent analytics — measuring the spoiler departures, without a score

ADR-0026 (Scores Unlocked) and ADR-0027 (Follow Live) add two opt-in ways to
lift the spoiler seal, each gated by a consent modal. The site owner wants to
know how those land: how often each toggle is confirmed vs. declined, and from
which surface. This records that — and nothing else.

## The decision

- **One event, three coarse props.** `src/lib/analytics.js` emits a single
  `toggle_consent` event via Vercel Analytics' `track`, with exactly three
  enumerated props: `toggle` (`scores_unlocked` | `follow_live`), `action`
  (`confirm` | `dismiss`), and `surface` (`slate` | `ingame`). One event name
  with an `action` prop gives one confirm/decline funnel per toggle in the
  dashboard, rather than a sprawl of event names.
- **An allowlist choke point.** `buildToggleEventProps` validates each of the
  three against its enum and rebuilds the payload from scratch — it never spreads
  the caller's input — so only the three known keys can ever be emitted, and a
  malformed call returns null and fires nothing. This mirrors the copy store's
  `sanitizeOverrides`: the safety property is structural, not a matter of every
  call site remembering to be careful.
- **Fired at the two consent handlers.** GameSelect's Scores Unlocked modal and
  GameView's Follow Live modal each call `trackToggleConsent` on confirm and on
  dismiss. No off-switch event (turning a toggle back off) — out of scope; it
  would need an added `action` enum value and a test, and can come later.

## Why this doesn't leak a score (and doesn't contradict Task F)

The Scores Unlocked consent copy promises the pass "does not track or advance
your by-hand scoring". That is about the **reveal mechanism** — no reveal mark is
recorded, persisted, or synced by the pass. This event is a separate thing:
anonymous, aggregate **chrome** telemetry about whether a button was tapped. It
is score-free *by construction* — there is no gamePk, no score, no inning, and no
`revealedThrough` anywhere in the allowlist, and `buildToggleEventProps` drops
any such key a caller might pass. `test/analytics.test.js` pins exactly that: a
call laden with `gamePk`/`score`/`revealedThrough` emits only the three coarse
props. The two statements are compatible: we never track *what you're scoring*;
we do count *how often the toggle is used*.

## Cost accepted

`@vercel/analytics` is already a dependency and `<Analytics/>` is already mounted
(`src/main.jsx`) — no new dependency, no new mount. `track` is a no-op unless the
app is running on a live Vercel deploy, so dev, tests, and any self-host emit
nothing. A telemetry failure is swallowed in a try/catch so it can never break a
user's toggle action.
