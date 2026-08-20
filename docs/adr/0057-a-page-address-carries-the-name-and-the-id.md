# ADR-0057 — A page's address carries the name AND the id

Status: accepted (2026-08-20)

## Context

Every page in this app about a person or a club was addressed by a bare number:
`/player/545361`, `/team/158/roster`, `/umpire/427044`. That number is the right
key — it is the MLB id, and this repo's oldest convention is that team and person
ids are the universal key that drives the schedule, the box score and the logo
CDN alike. It is a poor *address*.

Three things a numeric address cannot do. A reader who is handed one cannot tell
what it opens, so a link pasted into a message says nothing until it is clicked.
A search engine gets no term from the URL, and the URL is one of the few signals
it reads before it has rendered anything. And an answer engine — the audience
ADR-0053 was written for, which runs no JavaScript at all — sees a page whose
body is an empty div and whose address is a number.

The obvious alternative, a name-only address (`/team/brewers`), fails on the
things the id was right about. Names collide: two Will Smiths pitched in the same
league at the same time. Names change. And roughly 120 MiLB clubs would need a
slug table maintained against every rename, in the browser, forever, when their
own feed already names them.

There is also a hard constraint that rules out simply switching. Bare-id links
are already out in the world — shared in messages, bookmarked, sitting in the
Game Log next to stamps. Whatever happens next, every one of them has to keep
opening the same page.

## Decision

**A page about somebody is addressed `{slug}-{id}`, and the id stays
authoritative.** `/player/mike-trout-545361`, `/team/milwaukee-brewers-158/roster`,
`/umpire/pat-hoberg-427044`, `/leaders/org/pittsburgh-pirates-134`.

**Reading is loose; writing is strict.** `parseRoute` takes the trailing digits
of the segment and ignores everything in front of them. So the bare form still
resolves — no redirect, no lookup table, no expiry — and so does a *wrong* slug,
which is what lets a traded player's old link keep working. The builders emit the
slugged form whenever a name is in hand and the bare id when it is not, so a
half-loaded row still produces a working link rather than `undefined-158`.

**No redirects.** Both forms resolve, which is exactly the situation
`rel=canonical` exists for. `api/preview.js` — the only surface that knows which
route it is serving — writes the canonical at the slugged form, spelled from the
name statsapi just returned rather than from whatever segment the request
arrived on. A 301 would have cost a statsapi round trip on the first load of
every shared link, which is the load that matters most.

**Clubs name themselves.** All 30 MLB clubs are already in a static table
(`teams.js` `MLB_TEAM_NAMES` → `teamFullName`), so `teamSegment` slugs every
`/team/...` address with no caller passing anything — which is most of the team
hub, where a tab button knows an id and a tab key and nothing else. A MiLB club
is not in that table; those callers pass the name their feed gave them, and an
affiliate whose feed has not landed keeps the bare-id address it always had.

**Links borrow the name they are already rendering.** `PlayerLink`, `TeamLink`,
`UmpireLink` and `ManagerLink` wrap a name, so `nameFromChildren` reads the slug
off the children rather than making forty call sites each learn to pass one. It
is shallow on purpose: children that are art carry no string, and that caller
passes `name=` instead.

## Consequences

A slug is DOM text on pages inside the spoiler scope, so **a slug may only ever
be spelled from an identity — a person's name, a club's name — and never from a
result.** A matchup is safe; a winner, a margin or a walk-off is not. Nothing in
the scheme reads `linescore.js` or `derive.js`, and nothing in it may start to.

The helpers are mirrored in two places that cannot import `src/lib`:
`api/_lib/cards.js` (the edge runtime) and `scripts/warm-previews.mjs`. Drift
there means the client links to one address while the canonical names another —
the exact failure this scheme exists to avoid — so `test/cards.test.js` asserts
the edge copies against the app's rather than trusting the comment that says to
keep them in sync.

Warming now targets the slugged address. The bare form still resolves, but it is
a different edge cache key and no crawler is going to ask for it.

**This does not, on its own, make the pages legible to an answer engine.** The
body an unrewritten crawl receives is still `<div id="root"></div>`; ADR-0053
solved that for `/learn` alone. A named address is worth having regardless — for
the reader, for the link preview, and for the share — but the larger part of that
problem is still open, along with a sitemap that lists no player or club page at
all.

Game addresses are unchanged. `/07052026/milari/bottom3` still spells its
matchup as concatenated abbreviations, doubleheader suffix and all.
