# ADR-0042 — Stamp In is a consented season of results, at one address

Status: accepted (2026-08-08)

## Context

The Game Log's mint lives inside a revealed box score, and that is the whole of
ADR-0035's surviving argument: a stamp can only be **reached** from inside a
game you already opened, and only **rendered** where the containment guard
allows. It is a good argument. It is also, in practice, a slow one.

A stamp records a game you *watched*. Watching a game and scoring it by hand are
not the same act — you watch far more games than you score, and the ones you
watched from the couch in April are exactly the ones you now want in the book.
Reaching them through the existing flow means opening each game, tapping through
to its box score, lifting that seal, stamping, and coming back. Once per game.
For a season.

So the request is a page that lists a club's played season with the results
already showing, and one stamp button per row. Every part of that sentence is a
departure from what this app is for, which is why it needs its own decision
rather than a component.

## Decision

**One address shows a whole season of final scores, and getting to that address
is the consent.**

> `/team/{id}/stamp-in` lists a club's played season, newest first, with every
> result visible. It is entered from exactly one button, gated by a one-time
> consent on the page itself, and it is a RENDER-ONLY surface: it never writes
> `bbsbh:reveal:{gamePk}` and never advances `revealedThrough` for any game.

Four things make that sentence safe, and none of them is optional.

### 1. It is scoped to an address, not to a mode

Scores Unlocked (ADR-0026) is the app's other consented departure, and it is
site-wide and time-boxed: flip it on and *today* opens everywhere. This one is
the opposite shape. It opens **one page**, for **one club**, and nothing else in
the app changes — not the slate, not the innings viewer, not the box score, not
another club's page, not tomorrow. Turning the two knobs differently is
deliberate: a pass over a day has to be a pass over every surface, because a
score you have seen is seen; a page you deliberately opened is a place you can
simply leave.

The corollary is that the consent record is **not** a spoiled day. It records
"I agreed to this page", never "I have seen these games". `bbsbh:stampIn` sits
alongside `bbsbh:spoiledDays` and `bbsbh:reveal:{gamePk}` without touching
either, exactly as ADR-0026 keeps its own two stores apart.

### 2. The gate is on the page, not on the button

The consent interstitial mounts on `/team/{id}/stamp-in` itself, not on the
Schedule card's button that leads there. That is the only placement that works:
the route is a real address, so it is bookmarkable, shareable, and reachable by
typing. A gate that lives on the door you *usually* come through is a gate with
a hole in it.

**Nothing is rendered, and nothing is fetched, before the answer is yes.** The
season is a separate component that is mounted only once consented — so an
unconsented visit has no result in the DOM and has not asked statsapi for one
either. This is the fetched-then-hidden failure the spoiler rule names by name,
avoided by construction rather than by a `display: none`.

The consent is per device (`localStorage`, never synced), and it **fails
closed**: bad JSON, an array, a missing flag, a merely-truthy `consented` — all
of them parse to "not consented" and ask again. Its rules are pure in
`src/lib/stampIn.js` and pinned in `test/stamp-in.test.js`, so the ask-again
direction is the one the tests hold, not a convention.

### 3. Render-only, in ADR-0026's exact sense

The page draws finished games. It **must never mark one as scored.**

This is the invariant with real blast radius, and it is worth stating why. The
reveal mark is persisted, cloud-synced, and forward-only. A page that advanced
it would not merely open itself — it would silently unseal those games on every
*other* screen and on every one of the reader's other devices, permanently, for
games they never opened. That is a worse outcome than the page existing at all.

So: the screen mounts no `SealBox`, imports no `useRevealProgress`, and passes
no `onReveal` to anything. It reaches the reveal ratchet nowhere. The same
constraint the box score's mint `SealBox` carries (ADR-0035: "no `onReveal`, and
persists nothing") applies here in a stronger form, because here there is no
seal to speak of at all.

Note the asymmetry with ADR-0026 that follows from this. Scores Unlocked needed
`commitReveals` because its force-revealed `SealBox`es would otherwise ratchet
the mark by merely being looked at. This page needs no such suppressor, because
it never mounts the mechanism that would do the ratcheting. **Any future change
that puts a `SealBox` on this page inherits ADR-0026's question and must answer
it.**

### 4. Containment holds — it MINTS stamps, it does not DRAW them

ADR-0035's second amendment retired the server-side reveal gate and left
containment — *where stamp art may render* — as the entire argument. This page
does not weaken it. `scripts/check-stamp-surfaces.mjs` gains a
`FORBIDDEN_ART_FILES` list, the per-file counterpart of the directory list My
Tally already sits on, and both new files are on it:

- `screens/team/StampInPage.jsx` and `components/logbook/StampInButton.jsx` may
  call `useStamps` — minting is the feature — and may **not** name `GameStamp`
  or `StampGameButton`.
- Neither `GameStamp.jsx`'s nor `StampGameButton.jsx`'s import allowlist was
  widened. The stamp ART's reachable surfaces are exactly what they were the
  day before this shipped.

The count-versus-art line is the same one drawn for `/profile`: a *record* that
you hold a stamp is not a score, and here the score is already on the page by
consent anyway. What would be wrong is 162 finished keepsakes rendered on the
app's densest score surface, which is a different artifact with a different
argument, and this guard is what stops one arriving by accident.

## Consequences

- **One entry point, and it stays one.** The Schedule card's button on
  `/team/{id}/games` is the only link to this page anywhere in the app. It is
  not a sixth team tab (deliberately absent from `TEAM_TAB_ROUTES`, so
  `TeamTabBar` never draws it), it is not in `src/lib/reportPages.js`, so it
  reaches neither the site menu nor either footer, and nothing in the Game Log,
  the box score or the slate links to it. A second door is a second place to
  walk into a season of scores without meaning to.
- **Only games already PLAYED appear.** A scheduled game has no result and
  nothing to stamp. `stampInGames` filters on a result being present at all — a
  decided `won`, or both clubs' run totals for the rare final with no winner —
  which also means a dated (`?d=`) visit is honest for free: `fetchTeamSchedule`
  nulls those fields past its cutoff, so a cut-off game is simply not on the
  list.
- **The season is fetched one card at a time.** Each row needs its own feed and
  win probability, and a season is up to 162 rows — fetching on mount would be
  ~324 requests in a single burst, the largest network event in the app by an
  order of magnitude. Rows load as they approach the viewport
  (`IntersectionObserver`, a 600px margin) through a four-slot queue that is
  **LIFO on purpose**: a fast flick crosses fifty rows in a second, and serving
  oldest-request-first would spend the whole budget on cards already scrolled
  past. `usePastGameSignals`' module cache makes a second look free.
- **The cap refuses, and the page says so.** `MAX_STAMPS_PER_SEASON` rejects
  rather than prunes (ADR-0035). A row that cannot be stamped prints the
  refusal instead of offering a control that quietly does nothing.
- **No new backend.** The consent is one `localStorage` key; minting goes
  through the Game Log's existing local-first store and its existing sync. No
  new Vercel function, and nothing new to be inert when unconfigured.
- **MiLB degrades, it does not crash.** A club with no posted schedule renders
  "No games posted yet"; a thin row with no opponent still stamps, with the date
  alone as its accessible name.
- **`GameResultFace` gained one prop, `trailing`** — an already-rendered node
  the host drops at the end of the card's top row. The component neither knows
  nor can know what it is, which is what keeps that file free of any stamp
  identifier while still hosting the button. Every existing caller passes
  nothing and renders exactly as before.

## The voice, and the line it is close to

`docs/game-log.md` §1 is explicit that the Game Log is **not a checklist** — no
completion state, no badge, nothing to finish — and §3 forbids congratulating,
counting, or implying progress. A page listing a whole season with a green
check on the games you have marked is the closest this feature has come to that
line.

It stays on the right side of it by carrying **no total, no count, and no
proportion**. There is no "37 of 162", no bar, no streak, and the green state
says *you hold this one*, never *you are this far along*. The lede is about what
you watched. If a future change adds a counter to this page, it has quietly
turned the Game Log into the thing it was designed not to be — and it should
change §1 first, in the open, rather than as a side effect.

## Alternatives considered

- **A season-wide "reveal all" on the existing Games tab.** Rejected: the Games
  tab is a normal, sealed surface reached by anyone browsing a club, and putting
  an unseal-everything control on it makes every visit one mis-tap from a
  spoiled season. A separate address with its own consent is the point.
- **Reuse Scores Unlocked for this.** Rejected on both ends. It is a day pass,
  and this need is season-shaped; and it opens *every* surface, where this needs
  exactly one. Consenting to a season of one club's finals is a smaller ask than
  the pass, and folding it in would have made it a larger one.
- **Gate the button rather than the page.** Rejected: the route is real and
  bookmarkable, so the button is not a chokepoint. See decision 2.
- **Let the page mint through the box score's `StampGameButton`.** Rejected: it
  would mean widening the containment allowlist — the one list ADR-0035's
  amendment left standing as the entire spoiler argument — to admit a surface
  that lists games in bulk. A plain control that calls the same store costs one
  small component and widens nothing.
- **Fetch every game's signals on mount and cache the lot.** Rejected on cost
  alone; see the lazy-loading consequence above.

## Amendment (2026-08-16) — the constraint cited above has moved

The parenthetical citation of ADR-0035 ("no `onReveal`, and persists nothing")
describes the box score as it was. **ADR-0049** gave that `SealBox` an `onReveal`
that records a real tap as one bit (`bbsbh:boxreveal:{gamePk}`) and nothing more.

Nothing about this page changes. Stamp In still mounts no `SealBox`, imports no
`useRevealProgress`, and passes no `onReveal` anywhere — it reaches the reveal
ratchet nowhere, which is the property this ADR needed. And ADR-0049's bit is
scoped to the one box score whose seal was tapped, so a season of games listed
here can never acquire one.
