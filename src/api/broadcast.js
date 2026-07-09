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

    const res = await fetch(`${ESPN_SCOREBOARD}?dates=${dateParam}`)
    if (!res.ok) return ''
    const data = await res.json()

    // A doubleheader puts two same-matchup events on the same date, so team
    // identity alone can't disambiguate them — collect every team match, then
    // (when there's more than one) prefer whichever's own start time sits
    // closest to this game's actual first pitch.
    const matches = []
    for (const event of data.events ?? []) {
      const comp = event.competitions?.[0]
      const competitors = comp?.competitors ?? []
      const espnHome = competitors.find((c) => c.homeAway === 'home')?.team
      const espnAway = competitors.find((c) => c.homeAway === 'away')?.team
      if (sameTeam(home, espnHome) && sameTeam(away, espnAway)) {
        matches.push({ date: event.date, broadcasts: comp.broadcasts })
      }
    }
    if (matches.length === 0) return ''
    if (matches.length > 1 && startIso) {
      const target = new Date(startIso).getTime()
      matches.sort(
        (a, b) =>
          Math.abs(new Date(a.date).getTime() - target) -
          Math.abs(new Date(b.date).getTime() - target),
      )
    }
    return summarizeBroadcasts(matches[0].broadcasts)
  } catch {
    return ''
  }
}
