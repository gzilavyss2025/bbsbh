#!/usr/bin/env node
// game-buzz: pull the highest-engagement X posts from a game's time window to
// seed handwritten GAME NOTES — the storytelling numbers (velocity records,
// strikeout milestones, "first since…" facts, crowd moments), not link spam.
//
// Runs OFF-DEVICE, after the game, from a terminal — deliberately not part of
// the PWA. The app stays spoiler-safe and backend-free; this script is a
// post-game notes helper, and reading the buzz before revealing your way
// through the innings would spoil the game anyway. See docs/x-game-buzz.md
// for the scoping (API tiers, cost, query design, alternatives).
//
// Usage:
//   X_BEARER_TOKEN=... node scripts/game-buzz.mjs <gamePk> [options]
//
//   --max <n>        posts to print (default 12)
//   --pages <n>      search pages to pull, 100 posts each (default 3)
//   --keep-links     don't down-rank posts that carry article links
//   --query "<s>"    extra query terms OR'd into the topic clause
//
// Find the gamePk in the app's feed URL, or:
//   https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=YYYY-MM-DD
//
// X API notes (v2 recent search): posts from the last 7 days only, so run this
// within a week of the game. Access requires either the Basic subscription
// tier or (much cheaper for once-a-game use) pay-per-usage credits at
// $0.005/post read — a 300-post pull is ~$1.50. sort_order stays 'recency'
// with client-side ranking: relevancy mode doesn't paginate, and we want our
// own engagement formula anyway. Full scoping: docs/x-game-buzz.md.

const STATS = 'https://statsapi.mlb.com'
const X_API = 'https://api.x.com/2/tweets/search/recent'

// ---------------------------------------------------------------------- args
const [, , gamePkArg, ...rest] = process.argv
if (!gamePkArg || !/^\d+$/.test(gamePkArg)) {
  console.error('usage: X_BEARER_TOKEN=... node scripts/game-buzz.mjs <gamePk> [--max n] [--pages n] [--keep-links] [--query "extra terms"]')
  process.exit(1)
}
const opt = (name, fallback) => {
  const i = rest.indexOf(`--${name}`)
  return i >= 0 ? rest[i + 1] : fallback
}
const MAX_PRINT = Number(opt('max', 12))
const MAX_PAGES = Number(opt('pages', 3))
const KEEP_LINKS = rest.includes('--keep-links')
const EXTRA_QUERY = opt('query', '')

const token = process.env.X_BEARER_TOKEN
if (!token) {
  console.error('Set X_BEARER_TOKEN (an X API v2 app bearer token whose tier includes recent search).')
  process.exit(1)
}

// ------------------------------------------------------- game window + names
// The game's feed gives us everything: team names for the query and the real
// first-pitch / last-play timestamps for the search window.
const feed = await (await fetch(`${STATS}/api/v1.1/game/${gamePkArg}/feed/live`)).json()
const away = feed?.gameData?.teams?.away
const home = feed?.gameData?.teams?.home
if (!away?.teamName || !home?.teamName) {
  console.error(`No team data for gamePk ${gamePkArg} — is it a real game?`)
  process.exit(1)
}

const startIso = feed.gameData?.datetime?.dateTime
const plays = feed.liveData?.plays?.allPlays ?? []
const lastPlayEnd = plays.at(-1)?.about?.endTime
const start = startIso ? new Date(startIso) : null
if (!start) {
  console.error('Feed has no first-pitch time; cannot bound the window.')
  process.exit(1)
}
// Pad the window: pre-game buzz 30 min before first pitch, reaction 45 min
// after the last play (or a 4h fallback for suspended/odd feeds).
const end = lastPlayEnd ? new Date(lastPlayEnd) : new Date(start.getTime() + 4 * 3600e3)
const windowStart = new Date(start.getTime() - 30 * 60e3)
const windowEnd = new Date(Math.min(end.getTime() + 45 * 60e3, Date.now() - 15e3))

// ------------------------------------------------------------------ query
// Topic clause: both club names plus both starters' surnames (the names most
// posts actually use), plus any user-supplied terms. Retweets excluded so
// engagement counts stay on the original post; betting/promo spam excluded in
// the query (it drowns game-night search), while link posts are only
// down-ranked client-side — an in-query -has:links would also kill posts
// sharing highlight clips. (`lang:`/`is:` operators must be ANDed with a
// standalone keyword clause; the team OR-group satisfies that.)
const starters = ['away', 'home']
  .map((s) => feed.gameData?.probablePitchers?.[s]?.fullName?.split(' ').at(-1))
  .filter(Boolean)
  .map((n) => `"${n}"`)
const topic = [
  `"${away.teamName}"`,
  `"${home.teamName}"`,
  ...starters,
  ...(EXTRA_QUERY ? [EXTRA_QUERY] : []),
].join(' OR ')
const query = `(${topic}) lang:en -is:retweet -parlay -odds -promo -giveaway`

// --------------------------------------------------------------- fetch pages
async function searchPage(nextToken) {
  const url = new URL(X_API)
  url.searchParams.set('query', query)
  url.searchParams.set('start_time', windowStart.toISOString())
  url.searchParams.set('end_time', windowEnd.toISOString())
  url.searchParams.set('max_results', '100')
  url.searchParams.set('tweet.fields', 'public_metrics,created_at,author_id,entities,attachments')
  url.searchParams.set('expansions', 'author_id')
  url.searchParams.set('user.fields', 'username,name')
  if (nextToken) url.searchParams.set('next_token', nextToken)

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 429) {
    console.error('Rate limited by X — wait for the reset and re-run with fewer --pages.')
    process.exit(2)
  }
  if (!res.ok) {
    console.error(`X API ${res.status}: ${await res.text()}`)
    console.error('A 403 usually means the token\'s tier does not include recent search.')
    process.exit(2)
  }
  return res.json()
}

const posts = []
const users = new Map()
let nextToken
for (let page = 0; page < MAX_PAGES; page++) {
  const data = await searchPage(nextToken)
  for (const u of data.includes?.users ?? []) users.set(u.id, u)
  posts.push(...(data.data ?? []))
  nextToken = data.meta?.next_token
  if (!nextToken) break
}

// ------------------------------------------------------------------- ranking
// Engagement core: reposts and quotes signal "this told the story of the
// game" harder than likes do. On top of that, nudge toward storytelling —
// numbers, records, velocity, history — and away from bare link posts.
const STORY_WORDS =
  /\b(mph|strikeout|k's|ks\b|record|history|first .{0,24}since|fastest|hardest|career|streak|immaculate|complete game|shutout|no.?hitter|walk.?off|cycle|milestone|era\b|debut)\b/i

function score(t) {
  const m = t.public_metrics ?? {}
  // Reshares/quotes signal "this moment mattered" harder than likes;
  // bookmarks signal keep-this stat-nugget value.
  let s =
    (m.like_count ?? 0) +
    3 * (m.retweet_count ?? 0) +
    3 * (m.quote_count ?? 0) +
    2 * (m.reply_count ?? 0) +
    2 * (m.bookmark_count ?? 0)
  const text = t.text ?? ''
  if (STORY_WORDS.test(text)) s *= 1.5
  if (/\d/.test(text)) s *= 1.15
  const links = (t.entities?.urls ?? []).filter((u) => !u.expanded_url?.includes('/status/'))
  if (!KEEP_LINKS && links.length > 0 && !t.attachments?.media_keys?.length) s *= 0.35
  return Math.round(s)
}

posts.sort((a, b) => score(b) - score(a))

// -------------------------------------------------------------------- output
const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

console.log(`\n${away.teamName} @ ${home.teamName} — gamePk ${gamePkArg}`)
console.log(`window ${windowStart.toISOString()} → ${windowEnd.toISOString()}`)
console.log(`query  ${query}`)
console.log(`pulled ${posts.length} posts; top ${Math.min(MAX_PRINT, posts.length)} by engagement:\n`)

for (const t of posts.slice(0, MAX_PRINT)) {
  const u = users.get(t.author_id)
  const m = t.public_metrics ?? {}
  console.log(`— @${u?.username ?? t.author_id} · ${fmtTime(t.created_at)} · ♥${m.like_count} ↺${m.retweet_count} 💬${m.reply_count} [score ${score(t)}]`)
  console.log(`  ${t.text.replace(/\s+/g, ' ').trim()}\n`)
}
if (posts.length === 0) {
  console.log('Nothing matched — widen the window (--query) or check the game is <7 days old.')
}
