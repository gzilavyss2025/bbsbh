import { useId } from 'react'
import '../../../styles/system/ledger/pair-ledger.css'
import { Card } from '../frame/Card.jsx'
import { Key } from '../frame/Key.jsx'
import { Cluster } from '../layout/Cluster.jsx'
import { Stack } from '../layout/Stack.jsx'
import { Table } from './Table.jsx'

// THE PAIR LEDGER (#2455, Design A "Scouting ledgers") — the one layout for a
// two-team analysis table: a stamped Card, one title, a short note that names the
// measures and their direction, then a Table whose rows always read
// measure → side A → side B. Drawn once, in styles/system/ledger/pair-ledger.css.
// docs/design-system-pair-ledger.md has when to use it and when not.
//
//   title, note  the card's one title and a line saying what is measured and
//                which way is better ("League ranks · lower is better")
//   period       quiet metadata beside the title ("Regular season")
//   sides        exactly two { key, label, kicker, mark }: `label` names the
//                column, `kicker` is a small line above it (a city) shown on wide
//                screens, `mark` is a node the caller draws (a logo). The order
//                is the caller's, on every card of a set.
//   measureLabel the first column's head
//   footer       the tally, the link and the legend; optional
//   className    the block's namespace, for its own margin or row heights
//   children     the <tbody> rows: <tr><th scope="row"> measure</th><td> A</td><td> B</td></tr>,
//                and <tr><th scope="colgroup" colSpan={3}> for a group
//
// It composes Card, Table, Stack and Cluster, and knows no team, no unit and no
// threshold. Each side's figure, the leader and any failure come from the model
// that owns the rule (see lib/design/ledger/pairLead.js for the leader). It fetches
// nothing and imports no api/ module, so it may render inside a SealBox reveal.
export function PairLedger({ title, note, period, sides, measureLabel, footer, className = '', children }) {
  const titleId = useId()
  if (!Array.isArray(sides) || sides.length !== 2) throw new Error('PairLedger: sides is exactly two')
  return (
    <Card frame="stamped" body="flush" className={`pair-ledger ${className}`.trim()} aria-labelledby={titleId}>
      <Stack as="header" gap="tight" className="pair-ledger__head">
        <Cluster align="center" className="pair-ledger__titleline">
          <h3 id={titleId} className="pair-ledger__title">{title}</h3>
          {period && <span className="t-label pair-ledger__period">{period}</span>}
        </Cluster>
        <p className="pair-ledger__note">{note}</p>
      </Stack>
      <Table frame="bare" density="keep" className="pair-ledger__table">
        <caption className="sr-only">
          {title}{period ? `, ${period}` : ''}: {sides[0].label} and {sides[1].label}
        </caption>
        <colgroup>
          <col />
          <col className="pair-ledger__sidecol" />
          <col className="pair-ledger__sidecol" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="pair-ledger__measure">{measureLabel}</th>
            {sides.map((s) => (
              <th scope="col" key={s.key}>
                <Cluster as="span" gap="tight" align="center" className="pair-ledger__side">
                  {s.mark}
                  <span className="pair-ledger__sidename">
                    {s.kicker && <span className="t-label pair-ledger__kicker">{s.kicker}</span>}
                    <span>{s.label}</span>
                  </span>
                </Cluster>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </Table>
      {footer && <Stack as="footer" gap="tight" className="pair-ledger__foot">{footer}</Stack>}
    </Card>
  )
}

// A missing figure: the dash, and "no figure" for a screen reader. Never a zero.
export const NO_FIGURE = <span>—<span className="sr-only"> no figure</span></span>

// One figure. `lead` is the amber underline: it means "leads this measure", never
// "passes a threshold". `failed` is clay ink plus an asterisk, and a figure may
// do both. Both marks carry text for a screen reader, so neither needs colour.
// A figure is plain text: it is not a button and does not look like one.
export function PairFigure({ lead = false, failed = false, children }) {
  const cls = ['pair-ledger__figure', lead && 'pair-ledger__figure--lead', failed && 'pair-ledger__figure--failed']
  return (
    <span className={cls.filter(Boolean).join(' ')}>
      {children}
      {failed && <><span className="pair-ledger__asterisk" aria-hidden="true">*</span><span className="sr-only"> (failed)</span></>}
      {lead && <span className="sr-only"> (leads)</span>}
    </span>
  )
}

// A small tag after a figure: an ordinal suffix ("th") or a unit ("ft/s").
export function PairAffix({ children }) {
  return <span className="pair-ledger__affix">{children}</span>
}

// The legend. `lead` says what the amber mark means; `failed` is the model's own
// words for the clay asterisk ("Outside top 15"), or omitted when nothing can fail.
export function PairLegend({ lead, failed }) {
  const items = [{ label: lead, mark: <span className="pair-ledger__leadmark" aria-hidden="true" /> }]
  if (failed != null) items.push({ label: failed, mark: <span className="pair-ledger__failmark" aria-hidden="true">*</span> })
  return <Key items={items} className="pair-ledger__legend" />
}
