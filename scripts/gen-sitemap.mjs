// Writes public/sitemap.xml.
//
// The app had none, which is a real gap for a site whose routes are almost all
// client-side: nothing on the home page links to /standings or /umpires as
// crawlable <a href> markup until React has run, so a crawler that does not
// execute JavaScript has no way to learn those URLs exist. A sitemap is the one
// mechanism that works regardless of rendering — it is a flat list of URLs, read
// by every search and answer engine, and it costs one file.
//
// WHAT GOES IN, AND WHAT DELIBERATELY DOES NOT.
//
// In: the guides (which are server-rendered and fully readable without JS), and
// the stable, public, non-scoring app routes.
//
// Out, and this is the important half:
//
//   - Anything under a gamePk, a date, or a team's schedule. Those are the
//     scoring surfaces. Listing them invites a crawler to fetch a page whose
//     whole purpose is to withhold a result until a human asks for it, and a
//     sitemap is a standing invitation rather than a one-time fetch.
//   - The dev and lab routes (/identity-lab, /scorecard-lab, and friends), which
//     robots.txt also disallows.
//   - /admin and anything with ?edit.
//   - Per-PLAYER pages, and the reason is not the one this comment used to give.
//     It said those URLs 404 next spring. They do not: an id resolves forever,
//     a retired player's page still renders his career register, and since
//     ADR-0057 the address carries his name as well. The real reasons are that
//     there are five figures of them — twenty-five times the rest of this
//     sitemap put together — and that no precompute in this repo means "the
//     players worth listing". war.json and salaries.json each hold a bounded
//     set, and each would be a repurpose that shrinks the day its own generator
//     changes a filter, silently. They do not need the sitemap anyway: a club's
//     roster page names 26 of them as links now, so a crawler reaching one club
//     reaches its players by following markup, which is how discovery is meant
//     to work (ADR-0058). If a player listing is ever genuinely wanted, it needs
//     its own generator and a cut somebody defended — active 40-man rosters, say
//     — not a data file borrowed for a second job.
//
// Per-CLUB pages ARE listed, as of ADR-0058, and that is a reversal of the line
// above rather than an exception to it. There are 150 of them, not thousands;
// realignment moves that list about once a decade; the ids come from
// public/data/teams.json, which gen-teams.mjs already refreshes weekly, so this
// script gains no statsapi call and no build dependency; and since ADR-0058 the
// pages carry a readable body instead of an empty div. The address is spelled by
// route.js's own entitySegment, so a listed URL is byte-identical to the
// canonical api/preview.js writes for it — a sitemap naming the OTHER of two
// working addresses would list a page that points somewhere else.
//
// `lastmod` for a guide comes from that page's own `updated` field, so it is a
// statement about the content rather than about when this script last ran.
// Emitting today's date for every URL on every build is the most common way a
// sitemap becomes noise a crawler learns to ignore.

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { LANDING_PAGES } from '../src/copy/landing/pages/index.js'
import { SITE_URL } from '../src/copy/landing/site.js'
import { entitySegment } from '../src/lib/route.js'

// Stable public app routes. Hand-kept ON PURPOSE rather than derived from
// route.js: that file's table includes dev labs, unlisted QA pages and every
// game-scoped shape, and a derivation would have to exclude more than it keeps.
// A short explicit list is auditable; a filtered one is a place for a scoring
// route to sneak in later.
const APP_ROUTES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/about', priority: '0.5', changefreq: 'monthly' },
  { path: '/leaders', priority: '0.7', changefreq: 'daily' },
  { path: '/standings', priority: '0.7', changefreq: 'daily' },
  { path: '/prospects', priority: '0.5', changefreq: 'weekly' },
  { path: '/rehab', priority: '0.4', changefreq: 'daily' },
  { path: '/milestones', priority: '0.5', changefreq: 'daily' },
  { path: '/umpires', priority: '0.5', changefreq: 'weekly' },
  { path: '/awards', priority: '0.4', changefreq: 'monthly' },
  { path: '/postseason-history', priority: '0.4', changefreq: 'monthly' },
  { path: '/postseason-leaders', priority: '0.4', changefreq: 'monthly' },
  { path: '/all-star-rosters', priority: '0.4', changefreq: 'yearly' },
  { path: '/all-star-legacy', priority: '0.4', changefreq: 'yearly' },
  { path: '/trade-deadline', priority: '0.4', changefreq: 'yearly' },
  { path: '/logos', priority: '0.3', changefreq: 'yearly' },
  // The broadcast reports. Daily on the three that move every night; the farm
  // board is weekly because the rank list behind it is republished far less
  // often than the affiliate records are.
  { path: '/attendance', priority: '0.6', changefreq: 'daily' },
  { path: '/pace-of-play', priority: '0.6', changefreq: 'daily' },
  { path: '/farm-system-rankings', priority: '0.6', changefreq: 'weekly' },
  { path: '/bullpen-availability', priority: '0.6', changefreq: 'daily' },
  { path: '/doubleheaders', priority: '0.6', changefreq: 'daily' },
  // The season boards. Same class as /standings and /leaders above — league-wide,
  // public, no game's line on them — and they were left out only because each
  // arrived after this list was last read end to end.
  { path: '/situational-records', priority: '0.5', changefreq: 'daily' },
  { path: '/salaries', priority: '0.5', changefreq: 'weekly' },
  { path: '/postseason-race', priority: '0.6', changefreq: 'daily' },
  { path: '/fouls', priority: '0.4', changefreq: 'daily' },
]

// The six doors of the team hub (ADR-0034). MLB-only on four of them: an
// affiliate's Numbers, Games, Minors and Leaders tabs are the thinnest pages on
// this site — minor-league feeds routinely carry no standings, no jerseys and no
// prospects (the MiLB degrade in root CLAUDE.md) — and listing 480 URLs where
// 330 are substantive is how a sitemap earns a reputation. The hub and the
// roster are the two every club genuinely fills.
const CLUB_TABS = [
  { suffix: '', priority: '0.6', changefreq: 'weekly', mlbOnly: false },
  { suffix: '/roster', priority: '0.6', changefreq: 'daily', mlbOnly: false },
  { suffix: '/games', priority: '0.5', changefreq: 'daily', mlbOnly: true },
  { suffix: '/numbers', priority: '0.5', changefreq: 'daily', mlbOnly: true },
  { suffix: '/leaders', priority: '0.5', changefreq: 'daily', mlbOnly: true },
  { suffix: '/minors', priority: '0.4', changefreq: 'weekly', mlbOnly: true },
]

// Every club at every level this app serves, from the file gen-teams.mjs already
// writes. Read at CALL time, not at import — same reason the write below is
// guarded: importing this module must not touch the filesystem for a test that
// only wants buildSitemap's shape.
//
// A missing or unreadable file yields no clubs rather than a thrown build. This
// script runs inside `npm run build`, and a sitemap that lists fewer URLs is a
// far better failure than a deploy that does not happen.
export function readClubs() {
  try {
    const raw = readFileSync(new URL('../public/data/teams.json', import.meta.url), 'utf8')
    const bySportId = JSON.parse(raw).bySportId ?? {}
    return Object.entries(bySportId)
      .flatMap(([sportId, clubs]) =>
        (clubs ?? []).map((club) => ({ id: club.id, name: club.name, sportId: Number(sportId) })),
      )
      .filter((club) => club.id && club.name)
  } catch {
    return []
  }
}

function clubUrls(clubs) {
  return clubs.flatMap((club) => {
    const segment = entitySegment(club.id, club.name)
    return CLUB_TABS.filter((tab) => !tab.mlbOnly || club.sportId === 1).map((tab) =>
      url({
        path: `/team/${segment}${tab.suffix}`,
        priority: tab.priority,
        changefreq: tab.changefreq,
      }),
    )
  })
}

function url({ path, lastmod, priority, changefreq }) {
  return [
    '  <url>',
    `    <loc>${SITE_URL}${path}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : '',
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildSitemap(pages = LANDING_PAGES, clubs = readClubs()) {
  const entries = [
    ...APP_ROUTES.map(url),
    url({ path: '/learn', priority: '0.8', changefreq: 'monthly' }),
    ...pages.map((page) =>
      url({
        path: `/learn/${page.slug}`,
        lastmod: page.updated,
        priority: '0.9',
        changefreq: 'monthly',
      }),
    ),
    ...clubUrls(clubs),
  ]

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`
}

// Only WRITE when run as a script. `test/landing-pages.test.js` imports
// buildSitemap to assert what goes in and what stays out, and a module that
// writes a file on import would make the test suite mutate the repo — a build
// artifact appearing in `git status` after running tests is the kind of small
// mystery that costs somebody an afternoon.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const xml = buildSitemap()
  writeFileSync(resolve('public/sitemap.xml'), xml)
  console.log(`✓ sitemap.xml — ${xml.match(/<loc>/g)?.length ?? 0} urls`)
}
