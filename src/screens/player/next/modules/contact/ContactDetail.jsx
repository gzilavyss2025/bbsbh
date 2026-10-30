import { isAirFlight } from './contactFlight.js'
import { useFlight } from './ContactFlight.jsx'
import { fetchPersonName } from '../../../../../api/person-fetch.js'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { teamClubNameShort } from '../../../../../lib/teams.js'
import { splitDisplayName } from '../../../../../api/person/identity.js'
import { Headshot } from '../../../../../components/player/Headshot.jsx'
import { TeamLogo } from '../../../../../components/logo/TeamLogo.jsx'

// The Contact detail panel (#2073): the tapped ball's figures. It reads the flight clock, so
// the distance counts up in the air and the last stats rise in after the landing; the
// polite region speaks once, on landing.
// It shows only once a ball is tapped (Gary, 2026-10-30): no placeholder card before that. Its
// top-right corner is the matchup: the opponent's mark and the pitcher's headshot, his name under
// it (read on the tap). The names stay in the screen reader's line.
// YYYY-MM-DD to M/D/YY, or null.
const shortDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  return m ? `${Number(m[2])}/${Number(m[3])}/${m[1].slice(2)}` : null
}

export function ContactDetail({ cur, detail }) {
  const { frame } = useFlight()
  const flying = !!frame?.flying
  const { data: pitcher } = useAsync(() => fetchPersonName(cur?.pitcherId), [cur?.pitcherId])
  // Before a tap only the polite region mounts, so the first ball's line is spoken when it lands.
  if (!detail) return <span className="sr-only" aria-live="polite" />
  const opp = cur?.oppId ? teamClubNameShort(cur.oppId) : null
  return (
    <div className={`fcontact__detail${flying ? ' fcontact__detail--fly' : ''}`}>
      <span className="sr-only" aria-live="polite">
        {cur && !flying ? `${detail.eyebrow}${cur.distance == null ? '' : `, ${cur.distance} feet`}, ${detail.when}` : ''}
      </span>
      {/* The result and the date on one line, the date short (Gary, 2026-10-30: "Single · 3/30/26"). */}
      <span className="fcontact__eyebrow">
        {flying ? (isAirFlight(cur) ? 'In the air' : 'On the ground') : detail.eyebrow}
        {shortDate(cur?.date) && <span className="fcontact__when">{` · ${shortDate(cur.date)}`}</span>}
      </span>
      {/* The matchup is one card (Gary, 2026-10-30): the pitcher's headshot over an ink nameplate
          that carries the opponent's mark beside his name, first over last. */}
      <span className="fcontact__matchup">
        {cur?.pitcherId && <Headshot personId={cur.pitcherId} name={pitcher ?? ''} isMlb tint={false} className="fcontact__shot" />}
        <span className="fcontact__plate">
          {opp && <TeamLogo teamId={cur.oppId} name={opp} variant="mono" size={20} />}
          {pitcher && (
            <span className="fcontact__pname">
              {splitDisplayName(pitcher).first}
              {splitDisplayName(pitcher).first && <br />}
              {splitDisplayName(pitcher).last}
            </span>
          )}
        </span>
        <span className="sr-only">{[opp && `vs ${opp}`, pitcher && `off ${pitcher}`].filter(Boolean).join(', ')}</span>
      </span>
      <span className="fcontact__big">
        {flying && cur.distance != null ? Math.round(cur.distance * frame.fr) : detail.big}
        <small>{detail.unit}</small>
      </span>
      <dl className="fcontact__stats">
        {detail.stats.map(([k, v], i) =>
          i < 2 ? (
            <div key={k}><dd>{v}</dd><dt>{k}</dt></div>
          ) : (
            <div key={k} className="fcontact__rise" style={{ '--fcontact-i': i - 2 }}><dd>{v}</dd><dt>{k}</dt></div>
          ),
        )}
      </dl>
    </div>
  )
}
