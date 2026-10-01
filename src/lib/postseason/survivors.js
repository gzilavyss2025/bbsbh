// The survivors' board on the postseason home page: all twelve clubs, each in
// one fixed slot for the whole month, with what that club does next — or the
// round it went out in. Pure, over the derived bracket (docs/api/postseason.md).
//
// The bracket handed in is already heading into its cutoff date (ADR-0087):
// a club goes out on the board the morning after it loses, never during the
// game, and today's games never move it. Nothing here reads a date of its own
// beyond the slate's, and nothing reads Scores Unlocked.

const ROUND_ORDER = ['wildcard', 'division', 'lcs', 'worldseries']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// "Sat" for '2026-10-03'. Fixed English names rather than the locale's, so
// the board reads the same as the rest of the app's copy and tests can pin it.
export function weekdayOf(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

// The round's short name as a scorer writes it: "Wild Card", "NLDS", "ALCS",
// "World Series".
export function roundShort(series) {
  if (series.round === 'wildcard') return 'Wild Card'
  if (series.round === 'division') return `${series.league}DS`
  if (series.round === 'lcs') return `${series.league}CS`
  return 'World Series'
}

// The latest-round series that names this club. A winner is written into the
// next round's slot (bracket.js fills it from the derived winner), so the
// latest series is the live one, or the one the club went out in.
function latestSeriesFor(bracket, clubId) {
  let latest = null
  for (const s of bracket.series) {
    if (!s.slots.some((slot) => slot.club?.id === clubId)) continue
    if (!latest || ROUND_ORDER.indexOf(s.round) > ROUND_ORDER.indexOf(latest.round)) latest = s
  }
  return latest
}

// One club's slot: `state` is 'champion', 'out', 'today' or 'waiting'.
function slotFor(bracket, club) {
  const series = latestSeriesFor(bracket, club.id)
  if (!series) return { club, state: 'waiting', series: null, next: null }
  if (bracket.champion?.id === club.id) return { club, state: 'champion', series, next: null }
  if (series.eliminated?.id === club.id) return { club, state: 'out', series, next: null }
  if (series.playsOnCutoff && series.cutoffGame) {
    return { club, state: 'today', series, next: { gameNumber: series.cutoffGame.gameNumber, date: bracket.cutoff } }
  }
  // The next game with a known date. An "if necessary" game never carries one
  // (bracket.js), and that is the rule here too: the board names the next
  // round, never a date the live schedule could only know after the cutoff.
  const upcoming = series.upcoming?.find((u) => u.date) ?? null
  return { club, state: 'waiting', series, next: upcoming ? { gameNumber: upcoming.gameNumber, date: upcoming.date } : null }
}

// The board, league by league (AL first, as the bracket draws them). Each
// league lists its two bye clubs, then its Wild Card series' clubs in bracket
// order — a fixed order, so a club that goes out keeps its slot instead of
// the board reshuffling every morning.
export function survivorsBoard(bracket) {
  if (!bracket?.leagues) return null
  const leagues = ['AL', 'NL'].map((key) => {
    const league = bracket.leagues[key]
    const seen = new Set()
    const clubs = []
    const add = (club) => {
      if (!club || seen.has(club.id)) return
      seen.add(club.id)
      clubs.push(club)
    }
    for (const club of league?.byes ?? []) add(club)
    for (const s of league?.wildcard ?? []) for (const slot of s.slots) add(slot.club)
    return { key, slots: clubs.map((club) => slotFor(bracket, club)) }
  })
  const all = leagues.flatMap((l) => l.slots)
  return {
    leagues,
    alive: all.filter((s) => s.state !== 'out').length,
    total: all.length,
    champion: bracket.champion ?? null,
  }
}

// The one line under a club's mark. `slateDate` is the day the page shows:
// on the cutoff day itself a game reads "Today"; a slate paged past today
// (the bracket never passes today) names the weekday instead, so the word
// "Today" never sits on a page dated tomorrow.
export function survivorLine(slot, slateDate = null) {
  const { state, series, next } = slot
  if (state === 'champion') return 'Champions'
  if (state === 'out') return `Out · ${roundShort(series)}`
  if (!series) return 'To come'
  const round = roundShort(series)
  if (state === 'today') {
    const onCutoff = !slateDate || slateDate === next.date
    return onCutoff ? `Today · Game ${next.gameNumber}` : `Game ${next.gameNumber} · ${weekdayOf(next.date)}`
  }
  if (!next) return round
  return `${round} G${next.gameNumber} · ${weekdayOf(next.date)}`
}
