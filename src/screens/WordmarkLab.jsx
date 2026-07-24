import { SiteHeader } from '../components/SiteHeader.jsx'
import { TallyBaseballMark, TallyWordmark } from '../components/TallyBrand.jsx'

function LegacyWordmark({ height = 42 }) {
  const aspect = 1851 / 458
  return (
    <img
      src="/brand/tally-wordmark.png"
      width={Math.round(height * aspect)}
      height={height}
      alt="Previous Tally wordmark"
    />
  )
}

function CandidateWordmark({ title = 'Tally', ...props }) {
  return <TallyWordmark title={title} {...props} />
}

function CandidateLockup({ compact = false }) {
  const markSize = compact ? 24 : 30
  return (
    <span className={`wordmarklab__lockup${compact ? ' wordmarklab__lockup--compact' : ''}`}>
      <TallyBaseballMark size={markSize} title="" aria-hidden="true" />
      <CandidateWordmark height={markSize} tight />
    </span>
  )
}

function FocusCard() {
  return (
    <article className="wordmarklab__option wordmarklab__option--focus" data-selected="true">
      <span className="wordmarklab__optionhead">
        <span>
          <span className="wordmarklab__eyebrow">Selected direction</span>
          <strong>Scorer’s Asterisk</strong>
        </span>
        <span className="wordmarklab__pick">Refined</span>
      </span>
      <CandidateWordmark className="wordmarklab__optionmark" />
      <span className="wordmarklab__sizerow" aria-label="Small-size comparison">
        <CandidateWordmark style={{ height: 22 }} />
        <CandidateWordmark style={{ height: 18 }} />
        <CandidateWordmark style={{ height: 16 }} />
        <span>22 / 18 / 16 px</span>
      </span>
      <span className="wordmarklab__rationale">
        The approved large mark is now one complete outlined drawing. TAL1, the custom Y, and the
        scorer’s asterisk scale together without live-font hinting or compact substitutions.
      </span>
      <span className="wordmarklab__detail">
        One outlined asset · exact large-mark kerning · no live text
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
            <span className="wordmarklab__eyebrow">Brand study · optical refinement</span>
            <h1>Clubhouse L1 scorer’s asterisk</h1>
            <p>
              The chosen direction, tightened around the details that decide whether it reads as one
              word: L1Y spacing, a shared baseline, and a stronger scorer’s mark at every working
              size.
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
          <LegacyWordmark height={42} />
          <ul>
            <li>Uneven stencil cuts interrupt different letters in different ways.</li>
            <li>The thin Y and small A counter lose definition first.</li>
            <li>The concept says “scorecard,” but the rule is not systematic enough to feel owned.</li>
          </ul>
        </section>

        <section className="wordmarklab__options" aria-label="Selected Clubhouse L1 refinement">
          <FocusCard />
        </section>

        <ContextMockups />

        <section className="wordmarklab__recommendation">
          <span className="wordmarklab__eyebrow">My read</span>
          <h2>The three parts now read as one line.</h2>
          <p>
            Every context now uses the same complete geometry as the approved large mark. Because
            TAL1 no longer re-hints independently, the custom Y keeps the same relationship to the
            word at header, page-bar, and footer sizes.
          </p>
        </section>
      </main>
    </>
  )
}
