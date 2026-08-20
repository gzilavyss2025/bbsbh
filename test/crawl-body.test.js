// The crawlable body api/preview.js writes into the shell for the routes
// vercel.json rewrites — ADR-0059.
//
// Read api/_lib/crawl.js first. This body is composed COMPLETE and handed to
// whoever asked, including an anonymous crawler, with no SealBox in front of it
// and no reveal mark consulted — the same position test/landing-pages.test.js
// describes for /learn. So the assertions here are not about markup taste. Two
// of them are the whole safety argument: nothing in this layer can reach the
// live-game data modules, and a game route produces no body at all.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { buildRoster } from '../api/_lib/cards.js'
import { CRAWL_STYLE, playerCrawl, renderCrawlBody, seasonTable, teamCrawl } from '../api/_lib/crawl.js'
import { withCrawlBody } from '../api/preview.js'
import { buildSitemap } from '../scripts/gen-sitemap.mjs'
import { entitySegment } from '../src/lib/route.js'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

// A hitter, as statsapi hands one back. Field paths verified 2026-08-20 against
// people 545361 / 694973 / 671218 — see api/_lib/cards.js on each.
const HITTER = {
  id: 545361,
  fullName: 'Mike Trout',
  primaryNumber: '27',
  primaryPosition: { abbreviation: 'CF', name: 'Center Fielder' },
  currentTeam: { id: 108, name: 'Los Angeles Angels' },
  batSide: { description: 'Right' },
  pitchHand: { description: 'Right' },
  height: `6' 2"`,
  weight: 235,
  currentAge: 34,
  birthDate: '1991-08-07',
  birthCity: 'Vineland',
  birthStateProvince: 'NJ',
  birthCountry: 'USA',
  mlbDebutDate: '2011-07-08',
  stats: [
    {
      group: { displayName: 'hitting' },
      type: { displayName: 'season' },
      splits: [{ season: '2026', stat: { gamesPlayed: 120, avg: '.283', homeRuns: 31, rbi: 88, hits: 130, ops: '.921' } }],
    },
  ],
}

const CLUB = {
  id: 158,
  name: 'Milwaukee Brewers',
  locationName: 'Milwaukee',
  firstYearOfPlay: '1968',
  venue: { name: 'American Family Field' },
  league: { name: 'National League' },
  division: { name: 'National League Central' },
  sport: { id: 1 },
}

const playerBody = () =>
  renderCrawlBody(playerCrawl(HITTER, { id: 545361, name: 'Mike Trout', pos: 'CF', team: 'Los Angeles Angels' }))

const clubBody = (tab = '') =>
  renderCrawlBody(teamCrawl(CLUB, { id: 158, name: 'Milwaukee Brewers', level: 'MLB', league: 'National League', tab }))

// ------------------------------------------------------- the body is readable

test('a player body carries the words, with no JavaScript required', () => {
  const out = playerBody()
  assert.ok(out.includes('<h1>Mike Trout</h1>'), 'the name is a real headline')
  assert.ok(out.includes('Center Fielder'), 'the position is spelled out, not abbreviated')
  assert.ok(out.includes('Los Angeles Angels'), 'the club is named')
  assert.ok(out.includes('<td>.283</td>'), 'the season line is in the HTML')
  assert.ok(out.includes('Jul 8, 2011'), 'the debut date is readable, not ISO')
  // The link graph. A crawler learns a URL from an <a href>, and until this
  // existed the only markup this site offered one was a sitemap.
  assert.ok(out.includes('href="/team/los-angeles-angels-108"'), 'it links to the club, slugged')
  assert.ok(out.includes('href="/learn"'), 'it links into the guides')
})

test('a club body carries its identity and its own five other doors', () => {
  const out = clubBody()
  assert.ok(out.includes('<h1>Milwaukee Brewers</h1>'))
  assert.ok(out.includes('American Family Field'), 'the ballpark is named')
  for (const suffix of ['/roster', '/games', '/numbers', '/minors', '/leaders']) {
    assert.ok(out.includes(`href="/team/milwaukee-brewers-158${suffix}"`), `it links to ${suffix}`)
  }
  // A tab does not link to itself, and says which tab it is.
  const roster = clubBody('roster')
  assert.ok(roster.includes('<h1>Milwaukee Brewers — Roster</h1>'))
  assert.doesNotMatch(roster, /href="\/team\/milwaukee-brewers-158\/roster"/, 'the roster tab does not link to itself')
})

test('a missing field renders as nothing, not as a blank row', () => {
  // The MiLB degrade (root CLAUDE.md) on a surface with no React in it: an
  // affiliate whose feed carries no venue and no division must not print empty
  // definition rows.
  const bare = renderCrawlBody(
    teamCrawl({ id: 5015, name: 'Carolina Mudcats', sport: { id: 14 } }, { id: 5015, name: 'Carolina Mudcats', level: 'A', league: '', tab: '' }),
  )
  assert.ok(bare.includes('<h1>Carolina Mudcats</h1>'))
  assert.doesNotMatch(bare, /<dd><\/dd>/, 'no empty value is printed')
  assert.doesNotMatch(bare, /Ballpark/, 'a field with no value is absent, not blank')
})

test('a player with no season on file renders without a stat table', () => {
  const out = renderCrawlBody(
    playerCrawl({ ...HITTER, stats: [] }, { id: 545361, name: 'Mike Trout', pos: 'CF', team: 'Los Angeles Angels' }),
  )
  assert.ok(out.includes('<h1>Mike Trout</h1>'))
  assert.doesNotMatch(out, /<table>/, 'no empty table')
})

// ------------------------------------------------------------- the stat line

test('a traded player shows his combined season, not one club of it', () => {
  // Verified against person 671218, traded mid-2026: statsapi returns three
  // splits and the COMBINED one carries `numTeams`. Taking splits[0] blindly
  // happens to work there and would silently print one club's half of a season
  // the day statsapi orders them the other way.
  const table = seasonTable({
    stats: [
      {
        group: { displayName: 'hitting' },
        splits: [
          { season: '2026', team: { name: 'San Francisco Giants' }, stat: { gamesPlayed: 74, avg: '.264' } },
          { season: '2026', numTeams: 2, stat: { gamesPlayed: 87, avg: '.242' } },
        ],
      },
    ],
  })
  assert.equal(table.row[0], '87', 'the combined games total, not one club’s')
  assert.equal(table.row[1], '.242')
})

test('a pitcher gets a pitching line and a hitter a hitting one', () => {
  const pitcher = seasonTable({
    stats: [
      {
        group: { displayName: 'pitching' },
        splits: [{ season: '2026', stat: { wins: 9, losses: 11, era: '3.95', gamesPitched: 26, inningsPitched: '139.0', strikeOuts: 171, whip: '1.14' } }],
      },
    ],
  })
  assert.deepEqual(pitcher.columns, ['W-L', 'ERA', 'G', 'IP', 'SO', 'WHIP'])
  assert.equal(pitcher.row[0], '9-11')
  assert.deepEqual(seasonTable(HITTER).columns, ['G', 'AVG', 'HR', 'RBI', 'H', 'OPS'])
})

// --------------------------------------------------------------- the spoiler rule

// The structural half of ADR-0059. Everywhere else in this app a score is safe
// because a SealBox decides when a render function runs. Here the HTML is sent
// complete, so safety has to come from the layer being unable to reach a score
// at all.
test('the crawl layer imports nothing that can reach a game', () => {
  for (const path of ['api/_lib/crawl.js', 'api/_lib/cards.js', 'api/preview.js']) {
    const source = read(path)
    assert.doesNotMatch(source, /from '[^']*src\/api\//, `${path} must not import the app's data layer`)
    assert.doesNotMatch(source, /linescore|derive\.js|hitchart/, `${path} must not name a reveal-only module`)
  }
  // The body layer's whole import graph is one line, and that line is the slug
  // helpers — which fetch nothing either. There is almost no graph to audit,
  // which is the strongest form of this claim available.
  const imports = read('api/_lib/crawl.js').match(/^import .*$/gm) ?? []
  assert.deepEqual(imports, ["import { clean, entitySegment, niceDate } from './entity.js'"])
  assert.doesNotMatch(read('api/_lib/entity.js'), /^import /m, 'and that one imports nothing at all')
})

test('a game route produces no body, and cannot grow one by accident', () => {
  // A resolved game card carries no `crawl`, so there is nothing to render and
  // no branch to get wrong. Asserted here on the card shape AND on the source,
  // because the second is what fails if somebody adds one later.
  const gameCard = read('api/_lib/cards.js').match(/async function gameCard[\s\S]*?\n}/)[0]
  assert.ok(gameCard.length > 200, 'found the game builder')
  assert.doesNotMatch(gameCard, /crawl/, 'the game builder returns no crawl description')

  const shell = '<html><head></head><body><div id="root"></div></body></html>'
  const cardWithoutCrawl = { title: 'DET @ PIT', description: 'x', image: 'y', alt: 'z' }
  assert.equal(withCrawlBody(shell, cardWithoutCrawl, null), shell, 'the shell is handed back untouched')
})

test('a club body prints no record and no result', () => {
  // A club's W-L runs through the cutoff-gated modules in
  // src/api/spoiler-manifest.json — a number that takes an `asOf` for a reason.
  // Nothing here has a reader to ask, so it prints none.
  const out = clubBody()
  for (const word of [/\bwins?\b/i, /\blosses\b/i, /\brecord\b/i, /\bfinal\b/i, /gamePk/i, /\b\d{2,3}-\d{2,3}\b/]) {
    assert.doesNotMatch(out, word, `a club body must not carry ${word}`)
  }
  // The word "Standings" IS allowed, and only as a link label — the Numbers tab
  // is called that and /standings is a page this sitemap already lists. What is
  // forbidden is the NUMBER: a club's W-L, which the last pattern above catches
  // in the shape it would arrive in.
})

test('a player body carries a season aggregate and nothing per-game', () => {
  const out = playerBody()
  assert.doesNotMatch(out, /gamePk/i)
  assert.doesNotMatch(out, /statsapi/i)
  assert.doesNotMatch(out, /\b(final|walk-?off|beat|defeated)\b/i)
})

test('buildRoster answers only for the roster tab', async () => {
  // Every other route resolves to null without a request, which is what keeps
  // the ~29 other rewrites at one upstream call each.
  for (const route of ['player', 'team', 'team-games', 'game', 'standings']) {
    assert.equal(await buildRoster(new URLSearchParams({ route, id: '158' })), null, route)
  }
})

// ------------------------------------------------------- where the markup goes

test('the body is a sibling of #root, never its contents', () => {
  // Inside #root it would be cleared by React on mount, which would work — and
  // would paint IN CAPITALS until then, because the ALL-CAPS INVARIANT is scoped
  // to `#root *` and the built shell loads that stylesheet as a real <link>.
  const shell = '<html><head><title>t</title></head><body><div id="root"></div></body></html>'
  const out = withCrawlBody(shell, { crawl: { h1: 'Mike Trout' } }, null)
  assert.ok(out.includes('<div id="crawl">'), 'the body is written')
  assert.ok(out.indexOf('</div>') < out.indexOf('<div id="root">'), 'it closes before #root opens')
  assert.ok(out.includes('<div id="root"></div>'), 'the mount point survives intact')
  assert.equal(out.match(/<div id="root">/g).length, 1, 'exactly one mount point')
  assert.ok(out.indexOf(CRAWL_STYLE) < out.indexOf('</head>'), 'its stylesheet is in the head')
})

test('a shell this does not recognise is handed back untouched', () => {
  const odd = '<html><head></head><body><div id="app"></div></body></html>'
  assert.equal(withCrawlBody(odd, { crawl: { h1: 'Mike Trout' } }, null), odd)
})

test('a name is escaped, and a name containing a $ pattern survives intact', () => {
  // String.replace treats `$&` in a REPLACEMENT as a back-reference, and the
  // text flowing through here is a person's name — which this app does not get
  // to assume the shape of.
  const shell = '<html><head></head><body><div id="root"></div></body></html>'
  const out = withCrawlBody(shell, { crawl: { h1: `A$&B <script>alert('x')</script>` } }, null)
  assert.ok(out.includes('A$&amp;B'), 'the dollar pattern is not expanded')
  assert.doesNotMatch(out, /<script>alert/, 'no injected script tag survives')
  assert.ok(out.includes('&lt;script&gt;'), 'it is printed as text instead')
})

test('the app removes the body before it paints over it', () => {
  const main = read('src/main.jsx')
  const removal = main.indexOf("getElementById('crawl')")
  assert.ok(removal > -1, 'main.jsx removes the crawl body')
  assert.ok(removal < main.indexOf('root.render('), 'and does it before the first render')
})

// ------------------------------------------------------------------- sitemap

test('the sitemap lists every club, at the address the canonical names', () => {
  const clubs = [
    { id: 158, name: 'Milwaukee Brewers', sportId: 1 },
    { id: 512, name: 'Toledo Mud Hens', sportId: 11 },
  ]
  const xml = buildSitemap([], clubs)
  // The slugged form, spelled by route.js itself. A sitemap naming the OTHER of
  // two working addresses lists a page whose canonical points somewhere else.
  assert.ok(xml.includes(`<loc>https://tallybb.com/team/${entitySegment(158, 'Milwaukee Brewers')}</loc>`))
  assert.ok(xml.includes('/team/milwaukee-brewers-158/roster</loc>'))
  assert.ok(xml.includes('/team/milwaukee-brewers-158/numbers</loc>'), 'an MLB club gets all six doors')
  // A MiLB affiliate gets the two tabs its feed actually fills.
  assert.ok(xml.includes('/team/toledo-mud-hens-512</loc>'))
  assert.ok(xml.includes('/team/toledo-mud-hens-512/roster</loc>'))
  assert.doesNotMatch(xml, /toledo-mud-hens-512\/numbers/, 'not an affiliate’s thinnest tabs')
})

test('the sitemap still lists no player page and no scoring surface', () => {
  const xml = buildSitemap()
  assert.doesNotMatch(xml, /<loc>[^<]*\/player\//, 'players are discovered by links, not listed')
  assert.doesNotMatch(xml, /<loc>[^<]*\/\d{8}[^<]*<\/loc>/, 'no dated slate')
  assert.ok(xml.match(/<loc>/g).length > 300, 'the clubs really are in there')
})

test('a missing club file degrades to a shorter sitemap, never a failed build', () => {
  const xml = buildSitemap([], [])
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  assert.ok(xml.includes('<loc>https://tallybb.com/</loc>'), 'the app routes still ship')
})
