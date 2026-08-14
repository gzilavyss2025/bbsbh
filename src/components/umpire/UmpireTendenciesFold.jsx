import { useMemo, useState } from 'react'
import { selectOfficials } from '../../api/select.js'
import { loadUmpire } from '../../api/umpires.js'
import { useAsync } from '../../hooks/useAsync.js'
import { UmpireTendencies } from './UmpireTendencies.jsx'

// The Umpire Tendencies card as a collapsed drawer, for focus mode's EXTRAS
// tab: between the two clubs' bench/bullpen lists and the card-header facts.
// Same toggle chrome as the RosterPanel drawers above it (.roster/.roster__
// toggle), so the tab reads as one set of drawers rather than two idioms.
//
// COLLAPSED BY DEFAULT, unlike those drawers' `defaultOpen` in this tab: they
// answer the question the current half is asking (who is left), while this
// card answers one asked at most once a game — the drawer is the right
// disclosure for it, and it must not shove the benches apart when the tab
// opens.
//
// SPOILER FOOTING: identical to the lineup page's own card (UmpireTendencies'
// header) — season aggregates over FINAL games of ball/strike judgments, read
// from the static nightly files. `loadUmpire` is memoized in api/umpires.js,
// so a game whose lineup page already asked costs nothing here. The fetch
// exists only to decide whether there is a drawer at all: an MiLB crew or an
// unswept umpire renders nothing rather than a drawer that opens onto an
// apology.
export function UmpireTendenciesFold({ feed }) {
  const plateId = useMemo(() => selectOfficials(feed).find((o) => o.role === 'HP')?.id ?? null, [feed])
  const { data } = useAsync(
    () => (plateId != null ? loadUmpire(plateId) : Promise.resolve(null)),
    [plateId],
  )
  const [open, setOpen] = useState(false)

  // The same "is there anything here" test the card itself applies — asked
  // before the drawer renders, so the tab never offers an empty one.
  if (!data?.accuracy?.season?.called) return null

  return (
    <section className="roster umptendfold">
      <button className="roster__toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="roster__club">Umpire tendencies</span>
        <span className="roster__chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && <UmpireTendencies umpire={data} />}
    </section>
  )
}
