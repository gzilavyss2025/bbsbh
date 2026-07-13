import { useEffect, useRef } from 'react'

// Bottom sheet explaining Game Score, opened from the Top Games page's hint
// line. Same dialog contract as BallparkModal/GameFinderModal: Escape and a
// backdrop tap close it, focus moves to the close button on open and back to
// the trigger on close. Content mirrors docs/game-score.md's factor table +
// calibration anchors — the math the top-of-page hint deliberately no longer
// spells out inline.
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
          Every finished game starts with a couple of points just for being
          played, then earns more for the things that make a game worth
          scoring: lead changes, a big comeback, a close finish, extra
          innings, a walk-off, plenty of runs on both sides, and rare feats
          like a no-hit bid or a cycle. A lopsided game loses some of those
          points back. The total lands on a 0–10 scale — never the score
          itself, just how memorable the game was.
        </p>

        <dl className="gsmodal__factors">
          <GsFactor label="Lead changes &amp; ties" note="every flip is a page-turn" />
          <GsFactor label="Largest comeback" note="a rally means dense innings to score" />
          <GsFactor label="Late &amp; close" note="every pitch matters at the end" />
          <GsFactor label="Extra innings" note="bonus baseball, guaranteed tension" />
          <GsFactor label="Walk-off" note="the best ending in the sport" />
          <GsFactor label="Total runs, on both sides" note="more action to write down" />
          <GsFactor label="Scoring spread out, not bunched" note="runs sprinkled beats one big inning" />
          <GsFactor label="Late tying/go-ahead homers" note="peak drama" />
          <GsFactor label="Rare feats" note="no-hit bid, cycle, grand slam" />
          <GsFactor label="Blowout margin" note="subtracts — a laugher is a laugher" negative />
        </dl>

        {thresholds && (
          <p className="sheet__body gsmodal__tiers">
            Tiers are set relative to this list, not an even split: Elite is{' '}
            {fmt(thresholds.eliteMin)}+, Good is{' '}
            {fmt(thresholds.goodMin)}–{fmt(thresholds.eliteMin)}, Average is{' '}
            {fmt(thresholds.averageMin)}–{fmt(thresholds.goodMin)}, and Below
            Average is under {fmt(thresholds.averageMin)}.
          </p>
        )}

        <p className="gsmodal__foot">
          A 10.0 is an 11-inning walk-off with a blown 3-run lead and a late
          tying homer. A 5.0 is an ordinary one-lead-change, 5-3 kind of night.
        </p>
      </div>
    </div>
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
