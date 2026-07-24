import { SiteHeader } from '../components/SiteHeader.jsx'
import { TallyBaseballMark, TallyWordmark } from '../components/TallyBrand.jsx'

function ScorersAsterisk({ compact }) {
  // Compact placements get a separate optical cut. The previous scales were
  // 1 / 1.28; both are 10% larger here so the mark gains weight at every size.
  const scale = compact ? 1.41 : 1.1
  return (
    <g
      transform={`translate(216 23) scale(${scale})`}
      fill="none"
      stroke="currentColor"
      strokeWidth={compact ? 4.8 : 4}
      strokeLinecap="butt"
    >
      <path d="M0-11V11" />
      <path d="m-9.5-5.5 19 11" />
      <path d="m-9.5 5.5 19-11" />
    </g>
  )
}

function ClubhouseWordmark({ title, compact = false, small = false, ...props }) {
  // At working header/footer sizes, the font's hinted strokes gain visual
  // weight while a mechanically scaled path does not. The compact Y widens
  // its arms and stem, closes slightly toward the 1, and raises the fork so
  // the five letters still read as one drawn word.
  const yPath = small
    ? 'M145 8h19l9 31 9-31h19l-19 46v29h-18V54Z'
    : 'M147 8h17l9 31 9-31h17l-18 49v26h-16V57Z'

  return (
    <svg viewBox="0 0 244 96" role="img" aria-label={title} {...props}>
      <text
        x="1"
        y="83"
        fill="currentColor"
        fontFamily="Big Shoulders Display, IBM Plex Sans Condensed, sans-serif"
        fontSize="94"
        fontWeight="900"
        letterSpacing="-0.75"
      >
        TAL1
      </text>
      {/* Big Shoulders Display's 900-weight cap height begins at y=7.8 for
          this 94px text run, so the custom Y rounds that to y=8. Its fork
          and y=83 baseline stay fixed while the compact cut adds optical
          weight and raises the fork for hinted small-size text. */}
      <path
        d={yPath}
        fill="currentColor"
      />
      <ScorersAsterisk compact={compact} />
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
      <CandidateWordmark compact={compact} small />
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
        <CandidateWordmark small style={{ height: 22 }} />
        <CandidateWordmark compact small style={{ height: 18 }} />
        <CandidateWordmark compact small style={{ height: 16 }} />
        <span>22 / 18 / 16 px</span>
      </span>
      <span className="wordmarklab__rationale">
        The custom Y now closes the gap after the 1 and lands on the same baseline as the other
        letters. Its compact optical cut gains weight and an earlier fork beside hinted small-size
        text, while the asterisk stays stronger at every working distance.
      </span>
      <span className="wordmarklab__detail">
        Full-size geometry preserved · compact Y optical cut · squared scorer’s mark
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
          <TallyWordmark height={42} />
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
            The full-size Y keeps its original geometry, while the compact cut adds the weight and
            earlier fork needed beside hinted small-size text. The scorer’s asterisk keeps its
            identity instead of fading into punctuation in header and footer placements.
          </p>
        </section>
      </main>
    </>
  )
}
