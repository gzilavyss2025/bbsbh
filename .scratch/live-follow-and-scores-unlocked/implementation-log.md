# Implementation log — Follow Live + Scores Unlocked

Tracks the build of the feature specced in `design-spec.md`. Decisions locked
with the owner on 2026-07-24.

## Locked decisions

- **Admin-editable consent copy**, stored **globally in Redis** (amends "no
  backend" — accepted by the owner as the project matures), Clerk-admin-gated.
  The owner wants to tune the pop-up wording/humor without a deploy or an agent.
- **Build order:** admin copy panel FIRST, then Scores Unlocked (home), then
  Follow Live (in-game).
- **Scores Unlocked scope:** when on, ALL of today's games show score + inning
  on the slate cards (finals show final, live show runs + half), keeping the
  card's colors/cap treatment.
- **8am local reset**, stated explicitly in both consent boxes ("no matter what,
  at 8am the app goes back to assuming you want nothing spoiled").

## Phase 0 — Admin copy panel (DONE)

- `src/copy/registry.js` — closed registry: every editable consent string with a
  stable id, shipped default (scorebook voice + humor), maxLength, admin-form
  metadata. `sanitizeOverrides`/`resolveCopy`/`fillTokens` (only `{time}` token).
- `api/copy.js` — Node serverless. Public cacheable GET; allowlisted
  (`COPY_ADMIN_USER_IDS`) + Clerk-verified POST. 501 when unconfigured.
- `src/copy/CopyProvider.jsx` + `copyContext.js` — provider resolving
  defaults ← localStorage cache ← live GET; `useCopy().t(id, { time })`. Always
  falls back to defaults; wired into `main.jsx` (inside ClerkProvider when on).
- `src/screens/AdminCopy.jsx` + `/admin` route — mobile editor, Clerk-admin
  gated UI (API is the real boundary), grouped fields + counters + reset +
  live modal preview.
- `test/copy-registry.test.js` — 14 unit tests pinning the sanitize/resolve/
  token invariants. Full suite 524/524, lint + build clean.
- `docs/adr/0025-admin-editable-copy-store.md`; root `CLAUDE.md` now names three
  `api/` exceptions.

Verified `/admin` renders + degrades gracefully with no Clerk in dev.

## Phase 1 — Scores Unlocked (NEXT)

Per spec §2b/§3/§7: `src/lib/scoresUnlocked.js` (expiry-not-boolean, 8am local,
MAX_WINDOW clamp) + hook + the home toggle/consent (copy from the registry) +
slate score wiring (separate toggle-gated fetch) + banner. ADR-0026.

## Phases 1–2 complete — all seven remaining tasks landed (2026-07-24)

Built from a harmonized plan (a synthesis of 7 design-agent specs, worked out in
session and never committed — it is not a file in this repo; `design-spec.md`
plus this log are the durable record), in order F → D → A → B → C → G → E, one
commit each on `claude/live-game-spoiler-toggle-mcds2r`. Suite 582/582 at the
time, lint + build green.

- **In-game override** (`0187254`) — `effectiveReveal` render-only; mutation test first.
- **F** (`bc160df`) — consent copy honest ("does not track your scoring"; unconditional 8am).
- **D** (`9dc0d76`) — ADR-0026 + CONTEXT vocab + CLAUDE pointer (settles ADR numbering).
- **A** (`9ce1dd6`) — slate score line (toggle-gated fetch; default model score-free; `slateRevealAll`).
- **B** (`8feaa82`) — score-free `toggle_consent` analytics + ADR-0028.
- **C** (`35d01cf`) — AdminCopy "View real modal" (previewResolver, blank→default fidelity).
- **G** (`75a6f00`) — Follow Live: `liveEdge.js`, `useFollowLive` (8am-expiry flag),
  InningViewer merge effect (real ratchet), masthead toggle + consent + strip, ADR-0027.
- **E** (`bbaf91d`) — e2e `scores-unlocked.spec.js` (never-writes-reveal-mark invariant).

All five fable-caught bugs fixed in-flight: ADR-number collision (D=0026/G=0027/B=0028),
follow-flag expiry (no bare '1'), all-final-today `slateRevealAll`, merge-effect deps
churn, and the score-free-MODEL wording.

Open follow-ups for live verification (need a real in-progress game + browser with
feed access — blocked in this sandbox): visually confirm the slate score line, the
in-game unseal, and Follow Live auto-advance via the run skill; a separate
`e2e/invariants/follow-live.spec.js` against a live game.

## Post-implementation review pass (2026-07-24)

A read of the whole branch against `design-spec.md`. Four commits after the
feature landed were unrecorded here and had drifted from their docs
(`d4bbcd2` 15s poll, `f09a7c3` caught-up label, `8060bdc` linescore value check,
plus two `origin/main` merges), which is where most of the drift came from.

**Fixed in this pass (code):**

- **THE headline invariant was broken.** ADR-0026 and the e2e spec both promise
  the pass never writes the persisted reveal mark. It did. A half rendering
  revealed mounts its `SealBox` force-revealed; `SealBox` fires `onReveal` on any
  transition to shown, flag included; `InningViewer` wired that straight to
  `revealTo`. So opening a half under the pass ratcheted the real mark, persisted
  it, and (signed in) cloud-synced it to every device. Browser-confirmed against
  the committed 823035 fixture: `/top1` with the pass on wrote
  `bbsbh:reveal:823035` = `"0"`; null after the fix. `effectiveReveal` now
  returns `commitReveals`, and `InningViewer` hands down a no-op while unlocked.
  The e2e spec's assertion was correct all along — it had only ever run in an
  environment with no feed, so no half rendered and it passed vacuously.
- **Box score ignored the pass.** `BoxScore.jsx`'s `SealBox` was never wired to
  Scores Unlocked, so a pass whose consent copy promises "no seals, no tapping"
  still made you tap the box score. Now rides `forceRevealed` (ADR-0026).
- **`{inning}` bypassed the copy choke point.** `InningViewer` was doing a raw
  `.replace('{inning}', …)` on a registry string, while `registry.js`'s header
  swore `{time}` was the only token and that no field is ever interpolated with
  game data. Generalized `fillTokens` to a declared closed set (`TOKENS`), moved
  the call site onto it, and rewrote the spoiler guard to say what is actually
  admissible and why.
- **Slate line could render pre-game.** `slateScoreLine` gated only on the runs
  being finite; a schedule row posting `score: 0` before first pitch would print
  "MIL 0 – AZ 0" under a first-pitch time. Now gated on `abstractState`.

**Fixed in this pass (docs):** ADR-0027 claimed Follow Live "needs no new timer…
roughly every 60 seconds" while the code polls at 15s; ADR-0026 claimed the pass
applies "only for today's games" while the in-game override is window-scoped, not
date-scoped. Both corrected, each with the rationale for the shipped behavior.
The §9 amendments the spec promised (ADR-0001/0002/0008/0016/0022) were never
written — now appended. `design-spec.md` carries an amendment header recording
the ADR renumber and every settled open question. Both new ADRs now carry a
"Known gaps" section.

**Verification.** Lint clean, 616/616 unit, build green. Browser-verified against
a statsapi stub backed by the committed `test/fixtures/game-823035.trimmed.json`
(Chromium cannot reach statsapi through this sandbox's proxy, but a `page.route`
stub renders the real surfaces): box score sealed/unsealed correctly in both
directions, innings content unsealed under the pass with the reveal split bar
restored when off, and `bbsbh:reveal:823035` unwritten in all four states. That
stub trick is worth reusing — it is what turned the reveal-mark bug from
"unverifiable in this sandbox" into a two-minute reproduction.

**Not fixed — the next phase** (see ADR-0026/0027 "Known gaps"): the in-game
Scores Unlocked banner/off-switch, the Follow Live consent line naming
cross-device propagation, the jump-to-frontier chip, `follow-live.spec.js`, and
live-game verification of Follow Live's auto-advance.

## Phase 3 — merged into ONE switch (2026-07-24)

The owner's call, after the review pass: Follow Live and Scores Unlocked are one
feature, not two. His reasoning corrected a bad assumption baked into the whole
split — the case that justified two features ("follow this game live, keep the
rest of the slate sealed so I can score those later") does not occur, because
nobody leaves a ballpark and hand-scores four more three-hour games. One switch
meaning *I'm fine seeing today* covers it.

Two consequences fell out, and both made the design better:

1. **The ratchet went away entirely.** Follow Live's whole justification was that
   watching live is a *real* reveal and must persist. Under one site-wide pass
   that dissolves: everything already renders open, so there is nothing left to
   advance. What remained of Follow Live is auto-navigation, the 15s poll, and
   the caught-up status — none of which write anything. The mechanism that could
   permanently corrupt the persisted reveal mark, and cloud-sync that corruption,
   no longer exists. `useFollowLive.js`, `bbsbh:followLive:{gamePk}`, the masthead
   toggle, the second consent modal, the whole `followLive.*` copy group and the
   `follow_live`/`ingame` analytics enums are all deleted.
2. **8am stopped meaning "everything re-seals".** Also the owner's call: a day you
   agreed to spoil should STAY spoiled. Re-sealing it the next morning is a
   fiction. So consent now records the DAY (`src/lib/spoiledDays.js`,
   `bbsbh:spoiledDays`) and 8am means "the pass stops applying to new days".
   Whole day, not just games opened — the slate showed you every score the moment
   you flipped it on. Turning the switch off the SAME day takes the consent back,
   so a mis-tap still costs nothing; after 8am it's locked in.

Critically, the day list is a set of DATES, never a reveal mark — so even the
durable half can't touch, advance, or sync `revealedThrough`. The `commitReveals`
fix from the review pass is what holds that line in code.

**Also in this phase:** the in-game banner that was the review's #1 recommendation.
It rides under the masthead on EVERY section (both lineups, innings, box score),
and is the off switch. A locked-in day deliberately shows NO banner — there is
nothing to switch off, and offering to would be a lie.

**Copy had to change with the promise.** `scoresUnlocked.resetNote` used to say
"no matter what, at {time}… it re-seals on its own". That stopped being true. The
new default says the switch turns itself off so tomorrow starts sealed, and that
today stays unlocked. `test/copy-registry.test.js` now rejects the old phrasing
outright rather than merely accepting the new one.

**Verification.** Lint clean (0 problems), 630/630 unit (incl. the new
`test/spoiled-days.test.js`, 14 cases), build green, and a browser pass against
the statsapi stub over the committed 823035 fixture — seven render scenarios plus
the full consent → persist → same-day-undo path on the slate:

| state | banner | box seal | innings | reveal mark |
| --- | --- | --- | --- | --- |
| pass active | shown | none | open | `null` |
| day locked in | none | none | open | `null` |
| neither | none | sealed | sealed + reveal bar | `null` |

Consent wrote `["2026-07-24"]`; tapping the banner off took it straight back out.
The reveal mark stayed unwritten in every single state.

**Still open:** live-game verification of the auto-nav / 15s poll / caught-up
status against a game actually in progress (the stub can't exercise it), and the
question of whether the spoiled-day list should sync across devices now that it's
durable consent rather than a transient pass — recorded in ADR-0026's Cost accepted.

## Phase 4 — live verification + cross-device sync (2026-07-25)

**Live-game verification, finally done.** The one gap the sandbox seemed to
foreclose. Chromium can't reach statsapi through the proxy, but the shell can —
so the harness proxies every statsapi request the browser makes out through
`curl` and fulfils it with the real response. Each 15s poll therefore fetched
genuinely fresh data, which is what made the live behaviour testable at all.

Against KC@DET (gamePk 824244), in progress:

- opened `/top1` → the app auto-advanced itself to `/top9`, the live frontier;
- feed fetches 16/15/15/15s apart — `FOLLOW_POLL_MS`, not the 60s default;
- caught-up status read "LIVE · TOP 9TH IN PROGRESS", `{inning}` filled correctly;
- paged back to top 8, sat through two poll windows, stayed on top 8 — the guard
  against yanking a paged-back reader holds;
- `bbsbh:reveal:824244` unwritten throughout. That is the `commitReveals` bug
  confirmed clean against a live feed, which is the only place it could have
  come back.

A first attempt at the paged-back test was INVALID and worth recording: the
`/back/i` selector matched the site-home button and navigated to the slate, so
"stayed put" meant nothing. Redone against `aria-label="Back one half-inning"`.

**Cross-device sync for the spoiled-day list** (`api/spoiled-days.js` +
`SpoiledDaysCloudSync.jsx`). The design decision worth keeping: the reveal mark
syncs with a monotonic ratchet because it only moves one way, and a day SET
cannot use that shape. A plain union is monotonic too — and would resurrect a day
the user just took back, because the stale remote 'on' outlives the local
removal, silently reversing the same-day undo. So the wire format is a per-day
`'on' | 'off'` state map, a withdrawal travels as an explicit 'off', and last
write wins per day. Sound because a day is only mutable while it is "today" on
some device: past days are frozen and converge; disagreement about today
self-heals on the next touch. Absence means "no opinion", never "erase", so a
fresh device signing in can't wipe the history.

Also fixed a latent gap while wiring it: two mounted `useScoresUnlocked`
instances in the same tab couldn't see each other's writes (the browser fires
`storage` only in OTHER tabs). The hook now dispatches a same-tab `StorageEvent`
after each local change, so the existing listener is the single refresh path for
every source — another tab, this tab, or the cloud merge.

**Verification.** Lint clean, 668/668 (7 new sync-merge cases), build green.
Endpoint smoke-tested with env stripped: 501 unconfigured, 405 on a bad method;
6 serverless functions against Hobby's cap of 12. Browser re-checked with Clerk
off: consent → `["2026-07-25"]`, undo → `[]`, banner correct, **zero**
`/api/spoiled-days` calls, no page errors — the sync is properly inert without
Clerk.

**Still untested:** the two-device round trip itself needs a Clerk-configured
deploy the sandbox can't stand up. Merge logic is unit-pinned and the endpoint is
smoke-tested, but watch the first real sign-in.
