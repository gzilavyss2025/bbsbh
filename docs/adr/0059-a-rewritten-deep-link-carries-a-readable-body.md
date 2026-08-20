# ADR-0059 — A rewritten deep link carries a readable body

Status: accepted (2026-08-20)

## Context

`api/preview.js` has served the ~30 deep-link routes in `vercel.json` since
ADR-0012. It fetches the built `index.html`, swaps the `OG:BEGIN…OG:END` block
for the route's card, and returns it. The body it returns is
`<div id="root"></div>`, and always has been.

ADR-0053 established what that costs and cites the measurements: Google renders
JavaScript, and the crawlers behind AI assistants do not. GPTBot, ClaudeBot,
PerplexityBot and Applebot-Extended fetch script files and execute none of them.
So to an answer engine, every player page, every club page and every leader board
on this site is a blank div with a good meta description.

ADR-0053 solved this for `/learn` alone, by rendering those guides as real
documents through `api/page.js`. It solved it there because that is where the
prose was. It left the rest of the site exactly as it found it, and ADR-0057 then
named the gap in its own Consequences: a named address is worth having, but "the
body an unrewritten crawl receives is still `<div id="root"></div>`".

The gap is worth closing here rather than anywhere else because `api/preview.js`
is already holding everything needed. It has the route resolved. It has the
statsapi payload in hand — `buildCard` fetched a person, a club or a game to
write the card. And it is the only surface that knows which route it is serving.
A body built there costs no request that was not already made.

## Decision

**The spoiler-free rewritten routes carry a readable body.** A player page names
him, his club, his position, his bio and his season line, and links to his club's
pages. A club page names the club, its league, division, level and ballpark, and
links to its own six tabs. The ~25 report routes carry their heading and what the
page is. Every body ends with a short rail into the rest of the site.

**Game routes carry no body at all.** See "The spoiler rule decided two of these"
below; this is the decision the rest of the design was shaped around.

**The markup is a sibling of `#root`, and `src/main.jsx` removes it one statement
before it renders.** `createRoot().render()` clears its container, so markup
placed inside `#root` would be cleared for free — and would paint IN CAPITALS
until then, because the ALL-CAPS INVARIANT is scoped to `#root *` and the built
shell loads that stylesheet as a real `<link>`. That is ADR-0053's second reason
for a standalone document, applied to a surface that is not one.

Hiding the sibling instead — `#crawl { display: none }` in the app stylesheet —
was considered and rejected. It removes the flash completely, and it shows
content to clients that do not apply CSS while hiding it from clients that do,
which is the shape of cloaking whatever the intent. What a reader without
JavaScript sees is exactly what a reader with it sees before the bundle takes
over, and the flash is the honest cost of that.

**The request count per route does not change, with one exception that is the
point.** A player's season line rides `hydrate=stats(type=season)` on the call
the card already makes — statsapi defaults to the current season and picks the
group from the position, so it costs about a kilobyte and no round trip. A club's
body is built from the `/teams/{id}` response already fetched.

The exception is `/team/{id}/roster`, which adds one call for the active roster.
It is fired in parallel with the card, so the route's wall-clock is unchanged,
and it is reached only from `api/preview.js` — `api/og.js` draws a mark and a
level line and goes on making the one request it makes today. What it buys is the
link graph this site has never had: a crawler that reaches one club roster page
reaches its whole active roster from it — twenty-six players at MLB level, about
thirty at the others — by following markup.

**`api/_lib/cards.js` remains the one place this app talks to statsapi from the
server side, and its header now says what it feeds.** The second half of that
claim — "it exists only to feed crawler link-previews" — stopped being true, so
it was rewritten rather than left to rot.

**Cache headers gain a third band.** An entity route keeps `s-maxage=3600`: its
body is built from the same payload as its card and goes stale on the same event,
a trade. A report route is built with no statsapi call at all, so neither its card
nor its body can differ between two requests — those go to `s-maxage=86400`,
stale-servable for a week. An unresolved card keeps the 30 seconds ADR-0012 gave
it, for the reason recorded there.

**The sitemap now lists club pages, and still lists no player page.** The
exclusion was written down as "there are thousands, they turn over every season,
and a sitemap full of URLs that 404 next spring is worse than a short one that
stays true". Half of that is wrong and it is the load-bearing half: these pages do
not 404. An id resolves forever, a retired player's page still renders his career
register, and since ADR-0057 the address carries a name.

So the reasons were re-derived rather than re-asserted, and they split:

- **Clubs go in.** There are 150, not thousands. Realignment moves that list about
  once a decade. The ids come from `public/data/teams.json`, which
  `gen-teams.mjs` already refreshes weekly — so `gen-sitemap.mjs` gains no
  statsapi call and no build dependency, which matters because it runs inside the
  Vercel build. Every club gets its hub and its roster tab; MLB clubs get all six
  doors, because an affiliate's Numbers and Minors tabs are the thinnest pages
  here. 420 URLs, each with a body.
- **Players stay out.** There are five figures of them, twenty-five times the
  rest of the sitemap put together, and no precompute in this repo means "the
  players worth listing" — `war.json` and `salaries.json` each hold a bounded set
  and each would be a repurpose that shrinks the day its own generator changes a
  filter, silently. They do not need it: the roster pages name them as links.

The address a listed URL uses is spelled by `route.js`'s own `entitySegment`, so
it is byte-identical to the canonical `api/preview.js` writes. A sitemap naming
the other of two working addresses lists a page that points somewhere else.

## The spoiler rule decided two of these

A server-rendered body is DOM that exists before any human asked for it, which is
what the rule forbids on the scoring surfaces. Everywhere else in this app a
score is safe because a `SealBox` decides when a render function runs (ADR-0002).
Here the HTML is composed complete and handed to whoever asked, including an
anonymous crawler, with no seal in front of it and no reveal mark consulted —
exactly the position ADR-0053 records for `/learn`.

**So game routes get no body, and not by being careful.** `gameCard` returns no
description object, `api/_lib/crawl.js` has a player builder and a club builder
and no third one, and `api/preview.js` has nothing to render when the card
carries none. There is no branch to get wrong. The reason is in the payload:
`resolveGame` reads the schedule, and `teams.away.score`, `isWinner` and `status`
sit in the same object as the matchup a body would name. A lineup-and-umpires
body may well be safe; it is one careless template edit from not being, on a
route whose crawl value is close to zero because nobody searches a dated matchup.
That is a poor trade, so it is not made.

**The player's season line stays, and is not a departure.** ADR-0034's "the
cutoff is opt-in now" already settled it: a season aggregate is not a score, it
is the number the back of a baseball card has carried for a century, and freezing
it was the rule reaching past what it protects. The body prints exactly what the
app's own player page renders live at that same URL. A club's W-L is a different
matter — that runs through the cutoff-gated modules in
`src/api/spoiler-manifest.json`, a number that takes an `asOf` for a reason — and
nothing here has a reader to ask, so a club body prints no record.

**The enforcement is structural and asserted.** Nothing in this layer imports
`src/api/`; `api/_lib/crawl.js` imports exactly one module, the slug helpers in
`api/_lib/entity.js`, which import nothing at all. `test/crawl-body.test.js` pins
that over the import graph, pins that the game builder returns no description,
and pins that a club body carries no record — the same shape
`test/landing-pages.test.js` uses for the guides.

## Consequences

**A human on the first hard load of a shared link sees the body for a moment.**
Only there: client-side navigation never reaches this function, and an installed
reader never does either, because the service worker answers navigations with the
precached shell (`navigateFallback`, with only `/learn` on its denylist). A small
scoped stylesheet in the head keeps that moment looking like a plain document
rather than unstyled soup, and the body is removed one statement before the app
paints. The alternative was to hide it from browsers, which is the rejected
option above.

**`api/_lib/` gained two files, and `cards.js` came out barely longer than it
started.** It grew past the 600-line ceiling first, and the file-size guard's
answer to that is a split rather than a budget entry — which is what that guard
is for (ADR-0038). The body's builders and its renderer went to `crawl.js`
together, because they are one subject; the slug helpers went to `entity.js`
because a second module needed them the moment club pages started linking to
players. What `cards.js` keeps is what it was always for: talking to statsapi.

**Two copies of the slug helpers are now three consumers of one.** `entity.js` is
still an edge-side copy of `src/lib/route.js`, and `test/cards.test.js` still
asserts it against the app's own — the file moved, the obligation did not.
`scripts/warm-previews.mjs` keeps its own copy for the reason its header gives.

**The root `CLAUDE.md` was left alone deliberately.** It is at 200 of 200 lines,
its architecture map's claim about `/learn` is not made false by any of this, and
the rule there says to put detail in the right tier rather than raise the cap.
This ADR is that tier.

**What is still open.** Umpire and manager pages have no rewrite in `vercel.json`
at all, so they get neither a card nor a body; they are the obvious next routes.
Nothing here renders a MiLB club's affiliation, because `/teams/{id}` does not
carry a parent org and a second call for one is not worth it on a page whose
Minors tab already says it. And a player-page listing, if it is ever wanted, needs
its own generator and a cut somebody defended — not a data file borrowed for a
second job.
