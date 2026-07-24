# Follow Live — the fourth reveal-ratchet source

> **SUPERSEDED by ADR-0026 (2026-07-24), before either shipped to `main`.**
> Follow Live no longer exists as a separate feature. It was folded into the one
> spoilers-off pass, and in the process it stopped being a ratchet source at all.
>
> **Why it was merged.** The two features were split on the theory that you might
> want one without the other: peek at scores while still hand-scoring a game, or
> follow one game live without spoiling the rest of the slate. The owner's
> correction was that the second half of that isn't how baseball is actually
> watched — nobody goes home from the ballpark and hand-scores four more
> three-hour games, so "follow this one game but keep the others sealed" is a
> case that doesn't occur. One switch, meaning "I'm fine seeing today", covers it.
>
> **Why the ratchet went away with it.** This ADR's central claim was that
> following live is a *real* reveal and so must advance the persisted mark. Under
> a single site-wide pass that claim dissolves: everything already renders open
> via `effectiveReveal`, so there is nothing left for a ratchet to advance. All
> that remained of Follow Live was auto-navigation to the newest half, the
> tightened poll, and the caught-up status — none of which touch the mark. The
> result is strictly safer than what this ADR proposed: the one mechanism that
> could have permanently corrupted the persisted ratchet, and synced that
> corruption to every device, no longer exists.
>
> **What survived, and where it lives now:** `src/api/liveEdge.js`
> (`selectLiveEdge`, now a navigation input gated on the pass rather than a
> per-game flag), `FOLLOW_POLL_MS` in `useGameData.js`, the caught-up status
> (`scoresUnlocked.liveEdgeLabel`), and the auto-nav guard in `InningViewer`. All
> are documented in **ADR-0026**.
>
> **What was deleted:** `useFollowLive.js`, the `bbsbh:followLive:{gamePk}` key,
> the masthead Follow Live toggle, the second consent modal and its whole
> `followLive.*` copy group, and the `follow_live` / `ingame` analytics enums.
>
> The record below is kept as written, for the reasoning — not as a description
> of the code.

---

ADR-0026 added Scores Unlocked, a site-wide ephemeral render override. This is
the second spoiler departure: **Follow Live**, a per-game, opt-in mode that keeps
advancing your reveal to the game's live edge as it is played. It is the mirror
image of Scores Unlocked in one crucial way — it is a *real* reveal, not a render
trick — so it needs a different design.

## The decision

- **A fourth ratchet source, through the one gate.** The reveal high-water mark
  already advances from three sources: a tap, another tab's `storage` event, and
  a signed-in device's cloud sync — all funnelled through `mergeRevealedThrough`
  → `mergeMark`, which only ever moves the mark forward. Follow Live is the
  fourth: on every fresh feed, `InningViewer` computes the live edge and calls
  the SAME `mergeRevealedThrough`. It never sets the mark directly, never moves
  it backward, and never bypasses the ratchet. So what Follow Live reveals is a
  genuine reveal — it persists, syncs across devices (ADR-0022), and stays
  revealed when you turn the mode off. That is the intended behavior: "hand the
  pencil to someone who refuses to look away."
- **A spoiler-safe live edge.** `selectLiveEdge` (`src/api/liveEdge.js`) reports
  only how far the *game* has progressed — the half-index of the most recent
  play — never a run or score. It is not a reveal-only module (ADR-0001): it
  reads inning numbers and which half, and it is consulted only when the user has
  explicitly opted to follow. Two guards keep it honest: it returns null unless
  `following === true` (a bare truthy flag is not consent), and null before first
  pitch or on empty/malformed play data — and `mergeMark` drops a null, so a null
  edge is a no-op. It returns a **finite** half-index, never Infinity, and is
  clamped by the linescore so a stray future-half play can't over-advance.
- **The flag is an expiry, not a bare boolean.** `useFollowLive` stores the next
  local 8am as an epoch-ms expiry under `bbsbh:followLive:{gamePk}`, parsed by
  the same fail-closed `isUnlocked` predicate the Scores Unlocked pass uses. This
  makes the `followLive.resetNote` consent promise — "no matter what, by {time}…
  nothing stays unsealed into tomorrow on its own" — literally true even for a
  game that is suspended before Final: a stale flag reads as not-following the
  next day. The usual clear is more immediate: `InningViewer` calls
  `stopFollowing()` once the game is Final, so a "following" state never lingers
  into a later re-view.
- **Consent-gated, off is free.** Turning Follow Live ON goes through the shared
  `ConsentModal` (`group="followLive"`), the one place the spoiler trade is made
  explicit. Turning it OFF is immediate — no consent needed to return to your own
  pace, and it never un-reveals what already ratcheted. Confirm/dismiss emit the
  score-free `toggle_consent` analytics event (ADR-0028).
- **The existing poll, tightened while following.** Follow Live adds no new
  timer: it rides `useGameData`'s existing Live feed poll, and each fresh feed
  object re-runs the merge effect. What it *does* change is that poll's cadence —
  `useGameData(game, followLive)` swaps `FEED_POLL_MS` (60s) for `FOLLOW_POLL_MS`
  (**15s**) while following. The design spec recommended shipping at 60s; that
  recommendation was made before the caught-up state existed. A follower pinned
  to the frontier half is *watching* that half, and pitches land every ~20s, so
  60s leaves it looking frozen between polls. The cost is scoped to exactly the
  game the user consented to follow — an ordinary live game left in the
  background still polls at 60s — so the extra network/battery is only spent
  where it was asked for. `NetworkOnly` for `statsapi.mlb.com` (ADR-0004) means
  each of those polls is a real fetch; no cache can serve a stale (or a newer)
  edge.
- **A caught-up state, not a dead "Next".** While following, the frontier half
  often *is* the half on screen: everything played is revealed and there is no
  next half yet, so the floating bar's forward action would point at a half that
  hasn't happened. `InningViewer` swaps it for a calm live status
  (`followLive.liveEdgeLabel`, whose `{inning}` token is filled with the
  structural label of the half already on screen — never a score; see
  `registry.js`'s TOKENS spoiler guard). It reads the same consent-gated
  `selectLiveEdge` the merge effect does, and yields the instant the game goes
  Final or the user pages back off the frontier.
- **Composes with Scores Unlocked.** Both can be on. Follow Live raises the
  persisted reveal FLOOR (a real ratchet); `effectiveReveal` raises the render
  CEILING (an ephemeral override). They act on different values and never fight —
  the render path reads `renderRevealedThrough`, the ratchet path the real mark.

## Why this is a bounded, honest departure

The seal still lifts only after an explicit consent tap, and only for the one
game the user chose to follow. The live edge carries no score. The advance goes
through the same forward-only ratchet as every other reveal, so there is no new
way for the mark to move — only a new, consented reason for it to move forward.
And the flag's 8am expiry means the mode can't quietly persist into a day the
user hasn't re-consented to.

## Cost accepted

Follow Live, like Scores Unlocked, has **no server component** — it is
client-only (localStorage + the existing feed poll), so it is not a "no backend"
exception. It does auto-navigate the innings view for a caught-up follower
(guarded so a paged-back reader is left alone, and `replace:true` so Back is not
polluted); that guarded auto-nav is deletable in isolation if live use shows it's
twitchy. See ADR-0026 for Scores Unlocked, the render-override sibling.

## Known gaps (deliberately recorded, not yet closed)

- **The consent copy doesn't name the cross-device propagation.** Because Follow
  Live advances the *real* mark, a signed-in user's other devices ratchet forward
  with it (ADR-0022). That is the correct behavior, but the design spec required
  it be stated in the consent modal for a signed-in user — "your reveal point
  also advances on your other signed-in devices" — and no such line exists in the
  registry or the modal today. Until it does, the one effect of Follow Live that
  escapes the device is unconsented in the strict sense. Closing it needs a new
  `followLive.syncNote` registry field plus a signed-in-only slot in
  `ConsentModal` (the modal renders a fixed slot list per group today).
- **No "jump to live" affordance for a paged-back reader.** The auto-nav
  deliberately leaves a user who has paged back to re-read an earlier half where
  they are, and the caught-up status only shows when they're already at the
  frontier. The spec's answer to that was a small "Live: Bot 7 ›" chip that jumps
  forward; it isn't built, so a paged-back follower has to navigate manually.
- **No live-game browser verification yet.** `selectLiveEdge`, the merge, and the
  auto-nav guard are pinned by the pure suites, but the auto-advance has not been
  watched against a real in-progress game, and there is no
  `e2e/invariants/follow-live.spec.js`. Do that before treating the auto-nav feel
  as settled.
