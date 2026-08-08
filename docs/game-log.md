# The Game Log — scope, mechanics, and voice

**Status:** shipped and live · **Slug:** `game-log` · **Code name:** `logbook`

The one place in Tally Baseball that is *yours* rather than the league's. Every
other screen reports on baseball; this one reports on **you** — which games you
sat with, how they came out, what they added up to over a season.

Read this before touching anything the Game Log renders, and **especially before
writing a word of its copy.** The mechanics are enforced by tests and guards and
will tell you when you get them wrong. The voice is not, and won't.

Deeper reading, in order of specificity: `docs/adr/0035-logbook-stamps-are-gated-by-the-reveal-mark.md`
(why a stamp may carry a score at all), `docs/adr/0036-the-logbook-is-a-passport-book-you-arrange-by-hand.md`
(why the collection is a book you arrange), `docs/adr/0041-the-game-log-holds-more-than-one-book.md`
(why a user may hold more than one, and what stayed the same when that shipped),
`docs/adr/0042-stamp-in-is-a-consented-season-of-results.md` (why one page may
show a club's whole played season, and the four things that keep it contained),
`.scratch/game-stamps/PRD.md` (the original scoping, plus a running list of
where the build deliberately departed from it), and `src/CLAUDE.md` for the
component wiring.

---

## 1. The product, in one pass

You reveal a game's box score by hand, the way this whole app works. Across the
head of that revealed sheet, once the game is final, you can **stamp** it — mint
a one-color commemorative mark carrying the final score, the two clubs, the
date, and the venue. That stamp is yours to keep.

Stamps accumulate into your **Game Log**: one or more passport books you
arrange by hand (ADR-0041 — most users will only ever need the one that's
there from the start). Freshly minted stamps wait in a **tray** until you tap
a spot on a page to place them, which is also the moment a stamp is filed
into whichever book you had open. Pages hold eight, in two columns of four,
and each stamp lands with a slight tilt so a filled page reads as pressed by
hand rather than laid out by a grid. A **retrospective** (`/logbook/stats`)
adds the WHOLE collection up, across every book — clubs seen, your record
watching them, the span of dates you covered; a single book's own
retrospective is `/logbook/book/{bookId}/stats`.

The Game Log is per-user and local-first. On a Clerk-configured deployment,
signed-out visitors see the feature pitch and account entry at `/logbook`;
signing in opens the book and merges any stamps already minted on that device.
Signed in, the collection mirrors across the user's own devices. A deployment
without Clerk keeps the local book directly accessible, so the optional account
dependency still degrades gracefully.

### What it is not

- **Not a scoring tool.** It records that you were there for a game; it does not
  record what happened in it beyond the final line. You still keep score on paper.
- **Not social.** No sharing a collection, no comparing, no leaderboards. The one
  outward-facing surface is the Open Graph card on a `/logbook` link, and it
  describes the feature, never a user's contents.
- **Not a checklist.** There is no completion state, no badge, nothing to finish.
  Adding one would change what the feature is about — see §3's voice rules.

---

## 2. The naming contract — "Game Log" up top, `logbook` underneath

**The user-facing name is "Game Log." The code name is `logbook`, everywhere,
permanently.** This split is deliberate, not drift, and not a half-finished
rename. Do not "complete" it.

| Layer | Name | Examples |
|---|---|---|
| Everything a user reads or hears | **Game Log** | headings, buttons, menu labels, tab titles, `aria-label`s, OG cards |
| Route | `logbook` | `/logbook`, `/logbook/{season}`, `/logbook/stats`, `/logbook/book/{bookId}[/{season}\|/stats]`, `?place={gamePk}` |
| Modules, components, CSS, storage | `logbook` / `Logbook` | `LogbookPage.jsx`, `api/logbook.js`, `.logbook__cell`, `bbsbh:stamps` |

**Why the route can never change:** a stamped game's `/logbook` link is shared,
bookmarked, and — critically — its Open Graph card is cached by iMessage, Slack,
and Vercel's edge for far longer than a redirect would plausibly be maintained.
Renaming the path breaks every already-shared link and serves a stale card from
the old one. The cost is real and permanent; the gain is zero, because no user
ever sees the path segment as a word.

**Why the code keeps `logbook`:** a partial rename is worse than either whole.
`logbook` appears in three dozen files across the client, the serverless function, the
lint guard (`scripts/check-stamp-surfaces.mjs`), and the e2e specs; renaming
half of them leaves the next reader unsure which name means what.

### The thirteen files display copy lives in

If you are changing the user-facing name or wording, these are all of them.
Three are new since ADR-0041 gave the Game Log more than one book —
`LogbookPage.jsx` shrank to the route shell + book resolver when the shelf
pushed it past the file-size guard, and its old page-level copy (empty
state, tray and placement ledes) moved to `LogbookCollection.jsx` with it:

| File | What it carries |
|---|---|
| `src/components/chrome/LogbookButton.jsx` | the slate header's labelled entry point |
| `src/components/account/LogbookLanding.jsx` | the signed-out feature pitch, process, benefits, trust note, and account CTAs |
| `src/lib/reportPages.js` | the label in the More menu, site footer, and report footer |
| `src/screens/LogbookPage.jsx` | page `<h1>`, browser tab title — the route shell only now; see `LogbookCollection.jsx` below for the rest |
| `src/screens/LogbookCollection.jsx` | one open book's page: empty state, tray and placement ledes |
| `src/components/passport/LogbookShelf.jsx` | the multi-book shelf's copy — "your books," the new-book tile |
| `src/components/passport/BookManagementSheet.jsx` | create/rename/re-cover/remove-a-book copy |
| `src/components/passport/BookOrderControl.jsx` | the by-date re-order control and its confirm |
| `src/screens/LogbookStatsPage.jsx` | retrospective tab title, back links, empty state — both the whole-collection and the per-book views |
| `src/components/logbook/StampGameButton.jsx` | the whole mint strip inside the box score |
| `src/components/passport/PassportCover.jsx` | a book's foil-stamped cover and its `aria-label` — the default title/subtitle when a book carries no custom text |
| `src/screens/identity-lab/editors/StampPlacementEditor.jsx` | Identity Lab hints that name the destination |
| `api/_lib/cards.js` | the shared-link Open Graph card (`logbook` key) |

A grep for `Logbook` that returns hits in `src/lib/stamps.js`, `src/lib/stampArt.js`,
`api/stamps.js`, `src/hooks/useStamps.js`, or any `*.css` is finding **comments and
identifiers**. Leave them.

### Known collision: the player page's "Game log"

**`PlayerPage.jsx` already renders a section titled "Game log"** — a player's
game-by-game stat ledger, the back of his baseball card (`src/api/person/gameLog.js`).
That is a completely different thing from this feature, and the two names now
collide.

They are distinguishable in practice — the player page's is a sentence-case
section heading deep inside one player's page, this one is a title-case top-level
destination in the site chrome — and no surface shows both. **It is nonetheless an
unresolved product decision, not a settled one.** Options if it proves confusing:
rename the player-page section (it is the back-of-the-card *ledger* or *game-by-game*),
or rename this feature. Do not resolve it silently in either direction; raise it.

---

## 3. Narrative and marketing copy — read this twice

The Game Log's copy is the feature. Strip the voice out and what remains is a
list of games with scores on it, which is a thing the internet already has ten
thousand of. **Treat the strings below as designed artifacts, not as filler to be
tidied.** A "clearer" rewrite has, more than once, been a worse one.

### 3.1 The voice, stated

**It is a keepsake, not a database.** The governing metaphor is a paper scorebook
and a stamped passport — objects you own, carry, and eventually hand to someone.
Copy leans on physical verbs: a stamp is *minted*, *pressed*, *placed*, *filed*,
*waiting for a page*. It is never *added*, *saved*, *synced*, *stored*, or
*uploaded*, even though all four are literally what happens.

**Second person, and it means it.** "Your book." "You opened this one." "The games
you've scored." The whole emotional claim of the feature is possession, and every
line either carries that or is wasting its place.

**Warm, never cute.** The register is a person who cares about the thing, not a
brand doing a bit. No exclamation marks. No "Nice!", "Woohoo", "Let's go", no
emoji, no confetti language. The note field's placeholder — *"Dad's first game
here"* — is the ceiling for sentiment, and it earns it by being a real example of
what someone would type rather than a joke about one.

**Short, concrete, and it trusts you.** Sentences run to a clause or two. Em
dashes carry the second beat: *"You opened this one. Keep it — a stamp files this
game in your Game Log."* Nothing explains the metaphor; the metaphor does the
explaining.

**Permanence is the promise, and it is stated plainly.** *"A stamp is minted once
the game is final — the score on it never changes."* This is the single most
important sentence in the feature. It is what makes a stamp worth having. Do not
soften it, do not bury it, and do not ship anything that makes it untrue.

### 3.2 The strings, as shipped

| Surface | Copy |
|---|---|
| Header entry point | `Game Log` (title-case in DOM, uppercased in CSS) |
| Menu / footer label | `Game Log` |
| Page title / `<h1>` | `Game Log` |
| Signed-out pitch | *"A passport of the games you've scored."* → `Start your Game Log` / `I already have a book` |
| Book cover | `Game Log`, the club name, `Open` |
| OG card | eyebrow `GAME LOG` · title `Game Log` · sub *"A passport of the games you've scored — every stamp your own."* |
| Empty collection | *"No stamps yet. Reveal a game's box score and stamp it — it lands here, and you choose where on the page it goes."* |
| Empty retrospective | *"No stamps yet. Reveal a game's box score and stamp it — once a few are in the book, this is where it adds up."* |
| Not final yet | *"A stamp is minted once the game is final — the score on it never changes."* |
| Mintable | *"You opened this one. Keep it — a stamp files this game in your Game Log."* → `Stamp this game` |
| Season full | *"Your {season} Game Log is full. Remove a stamp to make room."* |
| Stamped, placed | *"Stamped, and on page {n} of your book."* |
| Stamped, unplaced | *"Stamped. It's waiting to be placed in your book."* |
| Mint-strip eyebrow | `Game Log` — the strip's own label, since the copy beside it is one line and can't carry the name in every state |
| Mint-strip row action | `Place it in your book` / `Move it in your book` — the row offers exactly one thing, and it is the way into the book |
| Mint-strip disclosure | `Details` — the collapsed second thought on a stamp you already have (mode, note, `Open Game Log`, `Remove stamp`). Plain and unsentimental on purpose: this is the one control here that is chrome rather than voice |
| Note field | label `Note`, placeholder *"Dad's first game here"* |
| Mode picker | group label *"How you took this game in"*, options `watched` / `followed` |
| Tray | *"{n} stamps are waiting for a page."* (singular: *"1 stamp is waiting for a page."*) |
| Placing | *"Tap the page where you want {date} to go."* → *"There? Confirm it, or tap somewhere else."* → `Stamp it here` |
| Moving | *"Tap where {date} should go instead — any page."* → *"There instead? Confirm it, or tap somewhere else."* → `Move it here` |
| Page full | *"This page holds 8. Turn to a new one, or add one from the corner."* |
| Re-order control | label `By date` → `Oldest first` / `Newest first` — two verbs, never a toggle, because the book is in whatever order its owner put it in (ADR-0036's re-order addendum) |
| Re-order confirm | *"This re-places every stamp in this book — each one lifted off its page and pressed back down {oldest\|newest} first, from page 1. The order you put them in by hand does not come back."* · *"The tray and your other books stay as they are."* → `Re-place them` / `Leave it as it is` |
| Selected stamp | `Open game ›` / `Move it` |
| Unplaced marker | `unplaced` |

### 3.3 Rules for writing new copy here

1. **Never name a number the user has to care about.** "Your 2026 Game Log is
   full" beats "You have reached the 500-stamp limit." Limits exist (§4.2) and
   are generous enough that stating them reads as a warning about a wall nobody
   will hit.
2. **Never congratulate.** No "Nice pickup!", no streak language, no "you're on a
   roll." The feature's whole posture is that the games matter and the app is
   just holding them.
3. **Never imply scarcity, urgency, or FOMO.** No "don't lose this," no "before
   it's gone." A stamp cannot be lost and nothing expires.
4. **Never promise the collection is backed up.** Signed out it is on one device
   and nowhere else. Cloud sync is a convenience for signed-in users, not a
   guarantee, and copy must not create one it can't keep.
5. **Never let marketing copy state or imply a score.** The `/logbook` OG card is
   the sharpest edge here: it is rendered for a link the user is about to send to
   someone whose reveal state is unknown. It describes the *feature* — never a
   game, a club, a record, or a count. See §5.
6. **Sentiment goes in the user's words, not ours.** The note field is where
   meaning lives. Our copy sets the table; it does not supply the feeling.
7. **When in doubt, cut.** Every shipped line above survived being shortened at
   least once.

---

## 4. How it works

### 4.1 Containment — the spoiler argument

The Game Log is the **first and only** thing in this app that persists a final
score (ADR-0035). It is safe for a structural reason, not a careful one — and the
structure is **where a stamp may render**, not a permission check when it is
minted:

> A stamp can only be **reached** from inside a revealed box score, and can only
> be **rendered** on a surface the containment guard allows. Nothing about the
> Game Log can put a score in front of you on a game you haven't opened.

**The lint guard is that argument.** `scripts/check-stamp-surfaces.mjs` fails
`npm run lint` if `GameStamp.jsx` or `StampGameButton.jsx` is imported from
anywhere outside its allowlist, and forbids a named set of unrevealed-game
surfaces — the slate, game cards, "Pick up your pencil" — from so much as
mentioning either. `e2e/invariants/logbook-stamp.spec.js` is the runtime half: it
asserts a stamp is *absent from the DOM*, not merely hidden, before the box score
is tapped. Read ADR-0035 before touching either.

The reach half is that `StampGameButton.jsx` renders **inside** the box score's
`SealBox` reveal render function. That host `SealBox` has **no `onReveal` and
persists nothing**, and must stay that way — give it one and a box score opened
under the Scores Unlocked pass would silently ratchet the whole game's
`revealedThrough`.

#### The retired mint gate

`POST /api/stamps` used to refuse unless the server could prove, from
`reveal:{userId}:{gamePk}` or `spoiled:{userId}`, that the user had finished
revealing the game (`meetsRevealGate`). **That gate is gone** — ADR-0035's second
amendment has the full reasoning, and the short version is that the `SealBox`
above deliberately persists nothing, so the ordinary way to stamp left no mark
for the gate to find and every such mint 403'd. It refused the flow while
defending only against a hostile client, which here is the owner spoiling their
own collection.

What the server still refuses:

1. **A game that isn't Final.** A live score still moves; a stamp is permanent.
2. **A client-supplied score.** The number lives in `game:final:{gamePk}`, a
   shared blob the server fetches for itself; the per-user record has no room for
   one. `mintRefusal`/`stampEntry` (`api/stamps.js`) are both pure and pinned in
   `test/api-handlers.test.js`.

### 4.2 Storage, shape, and limits

Local-first, in `localStorage` under `bbsbh:stamps` (`src/lib/stamps.js` is the
pure rules module; `src/hooks/useStamps.js` is the React store over it, with a
cross-tab `storage` listener and a same-tab echo — two hook instances really are
mounted at once).

A record holds `mode`, `note`, `date`, `placement`, `stampedAt`, and `updatedAt`.
**It does not hold the score.** Facts are resolved at render time by
`src/api/logbook.js` — the one fetcher in the app that asks statsapi *for* the
score, which is why it is its own file rather than a function in `schedule.js`.

`updatedAt` and `stampedAt` are two fields because one cannot do both jobs:
last-write-wins sync needs a clock that moves on an un-stamp, and `stampedAt`
must not move when a note is edited.

| Limit | Value | Constant |
|---|---|---|
| Stamps per season | 500 | `MAX_STAMPS_PER_SEASON` |
| Note length | 140 chars | `MAX_NOTE_LENGTH` |
| Pages | 60 | `MAX_PAGES` / `MAX_PLACEMENT_PAGE` |
| Stamps per page | 8 (2 × 4) | `PAGE_CAPACITY` |
| Tilt | ±7° | `MAX_TILT` / `MAX_PLACEMENT_TILT` |
| Modes | `watched`, `followed` | `STAMP_MODES` |

`attended` was cut from the mode enum for v1 — it wants its own overprint on the
stamp art, and adding an enum value later is cheap.

### 4.3 The book(s), and placement

`src/lib/passportLayout.js` is the geometry, as pure math. A placement is
`{ bookId, page, x, y, tilt }` with **x/y as fractions of the page box**, not
pixels — that is the entire reason a book arranged on a phone reads correctly
on a laptop, and the reason a placement is worth syncing at all. Note what a
placement adds to the record: which book, a page number, two fractions.
Nothing score-bearing, so a hostile client that forges one has moved a
picture, not minted a score.

A book is separate metadata (`src/lib/books.js`, `{ id, state, title,
subtitle, coverTeamId, createdAt, updatedAt }`) from the stamps filed in it —
it never holds the collection itself, only names a shelf slot. Every device
always has at least one (`DEFAULT_BOOK_ID`, synthesised the first time
`useBooks.js` mounts and finds none), so there is no "zero books" state
anywhere. `passportLayout.js` needed no changes to support more than one book:
every function there already took a `stamps` ARRAY as input, and a caller
pre-filtering that array to one book's stamps is enough — see ADR-0041.

Minting and placing are deliberately **two steps**, and now placing is also
the moment a stamp is filed into a book. The mint happens in the box score,
inside the seal, where the safety argument lives; the book — a whole page of
other games' stamps — never has to render inside a game screen. An unplaced
stamp is not a lost one, and belongs to no book yet; it waits in the tray,
book-agnostic, until a tap on a specific book's page both places it and
assigns it there in one motion.

Placement mode is `?place={gamePk}`, a **query and not a route name**: it is a
transient mode of the same page, not an address worth sharing, and a stale link
degrades to the plain book.

### 4.4 Sync

`src/components/sync/StampsCloudSync.jsx` — Clerk-gated, lazy, mounted in
`App.jsx`, inert when Clerk or Upstash is unconfigured (the endpoints `501`).
GET-merges the whole collection via `?export=1` on sign-in, then publishes each
local change. It used to POST the local `revealedThrough` to `/api/reveal` before
every mint to satisfy the retired gate (§4.1); that push is gone, and its removal
is what let a backlog of unsyncable stamps finally upload. Notes commit on blur,
not per keystroke — every save bumps `updatedAt`, which
is what the sync diffs on, so per-keystroke writes would publish a request per
character.

A book's own identity (title, subtitle, cover club) syncs on a separate
`books` channel — `api/books.js` + `src/components/sync/BooksCloudSync.jsx`,
modeled on `api/spoiled-days.js`'s shape (one small per-user Redis hash, no
season sharding, since a user holds at most `MAX_BOOKS` of them) rather than
`api/stamps.js`'s. Same removability-sync shape as stamps: a removed book
publishes an explicit `'off'` rather than being deleted, so a device that was
offline for the removal still learns about it on reconnect instead of a plain
union merge resurrecting it. See ADR-0041.

### 4.5 Stamp art

`src/components/logbook/GameStamp.jsx` is a tracing with no numbers of its own;
the geometry is pure math in `src/lib/stampArt.js` (unit-tested), the ink in
`src/lib/stampInk.js`, and per-club mark placement in `src/lib/stampLogoTuning.js`
— tunable from the Identity Lab. The ink defaults to the winning club's darkest
brand colour but a club may override it (`src/lib/stampInkTuning.js` +
`src/lib/data/stamp-ink.json`, tuned from the Stamp ink row at the foot of the
Identity Lab's Stamp placement card),
still walked through the same contrast floor either way (ADR-0036). **A stamp
stores the game, never the art**, so it redraws from those numbers every time:
retuning a club restyles every stamp of it already sitting in every user's
collection, the moment the change ships.

---

## 5. Surfaces and routes

| Route | Screen | Notes |
|---|---|---|
| `/logbook` | `LogbookPage.jsx` → `LogbookCollection.jsx` or `LogbookShelf.jsx` | signed out on a Clerk-configured deploy: feature pitch; signed in (or Clerk unavailable): exactly one live book opens directly (today's behaviour, unchanged); two or more show the shelf. `season: null` means "newest season you have stamps in", resolved by the page |
| `/logbook/{season}` | `LogbookCollection.jsx` | one season of the DEFAULT book, byte-for-byte unchanged parsing since before ADR-0041; out-of-range falls back to the bare book |
| `/logbook?place={gamePk}` | same | placement mode for one stamp |
| `/logbook/stats` | `LogbookStatsPage.jsx` | the retrospective over the WHOLE collection, every book — **this branch must stay above the season branch in `route.js`**, or `/logbook/stats` parses as season `NaN` and silently renders the bare book |
| `/logbook/book/{bookId}` | `LogbookCollection.jsx` | a specific non-default book, newest season — additive since ADR-0041, the only way to deep-link one |
| `/logbook/book/{bookId}/{season}` | same | one season of that book |
| `/logbook/book/{bookId}/stats` | `LogbookStatsPage.jsx` | that one book's retrospective — **must stay above the season branch above it, for the identical parsing reason** |

There is one more surface that MINTS a stamp without being part of the Game
Log's own routes — **Stamp In**, `/team/{id}/stamp-in` (ADR-0042). It lists a
club's played season with every result showing, behind a one-time per-device
consent, so a reader can press a stamp for each game they watched instead of
opening every box score in turn. Three properties keep it honest and all three
are enforced: it is **render-only** (it never writes `bbsbh:reveal:{gamePk}` or
advances `revealedThrough`), it has **exactly one entry point** (the Schedule
card's button on the Games tab — not a tab, not in `reportPages.js`, not linked
from the Game Log), and it **may mint a stamp but never draw one**
(`check-stamp-surfaces.mjs`'s `FORBIDDEN_ART_FILES`). Its copy lives in the
`stampIn` group of `src/copy/registry.js`, not in the twelve files above.

Entry points: the labelled pill in the slate header (`LogbookButton.jsx`), the
More menu and both footers (via `reportPages.js`), and the mint strip across the
head of a revealed box score.

**The Open Graph card** (`api/_lib/cards.js`, key `logbook`) is generic and static
— it describes the feature, never a collection. It must stay that way: the card is
rendered into a link the sender is about to hand to someone whose reveal state is
unknown to us.

---

## 6. Invariants — do not break these

1. **Containment is the whole spoiler argument** — a stamp is reachable only from
   inside a revealed box score, and renderable only where the guard allows. §4.1.
2. **The box score's stamp `SealBox` gets no `onReveal` and persists nothing.**
3. **`GameStamp.jsx` and `StampGameButton.jsx` stay inside their import
   allowlists** — `scripts/check-stamp-surfaces.mjs` is not advisory. A surface
   that mints without drawing (Stamp In) joins `FORBIDDEN_ART_FILES` instead of
   widening either allowlist.
4. **The `/logbook` route never changes.** §2.
5. **The record never stores a score**, only enough to resolve one at render time.
6. **The OG card never names a game, club, record, or count.** §5.
7. **"The score on it never changes" stays true**, in behavior and in copy. §3.1.
8. **A user is never left with zero books.** `useBooks.js`'s migration
   guarantees one always exists; the remove-a-book UI refuses to tombstone
   the last live one, the same way a full season is refused rather than
   silently doing nothing. ADR-0041.

## 7. Open threads

- **The "Game log" name collision with the player page's stat ledger** — §2,
  undecided.
- `attended` as a third mode, with its own overprint on the stamp art (§4.2).
- The retrospective is counts and records today; the PRD sketches more (who raked
  in the games you personally sat through) that has not been built.
- See `.scratch/game-stamps/PRD.md` for the running build-order status and the
  numbered list of deliberate departures from the original scoping.
