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
          Game Score rates a finished game from 0 to 10 on a single question:{' '}
          <em>was it worth scoring?</em> Run down yesterday&rsquo;s slate, find
          the big number, and that&rsquo;s the game to sit down with. It&rsquo;s
          never the final score, and it won&rsquo;t hint at one &mdash; it
          measures the drama, not the result.
        </p>
        <p className="sheet__body">
          Every finished game starts with a couple of points just for getting
          played. The rest is earned, item by item, down the list below, and a
          blowout hands some back. There&rsquo;s more than one road to a 10: a
          walk-off can get you there, and so can a one-hitter, a slugfest, or one
          hitter who refuses to make an out.
        </p>

        <div className="gsgroups">
          <GsGroup title="Drama — how late it stayed in doubt">
            <GsFactor label="Lead changes &amp; ties" note="the game keeps changing its mind" />
            <GsFactor label="Big comeback" note="a rally loads the late innings" />
            <GsFactor label="Nail-biter finish" note="one run late, every pitch counts" />
            <GsFactor label="Extra innings" note="free baseball, tension included" />
            <GsFactor label="Walk-off" note="nothing in the sport ends better" />
            <GsFactor label="Low-scoring duel" note="a 1–0 can grip all night" />
          </GsGroup>

          <GsGroup title="Action — how busy your pencil got">
            <GsFactor label="Runs, both sides" note="both dugouts keep you writing" />
            <GsFactor label="Scoring spread out" note="sprinkled runs beat one crooked number" />
            <GsFactor label="Home runs" note="extra for the ones that matter late" />
          </GsGroup>

          <GsGroup title="The standout — one player carries the night">
            <GsFactor label="Pitching gem" note="a near no-no lifts a quiet game" />
            <GsFactor label="Monster night" note="two homers, a cycle, that kind of night" />
            <GsFactor label="Debut or twilight" note="a first career gem, or a 40-year-old’s" />
          </GsGroup>

          <GsGroup title="Deductions — where a game gives points back">
            <GsFactor label="Blowout" note="a laugher subtracts, unless a gem saves it" negative />
          </GsGroup>
        </div>

        <div className="gsexamples">
          <h3 className="gsexamples__title">A few example games</h3>
          <GsExample
            score="9.8"
            line="Down 3–0, tied in the ninth, walk-off single in the eleventh. You’d frame the scorecard."
          />
          <GsExample
            score="8.4"
            line="A one-hitter with 14 strikeouts and almost nothing else on the page. One pitcher is plenty."
          />
          <GsExample
            score="7.1"
            line="A rookie’s debut: six no-hit innings until a cramp got him. Electric while it lasted, and the debut bonus does the rest."
          />
          <GsExample
            score="5.0"
            line="A 5–3 with one lead change and no late sweat. A fine night, nothing more."
          />
          <GsExample
            score="2.6"
            line="A 12–2 laugher, decided early. The blowout deduction takes its cut."
          />
        </div>

        {thresholds && (
          <p className="sheet__body gsmodal__tiers">
            The color tiers grade on a curve against the games showing now:
            Elite is {fmt(thresholds.eliteMin)} and up, Good is{' '}
            {fmt(thresholds.goodMin)}–{fmt(thresholds.eliteMin)}, Average is{' '}
            {fmt(thresholds.averageMin)}–{fmt(thresholds.goodMin)}, and under{' '}
            {fmt(thresholds.averageMin)} is Below Average.
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
