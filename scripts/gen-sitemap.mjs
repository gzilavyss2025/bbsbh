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
//   - Per-player and per-team pages. There are thousands, they turn over every
//     season, and a sitemap full of URLs that 404 next spring is worse than a
//     short one that stays true.
//
// `lastmod` for a guide comes from that page's own `updated` field, so it is a
// statement about the content rather than about when this script last ran.
// Emitting today's date for every URL on every build is the most common way a
// sitemap becomes noise a crawler learns to ignore.

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { LANDING_PAGES } from '../src/copy/landing/pages/index.js'
import { SITE_URL } from '../src/copy/landing/site.js'

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
  // index is weekly because the rank list behind it is republished far less
  // often than the affiliate records are.
  { path: '/rundown', priority: '0.6', changefreq: 'daily' },
  { path: '/attendance', priority: '0.5', changefreq: 'daily' },
  { path: '/pace', priority: '0.5', changefreq: 'daily' },
  { path: '/farm', priority: '0.5', changefreq: 'weekly' },
  { path: '/bullpens', priority: '0.5', changefreq: 'daily' },
]

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

export function buildSitemap(pages = LANDING_PAGES) {
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
  writeFileSync(resolve('public/sitemap.xml'), buildSitemap())
  console.log(`✓ sitemap.xml — ${APP_ROUTES.length + 1 + LANDING_PAGES.length} urls`)
}
