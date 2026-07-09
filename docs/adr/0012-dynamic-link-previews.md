# Dynamic link previews live in a thin edge layer — the one exception to "no backend"

bbsbh is otherwise a pure static SPA: every device queries statsapi directly and
there is no server of our own (see the architecture note in `CLAUDE.md`). Link
previews break that model on purpose, and only that model.

## The problem

Share a deep link — a player, a matchup, a team — into iMessage/Slack/Discord/
Twitter and the platform's crawler fetches the page and reads the `<head>` for
its preview card. Crawlers **do not run JavaScript**. Our SPA swaps the real
`og:*` tags only after React mounts, which the crawler never sees. And
`vercel.json` rewrites every non-asset path to the same `index.html`, so before
this change *every* shared link previewed with the identical hardcoded
phone-mockup card. There is no static-only fix: the space of players/games is
unbounded, so we can't pre-render a file per link, and the correct tags depend
on data (a player's name, a game's two clubs) known only at request time.

## The decision

Add a **crawler-only edge layer**, and nothing more:

- **`api/og.js`** — an `@vercel/og` (Satori) function that renders the 1200×630
  card as a PNG: player headshot + name/team/pos, both clubs' logos for a
  matchup, a club logo for a team, a labeled brand card for the rest. Images are
  fetched from the same mlbstatic CDNs the app already uses (headshots keyed by
  the person id that's right in the URL; logos by team id) and inlined as data
  URIs so a slow/failed CDN fetch degrades to a monogram/abbreviation. The card
  wears the paper-scorebook look and obeys the ALL-CAPS INVARIANT
  (`textTransform: uppercase`, matching `src/index.css`).
- **`api/preview.js`** — for the deep-link routes, fetches our own static
  `index.html` and swaps the `<!-- OG:BEGIN … OG:END -->` block for the route's
  computed tags. Real users get the same HTML and the SPA boots unchanged; the
  only thing a human notices is a correct per-page `<title>`.
- **`api/_lib/cards.js`** — the one place this layer talks to statsapi
  (server-side), resolving a route to the handful of display strings both
  functions share. Mirrors `resolveGame`/`matchupSlug`/`teamAbbr` from `src/`.
- **`vercel.json`** rewrites the deep-link paths to `api/preview` (encoding the
  route in the query); everything else keeps the existing SPA rewrite.

## Why this doesn't violate the spirit of "no backend"

- **The app is untouched.** The SPA still fetches every byte of game data
  directly from the client. This layer is invisible to it.
- **It's for crawlers, not features.** No app behavior depends on it. If the
  whole edge layer vanished, the app would work exactly as before — links would
  just preview with the old static card.
- **It fails safe.** Every builder returns `null` on any error and the injector
  keeps the static default block, so a statsapi hiccup can never break a shared
  link, only make its preview generic.
- **The spoiler rule holds.** A matchup card shows logos + names, never a score;
  a player/team card is season-agnostic identity. Nothing score-revealing is
  ever rendered or fetched into a preview.

## Cost we accepted

The first hard load of a deep link now passes through `api/preview` (a statsapi
round-trip for player/team/game routes) before the HTML returns — a few hundred
ms on cold shares only. Client-side (pushState) navigation never hits it, so
in-app movement is unaffected. If that latency ever matters, the mitigation is
to user-agent-gate the rewrite so only crawler UAs take the edge path; we chose
the simpler always-on route for now (it also gives humans correct titles).

Regenerate/verify the cards by rendering `api/og.js`'s exported `buildTree`
through `@vercel/og`'s `ImageResponse` in Node (it runs there too) and eyeballing
the PNG — that's how these were checked.
