import { fetchGameStory } from '../api/gameStory.js'
import { useAsync } from '../hooks/useAsync.js'

// A link out to MLB.com's own recap article for this game — deliberately just
// a generic label, never the article's headline (recap headlines routinely
// state the final themselves). Only ever mounts inside the box score's
// already-revealed render (see BoxScore.jsx / api/gameStory.js), same
// discipline as GameBuzzCard: the fetch doesn't fire, and the resolved URL
// doesn't reach the DOM, until the box score's own seal is tapped. Renders
// nothing while loading or when the game carried no editorial recap (most
// MiLB games, and MLB games too recent for MLB.com to have posted one yet).
export function GameStoryCard({ feed }) {
  const gamePk = feed?.gamePk
  const { data } = useAsync(() => (gamePk != null ? fetchGameStory(gamePk) : null), [gamePk])
  if (!data?.url) return null
  return (
    <section className="gamestory">
      <div className="gamestory__head">
        <h3 className="gamestory__title">Game story</h3>
        <span className="gamestory__note">MLB.com</span>
      </div>
      <a
        className="gamestory__link"
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Read the coverage of the game →
      </a>
    </section>
  )
}
