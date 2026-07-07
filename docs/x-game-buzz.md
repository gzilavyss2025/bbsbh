# Game buzz: pulling the night's best posts for GAME NOTES

The scorebook's GAME NOTES box wants the storytelling numbers — "Miz threw
104.5 mph, fastest pitch of the pitch-tracking era", "first Brewers complete
game with one hit or fewer since CC Sabathia in 2008" — not links to recaps.
This documents how to pull the highest-engagement social posts from a game's
exact time window to seed those notes, and why it lives in a **post-game
terminal script** (`scripts/game-buzz.mjs`), not the app.

**Why not in the app:** the PWA is spoiler-safe and backend-free. Game-night
social posts are wall-to-wall spoilers, so they can only ever be useful *after*
you've revealed your way through the game — and the X API needs a secret
bearer token, which a no-backend browser app cannot hold. A script you run
once per game from a terminal fits both constraints.

Research current as of July 2026; X's pricing moves often — re-verify before
committing money.

## The pipeline (implemented in scripts/game-buzz.mjs)

1. **Window from data we already have**: the statsapi live feed gives first
   pitch (`gameData.datetime.dateTime`) and the last play's `about.endTime`.
   Pad −30 min (pregame buzz) / +45 min (postgame reaction).
2. **Query**: both club names + both starters' surnames OR'd together,
   `lang:en -is:retweet` plus betting/promo negative keywords. Link posts are
   only *down-ranked* client-side (an in-query `-has:links` would also kill
   native highlight clips).
3. **Fetch**: `GET https://api.x.com/2/tweets/search/recent` with
   `start_time`/`end_time`, `max_results=100`, `tweet.fields=public_metrics,
   created_at,entities`, paginating with `next_token`. Keep
   `sort_order=recency` — relevancy mode doesn't return `next_token` (one page
   max), and we rank ourselves anyway.
4. **Rank client-side** over `public_metrics`:
   `score = likes + 3·retweets + 3·quotes + 2·replies + 2·bookmarks`
   (reshares/quotes = "this moment mattered"; bookmarks = stat-nugget value),
   then boost storytelling text (mph readings, "first … since …", records,
   streaks, milestones, walk-offs) and down-weight bare-link posts.
5. **Print top N** with metrics and clock times — the clock time lets you pin
   a post to its half-inning against the scorebook.

Run it: `X_BEARER_TOKEN=... node scripts/game-buzz.mjs <gamePk>` within 7 days
of the game (recent search only reaches back that far).

## What X access costs (the deciding factor)

| Option | Price | Verdict |
| --- | --- | --- |
| Free tier | $0 | Write-only. No search at all — useless here. |
| **Pay-per-usage credits** (Feb 2026) | **$0.005/post read** | **~$0.50–1.50 per game** at 100–300 posts. ~$80–250 for a whole 162-game season. The way to go. |
| Basic subscription | $200/mo | ~15k reads/mo. Only worth it for fixed billing at much higher volume. |
| Pro | $5,000/mo | Adds full-archive search (games older than 7 days). Not hobby-relevant. |

Same-day re-runs of the same query are deduplicated within a 24h UTC day on
pay-per-usage, so iterating on the ranking doesn't double-bill.

## Free alternatives worth having

- **Reddit game threads — the sleeper best fit, $0.** r/Brewers and
  r/baseball run a bot-posted "Game Thread" per game, *pre-bounded to the game
  window by construction*. Top-scored comments are live crowd reaction
  ("103.4?! he's never thrown that hard") with `created_utc` for inning
  attribution and zero link spam. Free OAuth API, ~100 queries/min. Weakness:
  one community's voice, small-N vote counts on low-traffic games.
- **Bluesky — $0, genuinely open.** `app.bsky.feed.searchPosts` on the
  unauthenticated `public.api.bsky.app` endpoint supports `sort=top` (server-
  side engagement ranking for free) plus `since`/`until`. Baseball volume is a
  fraction of X's, but it skews stats-literate — which fits the notes goal.
- **Scraping X without the API violates X's ToS — out of scope.** That
  includes the cheap "Twitter API" resellers, which are scrapers wearing an
  API costume.

**Best value per dollar:** Reddit game thread (free) + one tiny curated X
query (`from:` beat writers and stat accounts — e.g. the club beat writer,
@OptaSTATS/@CodifyBaseball-style feeds — ~$0.10/game) for the record-book
nuggets, with the broad X query as an optional supplement for crowd moments.

## Bounding to storytelling, not link farms

- In-query: `-is:retweet`, betting/promo negatives, `lang:en`.
- Client-side boosts (cheaper than query operators): `\d{2,3}(\.\d)? mph`,
  `first … since \d{4}`, `franchise record`, `career-high`, `streak`,
  `immaculate`, `no-hit`, `walk-off`, `\d+ (straight|consecutive)`,
  crowd/ovation words. Penalize bare scoreline posts — spoiler-shaped and
  note-free.
- Keep replies out of the *filter* but hold them to a higher score bar —
  in-game replies are often the best crowd color.

## Flagged uncertainties (re-check at spend time)

- Whether fixed tiers survive alongside pay-per-usage; posts-vs-requests
  semantics of Basic's 15k reads; Basic's historical 512-char query cap under
  the 2026 docs (the script stays well under it either way).
- Team marketing hashtags rotate seasonally (#ThisIsMyCrew has been the
  long-running Brewers tag) — the script builds its query from team names and
  starter surnames instead, so it doesn't depend on the hashtag of the year.
