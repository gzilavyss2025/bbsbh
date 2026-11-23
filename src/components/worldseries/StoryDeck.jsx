import { useEffect, useState } from 'react'
import '../../styles/worldseries/deck.css'
import { TEAM_COLOR_PAIRS } from '../../lib/colors/brandColors.js'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { ChampionHero } from './ChampionHero.jsx'

// The offseason's top stories, hand-entered until a feed carries them (Gary, 2026-11-23).
const STORIES = [
  { kind: 'signing', id: 'skubal-mets', tab: 'Skubal to the Mets', playerId: 669373, photo: '/art/stories/skubal-mets.webp', name: 'Tarik Skubal', teamId: 121,
    head: 'Skubal joins the Mets', terms: [['9', 'years'], ['$450M', 'total'], ['$50M', 'a year']],
    note: 'leaves the Dodgers with two Cy Young Awards and the richest contract a pitcher has ever signed.' },
]
const ROTATE_MS = 8000
// The signing's art, given by Gary (ESPN, Nov. 19, 2026), stored in public/art/stories.

// A signing reads like a back-page photo: the art full bleed, the headline set on it, and the deal
// below as a scorebook line of three figures on paper.
function SigningSlide({ s }) {
  const pair = TEAM_COLOR_PAIRS[s.teamId]
  return (
    <article className="deck-sign" style={pair ? { '--club-a': pair[0], '--club-b': pair[1] } : undefined} aria-label={s.head}>
      <div className="deck-sign__photo">
        <img src={s.photo} alt="" loading="lazy" decoding="async" />
        <div className="deck-sign__cap">
          <h2 className="deck-sign__head">{s.head}</h2>
        </div>
      </div>
      <div className="deck-sign__deal">
        <dl className="deck-sign__terms">
          {s.terms.map(([v, k]) => <div key={k}><dd>{v}</dd><dt>{k}</dt></div>)}
        </dl>
        <p className="deck-sign__note"><PlayerLink id={s.playerId}>{s.name}</PlayerLink> {s.note}</p>
      </div>
    </article>
  )
}

// The home slate's offseason hero: the World Series first, then the winter's top stories, one at a
// time, with an arrow on each side. It turns every 8 seconds, pausing while a pointer or focus is on it;
// never under reduced motion.
export function StoryDeck({ bracket }) {
  const slides = [{ id: 'ws', tab: 'World Series' }, ...STORIES]
  const [at, setAt] = useState(0)
  const [held, setHeld] = useState(false)
  useEffect(() => {
    if (held || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const t = setTimeout(() => setAt((i) => (i + 1) % slides.length), ROTATE_MS)
    return () => clearTimeout(t)
  }, [at, held, slides.length])
  const hold = () => setHeld(true)
  return (
    <section className="deck" aria-roledescription="carousel" aria-label="Top offseason stories"
      onPointerEnter={hold} onPointerLeave={() => setHeld(false)} onFocus={hold} onBlur={() => setHeld(false)}>
      <div className="deck__slides">
        {slides.map((s, i) => (
          <div key={s.id} className="deck__slide" aria-hidden={i !== at} inert={i !== at} data-on={i === at || undefined}>
            {s.id === 'ws' ? <ChampionHero bracket={bracket} /> : <SigningSlide s={s} />}
          </div>
        ))}
      </div>
      {slides.length > 1 && ['prev', 'next'].map((dir) => (
        <button key={dir} type="button" className={`deck__arrow deck__arrow--${dir}`}
          aria-label={dir === 'prev' ? 'Previous story' : 'Next story'}
          onClick={() => setAt((i) => (i + (dir === 'prev' ? slides.length - 1 : 1)) % slides.length)}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3"><path d={dir === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} /></svg>
        </button>
      ))}
    </section>
  )
}
