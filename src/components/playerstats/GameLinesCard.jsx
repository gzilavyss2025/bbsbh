import { BoxLinesDoor } from '../boxlines/BoxLinesDoor.jsx'
import { SectionTitle } from '../ui/SectionTitle.jsx'
import { careerSplitLine, fetchCareerSplits } from '../../api/boxlines/careerSplits.js'
import { useAsync } from '../../hooks/useAsync.js'

// GAME LINES — the player page's ledger of doors (ADR-0069, issue #997). Each
// row is a career line under one FACET — at home, at night, in July, at one
// park — and opens the game-by-game rows that add up to it. The card exists so
// the nine queued facet issues (#998–#1006) are each one entry in the registry
// below rather than nine cards with nine data paths.
//
// HOW TO ADD A FACET. Push one entry onto FACET_ROWS:
//
//   { sitCode: 'h', label: 'Home', kicker: 'Game lines · home',
//     facet: { kind: 'side', home: true }, groups: ['hitting', 'pitching'] }
//
// `sitCode` is the statsapi situation code whose CAREER row supplies the
// label's figures (api/boxlines/careerSplits.js fetches every code on the card
// in one call); `facet` is the question the sheet asks of the game log
// (api/boxlines/facets.js). Nothing else changes: the fetch, the gate, the
// sheet and this card's dress are already here. A facet whose code returns no
// row, or a row of 0 games, drops out on its own — which is also how MiLB
// degrades, since these codes answer for MLB service only.
//
// IT SHIPS EMPTY, AND THAT IS THE POINT. #997 is the foundation; every row
// belongs to a facet issue of its own. With no entries the card fetches
// nothing and renders nothing, so the player page is byte-for-byte unchanged
// until the first facet lands.
//
// SPOILER FOOTING. The labels are CAREER aggregates, open on this page the way
// the Splits vs team card's are (ADR-0034 — a stat line is not a score). The
// rows behind each door carry final scores and are gated in
// api/boxlines/rows.js, which is handed the page's `?d=` as its cutoff. This
// component holds no date logic; it passes `asOf` through.
//
// "Box Lines" is the internal name for this drilldown and never renders: the
// card is titled "Game lines", and each door says the house "See all ›".
const FACET_ROWS = []

export function GameLinesCard({ personId, playerSurname, group, asOf }) {
  const rows = FACET_ROWS.filter((r) => r.groups.includes(group))
  // One request for every door's label — and none at all while the registry is
  // empty, so an unlit card costs the page nothing.
  const codes = rows.map((r) => r.sitCode)
  const key = codes.join(',')
  const { data } = useAsync(
    () => (personId && key ? fetchCareerSplits(personId, group, codes) : Promise.resolve(null)),
    // key IS codes, by value — the array would be a new identity every render.
    [personId, group, key],
  )
  if (!rows.length || !data) return null

  const doors = rows
    .map((r) => ({ row: r, stat: data.get(r.sitCode) }))
    .filter(({ stat }) => stat && Number(stat.gamesPlayed) > 0)
  if (!doors.length) return null

  return (
    <div className="gamelines">
      <SectionTitle title="Game lines" note="career" />
      <ul className="gamelines__rows">
        {doors.map(({ row, stat }) => (
          <li className="gamelines__row" key={row.sitCode}>
            <BoxLinesDoor
              className="gamelines__door"
              label={`${row.label}: ${careerSplitLine(stat, group)}`}
              sheet={{
                personId,
                playerSurname,
                group,
                facet: row.facet,
                kicker: row.kicker,
                title: `${playerSurname} — ${row.label}`,
                cutoff: asOf ?? null,
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
