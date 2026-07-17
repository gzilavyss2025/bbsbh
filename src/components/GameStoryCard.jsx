import { fetchGameStory } from '../api/gameStory.js'
import { useAsync } from '../hooks/useAsync.js'
import { teamPrimaryColor } from '../lib/teams.js'
import { TeamLogo } from './TeamLogo.jsx'

// Each team's own MLB.com coverage of this game — a recap, and any same-game
// news (an in-game injury, e.g.) — one row per story, that team's logo at the
// left and the real headline as the link text, in the order they were
// published. Only ever mounts inside the box score's already-revealed render
// (see BoxScore.jsx / api/gameStory.js): the full final score is already on
// the same screen by the time this renders, so a real headline here spoils
// nothing beyond what's already unsealed. Renders nothing while loading, for
// a game still in progress (MLB.com hasn't posted yet), or for MiLB games
// (no team-branded feed to read).
export function GameStoryCard({ feed }) {
  const gamePk = feed?.gamePk
  const awayTeamId = feed?.gameData?.teams?.away?.id
  const homeTeamId = feed?.gameData?.teams?.home?.id
  const ready = gamePk != null && awayTeamId != null && homeTeamId != null
  const { data } = useAsync(
    () => (ready ? fetchGameStory(gamePk, awayTeamId, homeTeamId) : []),
    [gamePk, awayTeamId, homeTeamId],
  )
  const stories = data ?? []
  if (stories.length === 0) return null
  return (
    <section className="gamestory">
      <div className="gamestory__head">
        <h3 className="gamestory__title">Coverage</h3>
        <span className="gamestory__note">MLB.com</span>
      </div>
      <ul className="gamestory__list">
        {stories.map((s, i) => (
          <li key={i}>
            {/* --team-color feeds the hover fill below (CSS custom property,
                not a direct style — the color itself doesn't apply until
                :hover). Row still renders fine with no color for a team
                teamPrimaryColor doesn't know (falls back to the plain card
                background — see the CSS). */}
            <a
              className="gamestory__link"
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ '--team-color': teamPrimaryColor(s.teamId) }}
            >
              <TeamLogo teamId={s.teamId} size={26} className="gamestory__logo" />
              <span className="gamestory__headline">{s.headline}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
