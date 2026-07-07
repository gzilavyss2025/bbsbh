// REVEAL-ONLY (see the spoiler rule in CLAUDE.md, sibling to linescore.js /
// derive.js). Pulls the highest-engagement Bluesky posts from a game's time
// window to seed the GAME NOTES box — velocity records, "first … since …",
// walk-offs, crowd color. The post text openly states the final score, so this
// is score-revealing: only ever call it from INSIDE a SealBox reveal branch
// (GameBuzz mounts the fetcher there), never at render top-level or in a
// pre-reveal useMemo. The network request itself must not fire until reveal.
//
// The terminal `scripts/game-buzz.mjs` is the fuller, offline sibling (it also
// pulls the Reddit game thread, which needs a secret the browser can't hold).
// This module is the app's Bluesky-only half: no auth, and the AppView is
// CORS-open, so it runs straight from the browser with no backend.
//
// Host: api.bsky.app (the read-only AppView). The older public.api.bsky.app is
// now bot-blocked; verified 2026-07-07.

const BSKY = 'https://api.bsky.app/xrpc'

const STORY_WORDS =
  /\b(mph|strikeout|k's|ks\b|record|history|first .{0,24}since|fastest|hardest|career|streak|immaculate|complete game|shutout|no.?hitter|walk.?off|cycle|milestone|era\b|debut)\b/i

const BASEBALL =
  /\b(inning|pitch|strikeout|\bk'?s?\b|homer|home run|rbi|walk-?off|bullpen|no.?hitter|shutout|mph|\bera\b|lineup|dinger|grand slam|complete game|first pitch|bases loaded|scoreless|runs?\b)\b/i

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Engagement core: reshares/quotes signal "this told the story of the game"
// harder than likes; storytelling text and digits get a nudge; bare link cards
// get docked. Mirrors the scoring in scripts/game-buzz.mjs.
function scorePost(p, text) {
  const likes = p.likeCount ?? 0
  const reshares = p.repostCount ?? 0
  const quotes = p.quoteCount ?? 0
  const replies = p.replyCount ?? 0
  let s = likes + 3 * reshares + 3 * quotes + 2 * replies
  if (STORY_WORDS.test(text)) s *= 1.5
  if (/\d/.test(text)) s *= 1.15
  // An external link card with almost no prose is the link-spam shape.
  if (p.record?.embed?.$type === 'app.bsky.embed.external' && text.length < 40) s *= 0.35
  return Math.round(s)
}

// Bluesky's baseball volume is low and searchPosts ANDs multi-word queries, so
// a bare nickname (or a starter surname that is also an English word — "May")
// buries the game under the day's viral firehose. Precision-first queries fix
// it: both clubs AND'd and each starter's full quoted name are trusted; a lone
// nickname is only kept when the text also talks baseball. See docs/game-buzz.md.
function buildQueries(awayName, homeName, starterNames) {
  return [
    { q: `${awayName} ${homeName}`, gate: false },
    ...starterNames.map((n) => ({ q: `"${n}"`, gate: false })),
    { q: awayName, gate: true },
    { q: homeName, gate: true },
  ]
}

function relevant(text, gate, nicks) {
  if (!gate) return true
  const t = text.toLowerCase()
  const clubs = nicks.filter((n) => t.includes(n)).length
  return clubs >= 2 || (clubs >= 1 && BASEBALL.test(text))
}

// One search page. The unauthenticated AppView rate-limits per IP, so back off
// and retry a 403/429 a couple times before giving up on the page.
async function searchPage(term, since, until, cursor) {
  const url = new URL(`${BSKY}/app.bsky.feed.searchPosts`)
  url.searchParams.set('q', term)
  url.searchParams.set('sort', 'top')
  url.searchParams.set('since', since)
  url.searchParams.set('until', until)
  url.searchParams.set('limit', '100')
  url.searchParams.set('lang', 'en')
  if (cursor) url.searchParams.set('cursor', cursor)

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url)
    if (res.ok) return res.json()
    if (res.status !== 403 && res.status !== 429) throw new Error(`Bluesky HTTP ${res.status}`)
    await sleep(700 * (attempt + 1))
  }
  return { posts: [] } // rate-limited out; degrade to nothing for this term
}

// The game's search window, straight from the feed: −30 min before first pitch
// (pregame buzz), +45 min after the last play (reaction). Neither bound is a
// score. Returns null ISO strings if the feed has no first-pitch time.
function gameWindow(feed) {
  const startIso = feed?.gameData?.datetime?.dateTime
  if (!startIso) return null
  const start = new Date(startIso)
  const plays = feed?.liveData?.plays?.allPlays ?? []
  const lastPlayEnd = plays.at(-1)?.about?.endTime
  const end = lastPlayEnd ? new Date(lastPlayEnd) : new Date(start.getTime() + 4 * 3600e3)
  return {
    since: new Date(start.getTime() - 30 * 60e3).toISOString(),
    until: new Date(end.getTime() + 45 * 60e3).toISOString(),
  }
}

// Fetch + rank the game's Bluesky buzz. Resolves to a ranked array of
// { handle, text, createdAt, url, metrics, score }, or [] when the feed can't
// bound a window / nothing matched. Throws only on a hard (non-rate-limit)
// network failure, so the caller can offer a retry.
export async function fetchGameBuzz(feed, { max = 12 } = {}) {
  const away = feed?.gameData?.teams?.away
  const home = feed?.gameData?.teams?.home
  const win = gameWindow(feed)
  if (!away?.teamName || !home?.teamName || !win) return []

  const starterNames = ['away', 'home']
    .map((s) => feed?.gameData?.probablePitchers?.[s]?.fullName)
    .filter(Boolean)
  const nicks = [away.teamName, home.teamName].map((n) => n.toLowerCase())
  const queries = buildQueries(away.teamName, home.teamName, starterNames)

  const byUri = new Map()
  for (const { q, gate } of queries) {
    const data = await searchPage(q, win.since, win.until)
    for (const p of data.posts ?? []) {
      // Keep the strictest provenance: a URI seen from any precise (ungated)
      // query is trusted, even if a loose query also surfaced it.
      const prev = byUri.get(p.uri)
      byUri.set(p.uri, { p, gate: prev ? prev.gate && gate : gate })
    }
    await sleep(350) // pace successive terms under the per-IP limit
  }

  return [...byUri.values()]
    .map(({ p, gate }) => ({ p, gate, text: (p.record?.text ?? '').replace(/\s+/g, ' ').trim() }))
    .filter(({ text, gate }) => text && relevant(text, gate, nicks))
    .map(({ p, text }) => {
      const rkey = (p.uri ?? '').split('/').at(-1)
      return {
        handle: p.author?.handle ?? '',
        text,
        createdAt: p.record?.createdAt ?? p.indexedAt,
        url: `https://bsky.app/profile/${p.author?.handle}/post/${rkey}`,
        metrics: {
          likes: p.likeCount ?? 0,
          reshares: p.repostCount ?? 0,
          replies: p.replyCount ?? 0,
        },
        score: scorePost(p, text),
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
}
