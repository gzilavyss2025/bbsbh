import { useState } from 'react'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { TallyBaseballMark, TallyWordmark } from '../components/TallyBrand.jsx'

const STAR_OPTIONS = [
  {
    id: 'asterisk',
    name: 'Scorer’s Asterisk',
    eyebrow: 'Most scorebook',
    rationale:
      'Three blunt pen strokes make a six-point mark instead of a typeset star. It feels annotated by a scorer and stays open when enlarged at header size.',
    detail: 'Solid custom Y · six points · rounded pen strokes',
  },
  {
    id: 'open',
    name: 'Open Star',
    eyebrow: 'Most familiar',
    rationale:
      'A heavy outlined five-point star reads immediately without the dense center of the current glyph. The compact cut gets a thicker outline and more scale.',
    detail: 'Solid custom Y · five points · open counter',
  },
  {
    id: 'burst',
    name: 'Scoreboard Burst',
    eyebrow: 'Most graphic',
    rationale:
      'An eight-point diamond burst trades the souvenir-star silhouette for a sharper scoreboard signal. Broad cardinal points keep the shape obvious when small.',
    detail: 'Solid custom Y · eight points · diamond construction',
  },
]

function StarGlyph({ variant, compact }) {
  const scale = compact ? 1.28 : 1
  const transform = `translate(220 23) scale(${scale})`

  if (variant === 'open') {
    return (
      <path
        d="M0-11.5 3.3-4 11.4-3.2 5.2 2.2 7 10.2 0 6-7 10.2-5.2 2.2-11.4-3.2-3.3-4Z"
        transform={transform}
        fill="none"
        stroke="currentColor"
        strokeWidth={compact ? 3.9 : 3.2}
        strokeLinejoin="round"
      />
    )
  }

  if (variant === 'burst') {
    return (
      <path
        d="M0-12 3-4.7 8.5-8.5 4.7-3 12 0 4.7 3 8.5 8.5 3 4.7 0 12-3 4.7-8.5 8.5-4.7 3-12 0-4.7-3-8.5-8.5-3-4.7Z"
        transform={transform}
        fill="currentColor"
      />
    )
  }

  return (
    <g
      transform={transform}
      fill="none"
      stroke="currentColor"
      strokeWidth={compact ? 4.8 : 4}
      strokeLinecap="round"
    >
      <path d="M0-11V11" />
      <path d="m-9.5-5.5 19 11" />
      <path d="m-9.5 5.5 19-11" />
    </g>
  )
}

function ClubhouseWordmark({ title, star = 'asterisk', compact = false, ...props }) {
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
      <path
        d="M151 10h17l9 29 9-29h17l-18 47v26h-16V57Z"
        fill="currentColor"
      />
      <StarGlyph variant={star} compact={compact} />
    </svg>
  )
}

function CandidateWordmark({ title = 'Tally', ...props }) {
  return <ClubhouseWordmark title={title} {...props} />
}

function CandidateLockup({ star, compact = false }) {
  return (
    <span className={`wordmarklab__lockup${compact ? ' wordmarklab__lockup--compact' : ''}`}>
      <TallyBaseballMark size={compact ? 24 : 30} title="" aria-hidden="true" />
      <CandidateWordmark star={star} compact={compact} />
    </span>
  )
}

function OptionCard({ option, selected, onSelect }) {
  return (
    <button
      type="button"
      className="wordmarklab__option"
      data-selected={selected}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="wordmarklab__optionhead">
        <span>
          <span className="wordmarklab__eyebrow">{option.eyebrow}</span>
          <strong>{option.name}</strong>
        </span>
        <span className="wordmarklab__pick">{selected ? 'In context' : 'View'}</span>
      </span>
      <CandidateWordmark star={option.id} className="wordmarklab__optionmark" />
      <span className="wordmarklab__sizerow" aria-label="Small-size comparison">
        <CandidateWordmark star={option.id} style={{ height: 22 }} />
        <CandidateWordmark star={option.id} compact style={{ height: 18 }} />
        <CandidateWordmark star={option.id} compact style={{ height: 16 }} />
        <span>22 / 18 / 16 px</span>
      </span>
      <span className="wordmarklab__rationale">{option.rationale}</span>
      <span className="wordmarklab__detail">{option.detail}</span>
    </button>
  )
}

function ContextMockups({ star }) {
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
            <CandidateLockup star={star} compact />
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
              <CandidateLockup star={star} compact />
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
            <CandidateLockup star={star} />
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
            <CandidateLockup star={star} compact />
            <span>Tally Baseball · score without spoilers</span>
          </div>
        </article>
      </div>
    </section>
  )
}

export function WordmarkLab() {
  const [selected, setSelected] = useState('asterisk')
  const selectedOption = STAR_OPTIONS.find((option) => option.id === selected)

  return (
    <>
      <SiteHeader />
      <main className="wordmarklab">
        <header className="wordmarklab__intro">
          <div>
            <span className="wordmarklab__eyebrow">Brand study · glyph refinement</span>
            <h1>A cleaner Y, three new stars</h1>
            <p>
              Every option keeps the Clubhouse L1 idea, replaces the font’s notched Y with one
              continuous custom shape, and gives the star an optical-size cut that grows relative
              to the letters below 20 pixels.
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

        <section className="wordmarklab__options" aria-label="Clubhouse L1 star options">
          {STAR_OPTIONS.map((option) => (
            <OptionCard
              key={option.id}
              option={option}
              selected={selected === option.id}
              onSelect={() => setSelected(option.id)}
            />
          ))}
        </section>

        <div className="wordmarklab__selection">
          <span>Showing in context</span>
          <strong>{selectedOption.name}</strong>
          <p>{selectedOption.rationale}</p>
        </div>

        <ContextMockups star={selected} />

        <section className="wordmarklab__recommendation">
          <span className="wordmarklab__eyebrow">My read</span>
          <h2>Scorer’s Asterisk is the strongest first read.</h2>
          <p>
            It looks drawn rather than selected from a glyph menu, and its open center holds up when
            the compact version grows. Open Star is the clearest conventional alternative; the
            Scoreboard Burst is the bolder, less literal direction.
          </p>
        </section>
      </main>
    </>
  )
}
