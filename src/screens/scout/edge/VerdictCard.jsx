import { useInViewOnce } from '../../../hooks/scroll/useInViewOnce.js'
import { useCountUp } from '../../team/next/ranks/runvalue/useCountUp.js'
import { fmtValue } from '../../../lib/scout/metrics.js'
import { Card } from '../../../components/ui/frame/Card.jsx'

// THE VERDICT (#2319, ADR-0118): one number on one scale. The hitter's expected
// xwOBA (est.) on this pitcher's whole mix, against the league's on the same
// pitches (hitterBoard.js matchupVerdict). The scale's five steps sit on the
// map's own bands: Even is +-.030, Slight to +-.070, Clear past it.
const STEPS = ['pitcher2', 'pitcher1', 'even', 'hitter1', 'hitter2']
const STEP_WORD = ['Clear', 'Slight', 'Even', 'Slight', 'Clear']
const signed = (gap) => `${gap < 0 ? '−' : '+'}${fmtValue('xwoba', Math.abs(gap))}`

// Motion (styles/scout/motion.css): the card stamps in once as it scrolls into view, the marker
// slides from the centre line and its figure counts up (useCountUp, DOM-driven by data-count-*).
export function VerdictCard({ v, names, once }) {
  const [ref, phase] = useInViewOnce(once)
  useCountUp(ref, phase === 'play', signed)
  const lead = v.band === 0 ? null : v.band > 0 ? 'hitter' : 'pitcher'
  const mark = 50 + Math.max(-1, Math.min(1, v.gap / 0.1)) * 50
  return (
    <Card frame="stamped" tone="ink" label="The verdict" labelAs="h3" className="scout__vcard" ref={ref} data-motion={phase} stampIn={phase === 'play'}>
      <p className="scout__vhead">{lead ? `Edge ${names[lead]}` : 'Even'}</p>
      {lead && <p className="scout__vstep">{Math.abs(v.band) === 2 ? 'Clear' : 'Slight'}</p>}
      <p className="scout__vsub">
        {lead ? `Past ±.0${Math.abs(v.band) === 2 ? '70' : '30'}` : 'Inside the ±.030 band · no side has the edge'}
      </p>
      <div className="scout__scale" role="img" aria-label={`Verdict scale: ${signed(v.gap)} xwOBA, ${lead ? `${Math.abs(v.band) === 2 ? 'clear' : 'slight'} edge ${names[lead]}` : 'inside the even band'}`}>
        <span className="scout__scalemark" data-count={v.gap} data-count-at="260,640" style={{ left: `${mark}%` }}>{signed(v.gap)}</span>
        <span className="scout__scalepin" style={{ left: `${mark}%` }} />
        <div className="scout__scalebar">
          {STEPS.map((s) => <span key={s} className={`scout__step scout__step--${s}`} />)}
        </div>
        <span className="scout__scalemid" />
      </div>
      <div className="scout__scalewords" aria-hidden="true">
        {STEP_WORD.map((w, i) => <span key={i}>{w}</span>)}
      </div>
      <div className="scout__scalesides" aria-hidden="true">
        <span className="scout__scaleside--pitcher">◀ {names.pitcher}</span>
        <span className="scout__scaleside--hitter">{names.hitter} ▶</span>
      </div>
      <p className="scout__vfoot">
        Expected xwOBA (est.) <strong>{fmtValue('xwoba', v.value)}</strong> · league <strong>{fmtValue('xwoba', v.league)}</strong> on the same pitches.
      </p>
    </Card>
  )
}
