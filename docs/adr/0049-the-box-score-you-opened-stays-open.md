# ADR-0049 — The box score you opened stays open

Status: accepted (2026-08-16)

## Context

The box score's seal is the one seal in this app that a reader lifts *once about a
whole game*. Every other seal in the scoring flow covers a half inning, and the
mark behind it — `bbsbh:reveal:{gamePk}`, ADR-0022's high-water mark — is
remembered, persisted, and carried to a signed-in reader's other devices. Tap
the top of the 3rd on your phone and the iPad knows.

The box score was the exception, and not deliberately. Its `SealBox` carried no
`onReveal` at all, so lifting it was remembered for exactly as long as the page
stayed mounted. Leave the tab, come back, tap again. Open it on the iPad, tap
again. The reader who has already seen the final line was asked, over and over,
whether they were sure they wanted to see it.

ADR-0048 fixed one slice of this: a game carrying the reader's own **stamp**
opens unsealed, because a stamp means they were there. But a stamp is a keepsake,
and most opened box scores are never stamped. The reader who looked up a final
score without wanting a souvenir got no such memory — and they had done the same
thing, by hand, with the same knowledge afterward.

The tap is the fact worth keeping. Not the stamp, not the day, not the score:
**that this reader opened this box score.**

## Decision

**A tap on the box score's seal is recorded, per game, and mirrored across the
reader's own devices. It opens that box score and nothing else.**

> `bbsbh:boxreveal:{gamePk}` holds the string `"1"` and nothing else
> (`parseBoxRevealMark`, `useBoxScoreReveal` — both in the reveal-mark modules
> beside `revealedThrough`). `BoxScore.jsx` hands the box score's `SealBox` a
> real `onReveal` for the first time; the bit rides `/api/reveal` as
> `revealbox:{userId}:{gamePk}`, pushed and pulled by `BoxRevealCloudSync`.

Four things follow, and each was a choice.

### It is a bit of its own, not a shove of `revealedThrough`

The tempting implementation is one line: on reveal, ratchet the game's mark to
its final half. It is wrong, and the reason is the thing the mark MEANS.

`revealedThrough` is the by-hand scoring frontier. The innings viewer paints from
it, the scorecard inks only as far as it reaches (ADR-0047), and the slate's
"pick up your pencil" strip lists games by it (ADR-0022's scorebook index). A
reader who taps a box score has not scored a single half by hand — and shoving
the mark to the end would tell all three surfaces they had, permanently and on
every device. It would also retire the game from "pick up your pencil" for
finishing an arc it never started.

So the bit says only what happened: one seal, on one page, was lifted. The scope
question was asked and answered narrowly on purpose. A box score does show every
inning's line, so one could argue the innings viewer has nothing left to
protect — but the innings viewer is where you keep score, and the reader's place
in it is theirs to set.

### Only a real tap writes it

`SealBox` fires `onReveal` whenever the box becomes shown — by tap **or** by
`forceRevealed` flag (see `SealBox.jsx`, and ADR-0026's `commitReveals` for the
same trap caught in the innings viewer). The box score now has three openers, so
`onReveal` is handed over only when neither of the other two is doing the
opening:

```js
forceRevealed={spoilersOff || stamped || boxOpened}
onReveal={spoilersOff || stamped ? undefined : markBoxOpened}
```

Both exclusions are load-bearing:

- **The Scores Unlocked pass** (ADR-0026) is consent to spoil a DAY, and it
  expires at 8am. A bit written under it would outlive the consent it came from —
  every other seal back in place after the reset, this one permanently lifted, by
  a mark the reader never made.
- **A stamp** (ADR-0048) opens the game as a *render override*, exactly as
  reversible as the stamp behind it. A bit written on the stamp's account would
  survive the un-stamping and quietly break that promise.

Under either flag there is no seal on screen, so there is no tap to record.
Nothing is lost.

### It rides `/api/reveal` rather than an endpoint of its own

Same family, same address, same `(userId, gamePk)`: same auth, same erase index
(`reveal:index:{u}`), and one round trip for a client that wants both facts.
`docs/api/account-layer.md` closes by asking the next feature that wants an
endpoint whether it could ride an existing handler's query string instead. This
one could.

Two shapes fall out. `POST` now takes either field alone (`plannedWrites`) —
a box-only POST is the ORDINARY case, because a reader can open a box score on a
game they never hand-revealed a half of, and sending `revealedThrough: 0` there
would claim they had. And `api/account.js` erases `revealbox:{u}:{gamePk}` for
every gamePk in the index it already reads, so the bit cannot be the one thing an
erase forgets.

### The client latch never runs backward

`useBoxScoreReveal` merges `false → true` from any source — this device's tap,
another tab's `storage` event, another device's bit arriving from the cloud — and
offers no way back. It is `mergeMark`'s one-directional rule in one bit. There is
nothing in the app that asks to re-seal a box score, and a setter that could
would be a way for a stale value to shut a page under a reader who has it open.
The bit is re-read from storage only when the gamePk changes, and during render
rather than in an effect: `BoxScore` stays mounted as a reader moves between
games, and an effect would paint one frame of the previous game's answer — which
would show, not seal.

## Why this does not violate the spirit of the rule

The five tests ADR-0026 set for itself, and this is the first departure inside the
scope that PERSISTS something, so the fourth one deserves the attention:

- **Consented.** The reader tapped the seal. That is the most direct consent in
  the app — more direct than a day pass, and more direct than a stamp, which is
  inferred from a keepsake.
- **Scoped to what was consented to.** One `gamePk`, one page. The innings
  viewer, the scorecard, the slate and every other game are untouched.
- **The default path is byte-identical.** A game whose box score was never opened
  reads `false` and seals exactly as before.
- **The ratchet is untouched.** `bbsbh:reveal:{gamePk}` gains no new writer.
  `revealedThrough` still means only what it meant. The e2e spec asserts the key
  stays unwritten across a tap, a reload, and a visit to the innings viewer.
- **It fails closed.** Only the exact string `"1"` opens a page; `null`, `"0"`,
  `"true"`, a number, a mangled blob all read as sealed. An unreachable API, a
  failed pull, an older deploy answering without the field, and a storage read
  that throws all leave an ordinary seal one tap from open.

The bit itself is score-free by construction, and more so than the mark beside
it: `revealedThrough` at least says how far into a game a reader got, while this
says only *that* they opened one page. It can be read as "this person knows how
this game ended" — which is precisely what a stamp says out loud, and what an
entry in the scorebook index implies.

## Alternatives considered

**Shove `revealedThrough` to the final half.** One line, no new key, free cloud
sync. Rejected — see above; it lies to three other surfaces about work the reader
never did.

**Ask first: "remember that you opened this?"** Rejected. It is a consent prompt
for consent just given, on the very tap that gave it, and the reversal cost is
one visit to a game the reader can re-seal by clearing their data. ADR-0048
rejected the same prompt for the same reason.

**Keep it device-local.** Simpler, and no endpoint change. Rejected because the
second device is the whole complaint: `revealedThrough` has crossed devices since
ADR-0022, and a box score that re-seals on the iPad after being opened on the
phone is the same seal asking the same answered question.

**Gate it on being signed in.** Rejected, as ADR-0048 rejected it: signing in
decides whether the bit *travels*, never whether it counts. A deploy with no
Clerk key still remembers the tap on the device that made it.

**Fold it into the stamp override and drop one of them.** Rejected — they answer
different questions. A stamp opens the innings viewer and the scorecard too,
because the reader was AT the game; this opens one page, because they opened that
page. Either one alone leaves a real reader tapping a seal they have already
lifted.

## Consequences

- The box score's `SealBox` has three openers and one writer. That asymmetry is
  the thing to preserve: a fourth opener must ask itself whether it, too, must be
  excluded from `onReveal`.
- `/api/reveal` now stores two facts per game and its POST accepts either alone.
  `plannedWrites` is the one place that decides, and it is pure and unit-tested.
- `BoxRevealCloudSync` reports on the existing `reveal` sync channel rather than
  a fifth one, so My Tally's claim for that channel ("how far you have opened
  each game, carried device to device") still describes everything under it.
- Un-stamping no longer re-seals a box score the reader had opened by hand — it
  re-seals the innings viewer, which is where ADR-0048's reversibility is now
  pinned (`e2e/invariants/logbook-stamp.spec.js`).
- Verified by `e2e/invariants/box-score-unlock.spec.js`: the tap survives a
  reload, the pass and the stamp write nothing, the innings viewer still seals,
  a mangled value fails closed. Unit cases in `test/reveal-progress-core.test.js`
  (the parse) and `test/api-handlers.test.js` (the write plan).

## Amendment (2026-08-19) — the bit needs an owner, and adopting it means removing it

**Status:** accepted.

The decision above gives each game one persisted bit, keyed by gamePk and
nothing else. "Nothing else" included the account, and nothing cleared the bit
on sign-out. On a device two people share, that is a spoiler:

1. A signs in and opens a box score. `bbsbh:boxreveal:{gamePk}` is written
   locally and POSTed to A's account.
2. A signs out. The bit stays — local-first, by design.
3. B signs in and opens that game. `opened` is already true from local storage,
   so the box score renders **open** for B, and the publish effect posts the bit
   into **B's** account.

The other three channels in this family leak *state*. This one leaks a **render
override** — the whole point of the bit is that the box score renders unsealed
with no reveal mark — so B is not inheriting a preference. B is shown a score
they never asked to see, on a scoring surface. And because `mergeOpened` is
deliberately one-directional, B cannot get the seal back by signing out again.

The server key (`revealbox:{userId}:{gamePk}`) was always per-user. The leak was
entirely on the device.

**The bit now carries an owner tag**, `bbsbh:boxrevealOwner` — its own key, not
shared with the reveal mark, the stamps or the preferences, because the channels
sync independently and a device that reached one endpoint but not another must
not be recorded as holding both. `mergeStrategyFor` (src/lib/account/preferences.js)
is unchanged and generic; the rules for this channel are the React-free
`src/lib/account/boxReveal.js`.

**`adopt` here means CLEARING the local `bbsbh:boxreveal:*` keys**, not ignoring
them. The alternative — leaving A's bits on disk and ignoring them while
adopted — is arguably more correct, since A signing back in would find their
pages as they left them. It was rejected because it puts the owner tag in the
path of every *reader* of the bit, and a reader that forgets to consult it shows
a score. Removing the bits leaves one rule in one place; B's own pull
re-establishes B's.

**The guard is app-wide, not part of `BoxRevealCloudSync`.** That component
mounts inside the box score and its pull is a network round trip, while
`useBoxScoreReveal` reads the bit synchronously during that screen's first
render — so a guard living in the pull would decide whether B may see the page
only after it had painted. `OwnerGuards` runs on the sign-in transition
instead, before any scoring surface is mounted in the ordinary flow.
`BoxRevealCloudSync`'s publish effect still checks the tag as a second line:
the two are separate mounts with no ordering guarantee between them.

**The latch gained exactly one door back**, and it is the key being *removed*.
No stale value can close a page through it, because a removal is not a value:
nothing writes anything to this key but `'1'`, so its absence can only mean one
of the two things that take it away deliberately — "erase my Tally data", and
this guard. Both must re-seal a page that is already open. `clearBoxRevealMarks`
announces each removal as a `storage` event so a mounted page hears it in the
tab that made the change, the same echo `useStamps` uses.

- Pinned by `test/box-reveal-owner.test.js`: the sweep takes every box-reveal
  key and no other channel's, the prefix is exact, a blocked or hostile storage
  answers "nothing" rather than throwing, the owner tag round-trips, and the
  guard adopts only for a different account.
