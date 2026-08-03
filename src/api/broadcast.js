// Which network(s) the game airs on — the lineup pages' Broadcast fact, next
// to Attendance. Spoiler-free (a broadcast assignment is known well ahead of
// first pitch, same footing as the uniform/weather facts), so unlike
// linescore.js/derive.js this has no reveal gate and can be fetched eagerly.
//
// SOURCE: MLB Stats API carries no broadcast info in the live feed, so this
// hits ESPN's public scoreboard endpoint instead (CORS-open, no auth,
// verified 2026-07-09) and matches the game by date + both teams' identities.
// ESPN only covers the majors, so this resolves null for every MiLB game —
// the same graceful degrade as WAR/callouts.

const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard'

function toEspnDate(officialDate) {
  return typeof officialDate === 'string' ? officialDate.replaceAll('-', '') : ''
}

// A statsapi team and an ESPN competitor.team refer to the same club if
// either their abbreviations agree (most clubs) or their nicknames do (covers
// the handful where ESPN's abbreviation differs from statsapi's, e.g.
// Guardians/Diamondbacks-style renames).
function sameTeam(statsTeam, espnTeam) {
  const a = (statsTeam?.abbreviation || '').toUpperCase()
  const b = (espnTeam?.abbreviation || '').toUpperCase()
  if (a && b && a === b) return true
  const nickA = (statsTeam?.teamName || '').toLowerCase()
  const nickB = (espnTeam?.name || '').toLowerCase()
  return !!nickA && !!nickB && nickA === nickB
}

// Collapses ESPN's per-market broadcast list to one display string, national
// feed first (what most viewers would recognize), then home market, then any
// other market, deduped and capped so the fact stays a single readable line.
function summarizeBroadcasts(broadcasts) {
  if (!Array.isArray(broadcasts) || broadcasts.length === 0) return ''
  const order = ['national', 'home', 'away']
  const names = []
  const add = (list) => {
    for (const n of list ?? []) if (n && !names.includes(n)) names.push(n)
  }
  for (const market of order) {
    add(broadcasts.find((b) => b.market === market)?.names)
  }
  for (const b of broadcasts) {
    if (!order.includes(b.market)) add(b.names)
  }
  return names.slice(0, 3).join(' · ')
}

// The national-market network name only (FOX/ESPN/TBS/Apple TV+/…), or ''
// when this game has no such assignment. ESPN's national-market list carries
// "MLB.TV" on nearly every game (the league's own out-of-market package, sold
// alongside whatever else airs — never itself the blackout-triggering
// broadcast) — filtered out so the icon flags only a genuine TV/streaming
// exclusive (verified 2026-08-02 against a live slate: two real games that
// day carried "Peacock" and "NBC"/"Peacock" respectively, both alongside or
// instead of "MLB.TV").
function nationalName(broadcasts) {
  const national = (broadcasts ?? []).find((b) => b.market === 'national')
  const names = (national?.names ?? []).filter((n) => n && n !== 'MLB.TV')
  return names[0] ?? ''
}

// Every {date, broadcasts} match for a team pair within one ESPN scoreboard
// payload's events. A doubleheader puts two same-matchup events on the same
// date, so team identity alone can't disambiguate them — the caller breaks
// ties with pickClosest below.
function collectMatches(events, home, away) {
  const matches = []
  for (const event of events ?? []) {
    const comp = event.competitions?.[0]
    const competitors = comp?.competitors ?? []
    const espnHome = competitors.find((c) => c.homeAway === 'home')?.team
    const espnAway = competitors.find((c) => c.homeAway === 'away')?.team
    if (sameTeam(home, espnHome) && sameTeam(away, espnAway)) {
      matches.push({ date: event.date, broadcasts: comp.broadcasts })
    }
  }
  return matches
}

// Picks whichever doubleheader match's own start time sits closest to this
// game's actual first pitch. A no-op (returns the lone match) outside a
// doubleheader, where collectMatches only ever finds one.
function pickClosest(matches, startIso) {
  if (matches.length <= 1 || !startIso) return matches[0]
  const target = new Date(startIso).getTime()
  return [...matches].sort(
    (a, b) =>
      Math.abs(new Date(a.date).getTime() - target) -
      Math.abs(new Date(b.date).getTime() - target),
  )[0]
}

// One ESPN scoreboard fetch per date, shared by every caller within the same
// session — fetchNationalBroadcasts below and fetchGameBroadcast each ask for
// the same date's events once a slate/lineup page has more than one card, so
// this cache turns N redundant calls into one. Never throws; a failed fetch
// caches an empty list rather than retrying every card.
const eventsCache = new Map()
function fetchEspnEvents(dateParam) {
  if (!eventsCache.has(dateParam)) {
    eventsCache.set(
      dateParam,
      fetch(`${ESPN_SCOREBOARD}?dates=${dateParam}`)
        .then((res) => (res.ok ? res.json() : { events: [] }))
        .then((data) => data.events ?? [])
        .catch(() => []),
    )
  }
  return eventsCache.get(dateParam)
}

// Resolves to the broadcast summary string for this game, or '' when ESPN has
// nothing (MiLB, a postponed game, or a match failure). Never throws — a
// failed fetch degrades to '' like every other optional lineup-page fact.
export async function fetchGameBroadcast(feed) {
  try {
    const gameData = feed?.gameData
    const officialDate = gameData?.datetime?.officialDate
    const startIso = gameData?.datetime?.dateTime
    const away = gameData?.teams?.away
    const home = gameData?.teams?.home
    const dateParam = toEspnDate(officialDate)
    if (!dateParam || !away || !home) return ''

    const events = await fetchEspnEvents(dateParam)
    const matches = collectMatches(events, home, away)
    if (matches.length === 0) return ''
    return summarizeBroadcasts(pickClosest(matches, startIso).broadcasts)
  } catch {
    return ''
  }
}

// The slate's batched counterpart: one ESPN scoreboard call for a whole day's
// games (not one per card), returning { [gamePk]: networkName } for every
// game ESPN lists a NATIONAL broadcast for — the fact the slate icon flags,
// distinct from fetchGameBroadcast's full "national · home · away" summary
// used on the lineup page. MLB only (ESPN carries no MiLB scoreboard); a
// MiLB `games` list simply matches nothing and resolves to {}. Never throws;
// degrades to {} like every other optional slate fact.
export async function fetchNationalBroadcasts(dateStr, games) {
  try {
    const dateParam = toEspnDate(dateStr)
    if (!dateParam || !games?.length) return {}
    const events = await fetchEspnEvents(dateParam)
    const out = {}
    for (const game of games) {
      const matches = collectMatches(events, game.home, game.away)
      if (matches.length === 0) continue
      const name = nationalName(pickClosest(matches, game.gameDate)?.broadcasts)
      if (name) out[game.gamePk] = name
    }
    return out
  } catch {
    return {}
  }
}
