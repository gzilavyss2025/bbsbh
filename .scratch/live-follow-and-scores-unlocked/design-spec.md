# Design spec: Follow Live + "Just show me the scores" (today-scoped)

Status: ready-for-human
Type: design spec / feature proposal (no implementation in this PR)

Two related, **opt-in departures** from the spoiler rule:

1. **Follow Live** — a per-game toggle that auto-advances `revealedThrough` to
   the live edge of a game in progress and keeps it there as new halves start,
   behind an explicit "yes, this may spoil the outcome" confirmation.
2. **Scores Unlocked** — a site-wide "I'm just checking today's scores" toggle
   that un-gates everything (slate and game surfaces show scores plainly),
   auto-resetting at the next 8:00am **local** time.

---

## 1. Summary, goals, non-goals

**Summary.** Today every score-revealing value is sealed until a deliberate
per-half tap (`SealBox`, ADR-0002), the reveal high-water mark
(`revealedThrough`) only ratchets forward (`src/hooks/revealProgressCore.js:38`
`mergeMark`), and the only sanctioned unsealed score surfaces are narrow ADR'd
exceptions (ADR-0015 Game Score, ADR-0019 All-Star Rosters). This feature adds
two *user-consented* ways to skip the tap: a per-game live-following mode that
drives the existing ratchet to the game's live frontier on the existing 60s
feed poll, and a global, self-expiring "everything revealed" day pass.

**Goals.**
- Both modes are strictly opt-in, obviously on, trivially reversible, and
  scoped so they cannot leak into the default experience, another device
  (except where explicitly consented), a shared link, or a later day.
- Reuse the existing machinery rather than building a second reveal system:
  Follow Live is *a fourth source feeding the one existing ratchet* (tap,
  cross-tab `storage` event, cloud sync, and now the live edge); Scores
  Unlocked is *an ephemeral render-time override* that never touches the
  persisted mark.
- A user who never opts in gets a byte-identical DOM experience — provable by
  the existing CI-gated spoiler tests plus new ones (§8).

**Non-goals.** No push notifications; no data-entry; no partial "follow but
hide the score" hybrid (following live *is* consenting to spoilers); no
per-half granularity controls inside Follow Live; no server persistence of
either toggle (§3); no change to the OG/link-preview layer (ADR-0012 already
never renders a score and reads no client state); no change to the All-Star /
Game Score / Photos exceptions.

---

## 2. Mapping onto existing machinery

### 2a. Follow Live

**What advances.** `revealedThrough` itself, through the existing one-way
ratchet. `useRevealProgress` already exposes `mergeRevealedThrough`
(`src/hooks/useRevealProgress.js:78`) as "the only way an externally-sourced
value reaches local state", used by both the cross-tab `storage` listener and
`RevealCloudSync`. Follow Live becomes one more caller of that same function.
Because every downstream gate reads `revealedThrough` exclusively —
`InningPage`'s `revealed = idx <= revealedThrough`
(`src/screens/innings/InningPage.jsx:56`), the Pitchers table (ADR-0009,
`computePitcherLines(feed, revealedThrough)` in `InningViewer.jsx`),
`RollingLine`, extras unlock (`unlockedInnings`,
`src/hooks/revealProgressCore.js:44`), the entering lineup/defense cards
(ADR-0010, `safeToShowEntering` in `src/api/enteringHalf.js:28`) — advancing
the mark automatically un-gates everything consistently, with zero new
per-surface wiring and zero new spoiler boundaries (the exact lesson of
ADR-0016: don't mint a second boundary).

**What computes the live edge.** A new selector, proposed as
`selectLiveEdge(feed, followLiveEnabled)` in a new module `src/api/liveEdge.js`:

- Primary source: the last entry of `feed.liveData.plays.allPlays` (the array
  is chronological — already relied on by `forEachEventBeforeFirstPitch`,
  `src/api/enteringHalf.js:57`) → `about.inning` / `about.halfInning` →
  `halfIndex(inning, half)` (`src/api/select.js:123`). "The half that has
  plays" is exactly what a live follower wants revealed: `revealedThrough` at
  that index makes `InningPage` render it unsealed and `PlayByPlay` shows the
  plays so far; each 60s poll appends new plays into the same
  already-revealed half.
- Cross-check/fallback: `feed.liveData.linescore.currentInning` +
  `isTopInning` (the same fields the hydrated schedule rows read,
  `src/api/schedule.js:344,382`). Prefer `allPlays`: the linescore's
  `inningState` flips to Middle/End between halves and can point one half
  ahead of the first pitch. Take the `min` when both resolve; degrade to
  `null` (no advance) on a lean MiLB feed with an empty `allPlays`.
- Returns `null` unless `selectHasStarted(feed)` (`src/api/select.js:653`).

**Module classification.** `selectLiveEdge` reads no runs/hits/errors, but its
*return value* is spoiler-bearing structure: an index past `regulation`
reveals the game went to extras (exactly what ADR-0008 hides), and "how far
along the game is" is itself information. So it must not live in `select.js`
(spoiler-free), and it isn't reveal-only in the ADR-0001 sense either (no
SealBox in this flow). Proposal: a **consent-gated module** — a third
classification alongside spoiler-free and reveal-only, mirroring how
`enteringHalf.js` documents its caller contract. Enforce mechanically the way
`defenseEntering` does: the function takes the consent flag and returns
`null` unless it's true, so an ungated call site is inert rather than trusted.

**Polling.** No new poller. `useGameData` already auto-refreshes the feed
every 60s while Live (`FEED_POLL_MS`, `src/hooks/useGameData.js:44,197-205`)
and refetches on foreground (`refetchOnForeground: true`, line 69). Each poll
mints a new `feed` object, which already rebuilds the derived cache (ADR-0007)
and re-renders `PlayByPlay`. Follow Live only needs an effect in
`InningViewer`: on each new `feed`, if following,
`mergeRevealedThrough(selectLiveEdge(feed, true))`. Optional refinement: 30s
while following (a `followLive ? FOLLOW_POLL_MS : FEED_POLL_MS` branch);
recommend shipping at 60s — statsapi updates within seconds of a pitch, and a
second screen doesn't need pitch-level latency.

**No stale-cache spoiler risk.** ADR-0004's `NetworkOnly` for
`statsapi.mlb.com` (`vite.config.js:272-273`) means every poll is a real
network fetch; no SW cache can serve an old edge — or a *newer* cached one
after the user turns following off.

**Auto-navigation.** Advancing the mark un-gates halves, but the URL drives
which half shows (`src/App.jsx`; `InningViewer`'s `onInning`). When following
and the edge advances: if the user is currently *at the previous frontier
half*, navigate to the new frontier via
`onInning(inning, half, { replace: true })` — the same replaceState path the
out-of-range-URL normalizer uses in `InningViewer.jsx` — so 14 half-innings
of following don't pollute Back. If the user has paged back to re-read an
earlier half, do **not** yank them; show a small "Live: Bottom 7 ›" chip that
jumps to the frontier. Auto-advance goes straight through `goTo`, not the
animated page turn (ADR-0024) — an animation firing while the phone sits on a
table is noise (open question §11).

### 2b. Scores Unlocked (today only)

**The override, not the ratchet.** The global flag produces an **ephemeral
render-time override** and must never write through to persisted state:

- In `InningViewer`:
  `const effectiveRevealedThrough = scoresUnlocked ? Infinity : revealedThrough`,
  threaded to every consumer that currently takes `revealedThrough`
  (`InningPage`, `computePitcherLines`, `RollingLine`, the `unlocked`
  recompute, `StatBox`'s clamps, `selectPrePitchChanges`,
  `defenseEntering`/`lineupEntering` — whose `Infinity` cutoff path already
  exists for the box score, ADR-0010). `SealBox` already supports this via
  `forceRevealed` (`src/components/SealBox.jsx:31,38`), used today by
  `StatBox.jsx:71,200` and `HalfInning.jsx:230`. Children stay a
  lazily-invoked render function, so ADR-0001/0002's "reveal-only code runs
  only in the revealed branch" holds unchanged — the toggle flips *which
  branch renders*, not the branching mechanism.
- The user's genuine hand-revealed mark stays whatever it was. When the
  toggle expires at 8am (or is turned off), seals return exactly where they
  were. This makes the toggle honestly reversible — which "advance the
  ratchet to Infinity" could never be: the ratchet forbids regression by
  design, and the cloud mirror (ADR-0022) would propagate it to every device
  forever.
- Corollary: **taps made while unlocked do not advance `revealedThrough`
  either** — there are no seals to tap; `SealBox`'s `onReveal` already
  distinguishes force-revealed mounts from taps. Stated in the confirm copy:
  "while scores are unlocked, your scoring progress isn't being tracked."

**Slate.** Reuse the existing past-day machinery rather than building a
second result surface. `GameSelect` already has the flip-card result
treatment for Final games (`PastGameFlipCard`/`GameResultFace`, gated by
`showPastDayTreatment` + the one-tap `revealedAll`,
`src/screens/GameSelect.jsx:232,242`) and `useDayCardMeta`'s batched
classification pass. When `scoresUnlocked`:
- Treat today as `showPastDayTreatment = true` with `revealedAll` forced on —
  Final games flip to result faces with no tap.
- Live games get a new, small live-line on `GameCard` (e.g.
  `MIL 4 – AZ 2 · BOT 7`). `GameCard` is deliberately score-free today
  (`src/components/GameCard.jsx:12-16`) and the default slate fetch's
  `fields=` allowlist (`src/api/schedule.js:300`) carries **no score fields**
  — keep both. Add a separate `fetchSlateScores(dateStr, sportId)` in
  `schedule.js` using the score-bearing field set that already exists
  (`SEASON_SERIES_FIELDS`, `src/api/schedule.js:344`: `score`, `linescore`,
  `currentInning`), called **only while the toggle is active**, merged into
  cards by gamePk, re-polled on the slate's existing live-refresh cadence.
  The default fetch stays byte-identical — defense in depth: the invariant is
  about DOM, but a score-free default *payload* means a render-gate bug has
  nothing to leak.
- Top Performers / day recap follow the forced-`revealedAll` path they
  already have for past days (ADR-0011's keyed SealBox takes
  `forceRevealed`).

**"Today only" + the 8am reset.** The stored value is not a boolean but an
**expiry**: enabling computes the next 8:00am local and stores it; every read
compares `Date.now()` and treats a past expiry as "off" (deleting the key).
In a pure module (`src/lib/scoresUnlocked.js`) for unit tests:

```js
export function nextResetAt(now = new Date()) {
  const e = new Date(now)
  e.setHours(8, 0, 0, 0)          // local clock; DST handled by Date itself
  if (e <= now) e.setDate(e.getDate() + 1)
  return e.getTime()
}
export function isUnlocked(rawExpiry, now = Date.now()) {
  const t = Number(rawExpiry)
  return Number.isFinite(t) && t > now && t - now <= MAX_WINDOW_MS // §7
}
```

Enforcement points: (a) on read in the hook's `useState` initializer, like
every existing preference hook; (b) a `setTimeout` scheduled for
`expiry - now` so an open tab re-seals at 8:00:00 without a reload; (c) on
`visibilitychange`/foreground (the spirit of `refetchOnForeground`) so a tab
backgrounded overnight re-checks the moment it's foregrounded — mobile Safari
throttles/suspends timers, so (c) is mandatory, not a nicety.

---

## 3. State & persistence

New localStorage keys (`bbsbh:`-prefixed, matching `bbsbh:reveal:{gamePk}`,
`bbsbh:keepAwake`, `bbsbh:gameScoreVisible`):

| Key | Value | Lifetime |
| --- | --- | --- |
| `bbsbh:followLive:{gamePk}` | `'1'` | Per game. Written on confirm; deleted when the user toggles off **and** when the feed goes Final (`selectIsFinal`), so a stale flag can't linger. Per-gamePk scoping means it can never bleed to another game. |
| `bbsbh:scoresUnlocked` | expiry epoch-ms (string) | Until 8:00am local. Deleted on read-when-expired, on manual toggle-off, and clamped by `MAX_WINDOW_MS` (§7) so a hand-mangled far-future value can't create a permanent unlock — the same "malformed storage can never over-reveal" posture as `parseRevealMark` (`src/hooks/revealProgressCore.js:15`). |

Two new hooks in `src/hooks/`, shaped like `useKeepAwakePreference.js`
(try/catch storage, in-session degrade) plus a `storage` listener like
`useRevealProgress.js`'s so a second same-device tab picks up enable/disable
live. Parse/expiry/edge logic lives in pure React-free modules
(`src/lib/scoresUnlocked.js`, `src/api/liveEdge.js`) for the unit suite,
mirroring the `revealProgressCore.js` split.

**Cloud sync (ADR-0022) — recommendation: both toggles stay local-only;
Follow Live's *effect* syncs; Scores Unlocked's must not.**

- *Follow Live:* the mark advances through the real ratchet, so
  `RevealCloudSync` (`src/components/RevealCloudSync.jsx:57-80`) will POST
  each advance for a signed-in user, and their iPad ratchets forward too.
  This is **correct** — a revealed half is revealed; the server/client
  ratchets (`max(current, incoming)`) need no changes — but it must be named
  in the consent copy: "this also advances your reveal point on your other
  signed-in devices." Suppressing POSTs for machine-advanced marks would make
  devices lie to each other about what's been seen.
- *Scores Unlocked:* nothing syncs — the override never touches
  `revealedThrough`, so `RevealCloudSync` never fires. Do **not** add a
  synced "unlocked" flag: 8am *local* differs per device timezone, and a
  desktop enabling it must not silently unseal a phone. Local-only also
  bounds any bug's blast radius to one device for one morning.
- The toggles themselves don't sync because neither is durable scoring
  progress — one is per-game-transient, one expires in hours. ADR-0022's
  scope ("never a score, only the high-water mark") stays intact with zero
  `api/reveal.js` changes.

---

## 4. Confirmation / consent UX

Both toggles get an explicit confirm; neither activates from a single tap on
the toggle itself.

**Follow Live modal** (pattern: existing modals, e.g.
`FavoriteTeamModal`/`GameScoreModal`):
- Title: "Follow this game live?"
- Body: "Tally will reveal every half-inning as it happens and keep advancing
  to the newest play — including the score, and including extra innings.
  There's no way to re-seal what gets revealed." Signed-in addendum (only
  when `isClerkEnabled` and signed in): "Your reveal point also advances on
  your other signed-in devices."
- Buttons: dismiss first and default-focused ("Keep scoring by hand"),
  affirmative second, *not* auto-focused, unambiguous: "Follow live —
  spoilers OK". No "don't ask again": consent is per game, which is what
  keeps it meaningful. Turning *off* needs no confirm — off is always safe.

**Scores Unlocked modal** — yes, it needs the same gate; it's the more
destructive toggle (the whole slate, every level):
- Title: "Show today's scores?"
- Body: "Every score on the slate and in every game shows plainly — no seals,
  no taps. Your hand-scoring progress isn't tracked while this is on. Scores
  seal back up automatically at 8:00 AM, or turn it off anytime."
- Same button order/focus discipline. The affirmative states the expiry:
  "Unlock scores until 8:00 AM".

Accidental-tap defenses: the confirm modal itself; affirmative never
default-focused; the site-wide toggle lives behind a header/menu affordance
rather than a bare inline switch (§5); e2e fixtures never pre-enable either
flag (same discipline as `?nointro`, `e2e/fixtures.js`).

---

## 5. UI surfaces

**Follow Live toggle** — `GameView`'s masthead, exactly where
`KeepAwakeToggle` sits and with its gate (`{isLive && …}`,
`src/screens/GameView.jsx:345`): only rendered while the game is Live, so it
can't be armed pre-game or post-Final. Natural neighbors — a live follower
almost certainly wants the screen awake too (§11).

*Following state:* an unmissable persistent strip under the masthead on the
innings view — kraft-amber (the seal color: visually "the seal is off") —
`● FOLLOWING LIVE — SPOILERS ON · Turn off`. The strip *is* the off switch.
On turn-off, the strip drops and normal sealing resumes from the current
mark; the confirm already warned that what's revealed stays revealed.

**Scores Unlocked toggle** — two placements:
- Entry point: the slate header's settings surface, alongside the Game Score
  visibility preference (`SiteFooter`/`FavoriteTeamModal`,
  `src/screens/GameSelect.jsx:~537`), plus a compact slate-header "Scores"
  affordance — "just checking in" users won't dig into a footer.
- Active state: a site-wide banner strip atop the slate **and** every game
  view: `SCORES UNLOCKED UNTIL 8:00 AM · Turn off` — always the concrete
  expiry time, same kraft-amber treatment, and the banner is the off switch.
  Turning off restores all seals instantly (the override is ephemeral, §2b —
  this reversibility is the feature's best property; surface it).

Both strips use existing semantic tokens (`--seal-cover` family) and the
condensed-uppercase structural-label role; no new raw hex or ad hoc type
(`check-typography.mjs`, `check-caps.mjs`, `check-contrast.mjs` enforce).

---

## 6. Spoiler-safety invariants (the load-bearing section)

Guarantees for a user who opts into neither:

1. **No new unsealed DOM by default.** Both features are gated on flags that
   default absent. `selectLiveEdge` returns `null` without the consent
   argument; `effectiveRevealedThrough` is identically `revealedThrough` when
   the flag is off; `fetchSlateScores` is never called; the default slate
   `fields=` allowlist is unchanged. The existing e2e spoiler net
   (`e2e/invariants/spoiler-dom.spec.js`, `extra-innings-gating.spec.js`,
   `reveal-persistence.spec.js`) and the CI-gated unit suite
   (`test/spoiler-gates.test.js`, `test/reveal-only.test.js`,
   `test/invariant-real-game.test.js`) must pass with **zero edits** — any
   loosening of an existing assertion is a design failure per the root
   `CLAUDE.md` test-discipline rule.
2. **Reveal-only modules keep their contract.** `linescore.js`/`derive.js`/
   `highlightsByPlayId` are still invoked only inside a SealBox revealed
   branch. `forceRevealed` is already an established input
   (`StatBox.jsx:71`); it changes *when* that branch renders, not the
   lazy-render-function mechanism (ADR-0002). No reveal-only export gains a
   call site outside a reveal render path.
3. **The persisted ratchet is never corrupted.** Scores Unlocked never writes
   `revealedThrough` (unit-pinned: enable + render + expire leaves
   `bbsbh:reveal:{gamePk}` and the cloud mark untouched). Follow Live writes
   only real, finite half-indexes derived from actual plays through
   `mergeMark` — never `Infinity`, never past the last played half.
4. **Scope can't leak across users/devices/links.** Both flags are
   localStorage-only: never a URL param or route (`src/lib/route.js`
   untouched), never visible to the OG/preview layer (`api/og.js`/
   `api/preview.js` run server-side off the URL alone, render no score by
   ADR-0012, and can't see localStorage). A link shared from an unlocked
   session is byte-identical to one shared sealed. `/api/reveal` gains no new
   fields.
5. **Scope can't leak across time.** `bbsbh:scoresUnlocked` stores an expiry
   validated on every read with the `MAX_WINDOW_MS` clamp (≤ 26h, §7);
   expiry deletes the key; a device that slept through 8am re-seals on
   foreground via the `visibilitychange` check. `bbsbh:followLive:{gamePk}`
   clears on Final and is per-gamePk regardless.
6. **Malformed storage fails sealed.** Every parse collapses garbage to
   "off" (same posture as `parseRevealMark`/`parseAtBatMark`): non-numeric or
   over-window expiry → locked; any followLive value other than `'1'` → not
   following.
7. **Extras (ADR-0008).** Default users: unchanged — `unlockedInnings` still
   gates on the real mark. Follow Live consciously reveals extras as they
   happen (that *is* the consent). Scores Unlocked computes `unlocked` from
   `selectInningCount` under the override, and from `regulation` + the real
   mark the instant it's off.
8. **Fetch posture.** Fetching alone was never the invariant (the feed always
   contains scores; the DOM is the boundary), but the two payloads that are
   deliberately score-free today — the default slate schedule and the OG
   layer — stay score-free; score-bearing slate data rides a separate,
   toggle-gated fetch.

---

## 7. Edge cases

- **Not started (Preview).** Follow Live toggle not rendered (`isLive` gate,
  `GameView.jsx:71,345`). If the feed regresses into a delay mid-follow,
  `selectLiveEdge` simply stops advancing; `DelayCard`/`selectGameStatus`
  (`src/api/select.js:696`) already cover messaging.
- **Final.** `isLive` false stops the poll (`useGameData.js:202`); the follow
  effect does one last merge (the Final feed's last half), clears
  `bbsbh:followLive:{gamePk}`, and the strip yields to the existing
  end-of-game "Box score ›" affordance. Postponed reports
  `abstractGameState === 'Final'` (`GameSelect.jsx:222` comment), so clearing
  on Final covers it; a suspended game resuming another day starts over with
  fresh consent.
- **Skipped bottom of the 9th.** The follow edge comes from plays actually
  played, so it never advances into a never-played half;
  `selectSkippedBottomHalf` (`src/api/select.js:682`) stays Final-only. Under
  Scores Unlocked the existing `Infinity`-cutoff box-score paths handle it.
- **Extras interplay.** Follow Live advancing past `halfIndex(9,'bottom')`
  makes `unlockedInnings` open the 10th — the mechanism already works; the
  only "leak" is the consented one. `RollingLine`'s ADR-0008 window-scroll is
  exercised more often; no logic change.
- **MiLB degradation.** Lean feeds may post a linescore with sparse
  `allPlays`; `selectLiveEdge` takes the conservative `min`/null path —
  under-advancing is always safe (the user can still tap). Slate live-lines
  fall back to `—` per the MiLB convention when score fields are missing.
- **Doubleheaders.** Per-gamePk keys separate game 1/2; consent is per game.
- **8am / timezone / DST.** `setHours(8,0,0,0)` on a local `Date` is
  DST-correct by construction (the window is "until the next local 8am" —
  23 or 25 wall-clock hours on transition nights; acceptable, unit-pinned).
  Device timezone change mid-window (travel): the `MAX_WINDOW_MS` clamp
  (recommend 26h) bounds it; not worth more machinery. "Today" on the slate
  is already local (`toApiDate(new Date())`, `GameSelect.jsx:96`), consistent
  with a local reset.
- **Baseball days cross midnight.** A West-coast game ends 1am ET; the user
  checks at 7am — still unlocked (why 8am beats midnight). Enabling at
  7:59am yields a 1-minute window; they can re-enable — not worth
  special-casing.
- **Multiple tabs.** New keys ride the same `storage`-event pattern as
  `bbsbh:reveal:` (`useRevealProgress.js` listener): tab B re-seals when tab
  A turns Scores Unlocked off, and stops following when A stops. Note the
  asymmetry to document in the hook: reveal marks merge forward-only; these
  flags follow the *latest write in either direction* — deliberate, they're
  preferences, not progress.
- **Offline / poll failure.** `useAsync`'s stale-while-revalidate `reload`
  keeps the last-good feed; following pauses at the last edge. No special
  handling.
- **Past dates while unlocked.** Past days already have their own reveal-all
  treatment. Recommendation: the override applies to any game surface viewed
  during the window (simplest mental model) — but see §11.

---

## 8. Testing strategy

Per the test-discipline rule: each behavior lands with a test that fails
without it, in the same PR as the code.

**Unit (CI-gated `node:test`):**
- `test/scores-unlocked.test.js` — `nextResetAt` across evening enable →
  next-morning 8am; 7:30am → same-day 8am; DST spring-forward/fall-back
  nights; `isUnlocked` rejects garbage, past expiries, over-window values.
- `test/live-edge.test.js` — `selectLiveEdge` against the captured real-game
  fixture (`test/fixtures/`): mid-game frontier equals the last play's half;
  `null` without the consent flag, pre-start, and on empty `allPlays`; never
  exceeds the last played half; Final-feed edge equals the final half.
- Extend `test/reveal-progress-core.test.js` — live-edge values through
  `mergeMark` preserve the ratchet; a `null` edge is a no-op.
- **The headline invariant test**, extending `test/spoiler-gates.test.js` /
  `test/invariant-real-game.test.js`: with both flags at defaults, the
  spoiler-free selector surface over the real-game fixture is unchanged (no
  new ungated export returns score-bearing data), and the Scores Unlocked
  path never mutates the mark (enable → render-equivalent selector calls →
  expire → stored mark asserted unchanged).
- `test/route.test.js` untouched (no route changes), plus an assertion that
  neither flag round-trips through `parseRoute`/`buildPath`.

**e2e (Playwright, `npm run e2e`; browser check is not substitutable per root
`CLAUDE.md`):**
- Existing `e2e/invariants/*` pass **unmodified** — the regression net.
- New `e2e/invariants/scores-unlocked.spec.js`: enable via confirm modal →
  slate shows results/live lines → game view unsealed → toggle off → seals
  restored and `bbsbh:reveal:*` unchanged → re-enable, advance the clock past
  8am (`page.clock`), foreground → re-sealed.
- New `e2e/follow-live.spec.js` against a live/recent game
  (`docs/test-games.md` gamePks; `.claude/skills/run.md` loop): confirm
  wording present; frontier half unsealed without a tap; strip visible; turn
  off → the next half stays sealed until tapped. All via `?nointro`
  (`e2e/fixtures.js`).

---

## 9. ADR implications

**New ADRs (proposed):**
- **ADR-0025: "Follow Live advances the reveal ratchet from the live feed
  edge, behind per-game explicit consent."** Records: the fourth ratchet
  source through `mergeRevealedThrough`; `liveEdge.js`'s consent-gated
  classification (neither spoiler-free nor reveal-only); why the mark — not
  an override — is the right vehicle (everything downstream reads it; what's
  been seen live *has been seen*); the deliberate cloud-sync propagation and
  its consent copy; auto-clear on Final.
- **ADR-0026: "Scores Unlocked is an ephemeral, self-expiring render
  override — never a persisted reveal."** Records: why Infinity-through-the-
  ratchet was rejected (irreversible locally; permanent and multi-device via
  ADR-0022); the expiry-not-boolean storage shape and fail-sealed parsing;
  the local-only/no-sync decision; the default slate fetch staying
  score-free with a toggle-gated score fetch.

**Amendments:**
- ADR-0001/0002: note `forceRevealed`'s new global source; render-function
  contract unchanged.
- ADR-0008: extras gain two consented bypasses (ref 0025/0026); default path
  untouched.
- ADR-0022: the mark can now advance without a tap (Follow Live), consent
  copy names the propagation; the toggles themselves are deliberately
  unsynced.
- ADR-0016 (minor): the at-bat staging cursor is inert while unlocked.

**Docs:** root `CLAUDE.md`'s spoiler-rule paragraph currently names one
exception (ADR-0019); rewrite it to name these as the *consented* exceptions —
distinct in kind from ADR-0015/0019 ("safe because the number can't spoil")
because here the user explicitly trades the protection away. `CONTEXT.md`
gains **Follow Live**, **Scores Unlocked**, and **live edge** vocabulary;
`src/CLAUDE.md` (UI-side enforcement list) and `src/api/CLAUDE.md`
(module catalog: `liveEdge.js`'s third classification) get their tier
updates, per the doc-tier rule.

---

## 10. Rollout / phasing

**Phase 1 — Scores Unlocked** (smaller; no polling changes; self-contained):
1. `src/lib/scoresUnlocked.js` + hook + unit tests (pure logic first).
2. Game-view override threading (`effectiveRevealedThrough`) + banner strip +
   confirm modal.
3. Slate treatment (forced past-day path + `fetchSlateScores` + live line).
4. e2e spec; ADR-0026; doc-tier updates.
   *Riskiest bits:* the override accidentally writing through to the mark —
   pin with the §8 mutation test **before** wiring UI; expiry surviving
   backgrounded tabs (the `visibilitychange` check is mandatory); threading
   `Infinity` into `unlockedInnings`/`RollingLine` without breaking the
   extras window-scroll.

**Phase 2 — Follow Live:**
1. `src/api/liveEdge.js` + fixture tests.
2. Consent modal + masthead toggle + strip; flag hook.
3. The merge effect in `InningViewer` + auto-navigation + Final cleanup.
4. Cloud-sync consent copy; e2e/live-game verification; ADR-0025.
   *Riskiest bits:* `selectLiveEdge` importable ungated (the flag-argument
   guard + module header mitigate; consider a `check-caps.mjs`-style lint
   script if call sites ever multiply); auto-navigation fighting the user's
   own navigation (the only-advance-from-the-frontier rule is the guard); the
   ratchet+cloud interplay — an over-eager edge value is *permanent and
   multi-device*, hence the conservative `min`/null edge computation and the
   never-past-last-played-half unit pin.

Each phase is one PR (branch off current `origin/main`; product code + tests
together; never push `main` or trigger a deploy), verified on a reserved dev
port against a live game before merge, per root `CLAUDE.md`.

---

## 11. Open questions / decisions for the user

1. **Scores Unlocked scope while active:** every game surface viewed during
   the window (recommended, simplest), or only games whose `officialDate` is
   today (stricter "today only" — paging back keeps the normal reveal-all
   tap)?
2. **Follow Live poll cadence:** keep the existing 60s (recommended to ship)
   or 30s while following?
3. **Cloud propagation of Follow Live advances:** accept, with consent copy
   (recommended), or suppress POSTs for machine-advanced marks and let
   devices diverge?
4. **Auto-navigation feel:** instant `replace` jump to the new frontier
   (recommended) vs the page-turn animation; and should a new half arriving
   while the user reads an earlier one show the "Live: Bot 7 ›" chip
   (recommended) or do nothing?
5. **Reset hour:** hard-code 8:00am local for v1 (recommended) or make it a
   preference later?
6. **Should Follow Live offer keep-awake** (`bbsbh:keepAwake`) inside its
   confirm, since the two serve the same session?
7. **Slate live-line detail while unlocked:** score + half-inning only
   (recommended), or also outs/runners (more fetch weight and churn)?
