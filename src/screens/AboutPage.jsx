import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { TallyBaseballMark, TallyWordmark } from '../components/TallyBrand.jsx'

const PRINCIPLES = [
  {
    label: 'Sealed by default',
    text: 'Scores, run totals, highlights, and box-score outcomes stay hidden until you ask for them.',
  },
  {
    label: 'Works on delay',
    text: 'If you are watching a recording, you can open the matchup later and reveal the game at the same pace you watch it.',
  },
  {
    label: 'Reference-friendly',
    text: 'Player pages, team pages, standings, leaders, prospects, awards, and umpire data make it useful even when you are not scoring a game.',
  },
]

const SURFACES = [
  'Daily MLB and MiLB slates',
  'Live lineups and inning-by-inning scorekeeping views',
  'Player, team, standings, leaders, prospects, rehab, awards, and umpire pages',
  'Historical matchup lookup and printable logo reference',
]

export function AboutPage({ onBack }) {
  useDocumentTitle('About')
  return (
    <div className="screen aboutpage">
      <SiteHeader />
      <header className="topbar">
        <button className="topbar__back" onClick={onBack}>
          ‹ Games
        </button>
        <h1 className="topbar__title">About</h1>
      </header>

      <section className="aboutpage__intro" aria-labelledby="about-title">
        <div className="aboutpage__brand" aria-hidden="true">
          <TallyBaseballMark size={38} />
          <TallyWordmark height={25} />
        </div>
        <h2 id="about-title" className="aboutpage__title">
          A baseball companion for scorekeeping, delayed watching, and research.
        </h2>
        <p className="aboutpage__lede caps-exempt">
          Tally Baseball started as a tool for people who keep score by hand and
          want the practical context a live data feed can provide. It is also for
          watching a game after it happened without having the score spoiled, or
          for looking up baseball information in a quieter, game-centered way.
          It keeps the page quiet: no autoplay highlights, no final-score
          shortcuts, and no outcome copy unless you deliberately reveal it.
        </p>
      </section>

      <section className="aboutpage__section" aria-labelledby="about-principles">
        <h2 id="about-principles" className="section__title">
          How it works
        </h2>
        <div className="aboutpage__principles">
          {PRINCIPLES.map((item) => (
            <article key={item.label} className="aboutpage__principle">
              <h3>{item.label}</h3>
              <p className="caps-exempt">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="aboutpage__section" aria-labelledby="about-includes">
        <h2 id="about-includes" className="section__title">
          What is included
        </h2>
        <ul className="aboutpage__list">
          {SURFACES.map((item) => (
            <li key={item} className="caps-exempt">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="aboutpage__note caps-exempt" aria-label="Data note">
        <p>
          Game, roster, standings, and player data come from public MLB Stats API
          endpoints and related public baseball data sources. Tally Baseball is an
          independent project and is not affiliated with MLB, MiLB, or any club.
        </p>
      </section>
    </div>
  )
}
