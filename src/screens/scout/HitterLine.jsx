import { rate3 } from '../../api/person/shared.js'
import { Table } from '../../components/ui/table/Table.jsx'
import { pitchLabel } from '../../api/pitchArsenal.js'
import { boardRow } from './board.js'
import { Stack } from '../../components/ui/layout/Stack.jsx'

// THE HITTER'S SIDE IN PHASE 1 (#1410). The hitter map needs the #1411 grid,
// so until it ships this slot prints his line against each pitch type from
// the Savant board (public/data/savant-matchup.json): regular season only,
// labelled "xwOBA · Regular season" (Gary, item 15) — Savant's own xwOBA, not
// the "(est.)" estimate #1411 brings.
//
// THIN BY NATURE. The board's median hitter has about 36 PA against one pitch
// type, so every value prints beside its PA count, and a missing row prints
// "—", never zero. Nothing here ranks or compares hitters.
//
// `line` is the hitter's arsenal map ({ FF: { estWoba, whiff, ba, pa } }),
// `types` the pitcher's pilled types, `code` the selected one or null for All.
export function HitterLine({ line, types, code }) {
  const row = (c) => boardRow(line, c).row
  if (code) {
    const { row: r, as } = boardRow(line, code)
    return (
      <>
        {as && <p className="scout__cap scout__hitas">as {pitchLabel(as)}</p>}
        <dl className="scout__hitline">
          <Fact label="xwOBA" value={r?.estWoba != null ? rate3(r.estWoba) : '—'} />
          <Fact label="Whiff %" value={r?.whiff != null ? Math.round(r.whiff) : '—'} />
          <Fact label="BA" value={r?.ba != null ? rate3(r.ba) : '—'} />
          <Fact label="PA" value={r?.pa ?? '—'} />
        </dl>
      </>
    )
  }
  return (
    <Table frame="bare" density="tight" className="scout__hittable">
      <thead>
        <tr><th>Pitch</th><th>xwOBA</th><th>PA</th></tr>
      </thead>
      <tbody>
        {types.map((t) => {
          const r = row(t.code)
          return (
            <tr key={t.code}>
              <th scope="row">{t.name}</th>
              <td>{r?.estWoba != null ? rate3(r.estWoba) : '—'}</td>
              <td>{r?.pa ?? '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </Table>
  )
}

function Fact({ label, value }) {
  return (
    <Stack gap="tight" className="scout__hitfact">
      <dt className="scout__controllabel">{label}</dt>
      <dd className="scout__hitvalue">{value}</dd>
    </Stack>
  )
}
