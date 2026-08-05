#!/usr/bin/env node
// Guards against the dynamic link-preview layer (api/_lib/cards.js,
// docs/adr/0012-dynamic-link-previews.md) silently losing coverage of a real
// page again the way it did for 12 report pages and 4 of 5 team-hub tabs —
// added over several PRs across three weeks with no rewrite/card added
// alongside any of them, so each just fell through to the static default
// card with nothing failing to say so (fixed in #552).
//
// A page's dynamic card needs THREE things to agree, and any one missing
// silently degrades to the static default:
//   1. a vercel.json rewrite to /api/preview?route=<name>
//   2. a case '<name>': in api/_lib/cards.js's buildCard() switch
//   3. a GENERIC (static report pages) or TEAM_TABS (team-hub tabs) entry
//      that case actually reads — a case with no entry still returns null
//
// The two lists of "pages that must be covered" are read from their own
// source of truth rather than hand-maintained here, so this guard can't
// itself drift the way vercel.json did: REPORT_PAGES (src/lib/reportPages.js)
// for the standalone report pages, and TeamTabBar.jsx's TABS array for the
// team-hub tabs. A page added to either automatically becomes required here.
//
// Run by `npm run lint` (so it gates every push).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function read(relPath) {
  return readFileSync(join(ROOT, relPath), 'utf8')
}

// Slices the `{ ... }` block belonging to the first `{` at/after `marker`,
// by brace-depth counting rather than a regex — safe here because every
// caller passes plain JS object/function source with no unbalanced braces
// inside string literals (verified against the two blocks this guard reads).
function extractBlock(src, marker) {
  const markerIdx = src.indexOf(marker)
  if (markerIdx === -1) return null
  const braceStart = src.indexOf('{', markerIdx)
  if (braceStart === -1) return null
  let depth = 0
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) return src.slice(braceStart + 1, i)
    }
  }
  return null
}

// Top-level keys of an object block: a line starting with `key:` or
// `'key':` immediately followed by `{` — true for every entry in both
// GENERIC and TEAM_TABS (each maps to an object literal), and never true for
// a NESTED field inside one of those entries (a plain string, or TEAM_TABS's
// `description: (name) => \`...\`` arrow function, neither of which is
// followed by `{`).
function topLevelKeys(block) {
  const keys = new Set()
  const re = /^[ \t]*(?:'([^']+)'|([a-zA-Z_$][\w$]*)):\s*\{/gm
  let m
  while ((m = re.exec(block))) keys.add(m[1] || m[2])
  return keys
}

const reportPagesSrc = read('src/lib/reportPages.js')
const tabBarSrc = read('src/screens/team/TeamTabBar.jsx')
const cardsSrc = read('api/_lib/cards.js')
const vercelJson = JSON.parse(read('vercel.json'))

// --- pages that must be covered ---------------------------------------------

// REPORT_PAGES entries are all flat, single-segment paths today ('/fouls',
// not '/team/:id/...'). A future nested report-page path would need its own
// resolver (the way player/team/game already have one) rather than the
// generic-card treatment this guard checks for, so this only pulls the flat
// ones — true of every entry as of this writing.
const reportPageRoutes = [...reportPagesSrc.matchAll(/path:\s*'\/([a-z0-9-]+)'/g)].map((m) => m[1])

// Two pages are deliberately excluded from REPORT_PAGES itself (see that
// file's own header: Logo Sheet is a footer action button, About is appended
// separately by both callers) but are still real static pages the preview
// layer must cover.
const EXTRA_STATIC_ROUTES = ['about', 'logos']

const staticRoutes = [...new Set([...reportPageRoutes, ...EXTRA_STATIC_ROUTES])]

const tabBarKeys = [...tabBarSrc.matchAll(/key:\s*'([a-z]+)'/g)].map((m) => m[1])
// 'overview' maps to the bare /team/:id route — already covered by every
// other resolver (playerCard/gameCard/etc. all need it to work), not one of
// the per-tab generic card variants this guard checks.
// 'leaders' predates TeamTabBar.jsx (no button there) but is a real route
// (route.js's teamLeadersPath) that must stay covered.
const TEAM_TAB_EXTRAS = ['leaders']
const teamTabs = [...new Set([...tabBarKeys.filter((k) => k !== 'overview'), ...TEAM_TAB_EXTRAS])]

// --- what's actually wired up ------------------------------------------------

const vercelRoutes = new Set(
  (vercelJson.rewrites || [])
    .map((r) => /route=([a-zA-Z0-9-]+)/.exec(r.destination || '')?.[1])
    .filter(Boolean),
)

const genericKeys = topLevelKeys(extractBlock(cardsSrc, 'const GENERIC = ') || '')
const teamTabKeys = topLevelKeys(extractBlock(cardsSrc, 'export const TEAM_TABS = ') || '')
const buildCardBlock = extractBlock(cardsSrc, 'export async function buildCard(') || ''
const caseRoutes = new Set([...buildCardBlock.matchAll(/case\s+'([a-zA-Z0-9-]+)':/g)].map((m) => m[1]))

// --- verify ------------------------------------------------------------------

const problems = []

for (const route of staticRoutes) {
  if (!vercelRoutes.has(route)) problems.push(`/${route} — no vercel.json rewrite to /api/preview?route=${route}`)
  if (!caseRoutes.has(route)) problems.push(`/${route} — buildCard() has no case '${route}'`)
  else if (!genericKeys.has(route)) problems.push(`/${route} — buildCard() has a case, but GENERIC has no '${route}' entry (falls through to null)`)
}

for (const tab of teamTabs) {
  const route = `team-${tab}`
  if (!vercelRoutes.has(route)) problems.push(`/team/:id/${tab} — no vercel.json rewrite to /api/preview?route=${route}`)
  if (!caseRoutes.has(route)) problems.push(`/team/:id/${tab} — buildCard() has no case '${route}'`)
  else if (!teamTabKeys.has(tab)) problems.push(`/team/:id/${tab} — buildCard() has a case, but TEAM_TABS has no '${tab}' entry`)
}

if (problems.length) {
  console.error(
    '\n✗ Link-preview coverage guard failed — the following page(s) have no dynamic\n' +
      '  Open Graph card wired up (vercel.json rewrite -> buildCard() case -> a\n' +
      '  GENERIC/TEAM_TABS entry in api/_lib/cards.js), so a shared link silently\n' +
      '  falls back to the static default card. This is exactly how 12 report pages\n' +
      '  and 4 team-hub tabs lost preview coverage with nothing failing to say so\n' +
      '  (fixed in #552):\n',
  )
  for (const p of problems) console.error(`  ${p}`)
  console.error(
    "\n  Add a vercel.json rewrite ('/path' -> '/api/preview?route=<name>'), a matching\n" +
      "  case '<name>': in api/_lib/cards.js's buildCard(), and a GENERIC (static\n" +
      '  pages) or TEAM_TABS (team-hub tabs) entry with real title/eyebrow/\n' +
      '  description text — see docs/adr/0012-dynamic-link-previews.md.\n',
  )
  process.exit(1)
}

console.log(
  `✓ Link-preview coverage holds — every report page (${staticRoutes.length}) and team-hub tab (${teamTabs.length}) has a dynamic Open Graph card.`,
)
