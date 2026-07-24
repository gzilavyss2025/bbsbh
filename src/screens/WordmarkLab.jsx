import { SiteHeader } from '../components/SiteHeader.jsx'
import { TallyBaseballMark, TallyWordmark } from '../components/TallyBrand.jsx'

function ClubhouseWordmark({ title, ...props }) {
  return (
    <svg viewBox="0 0 218 96" role="img" aria-label={title} {...props}>
      <text
        x="1"
        y="83"
        fill="currentColor"
        fontFamily="Big Shoulders Display, IBM Plex Sans Condensed, sans-serif"
        fontSize="94"
        fontWeight="900"
        letterSpacing="-0.75"
      >
        TAL1Y
      </text>
      <polygon
        points="195,10 198.6,18 207.4,19 200.9,24.9 202.6,33.5 195,29.2 187.4,33.5 189.1,24.9 182.6,19 191.4,18"
        fill="currentColor"
      />
    </svg>
  )
}

function CandidateWordmark({ title = 'Tally', ...props }) {
  return <ClubhouseWordmark title={title} {...props} />
}

function CandidateLockup({ compact = false }) {
  return (
    <span className={`wordmarklab__lockup${compact ? ' wordmarklab__lockup--compact' : ''}`}>
      <TallyBaseballMark size={compact ? 24 : 30} title="" aria-hidden="true" />
      <CandidateWordmark />
    </span>
  )
}

function FocusCard() {
  return (
    <article className="wordmarklab__option wordmarklab__option--focus" data-selected="true">
      <span className="wordmarklab__optionhead">
        <span>
          <span className="wordmarklab__eyebrow">Focused refinement</span>
          <strong>Clubhouse L1 Star</strong>
        </span>
        <span className="wordmarklab__pick">In context</span>
      </span>
      <CandidateWordmark className="wordmarklab__optionmark" />
      <span className="wordmarklab__sizerow" aria-label="Small-size comparison">
        <CandidateWordmark style={{ height: 22 }} />
        <CandidateWordmark style={{ height: 16 }} />
        <span>22 px / 16 px</span>
      </span>
      <span className="wordmarklab__rationale">
        The second L remains a 1, preserving L1 inside the name. A scorer’s star after the Y replaces
        the underline with a scorebook mark that remains visible at header scale.
      </span>
      <span className="wordmarklab__detail">
        Tall display · L1 scorebook notation · scorer’s star
      </span>
    </article>
  )
}

function ContextMockups() {
  return (
    <section className="wordmarklab__contexts" aria-labelledby="contexts-title">
      <div className="wordmarklab__sectionhead">
        <span className="wordmarklab__eyebrow">Live comparison</span>
        <h2 id="contexts-title">One mark, four working distances</h2>
        <p>
          These are intentionally ordinary placements. A wordmark earns the header by staying
          recognizable when everything around it is doing real work.
        </p>
      </div>

      <div className="wordmarklab__contextgrid">
        <article className="wordmarklab__context wordmarklab__context--desktop">
          <span className="wordmarklab__contextlabel">Desktop slate header · 20 px</span>
          <div className="wordmarklab__fakeheader">
            <CandidateLockup compact />
            <div className="wordmarklab__levels" aria-hidden="true">
              <b>MLB</b><span>AAA</span><span>AA</span><span>A+</span><span>A</span>
              <i>⌕</i><i>≡</i>
            </div>
          </div>
        </article>

        <article className="wordmarklab__context wordmarklab__context--mobile">
          <span className="wordmarklab__contextlabel">390 px mobile header · 18 px</span>
          <div className="wordmarklab__phone">
            <div className="wordmarklab__phonebar">
              <CandidateLockup compact />
              <span aria-hidden="true">⌕ &nbsp; ≡</span>
            </div>
            <div className="wordmarklab__phonebody">
              <span>Fri, Jul 24</span>
              <strong>Today’s games</strong>
              <i />
              <i />
            </div>
          </div>
        </article>

        <article className="wordmarklab__context wordmarklab__context--page">
          <span className="wordmarklab__contextlabel">Standalone page bar · 22 px</span>
          <div className="wordmarklab__pagebar">
            <CandidateLockup />
            <span aria-hidden="true">⌕ &nbsp; ≡</span>
          </div>
          <div className="wordmarklab__pagecontent">
            <span>Team</span>
            <strong>Milwaukee Brewers</strong>
            <div />
          </div>
        </article>

        <article className="wordmarklab__context wordmarklab__context--footer">
          <span className="wordmarklab__contextlabel">Report footer · 16 px</span>
          <div className="wordmarklab__footerbar">
            <CandidateLockup compact />
            <span>Tally Baseball · score without spoilers</span>
          </div>
        </article>
      </div>
    </section>
  )
}

export function WordmarkLab() {
  return (
    <>
      <SiteHeader />
      <main className="wordmarklab">
        <header className="wordmarklab__intro">
          <div>
            <span className="wordmarklab__eyebrow">Brand study · focused refinement</span>
            <h1>Clubhouse L1 wordmark</h1>
            <p>
              One direction, refined against the constraints that matter: clay red only, fast
              recognition beside the baseball mark, and scorebook details that survive a phone
              header.
            </p>
          </div>
          <div className="wordmarklab__colorlock">
            <span aria-hidden="true" />
            <div>
              <strong>Color locked</strong>
              <small>Existing clay red · #B4453A</small>
            </div>
          </div>
        </header>

        <section className="wordmarklab__current" aria-labelledby="current-title">
          <div>
            <span className="wordmarklab__eyebrow">Current mark</span>
            <h2 id="current-title">What the redraw needs to solve</h2>
          </div>
          <TallyWordmark height={42} />
          <ul>
            <li>Uneven stencil cuts interrupt different letters in different ways.</li>
            <li>The thin Y and small A counter lose definition first.</li>
            <li>The concept says “scorecard,” but the rule is not systematic enough to feel owned.</li>
          </ul>
        </section>

        <section className="wordmarklab__options" aria-label="Clubhouse L1 refinement">
          <FocusCard />
        </section>

        <ContextMockups />

        <section className="wordmarklab__recommendation">
          <span className="wordmarklab__eyebrow">My read</span>
          <h2>The star survives where the underline disappears.</h2>
          <p>
            L1 still provides the structural idea inside the name. The raised, filled star adds a
            second scorebook signal without competing with the reading order, and keeps enough mass
            to remain intentional at the 16-pixel footer size.
          </p>
        </section>
      </main>
    </>
  )
}
