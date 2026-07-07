# Game buzz: pulling the night's best posts for GAME NOTES

The scorebook's GAME NOTES box wants the storytelling numbers — "May only went
65 pitches", "first Brewers complete game with one hit or fewer since CC
Sabathia in 2008" — not links to recaps. This documents how
`scripts/game-buzz.mjs` pulls the highest-engagement social posts from a game's
exact time window to seed those notes, and why it lives in a **post-game
terminal script**, not the app.

**Why not in the app:** the PWA is spoiler-safe and backend-free. Game-night
social posts are wall-to-wall spoilers (the top result is usually the final
score), so they're only ever useful *after* you've revealed your way through
the game. A script you run once per game from a terminal fits that, and keeps
any API credentials off the device.

**Two FREE sources. No per-read cost.** The paid X (Twitter) API — $0.005/post,
~$1–1.50 a game — is deliberately not used. Everything here is free:

| Source | Auth | What it's best at |
| --- | --- | --- |
| **Bluesky** | none | Always on. Beat-writer play-by-play + fan reaction. Verified working unauthenticated 2026-07-07. |
| **Reddit** | free app creds | The club's per-game **Game Thread**: top comments are the best live crowd color, pre-bounded to the game window by construction. Opt-in. |

Research current as of July 2026; both APIs move — re-verify if a call starts
failing.

## Running it

```bash
node scripts/game-buzz.mjs <gamePk>                       # Bluesky only
REDDIT_CLIENT_ID=… REDDIT_CLIENT_SECRET=… \
  node scripts/game-buzz.mjs <gamePk>                     # + Reddit game thread
```

Options: `--max n` (posts per source, default 12), `--pages n` (Bluesky pages
per query term, default 2), `--subreddit s` (force the Reddit game-thread sub),
`--query "terms"` (extra topic term), `--keep-links` (don't down-rank
link-only posts).

Find the gamePk in the app's feed URL, or from
`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=YYYY-MM-DD`.

## The pipeline (in scripts/game-buzz.mjs)

1. **Window from data we already have**: the statsapi live feed gives first
   pitch (`gameData.datetime.dateTime`) and the last play's `about.endTime`.
   Pad −30 min (pregame buzz) / +45 min (postgame reaction).
2. **Queries, precision-first** (see "Relevance" — this is the whole ballgame
   on Bluesky). Both club nicknames AND'd, each starter's full quoted name, and
   each club nickname alone (the last gated by a baseball-keyword filter).
3. **Rank client-side** over engagement:
   `score = likes + 3·reshares + 3·quotes + 2·replies`, then ×1.5 for
   storytelling text (mph readings, "first … since …", records, streaks,
   walk-offs), ×1.15 if it contains a digit, ×0.35 for bare link posts. One
   formula feeds both sources (Reddit's comment score maps to "likes").
4. **Print top N per source** with clock times — the clock time lets you pin a
   post to its half-inning against the scorebook.

## Relevance is the hard part (Bluesky)

Bluesky's baseball volume is low and `searchPosts` ANDs multi-word queries, so a
bare nickname buries the game under the day's viral firehose — and a starter
surname that doubles as an English word ("May", "Bello") is catastrophic. Tested
against gamePk 823036 (MIL@STL): searching bare `Brewers` / `May` returned 270
posts topped by a dead-cat memorial and AirBnB support tweets. The fix that
worked (61 posts, every top-10 about the actual game):

- **`"{away} {home}"` AND'd** ("Brewers Cardinals") — naming both clubs ≈ a
  game post. The workhorse; no gate needed.
- **each starter's FULL quoted name** ("Dustin May") — specific enough to trust.
- **each club nickname alone**, kept only if the text also carries a baseball
  signal (`inning`, `mph`, `bullpen`, `walk-off`, a run total…). High recall for
  single-team fan posts without the noise.

Engagement counts on Bluesky baseball posts run small (single-digit likes), so
ranking leans on relevance + storytelling more than raw virality — fine for
seeding a dozen notes.

**Endpoint gotcha:** use host `api.bsky.app` (the read-only AppView).
`public.api.bsky.app`, named in older notes, is now bot-blocked and returns a
403 splash page. Unauthenticated `app.bsky.feed.searchPosts` still works there
with `sort=top` + `since`/`until` + `cursor`. It rate-limits per IP, so the
script paces requests and retries 403/429 with backoff, degrading gracefully
(it keeps whatever pages returned).

## Reddit setup (one-time, free)

The old unauthenticated `www.reddit.com/…​.json` path is **dead** — it now
returns the web app's HTML or 403. Reddit requires OAuth. It's still free:

1. Create an app at <https://www.reddit.com/prefs/apps> → "create another
   app…" → type **script** (or **web app**). Any redirect URI (e.g.
   `http://localhost`).
2. The app's **client id** (under the app name) and **secret** become
   `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET`.
3. The script does userless OAuth (`grant_type=client_credentials`,
   HTTP Basic id:secret) against `www.reddit.com/api/v1/access_token`, then
   calls `oauth.reddit.com`. A descriptive `User-Agent` is mandatory — Reddit
   429s blank/generic ones. Free tier is ~100 queries/min, far more than one
   game needs.

It finds the club's newest "Game Thread" whose creation lands in the game
window (so doubleheaders pick the right one; override with `--subreddit`), then
pulls that thread's top comments. The club→subreddit map lives in the script.

## Bounding to storytelling, not link farms

- Precise queries (above) do most of the filtering.
- Client-side boosts (cheaper than query operators): `\d{2,3}(\.\d)? mph`,
  `first … since \d{4}`, `record`, `career`, `streak`, `immaculate`,
  `no-hitter`, `walk-off`, `complete game`, `debut`. Penalize bare link cards
  (external embed + almost no text) — spoiler-shaped and note-free.

## Flagged uncertainties (re-check if a call fails)

- Bluesky's unauthenticated rate limits aren't published and have tightened
  before; if 403s dominate, drop `--pages` to 1 or space out runs. The
  `public.` → `api.` host move already bit once.
- Reddit app-type semantics ("script" vs "web app") and the userless grant have
  been stable for years but are undocumented for this exact use; the 401-on-bad-
  creds handshake is verified, a real end-to-end pull needs your creds.
- **Bluesky, not X, is now the open baseball firehose** — but its volume is a
  fraction of X's. On a low-traffic MiLB game expect thin results; the Reddit
  game thread (if the club sub runs one) is the better fallback there.
