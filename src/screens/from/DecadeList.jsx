import { useLayoutEffect, useRef, useState } from 'react'
import { balanceColumns } from '../../lib/from/facts.js'
import { PlayerLink } from '../../components/player/PlayerLink.jsx'
import { HubTabBar } from '../../components/chrome/HubTabBar.jsx'
import { Table } from '../../components/ui/table/Table.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'

// The sticky bar's height at 390px (measured: one row that scrolls sideways), so a tap lands a decade under it. Keep in
// step with `.fromdec` scroll-margin-top in styles/from/place.css.
const BAR_H = 68
// A column is at least this wide, so two fit from about 740px. Never more than two.
const COLUMN = 320
const GAP = 16
const MAX_COLUMNS = 2

// One card to a decade, the newest first, under a jump bar that follows the reader (#1526, SPEC
// §9.2, §9.5). Every name opens the player's page. A card is one table of [Player, Pos, Debut].
// From about 740px the cards sit in two columns, each card in the column with fewer rows so far.
// The jump bar sticks only in one column: from 740px it wraps to two rows in its box, tall enough to
// cover the card it jumps to.
const posOf = (pos) => (pos && pos !== 'X' ? pos : '—')

function DecadeCard({ group }) {
  const n = group.players.length
  return (
    <Card frame="stamped" label={`${group.decade}s`} count={`${n} ${n === 1 ? 'player' : 'players'}`} body="flush" id={`decade-${group.decade}`} className="fromdec">
      <Table frame="bare" className="fromdec__table">
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Pos</th>
            <th scope="col">Debut</th>
          </tr>
        </thead>
        <tbody>
          {group.players.map(([id, name, pos, year]) => (
            <tr key={id}>
              <th scope="row" className="fromdec__name">
                <PlayerLink id={id} name={name}>{name}</PlayerLink>
              </th>
              <td className="fromdec__pos">{posOf(pos)}</td>
              <td className="fromdec__year">{year}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  )
}

// How many columns the container fits, measured BEFORE the first paint. The shared useColumnCount
// measures in an effect, so a wide screen painted one frame of one column and then jumped to two.
function useColumns() {
  const ref = useRef(null)
  const [cols, setCols] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    const measure = () => setCols(Math.min(MAX_COLUMNS, Math.max(1, Math.floor((el.clientWidth + GAP) / (COLUMN + GAP)))))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, cols]
}

export function DecadeList({ groups }) {
  const [ref, cols] = useColumns()
  const columns = balanceColumns(groups, cols, (g) => g.players.length + 2)
  return (
    <>
      {/* One decade has nothing to jump to: a sticky bar with a single tab only covers content. */}
      {groups.length > 1 && (
        <HubTabBar
          variant="anchor"
          ariaLabel="Decades"
          offset={cols === 1 ? BAR_H : 0}
          className={cols === 1 ? 'fromplace__jump' : ''}
          tabs={groups.map((g) => ({ key: `decade-${g.decade}`, label: `${g.decade}s`, count: g.players.length }))}
        />
      )}
      <div ref={ref} className="fromplace__cols" style={{ '--from-cols': cols }}>
        {columns.map((cards, c) => (
          <div key={c} className="fromplace__col">
            {cards.map((g) => (
              <DecadeCard key={g.decade} group={g} />
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
