import { fetchGameStory } from '../../api/gameStory.js'
import { useAsync } from '../../hooks/useAsync.js'
import { teamClubName, teamPrimaryColor } from '../../lib/teams.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'

// Each team's own MLB.com coverage of this game — a recap, and any same-game
// news (an in-game injury, e.g.) — resolved by api/gameStory.js, which also
// enriches each story with a photo and a preview blurb where the content API
// has them. The first story leads with that full treatment; the rest render
// as a compact logo+headline row, in publish order. If the first story's
// enrichment came back thin (no photo, no blurb), nothing gets the lead
// treatment and every story falls back to a compact row — the pre-enrichment
// look, never a lead card missing its photo. Only ever mounts inside the box
// score's already-revealed render (see BoxScore.jsx / api/gameStory.js): the
// full final score is already on the same screen by the time this renders,
// so real headlines and blurbs here spoil nothing beyond what's already
// unsealed. Renders nothing while loading, for a game still in progress
// (MLB.com hasn't posted yet), or for MiLB games (no team-branded feed to
// read).
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

  const [first, ...rest] = stories
  const lead = first?.photo && first?.blurb ? first : null
  const listed = lead ? rest : stories

  return (
    <section className="gamestory">
      <div className="gamestory__head">
        <h3 className="gamestory__title">Coverage</h3>
        <span className="gamestory__note">MLB.com</span>
      </div>
      {lead && <LeadStory story={lead} />}
      {listed.length > 0 && (
        <ul className="gamestory__list">
          {listed.map((s, i) => (
            <li key={i}>
              <StoryRow story={s} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function LeadStory({ story }) {
  return (
    <a className="gamestory__lead" href={story.url} target="_blank" rel="noopener noreferrer">
      <div className="gamestory__leadphoto">
        <img src={story.photo} alt="" loading="lazy" />
        <span className="gamestory__leadbadge">
          <TeamLogo teamId={story.teamId} size={18} />
          <span className="gamestory__leadbadgelabel">{teamClubName(story.teamId)}</span>
        </span>
      </div>
      <div className="gamestory__leadbody">
        <h4 className="gamestory__leadhead">{story.headline}</h4>
        <p className="gamestory__leadblurb">{story.blurb}</p>
      </div>
    </a>
  )
}

// --team-color feeds the hover fill below (CSS custom property, not a direct
// style — the color itself doesn't apply until :hover). Row still renders
// fine with no color for a team teamPrimaryColor doesn't know (falls back to
// the plain card background — see the CSS).
function StoryRow({ story }) {
  return (
    <a
      className="gamestory__link"
      href={story.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ '--team-color': teamPrimaryColor(story.teamId) }}
    >
      <TeamLogo teamId={story.teamId} size={26} className="gamestory__logo" />
      <span className="gamestory__headline">{story.headline}</span>
    </a>
  )
}
