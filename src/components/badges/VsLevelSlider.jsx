// A discrete, labeled filter over the SAME five bands ProspectTrendPill's dot
// row draws (levelTier, api/prospectTrend.js) — not a level-of-play filter
// (see TeamFilterStrip for the club pick, and /prospects' own level slider
// question this replaced: filtering by WHERE he's playing is a different
// question from filtering by HOW HE'S PERFORMING there). A real draggable
// <input type="range"> (native touch/keyboard/click handling, not a row of
// buttons standing in for one), snapped to 6 rungs — "All" plus tiers 1-5 —
// with every band's plain-language label shown beneath the track, colored the same
// red/kraft/green the dots themselves use, so the slider reads as the same
// scale before it's ever touched.
const RUNGS = ['All', 'Bottom', 'Below', 'In line', 'Above', 'Elite']

// tier 1-2 => 'low' (red), 3 => 'mid' (kraft brown), 4-5 => 'high' (green) —
// same bandFor as ProspectTrendPill's own dot row.
function bandFor(tier) {
  return tier <= 2 ? 'low' : tier >= 4 ? 'high' : 'mid'
}

// `value` is a tier (1-5) or null for "All"; `onChange` receives the same
// shape back.
const THUMB_COLOR = { low: 'var(--accent-negative)', mid: 'var(--seal-cover)', high: 'var(--accent-positive)' }

export function VsLevelSlider({ value, onChange, ariaLabel }) {
  const index = value == null ? 0 : value
  const thumbColor = index === 0 ? 'var(--accent-primary)' : THUMB_COLOR[bandFor(index)]

  return (
    <div className="vslevelslider">
      <input
        type="range"
        className="vslevelslider__input"
        min={0}
        max={RUNGS.length - 1}
        step={1}
        value={index}
        onChange={(e) => {
          const i = Number(e.target.value)
          onChange(i === 0 ? null : i)
        }}
        style={{ '--vslevelslider-thumb': thumbColor }}
        aria-label={ariaLabel}
        aria-valuetext={RUNGS[index]}
      />
      <div className="vslevelslider__ticks" aria-hidden="true">
        {RUNGS.map((rung, i) => (
          <span
            key={rung}
            className={
              `vslevelslider__tick${i === index ? ' is-active' : ''}` +
              (i > 0 ? ` vslevelslider__tick--${bandFor(i)}` : '')
            }
          >
            {rung}
          </span>
        ))}
      </div>
    </div>
  )
}
