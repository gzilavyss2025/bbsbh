import { statusBannersView } from '../../statusBanners.js'
import { STATUS_MARK } from './statusMarks.js'
import '../../../../styles/player-next/top/status.css'

// The band on the hero's top edge (#2008): one ledger row per status, inside the hero's border.
// The text and rules are statusBannersView's. No status: nothing drawn, no space.
export function HeroBand({ core }) {
  const list = statusBannersView(core)
  if (!list.length) return null
  return (
    <div className="pnext__band">
      <ul className="pnext__bandrows">
        {list.map((b) => (
          <li key={b.key} className="pnext__brow" data-status={b.key}>
            <span className="pnext__bmark" data-mark={STATUS_MARK[b.key]} aria-hidden="true" />
            {b.text}
          </li>
        ))}
      </ul>
    </div>
  )
}
