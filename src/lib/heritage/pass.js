import { SPORT_LABEL } from '../teams.js'
import { roundNameAt, isFullSeasonMilb } from '../postseason/roundTag.js'

/**
 * Presentation adapter for the EXISTING game:final / stamp facts contract.
 * No feed reads, fetches, storage, score derivations or artwork lookup here.
 * Call only after reveal, or with the owner's collection / dev fixtures.
 * @typedef {ReturnType<import('../../api/logbook.js').stampGameFacts>} StampFacts
 */

const DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
})
// Long-form ticket lettering for the existing classification labels.
const LEVEL_NAME = { AAA: 'Triple-A', AA: 'Double-A', 'A+': 'High-A', A: 'Single-A', ROK: 'Rookie' }

export function passDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return ''
  const value = new Date(`${date}T12:00:00Z`)
  return Number.isFinite(value.getTime()) && value.toISOString().slice(0, 10) === date
    ? DATE.format(value) : ''
}

// The city over a club's nickname. The feed's locationName is a neighbourhood for
// some clubs (the Mets' "Flushing", the Yankees' "Bronx"); franchiseName is the
// city fans say. Older facts lack it, so the full name minus the nickname comes
// next; a club named for no city (the Athletics) keeps its location.
export function passCity(team) {
  const nickname = team?.teamName ?? ''
  const franchise = team?.franchiseName ?? ''
  if (franchise && franchise !== nickname) return franchise
  const name = team?.name ?? ''
  if (nickname && name.endsWith(` ${nickname}`)) return name.slice(0, -nickname.length - 1)
  return team?.locationName ?? ''
}

/**
 * @param {StampFacts} game
 * @param {number|null} favoriteTeamId the reader's club, whose season game a regular-season pass numbers
 */
export function heritagePassModel(game, favoriteTeamId = null) {
  const validRuns = (runs) => Number.isInteger(runs) && runs >= 0
  if (game?.status !== 'Final' || !validRuns(game.away?.runs) || !validRuns(game.home?.runs)) return null
  const mlb = game.sportId === 1
  const milb = isFullSeasonMilb(game.sportId) || game.sportId === 16
  const postseason = Boolean(roundNameAt(game.gameType))
  const round = mlb || milb ? roundNameAt(game.gameType, game.sportId) : ''
  // A schedule's seriesGameNumber is distinct from its doubleheader gameNumber.
  const seriesGame = postseason && Number.isInteger(game.seriesGameNumber) && game.seriesGameNumber > 0
    ? game.seriesGameNumber : null
  // Each club has its own count; the reader's club when it played, else the home club's.
  const counted = game.away?.id != null && game.away.id === favoriteTeamId ? game.away : game.home
  const played = counted?.record ? counted.record.wins + counted.record.losses + (counted.record.ties ?? 0) : 0
  const seasonGame = game.gameType === 'R' && played > 0 ? played : null
  return {
    competition: mlb ? 'Major League Baseball' : milb ? 'Minor League Baseball' : 'Baseball',
    leagueMark: mlb ? 'mlb' : milb ? 'milb' : null,
    classification: milb ? SPORT_LABEL[game.sportId] : '',
    levelName: milb ? LEVEL_NAME[SPORT_LABEL[game.sportId]] : '',
    occasion: postseason ? (game.seriesDescription || round || 'Postseason') : game.gameType === 'R' ? 'Regular season' : '',
    postseason,
    seriesGame,
    seasonGame,
    date: passDate(game.date),
  }
}

// A regular-season pass carries each club's record after the game in its facts.
// A postseason row's record is the SERIES record, so those read yearRecordThrough.
export function factsRecord(game, side) {
  const record = game?.gameType === 'R' ? game[side]?.record : null
  return record ? { wins: record.wins, losses: record.losses } : null
}

// A club's record for the year through this game: its final regular-season record
// plus every postseason game it finished up to and including this one. `rows` is the
// club's schedule for the season (regular season and postseason), in schedule order.
export function yearRecordThrough(rows, teamId, gamePk) {
  // A postponed game is listed twice under one gamePk; the played row is the last.
  const through = rows.findLastIndex((row) => row.gamePk === gamePk)
  if (through < 0) return null
  let record = null
  for (const row of rows.slice(0, through + 1)) {
    if (!isPlayed(row)) continue
    const side = ['away', 'home'].map((key) => row.teams?.[key]).find((t) => t?.team?.id === teamId)
    if (!side) continue
    if (row.gameType === 'R') {
      record = Number.isInteger(side.leagueRecord?.wins) ? { wins: side.leagueRecord.wins, losses: side.leagueRecord.losses } : record
    } else if (record && typeof side.isWinner === 'boolean') {
      record = side.isWinner ? { ...record, wins: record.wins + 1 } : { ...record, losses: record.losses + 1 }
    }
  }
  return record
}

// Finished and played: 'Final', 'Game Over' and 'Completed Early' all count; a
// postponed or cancelled row also reads abstractly Final and does not.
const isPlayed = (row) => row.status?.abstractGameState === 'Final' &&
  !/^(Postponed|Cancelled)/.test(row.status?.detailedState ?? '')

export const passRecordText = (record) => (record ? `${record.wins}\u2013${record.losses}` : '')

// Tall passes have their own display pagination, never new saved placements.
export const PASSES_PER_PAGE = 4
export function passPage(stamps, page) {
  const pages = Math.max(1, Math.ceil(stamps.length / PASSES_PER_PAGE))
  const current = Math.max(1, Math.min(pages, Math.trunc(page) || 1))
  return { pages, current, entries: stamps.slice((current - 1) * PASSES_PER_PAGE, current * PASSES_PER_PAGE) }
}
