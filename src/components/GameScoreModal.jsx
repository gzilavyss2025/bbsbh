import { useEffect, useRef } from 'react'

// Bottom sheet explaining Game Score, opened from the Top Games page's hint
// line. Same dialog contract as BallparkModal/GameFinderModal: Escape and a
// backdrop tap close it, focus moves to the close button on open and back to
// the trigger on close. Content mirrors docs/game-score.md's five buckets
// (drama, action, spectacle, dominance, dud) — grouped into four plain-language
// sections plus a handful of made-up example games, the math the top-of-page
// hint deliberately no longer spells out inline.
export function GameScoreModal({ thresholds, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const closeRef = useRef(null)
  useEffect(() => {
    const trigger = document.activeElement
    closeRef.current?.focus()
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [])

  const fmt = (n) => n.toFixed(1)

  return (
    <div
      className="scrim"
      onClick={(e) => e.target.classList.contains('scrim') && onClose()}
    >
      <div
        className="sheet gsmodal"
        role="dialog"
        aria-modal="true"
        aria-label="How Game Score works"
      >
        <div className="gsmodal__head">
          <h2 className="sheet__title">How Game Score works</h2>
          <button
            ref={closeRef}
            type="button"
            className="gsmodal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="sheet__body">
          Game Score rates how <em>memorable</em> a finished game was, on a
          0&ndash;10 scale &mdash; a quick way to pick which of the day&rsquo;s
          games is worth your scoring time. It&rsquo;s never the final score
          itself, just the drama.
        </p>
        <p className="sheet__body">
          Every game starts with a couple of points just for being played, then
          earns more across a few categories. A one-sided blowout gives a little
          back. The total lands on the 0&ndash;10 scale &mdash; and there are
          many different ways to reach a 10.
        </p>

        <div className="gsgroups">
          <GsGroup title="Drama — how tense it got">
            <GsFactor label="Lead changes &amp; ties" note="every flip is a page-turn" />
            <GsFactor label="A big comeback" note="a rally packs dense, consequential innings" />
            <GsFactor label="Nail-biter finish" note="one run apart late, every pitch counts" />
            <GsFactor label="Extra innings" note="bonus baseball, guaranteed tension" />
            <GsFactor label="Walk-off" note="the single best ending in the sport" />
            <GsFactor label="Low-scoring duel" note="a 1–0 grips even with no lead change" />
          </GsGroup>

          <GsGroup title="Action — how much happened">
            <GsFactor label="Runs, on both sides" note="more to write down, both dugouts alive" />
            <GsFactor label="Scoring spread out" note="runs sprinkled beats one big inning" />
            <GsFactor label="Home runs" note="late tying/go-ahead shots, a cycle, a slam" />
          </GsGroup>

          <GsGroup title="A standout performance">
            <GsFactor
              label="A dominant pitching line"
              note="a near no-hitter or a strikeout gem carries a quiet game"
            />
            <GsFactor
              label="A monster night at the plate"
              note="multi-homer, a cycle, huge total bases"
            />
            <GsFactor
              label="Debut or twilight bonus"
              note="a rookie’s first gem or a 40-year-old’s counts extra"
            />
          </GsGroup>

          <GsGroup title="What pulls it down">
            <GsFactor
              label="A lopsided blowout"
              note="a laugher subtracts — but a gem cancels it out"
              negative
            />
          </GsGroup>
        </div>

        <div className="gsexamples">
          <h3 className="gsexamples__title">A few example games</h3>
          <GsExample
            score="9.8"
            line="Down 3–0, tied it in the 9th, won it on an 11th-inning walk-off single. Drama, saturated."
          />
          <GsExample
            score="8.4"
            line="A complete-game one-hitter with 14 strikeouts. Barely any scoring — one pitcher’s gem carries it."
          />
          <GsExample
            score="7.1"
            line="A rookie’s big-league debut: six hitless innings before a cramp pulled him. Electric, and the debut bonus lifts it."
          />
          <GsExample
            score="5.0"
            line="An ordinary 5–3. One lead change, some scoring, never quite a nail-biter — a fine night."
          />
          <GsExample
            score="2.6"
            line="A 12–2 laugher. Near-zero on every axis, and the blowout subtracts."
          />
        </div>

        {thresholds && (
          <p className="sheet__body gsmodal__tiers">
            The colored tiers on the list are set relative to the games showing,
            not an even split: Elite is {fmt(thresholds.eliteMin)}+, Good is{' '}
            {fmt(thresholds.goodMin)}–{fmt(thresholds.eliteMin)}, Average is{' '}
            {fmt(thresholds.averageMin)}–{fmt(thresholds.goodMin)}, and Below
            Average is under {fmt(thresholds.averageMin)}.
          </p>
        )}
      </div>
    </div>
  )
}

function GsGroup({ title, children }) {
  return (
    <section className="gsgroup">
      <h3 className="gsgroup__title">{title}</h3>
      <dl className="gsgroup__factors">{children}</dl>
    </section>
  )
}

function GsFactor({ label, note, negative = false }) {
  return (
    <div className={`gsfactor ${negative ? 'gsfactor--negative' : ''}`}>
      <dt className="gsfactor__label">{label}</dt>
      <dd className="gsfactor__note">{note}</dd>
    </div>
  )
}

function GsExample({ score, line }) {
  return (
    <div className="gsexample">
      <span className="gsexample__score">{score}</span>
      <span className="gsexample__line">{line}</span>
    </div>
  )
}
