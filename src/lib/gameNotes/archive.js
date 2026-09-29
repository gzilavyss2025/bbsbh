// The pure half of the /game-notes archive page (#1258): shard rows -> one sorted
// table, the club filter's order, and the CSV of links. Nothing here fetches; the
// page hands in the shards it loaded and a club-name lookup, which keeps this
// file free of teams.js and testable on plain arrays.
//
// SPOILER NOTE: a row is { date, teamId, club, title, url } — dates, a club and a
// title the club's own site chose ("Game Notes, September 27 vs. St. Louis"),
// never PDF text. The PDFs themselves hold results, and stay an off-site link,
// the same as the Game Notes button on the lineup page. This is an open surface
// (root CLAUDE.md), so nothing here needs a seal.

// The filter's "every club" value. A string, so it can never collide with a team id.
export const ALL_CLUBS = 'all'

const HEADER = ['date', 'teamId', 'club', 'title', 'url']

// Newest first; a tie (two clubs, or a doubleheader) falls to club name then
// title then url, so the order is the same whichever shard arrived first.
function byNewest(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  return a.club.localeCompare(b.club) || a.title.localeCompare(b.title) || a.url.localeCompare(b.url)
}

// `shards` is [{ teamId, notes: [{ date, title, url }] }] as the generator wrote
// them. A row with no date or no url cannot be listed or downloaded, so it is
// dropped; a missing title gets the plain one rather than a blank cell.
export function archiveRows(shards, nameOf) {
  const rows = []
  for (const shard of shards ?? []) {
    if (!shard || !Array.isArray(shard.notes)) continue
    for (const n of shard.notes) {
      if (!n?.date || !n?.url) continue
      rows.push({
        date: n.date,
        teamId: shard.teamId,
        club: nameOf(shard.teamId) || '',
        title: n.title || 'Game Notes',
        url: n.url,
      })
    }
  }
  return rows.sort(byNewest)
}

// The filter, in the order the issue asks for: the reader's club first (only if
// it is an MLB club in `clubs` — a MiLB favorite has no shard), then "All clubs",
// then the other clubs by name. `clubs` is [{ id, name }].
export function clubOptions(clubs, favoriteId) {
  const byName = [...clubs].sort((a, b) => a.name.localeCompare(b.name))
  const fav = byName.find((c) => c.id === favoriteId)
  const opt = (c) => ({ value: c.id, label: c.name })
  return [
    ...(fav ? [opt(fav)] : []),
    { value: ALL_CLUBS, label: 'All clubs' },
    ...byName.filter((c) => c !== fav).map(opt),
  ]
}

// Where the page opens: a `?team=` from the team hub if it names an MLB club,
// else the reader's own club, else every club.
export function defaultClub({ favoriteId, requestedId, clubIds }) {
  if (clubIds.includes(requestedId)) return requestedId
  if (clubIds.includes(favoriteId)) return favoriteId
  return ALL_CLUBS
}

// RFC 4180: quote a field holding a comma, quote or line break, and double any
// quote inside it. Titles are full of commas, so this is not optional.
function cell(v) {
  const s = String(v ?? '')
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function csvText(rows) {
  const lines = [HEADER.join(',')]
  for (const r of rows) lines.push(HEADER.map((k) => cell(r[k])).join(','))
  return lines.join('\r\n') + '\r\n'
}

export function csvFileName(isoDate) {
  return `game-notes-links-${isoDate}.csv`
}
