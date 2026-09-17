# Dynamic link previews live in a thin edge layer

bbsbh's game-data path is otherwise pure client-direct: every device queries
statsapi directly (see the architecture note in `CLAUDE.md`). Link previews
are the first departure from that path, and only that path.

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

## Why this stays narrow

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

## 2026-07-22: hardening a reproduced game-link failure

A shared "game in progress" link was found to fall back to the static default
card. Root cause: `resolveGame()` (`api/_lib/cards.js`) fanned its 5
sport-level schedule calls out via `Promise.allSettled`, which waits for
every level to finish even after the MLB answer is already in, and none of
those calls had a timeout (unlike `api/og.js`'s font/image fetches) — a slow
statsapi response (more likely exactly when a game is live) could stall
resolution with no ceiling. Worse, `api/preview.js` cached a failed
resolution identically to a correct one (`s-maxage=3600`), so the one
crawl that matters most — iMessage's, which fetches a link's preview once on
the sender's device and never retries — could bake the wrong card in for up
to an hour+ even after the underlying hiccup passed.

Fixed by: a shared `fetchWithTimeout` (`api/_lib/http.js`, extracted from
`api/og.js`) now also guards `cards.js`'s statsapi calls; `resolveGame`
resolves as soon as any sport level's schedule contains the wanted matchup
instead of waiting on all 5; and `api/preview.js` gives an unresolved card a
much shorter cache lifetime (`s-maxage=30`) so a transient miss self-heals
fast instead of sticking.

Also added, since MLB's schedule is known well ahead of first pitch:
`scripts/warm-previews.mjs`, a nightly best-effort pass that pre-warms the
edge cache for the day's games/teams/rosters so the first real crawl is
rarely cold. It only covers the finite, predictable routes (`lineup1`/
`lineup2`/`boxscore`, team/player pages, and each game's single `og:image`,
which is shared across every inning section) — the open-ended in-game
`top{n}`/`bottom{n}` sections aren't precomputable, which is why the
reliability fix above is the piece that actually covers an arbitrary
mid-game share.

## Amendment (2026-09-15) — the image is static for now; the card is not

Every card's `og:image` now points at the static `public/og-image.png` instead
of a per-route `api/og.js` render. `ogUrl()` in `api/_lib/cards.js` is the
whole change, and reverting that one function restores per-route art.

**What forced it.** Drawing one card costs about 400ms of CPU: Satori lays the
card out, then resvg rasterises a 1200x630 PNG. That price is fine for a link
somebody actually shared. It is not fine multiplied by the warm pass this ADR
added above, which asks for roughly 855 cards a night — three sections per
game, both clubs, and every player on all thirty active rosters.

Measured in Vercel Observability on 2026-09-15, over twelve hours:

| route          | invocations | CPU  |
|----------------|-------------|------|
| `/api/og`      | 885         | 6m   |
| `/api/preview` | 921         | 51s  |
| all 12 Node functions combined | ~180 | ~8s |

Six minutes of CPU per twelve hours is about six hours a month, against the
Hobby plan's four-hour Active CPU allowance. `/api/og` alone was the entire
overage, and the near 1:1 ratio with `/api/preview` shows what it was spent
on: the warm pass drawing cards for links nobody had shared yet, every night.

Raising `s-maxage` does not fix this. The edge cache is keyed per deployment
and this project deploys about three times a day — nightly data plus merges —
so no function cache survives more than about eight hours regardless of the
header. The warm pass then repopulates it from cold.

**What a shared link keeps.** Its own `<title>`, description, `og:image:alt`
and canonical, all still built per route by the builders above. Only the
picture is shared between them. A player link previews with the Tally card
rather than his headshot — a real step back from what this ADR set out to do,
taken deliberately and cheaply reversible.

`api/og.js` is untouched and still correct. Nothing calls it. The warm pass
still runs and still warms `/api/preview`, which costs ~55ms a route; its
`seenImages` set now collapses to a single image fetch, for free.

`test/cards.test.js` pins the invariant ("no card points at the dynamic
/api/og renderer"), so restoring per-route art means changing that test on
purpose rather than letting the cost drift back in.

## Amendment (2026-09-17) — the renderer is deleted, not parked

The sentence above — "`api/og.js` is untouched and still correct. Nothing calls
it" — no longer holds. `api/og.js` is **deleted**, with the two files it alone
read:

| file | bytes | what it held |
|---|---|---|
| `api/og.js` | 14,877 | the `@vercel/og` renderer |
| `api/_lib/fonts.js` | 548,602 | base64 IBM Plex bytes, read only by `og.js` |
| `api/_lib/logos.js` | 121,025 | `TEAM_LOGOS` SVGs, read only by `og.js` |

`@vercel/og` leaves `package.json` with it, and `satori` and
`@resvg/resvg-wasm` go as transitive deps — 177 lines out of the lockfile.
`api/_lib` drops from ten files to eight, back under the ADR-0038 threshold it
was sitting on.

**Why the 09-15 judgement changed.** Leaving the function in place was recorded
above as free. It was not. Reading the Hobby meters on 2026-09-17 —
Deployment Storage **16.34 GB against a 10 GB cap** — and dividing by the 37
production deploys inside the one-week retention window gives about **442 MB
per deployment**. Only 127 MB of that is the built static site (`du -sh dist`).
The other ~315 MB is the function bundles and build artifacts, so the
serverless layer is roughly 71% of what each deploy stores, and a function
nothing calls is still paid for on every one of ~7 deploys a day.

**Be honest about the size of this win.** It is small: a few MB of the 442, so
about 1–2% per deploy. It does not fix the storage overage — cutting production
deployment retention does that, and it is an account setting, not code. The
reasons to delete are that the code is unreachable, and that deleting it closes
the path by which the CPU overage returns. A renderer that exists is one
`ogUrl()` edit away from drawing 855 cards a night again; a renderer that does
not exist has to be written, reviewed and deployed.

**What did not change.** Every card still carries its own title, description,
`og:image:alt` and canonical. The image is still `public/og-image.png`.
`test/cards.test.js` keeps its assertion and its `/api/og` string — that is the
name the route would take if somebody built it again, so the test now guards
against the renderer being written BACK rather than merely re-referenced.
