import { useId, useMemo, useState } from 'react'
import { HALVES, monthsPlayed, teamRecordsFor } from '../../../../../api/teamRecords.js'
import { Segmented } from '../../../../../components/ui/control/Segmented.jsx'
import { RankStrip } from '../../../../../components/ui/frame/RankBar.jsx'
import { EmptyState } from '../../../../../components/ui/state/EmptyState.jsx'
import { ordinal } from '../../../../../lib/format.js'
import '../../../../../styles/team-next/records.css'
import { InningGrid } from './InningGrid.jsx'
import { COUNTS_GROUP, INNING_GROUP, MIN_RANKED, recordsModel } from './recordsModel.js'
import { SplitList } from './Splits.jsx'

// The Records card of the one-scroll team page (#1107, row 7b; spec .scratch/team-canvas/records-pick.md).
// Today's Records content in a rank-strip index: one 44px line per group, folded open in place, with
// the half and the month combined as the two scope levers. The old /team/{id} page still draws
// modules/records/RecordsCard.jsx until the swap row; this card is the new one beside it.
//
// ONE request: the shard already holds each club's rank per scope (`ranks`), read by recordsModel
// through the cutoff-gated rankOf. `cutoff` is the page's day-before cutoff, `asOf` its ?d= date.

function GroupLine({ group, of, open, onToggle, bodyId }) {
  return (
    <button type="button" className="rec__line" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
      <span className="rec__chev" aria-hidden="true" />
      <span className="rec__name">{group.title}</span>
      {of != null && group.ticks.length > 0 ? <RankStrip ranks={group.ticks} of={of} /> : <span />}
      <span className="rec__n">{group.rows.length}</span>
    </button>
  )
}

function Group({ group, of, open, onToggle, scope }) {
  const bodyId = useId()
  const body = group.title === INNING_GROUP
    ? <InningGrid key={scope} group={group} />
    : <SplitList rows={group.rows} count={group.title === COUNTS_GROUP} />
  return (
    <div className="rec__group">
      <GroupLine group={group} of={of} open={open} onToggle={onToggle} bodyId={bodyId} />
      <div className={`rec__fold${open ? ' rec__fold--open' : ''}`} id={bodyId} inert={!open}>
        <div className="rec__foldin">{body}</div>
      </div>
    </div>
  )
}

export function RecordsCard({ data, cutoff, asOf }) {
  const [halfPick, setHalf] = useState('all')
  const [monthPick, setMonth] = useState(null)
  const [openGroups, setOpenGroups] = useState(() => new Set())
  const months = useMemo(() => monthsPlayed(data, { cutoff }), [data, cutoff])
  // A half and a month combine, so an option with no games in the other lever's pick is disabled.
  // One pass per data or cutoff, not per render.
  const played = useMemo(() => {
    const s = new Set()
    for (const h of HALVES) for (const m of [null, ...months.map((x) => x.month)]) if (teamRecordsFor(data, { cutoff, half: h.key, month: m })) s.add(`${h.key}:${m}`)
    return s
  }, [data, cutoff, months])
  const has = (h, m) => played.has(`${h}:${m}`)
  // A pick the data no longer holds (the page date moved the cutoff) falls back to the whole season.
  const month = months.some((m) => m.month === monthPick) ? monthPick : null
  const half = has(halfPick, month) ? halfPick : 'all'
  const model = useMemo(() => recordsModel(data, { cutoff, asOf, half, month }), [data, cutoff, asOf, half, month])
  if (!has('all', null)) return null
  const toggle = (title) =>
    setOpenGroups((s) => {
      const next = new Set(s)
      if (!next.delete(title)) next.add(title)
      return next
    })

  return (
    <div className="tstats rec">
      <div className="rec__scope">
        {data.allStarDate && (
          <Segmented
            fill
            className="rec__halves"
            label="Season half"
            value={half}
            onChange={setHalf}
            options={HALVES.map((h) => ({ value: h.key, label: h.label, disabled: !has(h.key, month) }))}
          />
        )}
        {months.length > 1 && (
          <div className="rec__months" style={{ '--n': months.length + 1, '--cols': Math.ceil((months.length + 1) / 2) }}>
            <Segmented
              fill
              label="Month"
              value={month}
              onChange={setMonth}
              options={[{ value: null, label: 'All' }, ...months.map((m) => ({ value: m.month, label: m.short, disabled: !has(half, m.month) }))]}
            />
          </div>
        )}
      </div>
      {model ? (
        <>
          <div className="rec__head" aria-hidden="true">
            <span />
            <span>Group</span>
            <span className="rec__scale">
              {model.of != null && <><span>{ordinal(model.of)}</span><span>1st</span></>}
            </span>
            <span>N</span>
          </div>
          {model.groups.map((g) => (
            <Group key={g.title} group={g} of={model.of} open={openGroups.has(g.title)} onToggle={() => toggle(g.title)} scope={`${half}:${month}`} />
          ))}
          <p className="rec__key">
            {model.of != null
              ? <>Each tick is one split. The hollow square is the middle club. <i className="rankbar__swatch rankbar__swatch--top" /> top third, <i className="rankbar__swatch rankbar__swatch--low" /> bottom third.</>
              : `Ranks show on the live page, for splits of ${MIN_RANKED} or more games.`}
          </p>
        </>
      ) : (
        <EmptyState size="compact">No games in this stretch of the season yet.</EmptyState>
      )}
    </div>
  )
}
