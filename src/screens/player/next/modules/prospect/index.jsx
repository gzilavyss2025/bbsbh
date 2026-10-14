import { useEffect } from 'react'
import { fetchProspectTrend } from '../../../../../api/prospectTrend.js'
import { fetchLevelTenure } from '../../../../../api/levelTenure.js'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { inMinors } from '../innings/inningsView.js'
import { prospectView } from './prospectView.js'
import '../../../../../styles/player-next/career/prospect.css'

// Prospect performance (#2068): a minor leaguer's OPS or ERA percentile against his level, from the
// nightly file (the latest snapshot, so ?d= cannot rewind it). An MLB player, no row, or an earlier-
// season page hides the card with no fetch for MLB. Open surface: no seal.
export default function ProspectModule({ bio, asOf, onEmpty, onCount }) {
  const minors = inMinors(bio)
  const { data } = useAsync(() => (minors ? Promise.all([fetchProspectTrend(), fetchLevelTenure()]) : null), [minors])
  const v = data && prospectView(data[0], data[1], bio, asOf)
  const settled = !minors || data
  useEffect(() => {
    if (!settled) return
    if (v) onCount(v.count)
    else onEmpty()
  }, [settled, v?.count]) // eslint-disable-line react-hooks/exhaustive-deps -- report once per answer

  if (!v) return <div className="prospect prospect--wait" aria-busy={!settled} />
  return (
    <div className="prospect">
      <div className="prospect__lead">
        {v.state === 'qualified' ? (
          <div className="prospect__tile">
            <span className="prospect__label">{v.heading}</span>
            <span className="prospect__num">{v.pct}<sup>{v.suffix}</sup></span>
            <span className="prospect__cap">Percentile</span>
          </div>
        ) : (
          <div className="prospect__tile prospect__tile--hollow">
            <span className="prospect__label">{v.heading}</span>
            <span className="prospect__num">{v.tileNum}</span>
            <span className="prospect__cap">{v.tileCap}</span>
          </div>
        )}
        <div className="prospect__words">
          <span className="prospect__title">{v.state === 'qualified' ? v.standing : v.title}</span>
          <span className="prospect__sub">{v.state === 'qualified' ? v.comparison : v.need}</span>
        </div>
      </div>

      {v.state === 'qualified' && (
        <div className="prospect__scale" role="img" aria-label={`${v.ordinal} percentile on a scale from 0 to 100; 50 is the level median`}>
          <div className="prospect__dotrow"><span className="prospect__dot" style={{ left: `${v.pct}%` }}>{v.pct}</span></div>
          <div className="prospect__track" aria-hidden="true">
            <span className="prospect__fill" style={{ width: `${v.pct}%` }} />
            <span className="prospect__mid" />
          </div>
          <div className="prospect__ticks" aria-hidden="true"><span>0</span><span>50 · Level median</span><span>100</span></div>
        </div>
      )}

      <dl className="prospect__facts">
        {v.state === 'qualified' && <Fact name="Sample confidence">{v.confidence}</Fact>}
        {v.movement && <Fact name="Movement">{v.movement}</Fact>}
        {v.state === 'qualified' && <Fact name="Standing band">{v.tierLabel}</Fact>}
        {v.tenure && <Fact name="Time at level">{v.tenure}</Fact>}
      </dl>
      {v.age && <p className="prospect__age"><span className="prospect__label">Age vs level</span> {v.age}</p>}
    </div>
  )
}

const Fact = ({ name, children }) => (
  <div className="prospect__fact"><dt>{name}</dt><dd>{children}</dd></div>
)
