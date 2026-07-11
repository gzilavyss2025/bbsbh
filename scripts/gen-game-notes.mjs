// Regenerates public/data/game-notes.json — a slim, ACCUMULATING archive of each
// MLB club's official pre-game "Game Notes" PDF (title, date, url), so the
// lineup-page button (src/api/gameNotes.js) can still reach a game's notes long
// after mlb.com de-lists it.
//
// Why a committed archive and not just a live fetch: the page every club serves
// at mlb.com/{team}/news/game-notes — and the dapi.mlbinfra.com feed behind it —
// is itself lossy over time (see PER_TEAM below for how far back it reaches).
// The underlying img.mlbstatic.com PDF asset stays live indefinitely, though, so
// this job snapshots the feed daily and MERGES new links into the file, never
// dropping the ones that have since aged off the source. The app reads the live
// feed for the game currently being staged (fresher than any cron) and falls
// back to this archive for older, de-listed games. Same build-time-fetch pattern
// as gen-rehab.mjs / gen-war.mjs, with one twist: this one is append-only,
// because the source is lossy over time.
//
// The feed is an mlb.com convention keyed by our own MLB team id ("teamid-158"):
// CORS-open, no auth, no browser needed (the mlb.com HTML page is UA-gated, this
// backing JSON API is not). MLB only — MiLB clubs (milb.com) don't publish to it.
//
// Runs on a cron (.github/workflows/update-nightly-data.yml); also by hand:
//   node scripts/gen-game-notes.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'game-notes.json')
const STATSAPI = 'https://statsapi.mlb.com'
const DAPI = 'https://dapi.mlbinfra.com/v2/content/en-us/documents/'

// How many recent notes to pull per team each run. 100 is the feed's actual
// ceiling, found by probing: $limit above 100 doesn't error, it silently falls
// back to a small default page (25) instead — so anything higher is a regression,
// not an improvement. At 100 the feed reaches back close to Opening Day for most
// clubs (some clubs' 100 most recent notes go back into 2025's postseason).
// Comfortably more than any two daily runs need, so nothing can slip through.
const PER_TEAM = 100

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

async function fetchMlbTeams() {
  const data = await getJson(`${STATSAPI}/api/v1/teams?sportId=1`)
  return (data.teams ?? []).map((t) => t.id).filter(Boolean)
}

// The live feed for one club, shaped to the slim {date, title, url} we store.
// `contentDate` is the note's publish timestamp — a uniform ISO string across all
// 30 clubs, unlike the title, whose date/opponent formatting varies team to team
// (Brewers "Game Notes, July 9 at St. Louis" vs Astros "Astros Game Notes
// 07.08.26 at WSH"), so we key on the date, never on parsing the title.
//
// The stored date is the publish time in America/New_York, NOT the raw UTC date:
// a note posted on a game's evening ET is already the next calendar day in UTC,
// so slicing the UTC string would tag an evening game's note a day late and let
// it read as the NEXT day's note. The ET date recovers the true game date and
// lines up with the game's ET-based officialDate. See src/api/gameNotes.js.
const ET_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
const etDate = (iso) => (iso ? ET_DATE.format(new Date(iso)) : '')

async function fetchTeamNotes(teamId) {
  const url = `${DAPI}?$limit=${PER_TEAM}&tags.slug=teamid-${teamId},game-notes&sort=-contentDate`
  const { items = [] } = await getJson(url)
  return items
    .filter((it) => it?.file?.viewUrl)
    .map((it) => ({
      date: etDate(it.contentDate),
      title: it.title || 'Game Notes',
      url: it.file.viewUrl,
    }))
}

// Merge freshly-fetched rows into the ones already on file, deduped by the PDF
// url (the permanent, unique key), newest date first. Old rows the source has
// since dropped are kept — that persistence is the whole point of the archive.
function mergeNotes(existing = [], incoming = []) {
  const byUrl = new Map()
  for (const n of existing) if (n?.url) byUrl.set(n.url, n)
  for (const n of incoming) if (n?.url) byUrl.set(n.url, { ...byUrl.get(n.url), ...n })
  return [...byUrl.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

// Run an async fn across items with a small concurrency cap — be polite to the
// feed rather than firing all 30 clubs at once.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      try {
        results[i] = await fn(items[i])
      } catch {
        results[i] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// --- main ---------------------------------------------------------------------
let prev = { notes: {} }
try {
  prev = JSON.parse(await readFile(out, 'utf8'))
} catch {
  // first run — no archive yet
}

const teamIds = await fetchMlbTeams()
const fetched = await mapWithConcurrency(teamIds, 6, async (id) => ({
  id,
  notes: await fetchTeamNotes(id),
}))

const notes = { ...(prev.notes ?? {}) }
let added = 0
for (const row of fetched) {
  if (!row) continue
  const before = (notes[row.id] ?? []).length
  notes[row.id] = mergeNotes(notes[row.id], row.notes)
  added += notes[row.id].length - before
}

await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), notes }))
const total = Object.values(notes).reduce((sum, arr) => sum + arr.length, 0)
console.log(`wrote ${out} — ${total} notes across ${Object.keys(notes).length} teams (+${added} new)`)
