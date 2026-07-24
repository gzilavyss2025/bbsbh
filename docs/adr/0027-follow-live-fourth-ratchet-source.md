# Follow Live — the fourth reveal-ratchet source

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
- **Interval refresh is the existing poll.** `useGameData` already re-fetches a
  Live game roughly every 60 seconds; each fresh feed object re-runs the merge
  effect, so Follow Live needs no new timer. A second-screen follower doesn't
  need sub-minute latency.
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
