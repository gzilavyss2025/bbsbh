#!/usr/bin/env node
// game-buzz: pull the highest-engagement social posts from a game's time window
// to seed handwritten GAME NOTES — the storytelling numbers (velocity records,
// strikeout milestones, "first since…" facts, crowd moments), not link spam.
//
// Runs OFF-DEVICE, after the game, from a terminal — deliberately not part of
// the PWA. The app stays spoiler-safe and backend-free; this script is a
// post-game notes helper, and reading the buzz before revealing your way
// through the innings would spoil the game anyway. See docs/game-buzz.md for
// the source scoping (why these two, auth, query design, ranking).
//
// Two FREE sources, no per-read cost (X's paid API is gone; see the doc):
//   • Bluesky — always on, NO auth. Public AppView search on api.bsky.app.
//   • Reddit  — opt-in, needs a free app's OAuth creds. The club's "Game
//     Thread" is pre-bounded to the game window and its top comments are the
//     best live crowd reaction ("103.4?! he's never thrown that hard").
//
// Usage:
//   node scripts/game-buzz.mjs <gamePk> [options]
//   REDDIT_CLIENT_ID=… REDDIT_CLIENT_SECRET=… node scripts/game-buzz.mjs <gamePk>
//
//   --max <n>        posts to print per source (default 12)
//   --pages <n>      Bluesky pages to pull per query term, 100 each (default 2)
//   --subreddit <s>  force the Reddit game-thread sub (default: from the clubs)
//   --query "<s>"    extra topic term to widen the search
//   --keep-links     don't down-rank link-only posts
//
// Find the gamePk in the app's feed URL, or:
//   https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=YYYY-MM-DD

const STATS = 'https://statsapi.mlb.com'
// The unauthenticated Bluesky AppView. NB: the older `public.api.bsky.app`
// host is now bot-blocked (returns a 403 splash) — `api.bsky.app` still serves
// the read-only app.bsky.* XRPC methods with no token. Verified 2026-07-07.
const BSKY = 'https://api.bsky.app/xrpc'
const REDDIT_OAUTH = 'https://oauth.reddit.com'
const REDDIT_TOKEN = 'https://www.reddit.com/api/v1/access_token'
// Reddit blocks default/blank agents; a descriptive one is required by policy.
const UA = 'bbsbh-game-buzz/0.2 (baseball scorebook notes helper)'

// ---------------------------------------------------------------------- args
const [, , gamePkArg, ...rest] = process.argv
if (!gamePkArg || !/^\d+$/.test(gamePkArg)) {
  console.error('usage: node scripts/game-buzz.mjs <gamePk> [--max n] [--pages n] [--subreddit s] [--query "extra terms"] [--keep-links]')
  process.exit(1)
}
const opt = (name, fallback) => {
  const i = rest.indexOf(`--${name}`)
  return i >= 0 ? rest[i + 1] : fallback
}
const MAX_PRINT = Number(opt('max', 12))
const MAX_PAGES = Number(opt('pages', 2))
const FORCE_SUB = opt('subreddit', '')
const EXTRA_QUERY = opt('query', '')
const KEEP_LINKS = rest.includes('--keep-links')

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
const windowEnd = new Date(end.getTime() + 45 * 60e3)

// A thin per-team term database: the shorthand fans actually type instead of
// the full teamName. Each team's official abbreviation (MIL/STL…) is added
// automatically from the feed, so this holds only what can't be derived:
//   • nicks — word nicknames ("Cards", "Stros", "Crew"). Apostrophe-plural
//     forms only ("A's", never bare "As" — an English word); no nick that just
//     repeats the teamName.
//   • tags  — the club hashtag ("#STLCards"). These are marketing slogans that
//     churn year to year — re-verify if a team rebrands.
// Used two ways: nicks/tags widen the Bluesky search, and every alias
// (name + abbr + nicks + tags) widens the relevance gate so a post that only
// says "STL walk-off" still counts. Keep the MiLB-graceful spirit: an unmapped
// team just falls back to its name + abbreviation.
const TEAM_TERMS = {
  Diamondbacks: { nicks: ['Dbacks', 'D-backs', 'Snakes'], tags: ['#Dbacks'] },
  Braves: { nicks: ['Bravos'], tags: ['#ForTheA', '#BravesCountry'] },
  Orioles: { nicks: ["O's", 'Birds'], tags: ['#Birdland'] },
  'Red Sox': { nicks: ['BoSox'], tags: ['#DirtyWater'] },
  Cubs: { nicks: ['Cubbies', 'Northsiders'], tags: ['#GoCubsGo'] },
  'White Sox': { nicks: ['ChiSox'], tags: ['#WhiteSox'] },
  Reds: { nicks: ['Redlegs'], tags: ['#ATOBTTR'] },
  Guardians: { nicks: ['Guards'], tags: ['#ForTheLand'] },
  Rockies: { nicks: ['Rox'], tags: ['#Rockies'] },
  Tigers: { nicks: ['Tigs'], tags: ['#RepDetroit'] },
  Astros: { nicks: ['Stros', "'Stros"], tags: ['#Astros'] },
  Royals: { nicks: [], tags: ['#FountainsUp'] },
  Angels: { nicks: ['Halos'], tags: ['#RepTheHalo'] },
  Dodgers: { nicks: ['Dodgs'], tags: ['#LetsGoDodgers'] },
  Marlins: { nicks: ['Fish'], tags: ['#MarlinsBeisbol'] },
  Brewers: { nicks: ['Crew', 'Brew Crew'], tags: ['#ThisIsMyCrew'] },
  Twins: { nicks: ['Twinkies'], tags: ['#MNTwins'] },
  Mets: { nicks: ['Amazins'], tags: ['#LGM'] },
  Yankees: { nicks: ['Yanks', 'Bombers'], tags: ['#RepBX'] },
  Athletics: { nicks: ["A's"], tags: ['#Athletics'] },
  Phillies: { nicks: ['Phils'], tags: ['#RingTheBell'] },
  Pirates: { nicks: ['Bucs', 'Buccos'], tags: ['#LetsGoBucs'] },
  Padres: { nicks: ['Pads', 'Friars'], tags: ['#ForTheFaithful'] },
  Giants: { nicks: ['Gigantes'], tags: ['#SFGiants'] },
  Mariners: { nicks: ["M's"], tags: ['#TridentsUp'] },
  Cardinals: { nicks: ['Cards', 'Redbirds'], tags: ['#STLCards'] },
  Rays: { nicks: [], tags: ['#RaysUp'] },
  Rangers: { nicks: [], tags: ['#StraightUpTX'] },
  'Blue Jays': { nicks: ['Jays'], tags: ['#BlueJays'] },
  Nationals: { nicks: ['Nats'], tags: ['#NATITUDE'] },
}

// Resolve a feed team to its query/gate terms (abbreviation from the feed).
function teamTerms(team) {
  const t = TEAM_TERMS[team.teamName] || {}
  return {
    name: team.teamName,
    abbr: team.abbreviation ? [team.abbreviation] : [],
    nicks: t.nicks ?? [],
    tags: t.tags ?? [],
  }
}
const awayT = teamTerms(away)
const homeT = teamTerms(home)

// WPA top performers: the game's decisive players are the best extra search
// terms (the hero of the night gets tagged by name even if he wasn't a
// starter). Sum each player's win-probability added across every play — a
// batter earns his own team's WP swing, a pitcher the opposite — and take the
// biggest positive movers. Reveal-heavy data, but this whole script is a
// post-game helper. Absent at most MiLB parks; degrade to just the starters.
async function topPerformers() {
  try {
    const wp = await (await fetch(`${STATS}/api/v1/game/${gamePkArg}/winProbability`)).json()
    if (!Array.isArray(wp)) return []
    const acc = new Map()
    const add = (p, v) => {
      if (!p?.id) return
      const e = acc.get(p.id) ?? { name: p.fullName, w: 0 }
      e.w += v
      acc.set(p.id, e)
    }
    for (const e of wp) {
      const h = e.homeTeamWinProbabilityAdded
      if (typeof h !== 'number') continue
      const top = e.about?.isTopInning // away batting → away batter earns −h
      add(e.matchup?.batter, top ? -h : h)
      add(e.matchup?.pitcher, top ? h : -h)
    }
    return [...acc.values()]
      .filter((x) => x.w > 0 && x.name)
      .sort((a, b) => b.w - a.w)
      .slice(0, 3)
      .map((x) => x.name)
  } catch {
    return []
  }
}

// Search queries, precision-first. Bluesky ANDs multi-word queries and its
// baseball volume is low, so a bare nickname like "Brewers" — never mind a
// starter surname that is also an English word ("May") — buries the game under
// the day's viral firehose. Precise shapes carry the load, loose shapes are
// gated hard downstream:
//   • both club nicknames AND'd ("Brewers Cardinals") — naming both ≈ a game
//     post; this is the workhorse and needs no relevance gate.
//   • each starter's + each WPA-hero's FULL quoted name ("Chad Patrick") —
//     specific enough to trust on their own.
//   • each club hashtag, queried as its bare token ("STLCards", no '#') — the
//     token still matches the tag and, unlike a '#'-prefixed q, combines with
//     the since/until window (Bluesky 400s on '#'+date). A tag ≈ game buzz;
//     ungated.
//   • each club nickname / bare name — recall for single-team fan posts, gated
//     hard downstream. Ordered LAST so if the unauth AppView rate-limits mid-run
//     it starves these, not the precise queries above.
const starterNames = ['away', 'home']
  .map((s) => feed.gameData?.probablePitchers?.[s]?.fullName)
  .filter(Boolean)
const preciseNames = [...new Set([...starterNames, ...(await topPerformers())])]
const QUERIES = [
  { q: `${away.teamName} ${home.teamName}`, gate: false },
  ...preciseNames.map((n) => ({ q: `"${n}"`, gate: false })),
  ...[...awayT.tags, ...homeT.tags].map((t) => ({ q: t.replace(/^#/, ''), gate: false })),
  ...(EXTRA_QUERY ? [{ q: EXTRA_QUERY, gate: false }] : []),
  ...[...awayT.nicks, ...homeT.nicks].map((q) => ({ q, gate: true })),
  { q: away.teamName, gate: true },
  { q: home.teamName, gate: true },
]

// The relevance gate for loose (nickname / bare-name) results. Each team gets
// matchers over its aliases, whole-word / hashtag-aware so short codes ("STL")
// don't hit inside other words ("hustle"). Aliases split HARD (name, abbr,
// tag — specific) vs SOFT (nicks — "Crew", "Cards": common English words that
// pair with an incidental baseball term like "runs"/"era" to admit noise). A
// post survives only if it names BOTH clubs (by any alias — "Crew beat the
// Cards" is clearly the game) OR names one club by a HARD alias AND talks
// baseball. A lone soft nick, even next to a baseball word, is not enough.
const BASEBALL =
  /\b(inning|pitch|strikeout|\bk'?s?\b|homer|home run|rbi|walk-?off|bullpen|no.?hitter|shutout|mph|\bera\b|lineup|dinger|grand slam|complete game|first pitch|bases loaded|scoreless|runs?\b)\b/i
function teamMatchers(t) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Prefix bans a preceding word char or '#' (keeps a nick from matching inside
  // a hashtag); a tag alias carries its own '#'.
  const rx = (arr) =>
    arr.length ? new RegExp(`(?:^|[^\\w#])(?:${arr.map(esc).join('|')})(?=$|[^\\w])`, 'i') : null
  return {
    hard: rx([t.name, ...t.abbr, ...t.tags]),
    any: rx([t.name, ...t.abbr, ...t.tags, ...t.nicks]),
  }
}
const AW = teamMatchers(awayT)
const HM = teamMatchers(homeT)
const hit = (m, text) => (m ? m.test(text) : false)
function relevant(text, gate) {
  if (!gate) return true
  const anyTeams = [AW.any, HM.any].filter((m) => hit(m, text)).length
  const hardTeams = [AW.hard, HM.hard].filter((m) => hit(m, text)).length
  return anyTeams >= 2 || (hardTeams >= 1 && BASEBALL.test(text))
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ------------------------------------------------------------------- ranking
// Engagement core: reshares/quotes signal "this told the story of the game"
// harder than likes; on top of that, nudge toward storytelling — numbers,
// records, velocity, history — and away from bare link posts. One formula for
// both sources, fed a normalized {likes, reshares, quotes, replies} shape.
const STORY_WORDS =
  /\b(mph|strikeout|k's|ks\b|record|history|first .{0,24}since|fastest|hardest|career|streak|immaculate|complete game|shutout|no.?hitter|walk.?off|cycle|milestone|era\b|debut)\b/i

function score({ likes = 0, reshares = 0, quotes = 0, replies = 0 }, text = '', hasLinkOnly = false) {
  let s = likes + 3 * reshares + 3 * quotes + 2 * replies
  if (STORY_WORDS.test(text)) s *= 1.5
  if (/\d/.test(text)) s *= 1.15
  if (!KEEP_LINKS && hasLinkOnly) s *= 0.35
  return Math.round(s)
}

function inWindow(iso) {
  const t = new Date(iso).getTime()
  return t >= windowStart.getTime() && t <= windowEnd.getTime()
}

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

// -------------------------------------------------------------- Bluesky (free)
// app.bsky.feed.searchPosts is a public read method: q, sort=top, since/until
// (ISO), limit≤100, cursor pagination. Engagement counts ride on each post
// (likeCount/repostCount/replyCount/quoteCount). No auth, no cost.
async function bskyPage(term, cursor) {
  const url = new URL(`${BSKY}/app.bsky.feed.searchPosts`)
  url.searchParams.set('q', term)
  url.searchParams.set('sort', 'top')
  url.searchParams.set('since', windowStart.toISOString())
  url.searchParams.set('until', windowEnd.toISOString())
  url.searchParams.set('limit', '100')
  url.searchParams.set('lang', 'en')
  if (cursor) url.searchParams.set('cursor', cursor)

  // The unauthenticated AppView rate-limits per IP; a burst of term×page
  // requests trips a 403/429. Back off and retry a couple times before giving
  // up on the page.
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (res.ok) return res.json()
    if (res.status !== 403 && res.status !== 429) {
      throw new Error(`HTTP ${res.status}`)
    }
    await sleep(700 * (attempt + 1))
  }
  throw new Error('rate-limited (403/429) after retries')
}

async function bskySearch(term) {
  const out = []
  let cursor
  for (let page = 0; page < MAX_PAGES; page++) {
    let data
    try {
      data = await bskyPage(term, cursor)
    } catch (err) {
      console.error(`  Bluesky "${term}" → ${err.message}; keeping what came back.`)
      break
    }
    out.push(...(data.posts ?? []))
    cursor = data.cursor
    if (!cursor || (data.posts ?? []).length === 0) break
    await sleep(350) // pace successive pages
  }
  return out
}

async function runBluesky() {
  const byUri = new Map()
  for (const { q, gate } of QUERIES) {
    for (const p of await bskySearch(q)) {
      // Keep the strictest gate seen for a post (a URI can surface from both a
      // precise and a loose query).
      const prev = byUri.get(p.uri)
      byUri.set(p.uri, { p, gate: prev ? prev.gate && gate : gate })
    }
    await sleep(350) // pace successive terms
  }
  return [...byUri.values()]
    .filter(({ p }) => inWindow(p.record?.createdAt ?? p.indexedAt))
    .filter(({ p, gate }) => relevant(p.record?.text ?? '', gate))
    .map(({ p }) => {
      const text = (p.record?.text ?? '').replace(/\s+/g, ' ').trim()
      // An external link card with little text is the link-spam shape; a
      // quote/image post or one with real prose is not.
      const linkOnly =
        p.record?.embed?.$type === 'app.bsky.embed.external' && text.length < 40
      const rkey = (p.uri ?? '').split('/').at(-1)
      return {
        source: 'bsky',
        handle: p.author?.handle ?? '',
        text,
        createdAt: p.record?.createdAt ?? p.indexedAt,
        url: `https://bsky.app/profile/${p.author?.handle}/post/${rkey}`,
        metrics: {
          likes: p.likeCount ?? 0,
          reshares: p.repostCount ?? 0,
          quotes: p.quoteCount ?? 0,
          replies: p.replyCount ?? 0,
        },
        score: score(
          { likes: p.likeCount, reshares: p.repostCount, quotes: p.quoteCount, replies: p.replyCount },
          text,
          linkOnly,
        ),
      }
    })
    .sort((a, b) => b.score - a.score)
}

// --------------------------------------------------------------- Reddit (free)
// Club nickname → subreddit that runs the per-game "Game Thread". Override with
// --subreddit. Only used to opt into Reddit; Bluesky needs none of this.
const CLUB_SUBS = {
  Diamondbacks: 'azdiamondbacks', Braves: 'Braves', Orioles: 'Orioles',
  'Red Sox': 'redsox', Cubs: 'CHICubs', 'White Sox': 'whitesox', Reds: 'Reds',
  Guardians: 'ClevelandGuardians', Rockies: 'ColoradoRockies', Tigers: 'motorcitykitties',
  Astros: 'Astros', Royals: 'KCRoyals', Angels: 'angelsbaseball', Dodgers: 'Dodgers',
  Marlins: 'miamimarlins', Brewers: 'brewers', Twins: 'minnesotatwins',
  Mets: 'NewYorkMets', Yankees: 'NYYankees', Athletics: 'oaklandathletics',
  Phillies: 'phillies', Pirates: 'buccos', Padres: 'Padres', Giants: 'SFGiants',
  Mariners: 'Mariners', Cardinals: 'Cardinals', Rays: 'tampabayrays',
  Rangers: 'TexasRangers', 'Blue Jays': 'TorontoBlueJays', Nationals: 'Nationals',
}

async function redditToken(id, secret) {
  const res = await fetch(REDDIT_TOKEN, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(`token HTTP ${res.status}: ${await res.text()}`)
  return (await res.json()).access_token
}

async function redditGet(token, path) {
  const res = await fetch(`${REDDIT_OAUTH}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': UA },
  })
  if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}`)
  return res.json()
}

async function runReddit(id, secret) {
  const sub = FORCE_SUB || CLUB_SUBS[home.teamName] || CLUB_SUBS[away.teamName]
  if (!sub) {
    console.error(`  No subreddit mapped for ${away.teamName}/${home.teamName}; pass --subreddit.`)
    return []
  }
  const token = await redditToken(id, secret)

  // Find the game thread: newest "Game Thread" posts in the club sub, keep the
  // one whose creation lands in the game window (a doubleheader has two).
  const search = await redditGet(
    token,
    `/r/${sub}/search?q=${encodeURIComponent('title:"Game Thread"')}&restrict_sr=1&sort=new&t=week&limit=25`,
  )
  const posts = (search.data?.children ?? []).map((c) => c.data)
  const thread = posts.find((p) => inWindow(new Date(p.created_utc * 1000).toISOString()))
  if (!thread) {
    console.error(`  No r/${sub} "Game Thread" found inside the game window.`)
    return []
  }

  // Top comments of that thread. depth=1 keeps top-level crowd reaction; the
  // stickied bot header (distinguished) is dropped.
  const listing = await redditGet(token, `/comments/${thread.id}?sort=top&limit=100&depth=1`)
  const comments = (listing[1]?.data?.children ?? [])
    .map((c) => c.data)
    .filter((c) => c && c.body && !c.distinguished && c.body !== '[deleted]')

  return comments
    .map((c) => {
      const text = c.body.replace(/\s+/g, ' ').trim()
      return {
        source: 'reddit',
        handle: `u/${c.author}`,
        text,
        createdAt: new Date(c.created_utc * 1000).toISOString(),
        url: `https://reddit.com${c.permalink}`,
        metrics: { likes: c.score ?? 0, reshares: 0, quotes: 0, replies: c.replies ? 1 : 0 },
        // Reddit comment score already blends up/downvotes; treat it as "likes"
        // and lean on the story-word boost for the notes-worthiness signal.
        score: score({ likes: c.score }, text),
      }
    })
    .sort((a, b) => b.score - a.score)
}

// -------------------------------------------------------------------- output
function print(header, items) {
  console.log(`\n${header} — top ${Math.min(MAX_PRINT, items.length)} of ${items.length}:\n`)
  if (items.length === 0) {
    console.log('  (nothing matched this window)\n')
    return
  }
  for (const it of items.slice(0, MAX_PRINT)) {
    const m = it.metrics
    const eng =
      it.source === 'reddit'
        ? `▲${m.likes}`
        : `♥${m.likes} ↺${m.reshares} 💬${m.replies}`
    console.log(`— ${it.handle} · ${fmtTime(it.createdAt)} · ${eng} [score ${it.score}]`)
    console.log(`  ${it.text}`)
    console.log(`  ${it.url}\n`)
  }
}

console.log(`\n${away.teamName} @ ${home.teamName} — gamePk ${gamePkArg}`)
console.log(`window ${windowStart.toISOString()} → ${windowEnd.toISOString()}`)
console.log(`queries: ${QUERIES.map((x) => x.q).join(' | ')}`)

print('BLUESKY', await runBluesky())

const rid = process.env.REDDIT_CLIENT_ID
const rsecret = process.env.REDDIT_CLIENT_SECRET
if (rid && rsecret) {
  try {
    print(`REDDIT game thread`, await runReddit(rid, rsecret))
  } catch (err) {
    console.error(`\nReddit lookup failed: ${err.message}`)
    console.error('A 401 means the app creds are wrong; 403 means the app type is not "script"/"web".')
  }
} else {
  console.log('\nREDDIT — skipped (set REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET to include game-thread comments; see docs/game-buzz.md).')
}
