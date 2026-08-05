import { SiteHeader } from '../chrome/SiteHeader.jsx'
import { ReportFooter } from '../chrome/ReportFooter.jsx'

const STEPS = [
  {
    number: '01',
    title: 'Open the game',
    text: 'Follow it inning by inning. Results stay sealed until you choose to reveal the final box score.',
  },
  {
    number: '02',
    title: 'Press the stamp',
    text: 'Once the game is final, mint a one-color mark with the clubs, score, date, and ballpark.',
  },
  {
    number: '03',
    title: 'Arrange your book',
    text: 'Place every stamp by hand, move it when the page feels crowded, and leave a note worth keeping.',
  },
]

const BENEFITS = [
  {
    label: 'Notes',
    title: 'Remember more than the score',
    text: 'Mark whether you watched or followed, then add the detail only you would know — who was there, where you sat, why the game mattered.',
  },
  {
    label: 'Retrospective',
    title: 'See the season add up',
    text: 'Your retrospective gathers the clubs, ballparks, matchups, and pitchers that filled your baseball year.',
  },
  {
    label: 'Everywhere',
    title: 'Carry the book with you',
    text: 'Start on your phone at the park and open the same arranged pages later on your tablet or laptop.',
  },
]

function PreviewAction({ className, children }) {
  return (
    <button type="button" className={className}>
      {children}
    </button>
  )
}

function LandingActions({ SignUpAction, SignInAction, compact = false }) {
  return (
    <div className={`logbooklanding__actions${compact ? ' logbooklanding__actions--compact' : ''}`}>
      <SignUpAction className="logbooklanding__cta logbooklanding__cta--primary">
        Start your Game Log
      </SignUpAction>
      <SignInAction className="logbooklanding__cta logbooklanding__cta--secondary">
        I already have a book
      </SignInAction>
    </div>
  )
}

function PreviewStamp({ date, variant }) {
  return (
    <span className={`logbooklanding__stamp logbooklanding__stamp--${variant}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="42" />
        <circle cx="50" cy="50" r="34" />
        <path d="M50 28 72 50 50 72 28 50Z" />
        <path d="M50 35 65 50 50 65 35 50Z" />
      </svg>
      <span>{date}</span>
    </span>
  )
}

function PassportPreview() {
  return (
    <figure className="logbooklanding__preview">
      <div className="logbooklanding__book" aria-hidden="true">
        <div className="logbooklanding__page logbooklanding__page--left">
          <span className="logbooklanding__pageno">06</span>
          <PreviewStamp date="APR 12" variant="one" />
          <PreviewStamp date="MAY 03" variant="two" />
          <span className="logbooklanding__rule logbooklanding__rule--one" />
          <span className="logbooklanding__rule logbooklanding__rule--two" />
        </div>
        <span className="logbooklanding__spine" />
        <div className="logbooklanding__page logbooklanding__page--right">
          <span className="logbooklanding__pageno">07</span>
          <PreviewStamp date="JUN 22" variant="three" />
          <PreviewStamp date="JUL 04" variant="four" />
          <span className="logbooklanding__rule logbooklanding__rule--one" />
          <span className="logbooklanding__rule logbooklanding__rule--two" />
        </div>
      </div>
      <figcaption className="caps-exempt">A season becomes a book you arrange by hand.</figcaption>
    </figure>
  )
}

// Pure presentation on purpose. The Clerk-aware wrapper is dynamically
// imported by LogbookPage, so an unconfigured deploy never downloads the
// account SDK just to carry this page's markup and illustration.
export function LogbookLanding({
  SignUpAction = PreviewAction,
  SignInAction = PreviewAction,
}) {
  return (
    <div className="screen logbooklanding">
      <SiteHeader />
      <main>
        <section className="logbooklanding__hero" aria-labelledby="logbooklanding-title">
          <div className="logbooklanding__herocopy">
            <p className="logbooklanding__eyebrow">The one place that is yours</p>
            <h1 id="logbooklanding-title">A passport of the games you&rsquo;ve scored.</h1>
            <p className="logbooklanding__lede caps-exempt">
              Reveal the final box score, press a keepsake stamp, and arrange your
              baseball year one game at a time. Your Game Log comes with you.
            </p>
            <LandingActions SignUpAction={SignUpAction} SignInAction={SignInAction} />
            <p className="logbooklanding__fineprint caps-exempt">
              Free account. No public profile, leaderboard, or social feed — this
              book is yours.
            </p>
          </div>
          <PassportPreview />
        </section>

        <section className="logbooklanding__steps" aria-labelledby="logbooklanding-how">
          <div className="logbooklanding__sectionhead">
            <p>From box score to keepsake</p>
            <h2 id="logbooklanding-how">Open it. Stamp it. Place it.</h2>
          </div>
          <ol>
            {STEPS.map((step) => (
              <li key={step.number}>
                <span className="logbooklanding__stepnum">{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p className="caps-exempt">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="logbooklanding__benefits" aria-labelledby="logbooklanding-why">
          <div className="logbooklanding__sectionhead">
            <p>The game ends. The page stays.</p>
            <h2 id="logbooklanding-why">Keep the part only you can tell.</h2>
          </div>
          <div className="logbooklanding__benefitgrid">
            {BENEFITS.map((benefit) => (
              <article key={benefit.title}>
                <span className="logbooklanding__benefitlabel">{benefit.label}</span>
                <h3>{benefit.title}</h3>
                <p className="caps-exempt">{benefit.text}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="logbooklanding__trust" aria-labelledby="logbooklanding-trust">
          <div className="logbooklanding__seal" aria-hidden="true">
            <span />
          </div>
          <div>
            <p className="logbooklanding__trustlabel">Spoiler safe by design</p>
            <h2 id="logbooklanding-trust">A stamp never tells you something you did not open.</h2>
            <p className="caps-exempt">
              Tally only mints a stamp after you have revealed that game&rsquo;s final
              box score. The result was already yours before the stamp carried it.
            </p>
          </div>
        </aside>

        <section className="logbooklanding__closing" aria-labelledby="logbooklanding-closing">
          <p className="logbooklanding__eyebrow">One game starts the book</p>
          <h2 id="logbooklanding-closing">Keep the games you sat with.</h2>
          <p className="caps-exempt">
            A stamp is minted once the game is final — the score on it never changes.
          </p>
          <LandingActions
            SignUpAction={SignUpAction}
            SignInAction={SignInAction}
            compact
          />
        </section>
      </main>
      <ReportFooter />
    </div>
  )
}
