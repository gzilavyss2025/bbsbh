import { PennantRow } from '../../../../../components/honors/PennantRow.jsx'

// Pennant seasons, under the ledger of Team history: one pennant for each year he played for a
// club that won its league (pennantsView.js). Draw-only; the card hides when he has none.
export function PennantBand({ pennants }) {
  if (!pennants?.length) return null
  return (
    <section className="teamhist__pen" aria-label="Pennant seasons">
      <h3 className="teamhist__penl">Pennant seasons</h3>
      <PennantRow pennants={pennants} label="Pennant seasons, newest first" />
    </section>
  )
}
