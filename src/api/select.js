// Pure selectors that pull structured, spoiler-free data out of the raw
// feed/live response. None of these touch runs/hits/errors — score-revealing
// numbers are handled separately (see linescore.js) so they are only computed
// on reveal.

// Build a fast lookup of player id -> gameData player record.
function playerIndex(feed) {
  return feed?.gameData?.players ?? {}
}

// Resolve the batting order for one side into a printable lineup. battingOrder
// is an array of player ids (as strings) in slot order. Cross-references
// gameData.players for names and the team's boxscore players[] for jersey
// number and position.
export function selectLineup(feed, side /* 'away' | 'home' */) {
  const team = feed?.liveData?.boxscore?.teams?.[side]
  if (!team) return []

  const order = team.battingOrder ?? []
  const boxPlayers = team.players ?? {}
  const players = playerIndex(feed)

  return order.map((rawId, i) => {
    const id = typeof rawId === 'string' ? Number(rawId) : rawId
    const key = `ID${id}`
    const box = boxPlayers[key] ?? {}
    const person = players[key] ?? box.person ?? {}
    return {
      order: i + 1,
      id,
      name: person.fullName ?? box.person?.fullName ?? 'TBD',
      jersey: box.jerseyNumber ?? person.primaryNumber ?? '',
      position: box.position?.abbreviation ?? '',
    }
  })
}

// Team-level meta for a side: name, record, manager placeholder (manager is
// fetched separately), and probable pitcher with handedness.
export function selectTeamMeta(feed, side) {
  const box = feed?.liveData?.boxscore?.teams?.[side]?.team ?? {}
  const gdTeam = feed?.gameData?.teams?.[side] ?? {}
  const probable = feed?.gameData?.probablePitchers?.[side]
  const players = playerIndex(feed)

  let pitcher = null
  if (probable?.id) {
    const p = players[`ID${probable.id}`] ?? {}
    pitcher = {
      id: probable.id,
      name: probable.fullName ?? p.fullName ?? 'TBD',
      hand: p.pitchHand?.code ?? '', // 'L' | 'R'
    }
  }

  return {
    id: box.id ?? gdTeam.id,
    name: gdTeam.name ?? box.name ?? '',
    teamName: gdTeam.teamName ?? box.teamName ?? '',
    abbreviation: gdTeam.abbreviation ?? box.abbreviation ?? '',
    probablePitcher: pitcher,
  }
}

// The four umpires. officialType is one of Home Plate / First Base /
// Second Base / Third Base.
export function selectOfficials(feed) {
  const officials = feed?.liveData?.boxscore?.officials ?? []
  const order = ['Home Plate', 'First Base', 'Second Base', 'Third Base']
  const byType = {}
  for (const o of officials) {
    if (o.officialType) byType[o.officialType] = o.official?.fullName
  }
  return order
    .filter((t) => byType[t])
    .map((t) => ({ role: t, name: byType[t] }))
}

// Venue / weather / attendance / first pitch. MLB populates these; MiLB may
// not, so every field is optional.
export function selectGameInfo(feed) {
  const gameData = feed?.gameData ?? {}
  const venue = gameData.venue?.name ?? ''
  const weather = gameData.weather ?? {}

  // boxscore.info[] is a list of { label, value } rows.
  const infoRows = feed?.liveData?.boxscore?.info ?? []
  const infoByLabel = {}
  for (const row of infoRows) {
    if (row.label) infoByLabel[row.label] = (row.value ?? '').replace(/\.$/, '')
  }

  return {
    venue,
    weather:
      weather.temp && weather.condition
        ? `${weather.temp}°, ${weather.condition}`
        : infoByLabel['Weather'] ?? '',
    wind: weather.wind ?? infoByLabel['Wind'] ?? '',
    attendance: infoByLabel['Att'] ?? '',
    firstPitch: infoByLabel['First pitch'] ?? '',
  }
}

// Number of innings the linescore knows about (drives the inning navigator).
export function selectInningCount(feed) {
  const innings = feed?.liveData?.linescore?.innings ?? []
  const scheduled = feed?.liveData?.linescore?.scheduledInnings ?? 9
  return Math.max(innings.length, scheduled)
}

// Whether the game has started at all (used for the "not started yet" state).
export function selectHasStarted(feed) {
  const abstract = feed?.gameData?.status?.abstractGameState
  return abstract === 'Live' || abstract === 'Final'
}
