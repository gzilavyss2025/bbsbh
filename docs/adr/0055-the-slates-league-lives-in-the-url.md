# ADR-0055 — The slate's league lives in the URL, and MLB is the absence of it

Status: accepted (2026-08-20)

## Context

The slate — the app's home screen — shows one league's games on one day. The
day had been a URL segment since the beginning (`/08152026`, bare `/` = today),
so a day was shareable. The league was not. It was a My Tally preference,
`level`, stored per user and synced between a signed-in reader's devices, with
a "Level the slate opens on" control in `/profile` and the `MLB/AAA/AA/A+/A`
pills on the slate itself writing to it.

That meant the app's shortest address named a different page for every reader.
Sending someone "today's Triple-A games" was not possible at all: the pills
changed the screen and left the URL alone, so whatever you copied out of the
address bar showed the recipient *their* league, not yours. A reader who had
once tapped AAA got AAA for every link anybody ever sent them, including links
meant to show an MLB game's day.

The preference itself was a reasonable idea — somebody scoring an affiliate all
season should not have to re-pick their league every visit — and it is the
reason the league was not in the URL to begin with. It is also what made the
URL unable to say which league it meant.

## Decision

**The slate's league is a URL segment. Nothing else decides it.**

```
/                    MLB, today
/08152026            MLB, one day
/aaa                 Triple-A, today
/aa/08152026         Double-A, one day
```

Four shapes, and the parse is one branch in `src/lib/route.js`. The route
carries `sportId`; `slatePath(apiDate, sportId)` builds it; `GameSelect` takes
both as props from `App.jsx` and navigates rather than setting state, so a
league tap and a day page are the same kind of move — a new address, with
Back/Forward walking what you visited.

**MLB and today are each the ABSENCE of a segment.** There is no `/mlb` and no
`?s=1`. This is the load-bearing half of the decision, not a tidiness
preference: it is what makes the bare `/` mean today's MLB games *for
everybody*, which is the only way an MLB link can be shared at all. A default
that emitted a segment would give the same page two addresses and leave the
short one ambiguous again — exactly the problem this replaces.

**The league is spelled the way it is spoken.** `aaa`, `aa`, `higha`, `a`. A
shared link is read out loud more often than it is typed, and "High-A" is what
the level is called. The leader board's scope vocabulary (`src/api/leaders.js`)
spells the same level `aplus` in `/leaders/aplus`; those links are already
shared and renaming them would break inbound ones for nothing, so `aplus` is
accepted as an inbound alias on the slate and never emitted.

**A malformed day degrades to that league's today**, matching the shrug the
bare-date branch already takes (`/13452026` is today's slate, not an error).
`/aaa/13452026` is Triple-A today. The league survives a mangled date because
losing it would silently answer with a different league's games.

## Consequences

**The `level` preference no longer steers anything, and its control is gone.**
"Level the slate opens on" is removed from `/profile`'s Baseball section — a
setting that answers a question the address already answers, out loud, would
have been a control with no effect. The stored field stays in the closed
registry in `src/lib/account/preferences.js`, marked retained-not-read, because
the preference document is shared with devices that have not reloaded yet:
dropping the field would turn their perfectly valid stored value into a rejected
one, and last-write-wins cannot tell that apart from a hostile write. Retire the
field once nothing publishes it.

**The trade is deliberate and it is a real one.** A reader who scores an
affiliate all season now lands on MLB when they open a bare link, and reaches
their league by bookmarking `/aaa` instead of by having told the app once. That
cost buys the thing the preference made impossible: a link that shows its
recipient the same slate its sender was looking at. Sharing was the point; the
preference was the obstacle.

**The slate's own wordmark had to learn the league.** It is labelled "Reload
games" and its job is to land on today's games where you are — under the old
behaviour `assign('/')` did that, because `/` rendered your saved league. It
would now drop an affiliate reader onto MLB, so `goHome` takes an optional path
and the slate passes `slatePath(null, sportId)`. `SiteHeader`'s wordmark, which
means "home" rather than "reload", still calls it bare and still gets `/`.

**No league slug shadows a named route.** They are two-to-five letters and every
single-segment route in the app is a word (`/about`, `/awards`, `/attendance`,
`/all-star-rosters`). The parse is an exact table lookup, never a prefix match.

**Nothing here touches the spoiler rule.** The slate's score cells are sealed by
`revealedThrough` and the Scores Unlocked consent exactly as before; which
league's games are listed is not a score, and the URL carries no reveal state.

- Pinned by `test/route.test.js`: the four shapes, the two absent defaults, the
  `aplus` alias in but never out, a full round-trip through `slatePath` and
  `parseRoute` for every slug, the malformed-day fallback, and the named routes
  that start with the same letters.
