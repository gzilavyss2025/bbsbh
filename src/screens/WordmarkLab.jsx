import { useEffect, useId, useRef, useState } from 'react'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { TallyBaseballMark, TallyWordmark } from '../components/TallyBrand.jsx'

const OPTIONS = [
  {
    id: 'scorebook',
    name: 'Scorebook Cut',
    eyebrow: 'Recommended',
    rationale:
      'A sturdier redraw of the current idea. One disciplined ledger-rule cut replaces the uneven gaps, while broader strokes hold together at header size.',
    detail: 'Custom geometry · 3.25:1 · shared scorebook rule',
  },
  {
    id: 'diamond',
    name: 'Diamond Counter',
    eyebrow: 'Most direct',
    rationale:
      'A compact clubhouse sans with one memorable intervention: the A counter becomes the same base-diamond shape used throughout Tally.',
    detail: 'Condensed sans · 3.05:1 · diamond counter',
  },
  {
    id: 'baseline',
    name: 'Home Baseline',
    eyebrow: 'Most editorial',
    rationale:
      'A calmer word shape grounded by a scorer’s rule that resolves into home plate. It feels native to the paper-and-ink system without becoming retro.',
    detail: 'Plex construction · 3.35:1 · home-plate terminal',
  },
  {
    id: 'clubhouse',
    name: 'Clubhouse L1',
    eyebrow: 'New direction',
    rationale:
      'The second L becomes a 1, turning the middle into L1—the scorebook notation baked into the name. The underline annotates that pair instead of merely decorating it.',
    detail: 'Tall display · L1 scorebook notation · annotated pair',
  },
]

function ScorebookWordmark({ title, ...props }) {
  const maskId = `scorebook-wordmark-${useId().replace(/:/g, '')}`
  return (
    <svg viewBox="0 0 300 96" role="img" aria-label={title} {...props}>
      <defs>
        <mask id={maskId}>
          <g fill="white">
            <path d="M0 8h48v16H32v64H16V24H0V8Z" />
            <path
              fillRule="evenodd"
              d="M55 88 75 8h24l21 80h-18l-5-20H76l-4 20H55Zm25-36h13l-7-27-6 27Z"
            />
            <path d="M128 8h17v64h34v16h-51V8Zm58 0h17v64h34v16h-51V8Z" />
            <path d="M235 8h19l14 28 14-28h18l-24 48v32h-17V56L235 8Z" />
          </g>
          <rect x="0" y="36" width="300" height="5" fill="black" />
        </mask>
      </defs>
      <rect width="300" height="96" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  )
}

function DiamondWordmark({ title, ...props }) {
  return (
    <svg viewBox="0 0 320 96" role="img" aria-label={title} {...props}>
      <path d="M0 9h52v17H35v61H17V26H0V9Z" fill="currentColor" />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M58 87 80 9h25l23 78h-19l-5-18H81l-5 18H58Zm31-35 4 5 5-5-5-5-4 5Z"
      />
      <path d="M136 9h18v61h36v17h-54V9Zm62 0h18v61h36v17h-54V9Z" fill="currentColor" />
      <path d="M251 9h20l15 27 15-27h19l-25 47v31h-18V56L251 9Z" fill="currentColor" />
    </svg>
  )
}

function BaselineWordmark({ title, ...props }) {
  return (
    <svg viewBox="0 0 320 96" role="img" aria-label={title} {...props}>
      <text
        x="2"
        y="76"
        fill="currentColor"
        fontFamily="IBM Plex Sans, system-ui, sans-serif"
        fontSize="78"
        fontWeight="700"
        letterSpacing="-5"
      >
        TALLY
      </text>
      <path
        d="M4 87H277l10-8 10 8-10 8-10-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ClubhouseWordmark({ title, ...props }) {
  const lRef = useRef(null)
  const oneRef = useRef(null)
  const [underline, setUnderline] = useState({ x: 93, width: 71 })

  useEffect(() => {
    let active = true
    const measure = () => {
      if (!active || !lRef.current || !oneRef.current) return
      const lBox = lRef.current.getBBox()
      const oneBox = oneRef.current.getBBox()
      const start = lBox.x
      const end = oneBox.x + oneBox.width
      const overhang = (end - start) * 0.03
      setUnderline({ x: start - overhang, width: end - start + overhang * 2 })
    }

    const fontsReady = document.fonts?.ready ?? Promise.resolve()
    fontsReady.then(measure)
    return () => {
      active = false
    }
  }, [])

  return (
    <svg viewBox="0 0 280 96" role="img" aria-label={title} {...props}>
      <text
        x="1"
        y="83"
        fill="currentColor"
        fontFamily="Big Shoulders Display, IBM Plex Sans Condensed, sans-serif"
        fontSize="94"
        fontWeight="900"
        letterSpacing="-0.75"
      >
        <tspan>T</tspan>
        <tspan>A</tspan>
        <tspan ref={lRef}>L</tspan>
        <tspan ref={oneRef}>1</tspan>
        <tspan>Y</tspan>
      </text>
      <rect
        x={underline.x}
        y="87"
        width={underline.width}
        height="5"
        rx="2.5"
        fill="currentColor"
      />
    </svg>
  )
}

function CandidateWordmark({ variant, title = 'Tally', ...props }) {
  if (variant === 'scorebook') return <ScorebookWordmark title={title} {...props} />
  if (variant === 'diamond') return <DiamondWordmark title={title} {...props} />
  if (variant === 'baseline') return <BaselineWordmark title={title} {...props} />
  return <ClubhouseWordmark title={title} {...props} />
}

function CandidateLockup({ variant, compact = false }) {
  return (
    <span className={`wordmarklab__lockup${compact ? ' wordmarklab__lockup--compact' : ''}`}>
      <TallyBaseballMark size={compact ? 24 : 30} title="" aria-hidden="true" />
      <CandidateWordmark variant={variant} />
    </span>
  )
}

function OptionCard({ option, selected, onSelect }) {
  return (
    <button
      type="button"
      className="wordmarklab__option"
      data-selected={selected}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="wordmarklab__optionhead">
        <span>
          <span className="wordmarklab__eyebrow">{option.eyebrow}</span>
          <strong>{option.name}</strong>
        </span>
        <span className="wordmarklab__pick">{selected ? 'In context' : 'View'}</span>
      </span>
      <CandidateWordmark variant={option.id} className="wordmarklab__optionmark" />
      <span className="wordmarklab__sizerow" aria-label="Small-size comparison">
        <CandidateWordmark variant={option.id} style={{ height: 22 }} />
        <CandidateWordmark variant={option.id} style={{ height: 16 }} />
        <span>22 px / 16 px</span>
      </span>
      <span className="wordmarklab__rationale">{option.rationale}</span>
      <span className="wordmarklab__detail">{option.detail}</span>
    </button>
  )
}

function ContextMockups({ variant }) {
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
            <CandidateLockup variant={variant} compact />
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
              <CandidateLockup variant={variant} compact />
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
            <CandidateLockup variant={variant} />
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
            <CandidateLockup variant={variant} compact />
            <span>Tally Baseball · score without spoilers</span>
          </div>
        </article>
      </div>
    </section>
  )
}

export function WordmarkLab() {
  const [selected, setSelected] = useState('clubhouse')
  const selectedOption = OPTIONS.find((option) => option.id === selected)

  return (
    <>
      <SiteHeader />
      <main className="wordmarklab">
        <header className="wordmarklab__intro">
          <div>
            <span className="wordmarklab__eyebrow">Brand study · round one</span>
            <h1>Tally wordmark alternatives</h1>
            <p>
              Four directions built around the same constraints: clay red only, fast recognition
              beside the baseball mark, and a silhouette that survives a phone header.
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

        <section className="wordmarklab__options" aria-label="Wordmark options">
          {OPTIONS.map((option) => (
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

        <ContextMockups variant={selected} />

        <section className="wordmarklab__recommendation">
          <span className="wordmarklab__eyebrow">My read</span>
          <h2>Clubhouse L1 is the most ownable idea.</h2>
          <p>
            The substitution works because it is not a baseball ornament placed beside the name—the
            scorebook language is the name. The next refinement is optical: make the 1 unmistakable
            without letting a first-time reader stop at “Tal-one-y.”
          </p>
        </section>
      </main>
    </>
  )
}
