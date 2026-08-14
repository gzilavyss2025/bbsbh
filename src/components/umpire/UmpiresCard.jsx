import { useMemo, useState } from 'react'
import { loadUmpire, umpireAccuracySummary } from '../../api/umpires.js'
import { useAsync } from '../../hooks/useAsync.js'
import { UmpireTierGlyph } from '../badges/UmpireTierGlyph.jsx'
import { UmpireAccuracyModal } from './UmpireAccuracyModal.jsx'
import { UmpireLink } from './UmpireLink.jsx'
import { UmpireTendencies } from './UmpireTendencies.jsx'

// The lineup page's Umpires section (moved out of TeamInfo.jsx when that
// screen hit its file-size budget): the crew grid, the plate ump's accuracy
// tier glyph, the accuracy modal every name opens, and — beside the crew from
// the wide breakpoint, under it on a phone — the full Umpire Tendencies card.
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
  // Tonight's plate umpire's full Tendencies card, rendered beside the crew
  // list instead of only behind the accuracy modal. Same static nightly files
  // the modal reads, memoized in api/umpires.js, so the second consumer costs
  // no second fetch. The card renders nothing for MiLB or an unswept umpire
  // (its own guard), and the layout collapses back to the plain crew grid
  // (see .umps__zone).
  const { data: hpUmpire } = useAsync(
    () => (hpId != null ? loadUmpire(hpId) : Promise.resolve(null)),
    [hpId],
  )
  const [modalId, setModalId] = useState(null)

  if (officials.length === 0) return null
  // A six-man crew (All-Star Game / postseason, LF + RF added — see
  // selectOfficials) needs its own desktop/ipad layout: two rows of three
  // rather than the auto-fit grid's crowded row of four plus a stray row of
  // two (see .umps__list--six in index.css). Four-and-under crews keep the
  // existing auto-fit flow untouched.
  const sixMan = officials.length === 6
  return (
    <section className="umps">
      <h3 className="section__title">Umpires</h3>
      {/* Crew list and the plate ump's Tendencies card share one zone: a
          single column on a phone (card under the crew, above the preview
          door), two from the wide breakpoint — where the crew stacks into
          one column so the card can sit beside it (see .umps__zone). */}
      <div className="umps__zone">
        <ul className={`umps__list${sixMan ? ' umps__list--six' : ''}`}>
          {officials.map((o) => (
            <li key={o.role}>
              <span className="umps__role">{o.role}</span>
              <span className="umps__namerow">
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
              </span>
            </li>
          ))}
        </ul>
        {hpUmpire && <UmpireTendencies umpire={hpUmpire} />}
      </div>
      {modalId != null && <UmpireAccuracyModal id={modalId} onClose={() => setModalId(null)} />}
    </section>
  )
}
