// Game Notes — a link out to a club's official pre-game press-notes PDF, shown as
// a button on the lineup page. Two sources, one shape ({ date, title, url }):
//
//  • LIVE: dapi.mlbinfra.com — the JSON feed the mlb.com/{team}/news/game-notes
//    page is built from. CORS-open, no auth, keyed by our own MLB team id
//    ("teamid-158"). This is the freshest source and the one that matters for the
//    game being staged right now: a note posts a few hours before first pitch,
//    after the nightly archive cron has already run.
//  • ARCHIVE: a static same-origin /data/game-notes.json a daily cron
//    (scripts/gen-game-notes.mjs) appends to. The live feed only lists a club's
//    last ~10 games, so once a note ages off it's gone from mlb.com — but the
//    underlying img.mlbstatic.com PDF stays live forever. The archive keeps the
//    link so an older game stays reachable long after the site drops it.
//
// The two agree for any date the cron has already captured; the live check only
// changes the answer for today's not-yet-archived note. Resolution therefore:
// trust the archive for a past date it already has, else ask the live feed, else
// fall back to whatever the archive held.
//
// Spoiler note: the notes LIST (title/date/url) carries no score, so resolving
// and rendering the button is spoiler-free and belongs outside any seal, like the
// rest of the lineup page. The PDF itself is a press packet that recaps prior
// results — opening it is a deliberate, user-initiated jump to an external tab,
// the same "you chose to reveal this" contract as a tap-to-reveal seal.
//
// MLB only: the feed is an mlb.com convention; MiLB clubs (milb.com) don't
// publish to it, so callers gate on sportId === 1 and this degrades to null
// (button hidden) everywhere else.

const DAPI = 'https://dapi.mlbinfra.com/v2/content/en-us/documents/'

// Notes older than this (in days) are firmly in "de-listed, never changes"
// territory — serve them straight from the archive without a live round-trip.
const LIVE_LOOKBACK_DAYS = 3

let archivePromise = null
function loadArchive() {
  if (!archivePromise) {
    archivePromise = fetch('/data/game-notes.json')
      .then((r) => (r.ok ? r.json() : { notes: {} }))
      .catch(() => ({ notes: {} }))
  }
  return archivePromise
}

async function fetchLiveNotes(teamId, limit = 8) {
  const url = `${DAPI}?$limit=${limit}&tags.slug=teamid-${teamId},game-notes&sort=-contentDate`
  const res = await fetch(url)
  if (!res.ok) return []
  const { items = [] } = await res.json()
  return items
    .filter((it) => it?.file?.viewUrl)
    .map((it) => ({
      date: (it.contentDate || '').slice(0, 10),
      title: it.title || 'Game Notes',
      url: it.file.viewUrl,
    }))
}

const dayDiff = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000)

// Pick the note that best matches the game's calendar date: an exact date wins,
// else the nearest within a day (absorbs the rare UTC-rollover on a note posted
// late in the evening), tie-breaking toward the newer note. With no game date,
// the newest note is the sensible default.
function matchByDate(notes, gameDate) {
  if (!notes || notes.length === 0) return null
  if (!gameDate) return notes[0]
  let best = null
  let bestGap = Infinity
  for (const n of notes) {
    if (!n?.date) continue
    if (n.date === gameDate) return n
    const gap = Math.abs(dayDiff(n.date, gameDate))
    if (gap <= 1 && gap < bestGap) {
      best = n
      bestGap = gap
    }
  }
  return best
}

// Resolve the best game-notes link for a club on a given calendar date, or null.
// `gameDate` is the game's officialDate ("YYYY-MM-DD"); `teamId` is the MLB team
// id. Safe to call for any game — returns null (→ no button) when there are no
// notes, which is every MiLB game and any date the club never posted.
export async function resolveGameNotes(teamId, gameDate) {
  if (!teamId) return null
  const archive = await loadArchive()
  const archived = matchByDate(archive.notes?.[teamId] ?? [], gameDate)

  // A past date the archive already covers never changes — no need to hit the
  // network. (Recent/today's games fall through to the live feed below, which is
  // the only source with a note that posted after the last cron run.)
  const old = gameDate && dayDiff(new Date().toISOString().slice(0, 10), gameDate) > LIVE_LOOKBACK_DAYS
  if (archived && old) return archived

  try {
    const live = matchByDate(await fetchLiveNotes(teamId), gameDate)
    if (live) return live
  } catch {
    // live feed unreachable — use whatever the archive had
  }
  return archived
}
