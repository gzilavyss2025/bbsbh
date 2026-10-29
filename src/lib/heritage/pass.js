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

/** @param {StampFacts} game */
export function heritagePassModel(game) {
  const validRuns = (runs) => Number.isInteger(runs) && runs >= 0
  if (game?.status !== 'Final' || !validRuns(game.away?.runs) || !validRuns(game.home?.runs)) return null
  const mlb = game.sportId === 1
  const milb = isFullSeasonMilb(game.sportId) || game.sportId === 16
  const postseason = Boolean(roundNameAt(game.gameType))
  const round = mlb || milb ? roundNameAt(game.gameType, game.sportId) : ''
  // A schedule's seriesGameNumber is distinct from its doubleheader gameNumber.
  const seriesGame = postseason && Number.isInteger(game.seriesGameNumber) && game.seriesGameNumber > 0
    ? game.seriesGameNumber : null
  return {
    competition: mlb ? 'Major League Baseball' : milb ? 'Minor League Baseball' : 'Baseball',
    leagueMark: mlb ? 'mlb' : milb ? 'milb' : null,
    classification: milb ? SPORT_LABEL[game.sportId] : '',
    levelName: milb ? LEVEL_NAME[SPORT_LABEL[game.sportId]] : '',
    occasion: postseason ? (game.seriesDescription || round || 'Postseason') : game.gameType === 'R' ? 'Regular season' : '',
    postseason,
    seriesGame,
    date: passDate(game.date),
  }
}

// Tall passes have their own display pagination, never new saved placements.
export const PASSES_PER_PAGE = 4
export function passPage(stamps, page) {
  const pages = Math.max(1, Math.ceil(stamps.length / PASSES_PER_PAGE))
  const current = Math.max(1, Math.min(pages, Math.trunc(page) || 1))
  return { pages, current, entries: stamps.slice((current - 1) * PASSES_PER_PAGE, current * PASSES_PER_PAGE) }
}
