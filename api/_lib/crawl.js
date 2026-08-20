// The crawlable BODY for a rewritten deep link — the other half of what
// api/preview.js serves, alongside the link-preview card in the <head>.
//
// WHY IT EXISTS. api/preview.js has swapped the OG block for a per-route card
// since ADR-0012, but the body underneath it was `<div id="root"></div>`. Google
// renders JavaScript and survives that; the crawlers behind AI assistants do
// not, and ADR-0053 has the measurements. So to an assistant, every player page,
// club page and leader board on this site was a blank div with a good meta
// description. ADR-0053 fixed that for /learn by rendering those guides as real
// documents. This is the same move applied to the ~30 routes vercel.json already
// rewrites, and it reuses their already-resolved payload rather than fetching
// again. ADR-0058.
//
// EVERYTHING HERE IS PURE. No fetch, no Redis, no clock, and one import — the
// slug helpers in ./entity.js, which fetch nothing either. api/_lib/cards.js
// does all of the I/O and hands the payload here, the same split
// src/copy/landing/render.js keeps for /learn, and for the same reason: this
// HTML is composed COMPLETE and handed to whoever asked, with no SealBox in
// front of it and no reveal mark consulted, so a module that cannot reach the
// feed cannot leak a score. `test/crawl-body.test.js` pins that over the import
// graph.
//
// It holds BOTH halves of the body — what a page says (the builders) and how it
// is written out (the renderer) — because they are one subject and the file-size
// guard would rather have one file per subject than two halves of one (ADR-0038).
// What cards.js keeps is what it was always for: talking to statsapi.
//
// NOTHING HERE RENDERS A GAME. There is a player builder and a club builder and
// no third one, so a game route reaches nothing in this file at all. A club's or
// a person's identity is spoiler-free and opens live everywhere else in this
// app; a game route is inside the spoiler scope, and the schedule payload that
// would answer one carries `teams.away.score` and `isWinner` in the same object
// as the matchup. ADR-0058 argues why that is a body worth NOT having.
//
// WHERE THE MARKUP GOES, and why it is not inside #root. React clears its
// container on mount, so markup placed in `#root` would be thrown away when the
// SPA boots — which would work. It would also be wrong: the ALL-CAPS INVARIANT
// in src/styles/01-base.css is scoped to `#root *`, and the built shell loads
// that stylesheet as a real <link>, so a paragraph of prose inside #root paints
// IN CAPITALS for as long as the shell is on screen. That is ADR-0053's own
// second reason, applied to this surface. So the body is a SIBLING that
// src/main.jsx removes immediately before it renders.
//
// The alternative — leaving the sibling in place and hiding it with
// `#crawl { display: none }` in the app stylesheet — would remove the flash
// completely and is deliberately not used. It shows content to clients that do
// not apply CSS and hides it from clients that do, which is the shape of
// cloaking whatever the intent. A reader who does not run JavaScript sees
// exactly what a reader who does would see before the bundle takes over.

import { clean, entitySegment, niceDate } from './entity.js'

// --- what the page says ----------------------------------------------------
//
// Each builder turns a statsapi payload into a `crawl` description; cards.js
// hangs that on the card and api/preview.js renders it into the page (ADR-0058).
// The shape:
//
//   { h1, lead, blurb,
//     facts: [{ label, value }],
//     table: { heading, columns, row },
//     list:  { heading, items: [{ href, text, note }] },
//     links: { heading, items } }
//
// Every part is optional and an empty one renders as nothing, which is what
// keeps a MiLB club whose feed carries no venue from printing a blank row (the
// MiLB degrade in root CLAUDE.md, applied to a surface with no React in it).
//
// The builders take the payload their card already fetched — never a fresh one —
// so a body costs no request of its own. Field paths were verified 2026-08-20
// against people 545361 / 694973 / 671218 and teams 158 / 512 / 5015; the
// repo's rule is to check a new one against a real response rather than guess.
//
// They are EXPORTED so they can be unit-tested against a payload with no network
// call, the same reason `firstNonNull` and `TEAM_TABS` are — and here it buys
// more than convenience. What these functions do and do not put in a page IS the
// spoiler claim ADR-0058 makes, so `teamCrawl` emitting no record has to be
// assertable rather than merely written down.

// A traded player's season comes back as several splits: one per club, plus a
// COMBINED one that carries `numTeams`. Verified 2026-08-20 against person
// 671218, traded mid-2026 — three splits, the combined one first with
// `numTeams: 2`. Take the combined line when there is one; a player who has not
// moved has exactly one split and takes it.
function seasonSplit(group) {
  const splits = group?.splits ?? []
  return splits.find((s) => (s.numTeams ?? 0) > 1) ?? splits[0] ?? null
}

// The season line the player's own page already shows. A SEASON AGGREGATE IS NOT
// A SCORE, and that is the settled reading rather than a new one: ADR-0034's
// "the cutoff is opt-in now" took the date cutoff OFF these surfaces precisely
// because freezing a stat line was the spoiler rule reaching past what it
// protects. This is the same number the app renders live at this same URL, and
// no part of it belongs to one game.
export function seasonTable(person) {
  const group = (person.stats ?? []).find((s) => (s.splits ?? []).length)
  const split = seasonSplit(group)
  if (!split) return null
  const stat = split.stat ?? {}
  const pitching = group?.group?.displayName === 'pitching'
  const cells = pitching
    ? [
        ['W-L', stat.wins == null ? '' : `${stat.wins}-${stat.losses ?? 0}`],
        ['ERA', stat.era],
        ['G', stat.gamesPitched ?? stat.gamesPlayed],
        ['IP', stat.inningsPitched],
        ['SO', stat.strikeOuts],
        ['WHIP', stat.whip],
      ]
    : [
        ['G', stat.gamesPlayed],
        ['AVG', stat.avg],
        ['HR', stat.homeRuns],
        ['RBI', stat.rbi],
        ['H', stat.hits],
        ['OPS', stat.ops],
      ]
  const kept = cells.filter(([, value]) => value !== undefined && value !== null && value !== '')
  if (!kept.length) return null
  return {
    heading: `${split.season ? `${split.season} ` : ''}season · ${pitching ? 'pitching' : 'hitting'}`,
    columns: kept.map(([label]) => label),
    row: kept.map(([, value]) => String(value)),
  }
}

// A player's readable body: who he is, the club he is on, and the season line.
// Position spelled out rather than abbreviated — 'Center Fielder' is a term an
// answer engine can match a question against; 'CF' is not.
export function playerCrawl(p, { id, name, pos, team }) {
  const posName = clean(p.primaryPosition?.name || '')
  const positionLabel = posName && posName !== 'Unknown' ? posName : pos
  const born = [clean(p.birthCity), clean(p.birthStateProvince), clean(p.birthCountry)]
    .filter(Boolean)
    .join(', ')
  const clubSegment = p.currentTeam?.id ? entitySegment(p.currentTeam.id, team) : ''
  return {
    h1: name,
    lead: [positionLabel, team].filter(Boolean).join(' · '),
    blurb: `${name} on Tally Baseball — bio, career register and season stats, alongside a spoiler-safe scorecard companion for the games he plays in.`,
    facts: [
      { label: 'Position', value: positionLabel },
      { label: 'Club', value: team },
      { label: 'Number', value: p.primaryNumber ? `#${clean(p.primaryNumber)}` : '' },
      { label: 'Bats / Throws', value: bothSides(p) },
      { label: 'Height / Weight', value: [clean(p.height), p.weight ? `${p.weight} lb` : ''].filter(Boolean).join(' / ') },
      { label: 'Age', value: p.currentAge ? String(p.currentAge) : '' },
      { label: 'Born', value: [niceDate(p.birthDate), born].filter(Boolean).join(' · ') },
      { label: 'MLB debut', value: niceDate(p.mlbDebutDate) },
      // The id in the body as well as in the address, for a reader checking
      // they have the right one of two players who share a name — ADR-0057's
      // motivating case is exactly that pair.
      { label: 'MLB id', value: String(id) },
    ],
    table: seasonTable(p),
    links: clubSegment
      ? {
          heading: `${team} on Tally`,
          items: [
            { href: `/team/${clubSegment}`, text: `${team} club page` },
            { href: `/team/${clubSegment}/roster`, text: `${team} roster` },
            { href: `/team/${clubSegment}/leaders`, text: `${team} team leaders` },
          ],
        }
      : null,
  }
}

function bothSides(p) {
  const bats = clean(p.batSide?.description || '')
  const throws = clean(p.pitchHand?.description || '')
  if (!bats && !throws) return ''
  return `${bats || '—'} / ${throws || '—'}`
}

// The six doors of the team hub (ADR-0034 — each tab is a real route that loads
// only its own data). The body lists the five a reader is NOT on, which is what
// gives a crawler a path from any club page to the other five.
const TEAM_DOORS = [
  { tab: '', suffix: '', text: 'Club overview' },
  { tab: 'roster', suffix: '/roster', text: 'Roster' },
  { tab: 'games', suffix: '/games', text: 'Schedule and results' },
  { tab: 'numbers', suffix: '/numbers', text: 'Standings and team stats' },
  { tab: 'minors', suffix: '/minors', text: 'Affiliates and prospects' },
  { tab: 'leaders', suffix: '/leaders', text: 'Team leaders' },
]

// A club's readable body: identity, where it plays, and its own six doors.
//
// NO RECORD, and that is a decision rather than an omission. A club's W-L is
// what the cutoff-gated modules in src/api/spoiler-manifest.json handle
// (standings.js, teamScore.js, teamRecords.js, seasonSeries.js) — a number that
// takes an `asOf` for a reason. Nothing here has a reader to ask, so it does not
// print one. The identity below never moves during a game.
export function teamCrawl(t, { id, name, level, league, tab }) {
  const segment = entitySegment(id, name)
  const division = clean(t.division?.name || '')
  return {
    h1: [name, tab ? TEAM_DOORS.find((door) => door.tab === tab)?.text : ''].filter(Boolean).join(' — '),
    lead: [level, league, division].filter(Boolean).join(' · '),
    blurb: `${name} on Tally Baseball — roster, leaders, affiliates and schedule, alongside a spoiler-safe companion for scoring the club's games by hand.`,
    facts: [
      { label: 'League', value: league },
      { label: 'Division', value: division },
      { label: 'Level', value: level },
      { label: 'Ballpark', value: clean(t.venue?.name || '') },
      { label: 'Location', value: clean(t.locationName || '') },
      { label: 'First season', value: t.firstYearOfPlay ? String(t.firstYearOfPlay) : '' },
      { label: 'Club id', value: String(id) },
    ],
    links: {
      heading: `${name} on Tally`,
      items: TEAM_DOORS.filter((door) => door.tab !== (tab || '')).map((door) => ({
        href: `/team/${segment}${door.suffix}`,
        text: door.text,
      })),
    },
  }
}

// --- how it is written out -------------------------------------------------

// Scoped to #crawl, injected into the <head> by preview.js, and left behind
// harmlessly once main.jsx removes the element. It exists so the brief moment a
// human sees this on the first hard load of a shared link reads as a plain
// document rather than as unstyled soup. Colours are inherited from the app's
// own stylesheet, which the shell has already loaded — this sets layout only, so
// there is no second palette here to drift from src/tokens/.
export const CRAWL_STYLE = `<style>#crawl{max-width:42rem;margin:0 auto;padding:1.5rem 1.25rem 3rem;font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}#crawl h1{font-size:1.6rem;margin:0 0 .25rem}#crawl h2{font-size:1.05rem;margin:1.75rem 0 .5rem}#crawl p{margin:0 0 .75rem}#crawl dl{display:grid;grid-template-columns:auto 1fr;gap:.15rem .75rem;margin:1rem 0}#crawl dt{font-weight:600}#crawl dd{margin:0}#crawl ul{margin:.25rem 0;padding-left:1.1rem}#crawl li{margin:.15rem 0}#crawl table{border-collapse:collapse;width:100%}#crawl th,#crawl td{padding:.25rem .5rem;text-align:left;border-bottom:1px solid currentColor}#crawl small{opacity:.75}</style>`

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Every body ends with the same short rail. A crawler learns a URL from a link,
// and until now the only markup this site offered one was a sitemap — so the
// pages that ARE listed there had nothing pointing onward to the pages that are
// not. See ADR-0058 on why a club's roster page carries the rest of that graph.
const SITE_LINKS = [
  { href: '/', text: "Today's games" },
  { href: '/learn', text: 'Scorekeeping guides' },
  { href: '/standings', text: 'Standings' },
  { href: '/leaders', text: 'League leaders' },
  { href: '/umpires', text: 'Umpire rankings' },
  { href: '/about', text: 'About Tally Baseball' },
]

const link = (item) =>
  `<li><a href="${esc(item.href)}">${esc(item.text)}</a>${item.note ? ` <small>${esc(item.note)}</small>` : ''}</li>`

function renderFacts(facts = []) {
  const rows = facts.filter((f) => f && f.value)
  if (!rows.length) return ''
  return `<dl>\n${rows.map((f) => `<dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd>`).join('\n')}\n</dl>`
}

// A real <table>, for the same reason render.js gives: a grid of divs is
// guesswork for a machine reader, and being read by one is this body's whole job.
function renderTable(table) {
  if (!table || !table.columns?.length || !table.row?.length) return ''
  return `<h2>${esc(table.heading)}</h2>
<table>
<thead><tr>${table.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
<tbody><tr>${table.row.map((c) => `<td>${esc(c)}</td>`).join('')}</tr></tbody>
</table>`
}

function renderList(list) {
  if (!list || !list.items?.length) return ''
  return `<h2>${esc(list.heading)}</h2>\n<ul>\n${list.items.map(link).join('\n')}\n</ul>`
}

// `crawl` is the description object api/_lib/cards.js builds — see buildCrawl
// there for its shape. Returns '' for anything it cannot render, so the caller's
// fallback is always the shell it already had.
export function renderCrawlBody(crawl) {
  if (!crawl?.h1) return ''
  const parts = [
    `<h1>${esc(crawl.h1)}</h1>`,
    crawl.lead ? `<p>${esc(crawl.lead)}</p>` : '',
    crawl.blurb ? `<p>${esc(crawl.blurb)}</p>` : '',
    renderFacts(crawl.facts),
    renderTable(crawl.table),
    renderList(crawl.list),
    renderList(crawl.links),
    renderList({ heading: 'Elsewhere on Tally', items: SITE_LINKS }),
  ]
  return `<div id="crawl">
<p><a href="/">Tally Baseball</a></p>
${parts.filter(Boolean).join('\n')}
<p><small>Tally Baseball is a free, spoiler-safe companion for scoring baseball by hand. Every score stays sealed until you tap to reveal it.</small></p>
</div>`
}
