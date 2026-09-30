import { useMemo, useState } from 'react'
import { umpireAccuracySummary } from '../../api/umpires.js'
import { useAsync } from '../../hooks/useAsync.js'
import { UmpireTierGlyph } from '../badges/UmpireTierGlyph.jsx'
import { UmpireAccuracyModal } from './UmpireAccuracyModal.jsx'
import { UmpireLink } from './UmpireLink.jsx'

// The lineup page's crew (moved out of TeamInfo.jsx when that screen hit its
// file-size budget): one fact cell per umpire — "HP UMP", "1B UMP", … — the
// plate ump's accuracy tier glyph, and the accuracy modal every name opens.
// It draws CELLS, not a card and not a header: TeamInfo renders it inside the
// same FactGrid as the date / ballpark / weather facts, so the page's two top
// tables are one table and the crew fills the cell an odd fact count left
// empty. The full Umpire Tendencies card is NOT in here — TeamInfo renders it
// as the page-top zone's right column (see .teaminfo__topzone).
//
// Under tonight's plate ump: his season accuracy TIER (Elite/Good/Average/
// Below Average — see api/umpires.js's tierForZ), as a tap glyph next to
// his name (UmpireTierGlyph) that unfolds the tier tag + rank in place
// before the full accuracy modal (the Umpire Tendencies card + his last five
// plate games) one tap further. Rides its own async load (keyed to his id).
// It's a season aggregate of Final games only, so it can't leak tonight's
// (unplayed) result; hidden for MiLB / umps with no data.
//
// EVERY crew member's NAME opens that modal, not only the plate umpire's and
// not only via the glyph. A base umpire has plate work of his own on other
// nights, and "how does the guy at first base call a zone" is a real question
// — it just had no answer short of navigating away to his page. The modal's
// own "Full umpire page" button keeps that route one tap further on, so
// nothing was taken away by making the name open a sheet instead.
export function UmpiresCard({ officials }) {
  const hpId = useMemo(() => officials.find((o) => o.role === 'HP')?.id ?? null, [officials])
  const { data: hpAccuracy } = useAsync(() => umpireAccuracySummary(hpId), [hpId])
  const [modalId, setModalId] = useState(null)

  if (officials.length === 0) return null
  return (
    <>
      {officials.map((o) => (
        <div className="fact" key={o.role}>
          <dt className="fact__label">{o.role} ump</dt>
          <dd className="fact__value umps__namerow">
            <UmpireLink id={o.id} className="umps__name" onOpen={() => setModalId(o.id)}>
              {o.name}
            </UmpireLink>
            {o.role === 'HP' && hpAccuracy?.tier && (
              <UmpireTierGlyph
                tier={hpAccuracy.tier}
                rank={hpAccuracy.rank}
                total={hpAccuracy.total}
                onFullBreakdown={() => setModalId(o.id)}
              />
            )}
          </dd>
        </div>
      ))}
      {modalId != null && <UmpireAccuracyModal id={modalId} onClose={() => setModalId(null)} />}
    </>
  )
}
