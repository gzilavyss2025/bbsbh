import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { TallyBaseballMark, TallyWordmark } from '../components/chrome/TallyBrand.jsx'

const STORY = [
  'It starts with a paper scorebook and a game you cannot watch live. The broadcast is two hours behind, or four, or it is sitting in a recording until the kids are down. You are keeping score by hand, so you need answers all night: who came in to pitch, who moved to left field, which pinch hitter just took the third spot in the order, who is working the plate.',
  'Every tool that can answer those questions answers a different one first. Open a league app and the scoreboard is the home screen. Check a team page and the day’s result is in the header. Search a player’s name and the card that comes back carries the game state. You asked who the left fielder is, and you were told how it ends. There is no undoing that.',
  'Tally Baseball inverts the order. The reference is open and the result is sealed — not blurred, not folded behind a tap-to-expand, simply not on the page until you ask for it. Everything you need to fill in a scorecard is there from the first pitch. The runs wait for you.',
]

const PRINCIPLES = [
  {
    label: 'Sealed by default',
    text: 'Run totals, the line score, the box score, and highlight thumbnails stay hidden until you reveal them. On the scoring surfaces a score is not fetched and then covered — it is not on the page at all.',
  },
  {
    label: 'Revealed at your pace',
    text: 'Open a half-inning one batter at a time, or turn over the whole half at once. The app never runs ahead of you, and extra innings stay out of sight until you have revealed through the ninth — a tenth inning on screen would tell you the ninth ended level.',
  },
  {
    label: 'Built for delayed viewing',
    text: 'Come back to a game hours or days later and it opens exactly where you stopped. A finished game behaves the same as a live one. Your place is kept on the device, and it follows you between your own devices if you sign in.',
  },
  {
    label: 'Everything that is not a score stays open',
    text: 'Batting orders, defensive alignments, rosters, the umpiring crew, ballpark details, season and career statistics, standings, and leader boards are live the whole time. A stat line is not a score, so nothing gates one.',
  },
  {
    label: 'Yours to unseal',
    text: 'Sometimes you do want the result. A site-wide Scores Unlocked switch opens a day you name, and it asks you to confirm that day first. It is opt-in, it is reversible, and nothing is unsealed on your behalf.',
  },
]

const SURFACES = [
  'Daily slates for MLB and the minors — Triple-A, Double-A, High-A, and Single-A',
  'Starting lineups, defensive alignments, and the umpiring crew before the first pitch',
  'A half-inning play feed with substitutions in the order they happened',
  'A sealed box score and line score you open when you are ready for them',
  'Player, team, standings, leaders, prospects, rehab-assignment, awards, and umpire pages',
  'A printable scorecard and a grayscale logo sheet for sketching club marks in pencil',
  'A Game Log that stamps the games you scored, so a season becomes a book you keep',
]

const FAQ = [
  {
    q: 'Is Tally Baseball free?',
    a: 'Yes. It is free, it needs no account, and it runs in any browser. You can add it to a phone home screen and it opens like an app. Signing in is optional and does one thing: it carries your place in a game between your own devices.',
  },
  {
    q: 'Does it keep score for me?',
    a: 'No, and that is deliberate. Tally is a reference for the person scoring, not a data-entry app. You keep the scorecard — on paper, in pencil, in your own shorthand. Tally supplies the names, the substitutions, and the order they arrived in.',
  },
  {
    q: 'Will it spoil a game I am watching on delay?',
    a: 'Not on its own. It sends no notifications, it puts no live scoreboard in front of you, and it plays no highlights unprompted. You still have to turn off alerts from other sports and news apps, because that is outside anything Tally can reach.',
  },
  {
    q: 'What about a game that ended last week?',
    a: 'It works the same way. A completed game opens sealed and reveals half-inning by half-inning, at whatever pace you are watching the recording.',
  },
  {
    q: 'Does it cover minor-league games?',
    a: 'Yes, down through Single-A. Minor-league feeds are thinner than the major-league ones — a lineup or a weather reading is sometimes never posted — so those fields read as not posted yet rather than failing.',
  },
  {
    q: 'Where does the data come from?',
    a: 'The public MLB Stats API and related public baseball data sources, queried by your device directly. There is no Tally server holding a copy of a game.',
  },
]

const GUIDES = [
  { text: 'How to score a baseball game', href: '/learn/score-a-baseball-game' },
  { text: 'How to watch on delay without spoilers', href: '/learn/watch-without-spoilers' },
  { text: 'How to read a box score', href: '/learn/read-a-box-score' },
  { text: 'Scorekeeping symbols and abbreviations', href: '/learn/scorekeeping-symbols' },
  { text: 'The baseball statistics glossary', href: '/learn/stats-glossary' },
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
          <TallyWordmark height={25} tight />
        </div>
        <h2 id="about-title" className="aboutpage__title">
          The spoiler-free baseball app for people who keep score by hand.
        </h2>
        <p className="aboutpage__lede caps-exempt">
          Tally Baseball is a free, spoiler-free companion for scoring a game on
          paper, watching a broadcast on delay, or looking something up mid-game
          without being handed the result. Batting orders, defensive alignments,
          rosters, umpires, and season statistics stay open from the first pitch.
          Runs, the line score, and the box score stay sealed until you tap to
          reveal them. No account, no download, and no notifications — it runs in
          a browser and installs to a phone home screen.
        </p>
      </section>

      <section className="aboutpage__section" aria-labelledby="about-story">
        <h2 id="about-story" className="section__title">
          Why Tally Baseball exists
        </h2>
        <div className="aboutpage__prose">
          {STORY.map((para) => (
            <p key={para.slice(0, 24)} className="caps-exempt">
              {para}
            </p>
          ))}
        </div>
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

      <section className="aboutpage__section" aria-labelledby="about-faq">
        <h2 id="about-faq" className="section__title">
          Common questions
        </h2>
        <div className="aboutpage__principles">
          {FAQ.map((item) => (
            <article key={item.q} className="aboutpage__principle aboutpage__qa">
              <h3 className="caps-exempt">{item.q}</h3>
              <p className="caps-exempt">{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="aboutpage__section" aria-labelledby="about-guides">
        <h2 id="about-guides" className="section__title">
          Scorekeeping guides
        </h2>
        <ul className="aboutpage__list aboutpage__list--links">
          {GUIDES.map((guide) => (
            <li key={guide.href} className="caps-exempt">
              <a href={guide.href}>{guide.text}</a>
            </li>
          ))}
        </ul>
      </section>

      <section className="aboutpage__note caps-exempt" aria-label="Data note">
        <p>
          Game, roster, player, and statistical data come from public MLB Stats API
          endpoints and related public baseball data sources. Tally Baseball is an
          independent project and is not affiliated with MLB, MiLB, or any club.
        </p>
        <p>
          The breakout/cooling scouting signal shown on some batting orders is a
          third-party model from{' '}
          <a href="https://www.feverbaseball.com" target="_blank" rel="noreferrer">
            Fever Baseball
          </a>
          , refreshed nightly. Unlike Tally Baseball&apos;s own callouts, it is not a
          fact reconciled against the official record — it is one outside
          model&apos;s opinion, shown here with attribution rather than folded into
          the rest of the app&apos;s data.
        </p>
      </section>
    </div>
  )
}
