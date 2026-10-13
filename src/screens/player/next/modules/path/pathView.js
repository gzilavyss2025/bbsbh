// The Path to the Majors card's pure view (#1894): one tile per minor-league level he played,
// then the majors tile, from the two year-by-year fetches. Levels, games and clubs are
// levelProgressionView's. No minor-league record gives null, so the module reports empty.
import { levelProgressionView, dropRehabStints } from '../../../../../api/person/career/progression.js'
import { withoutMultiTeamAggregate } from '../../../../../api/person/stats.js'

// "2021", "2021–23": the board's short end year.
const yearSpan = (a, b) => (a === b ? `${a}` : `${a}–${String(b).slice(2)}`)

const longDate = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export function pathView({ milb, mlb, group, debutDate, currentSportId }) {
  const debutYear = debutDate ? Number(debutDate.slice(0, 4)) : null
  const p = levelProgressionView(dropRehabStints(milb, debutYear), group, currentSportId, mlb)
  if (!p) return null
  const levels = p.levels
    .filter((l) => l.reached)
    .map((l) => {
      const years = yearSpan(l.firstYear, l.lastYear)
      const main = l.teams.reduce((best, t) => (t.games > (best?.games ?? -1) ? t : best), null)
      return {
        label: l.label,
        games: l.games,
        years,
        teams: l.teams,
        logoId: main?.id ?? null,
        now: l.isCurrent,
        aria: `${l.label}, ${l.teams.map((t) => `${t.name} ${t.games}`).join(', ')}, ${l.games} games, ${years}${l.isCurrent ? ', here now' : ''}`,
      }
    })
  const mlbRows = debutDate ? withoutMultiTeamAggregate(mlb).filter((s) => Number(s.season)) : []
  let majors = null
  if (mlbRows.length) {
    const seasons = mlbRows.map((s) => Number(s.season))
    const last = mlbRows.reduce((a, s) => (Number(s.season) >= Number(a.season) ? s : a))
    majors = {
      games: p.mlbGames,
      years: yearSpan(Math.min(...seasons), Math.max(...seasons)),
      logoId: last.team?.id ?? null,
      now: currentSportId === 1,
    }
  }
  return {
    badge: debutDate ? 'MLB' : 'Prospect',
    headline: debutDate ? `Debuted ${longDate(debutDate)}` : '',
    total: p.minorsGames,
    levels,
    mlb: majors,
  }
}
