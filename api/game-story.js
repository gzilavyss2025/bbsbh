// Resolves each team's own MLB.com coverage of a game — not just the single
// neutral recap statsapi's `content` endpoint exposes (`editorial.recap.mlb`,
// one article, tagged to one team), but BOTH teams' own beat-writer articles,
// including same-game news beyond the recap (an in-game injury, e.g.). MLB.com
// team sites only carry this in their RSS feeds
// (mlb.com/{team}/feeds/news/rss.xml), which — unlike statsapi.mlb.com — send
// no CORS header, so the browser can't fetch them directly; this edge function
// is the server-side hop that works around that (same reason api/_lib/cards.js
// exists for link previews, though this feeds the app itself, not crawlers).
//
// A team's feed mixes everything they publish (trades, roster moves, season
// features) with actual game coverage, and RSS carries no gamePk tag to
// disambiguate — so this windows each feed to [first pitch, final out + 2h]
// and takes every item published in that span as "about this game". Verified
// live 2026-07-17 against gamePk 823440 (NYM @ PHI): the Mets' recap and a
// same-game Soto-injury note both landed ~2h after the final out (not within
// 1h, hence the wider buffer), while the Phillies' own recap-style piece
// landed ~50min after — publish timing varies enough across teams/writers
// that 1h would miss legitimate recaps.
//
// Degrades to an empty list on any failure (feed not final yet, an RSS fetch
// timing out, an unrecognized team) — never breaks the box score.

export const config = { runtime: 'edge' }

const MLB = 'https://statsapi.mlb.com'
const WINDOW_BUFFER_MS = 2 * 60 * 60 * 1000

// A handful of mlb.com pages are rolling trackers, not dated articles — their
// RSS pubDate is bumped on every edit, so a stale one can drift inside a
// game's window by pure coincidence. Verified live across many teams' feeds,
// 2026-07-17: every club runs the exact same two slug templates
// ("{team}-injuries-and-roster-moves", "watch-minor-league-baseball-games-
// for-free-{year}"), so this is a stable site-wide convention to filter, not
// a one-off guess.
const EVERGREEN_SLUG = [/-injuries-and-roster-moves$/, /^watch-minor-league-baseball-games-for-free-\d{4}$/]

function isEvergreen(url) {
  const slug = /\/news\/([^/?#]+)/.exec(url)?.[1] ?? ''
  return EVERGREEN_SLUG.some((re) => re.test(slug))
}

// mlb.com team-site slug for each of the 30 current MLB clubs' statsapi ids
// (same id set as src/lib/teams.js TEAM_ABBR; edge functions can't import the
// app's ESM graph, so this is a deliberate small copy — verified live against
// mlb.com/{slug}/feeds/news/rss.xml, 2026-07-17). MiLB ids have no entry: those
// clubs carry no team-branded news feed.
const MLB_SLUG = {
  108: 'angels',
  109: 'dbacks',
  110: 'orioles',
  111: 'redsox',
  112: 'cubs',
  113: 'reds',
  114: 'guardians',
  115: 'rockies',
  116: 'tigers',
  117: 'astros',
  118: 'royals',
  119: 'dodgers',
  120: 'nationals',
  121: 'mets',
  133: 'athletics',
  134: 'pirates',
  135: 'padres',
  136: 'mariners',
  137: 'giants',
  138: 'cardinals',
  139: 'rays',
  140: 'rangers',
  141: 'bluejays',
  142: 'twins',
  143: 'phillies',
  144: 'braves',
  145: 'whitesox',
  146: 'marlins',
  147: 'yankees',
  158: 'brewers',
}

// &amp; decodes LAST — decoding it first would turn a source string that
// legitimately contains the literal text "&lt;" (encoded as "&amp;lt;") into
// "<" instead of "&lt;", an over-decode CodeQL flags as double-unescaping.
function decodeEntities(s) {
  return String(s ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

function stripCdata(s) {
  const m = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec((s ?? '').trim())
  return decodeEntities(m ? m[1] : s)
}

// Minimal RSS 2.0 <item> parser — title/link/pubDate only, regex-based since
// the edge runtime has no DOMParser and this is the only field set the app
// needs. Good enough for mlb.com's feed, which is well-formed and stable.
function parseRssItems(xml) {
  const items = []
  for (const raw of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = raw[1]
    const title = /<title>([\s\S]*?)<\/title>/.exec(block)?.[1]
    const link = /<link>([\s\S]*?)<\/link>/.exec(block)?.[1]
    const pubDate = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(block)?.[1]
    if (!title || !link || !pubDate) continue
    const publishedMs = Date.parse(pubDate.trim())
    if (Number.isNaN(publishedMs)) continue
    items.push({
      headline: stripCdata(title),
      url: stripCdata(link),
      publishedMs,
    })
  }
  return items
}

// mlb.com serves every article at /news/{slug} regardless of which team's
// section it was crawled from (verified live) — normalizing to that form
// keeps every story's URL shape consistent, matching the single-recap link
// this module used to build before RSS was added.
function normalizeUrl(url) {
  const slug = /\/news\/([^/?#]+)/.exec(url)?.[1]
  return slug ? `https://www.mlb.com/news/${slug}` : url
}

async function getJson(path) {
  const res = await fetch(`${MLB}${path}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`MLB ${res.status} for ${path}`)
  return res.json()
}

// [first pitch, final out + buffer] in epoch ms — null if the game isn't
// Final yet (the boxscore info block only carries "T" once it's over, so a
// live/upcoming game naturally yields no window and no stories, same as the
// old single-recap version showed nothing until MLB.com had actually posted).
async function resolveGameWindow(gamePk) {
  const feed = await getJson(`/api/v1.1/game/${gamePk}/feed/live`)
  const startIso = feed?.gameData?.datetime?.dateTime
  const startMs = startIso ? Date.parse(startIso) : NaN
  const info = feed?.liveData?.boxscore?.info ?? []
  const tField = info.find((i) => i.label === 'T')?.value
  const m = /(\d+):(\d+)/.exec(tField ?? '')
  if (Number.isNaN(startMs) || !m) return null
  const durationMs = (Number(m[1]) * 60 + Number(m[2])) * 60_000
  return { startMs, endMs: startMs + durationMs + WINDOW_BUFFER_MS }
}

async function teamStories(teamId, window) {
  const slug = MLB_SLUG[teamId]
  if (!slug) return []
  const res = await fetch(`https://www.mlb.com/${slug}/feeds/news/rss.xml`, {
    headers: { Accept: 'application/rss+xml, text/xml, */*' },
  })
  if (!res.ok) return []
  const items = parseRssItems(await res.text())
  return items
    .filter((it) => it.publishedMs >= window.startMs && it.publishedMs <= window.endMs)
    .filter((it) => !isEvergreen(it.url))
    .map((it) => ({ teamId, headline: it.headline, url: normalizeUrl(it.url), publishedMs: it.publishedMs }))
}

export default async function handler(req) {
  const url = new URL(req.url)
  const gamePkParam = url.searchParams.get('gamePk')
  // Only a bare integer — this is spliced into a statsapi feed path
  // (resolveGameWindow → /api/v1.1/game/{gamePk}/feed/live); an unvalidated
  // string could inject extra path/query segments onto that host.
  const gamePk = /^\d+$/.test(gamePkParam ?? '') ? gamePkParam : null
  const awayId = Number(url.searchParams.get('awayId'))
  const homeId = Number(url.searchParams.get('homeId'))

  let stories = []
  try {
    if (gamePk && awayId && homeId) {
      const window = await resolveGameWindow(gamePk)
      if (window) {
        const [away, home] = await Promise.all([
          teamStories(awayId, window),
          teamStories(homeId, window),
        ])
        const seen = new Set()
        stories = [...away, ...home]
          .sort((a, b) => a.publishedMs - b.publishedMs)
          .filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)))
          .map(({ teamId, headline, url: storyUrl }) => ({ teamId, headline, url: storyUrl }))
      }
    }
  } catch {
    stories = []
  }

  return new Response(JSON.stringify({ stories }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600',
    },
  })
}
