import { BoxLinesDoor } from '../boxlines/BoxLinesDoor.jsx'
import { SectionTitle } from '../ui/SectionTitle.jsx'
import { cardFacetsFor } from '../../api/boxlines/cardFacets.js'
import { careerSplitLine, fetchDoorLabels } from '../../api/boxlines/careerSplits.js'
import { useAsync } from '../../hooks/useAsync.js'

// GAME LINES — the player page's ledger of doors (ADR-0069, issue #997). Each
// row is a career line under one FACET — at home, at night, in July, at one
// park — and opens the game-by-game rows that add up to it. The card exists so
// each facet issue (#998–#1006) is one entry in a registry rather than nine
// cards with nine data paths. Seven of them are lit: Home and Road (#1004,
// #1005), Day and Night (#1000), a pitcher's Started and In relief (#1003's
// pitcher half), and the Postseason (#1006).
//
// THE DOORS ARE A REGISTRY, and it lives in api/boxlines/cardFacets.js — pure
// data, so the suite can check every entry against the same facetPlan the
// sheet uses. Add a door there, not here. This file only draws them.
//
// SPOILER FOOTING. The labels are CAREER aggregates, open on this page the way
// the Splits vs team card's are (ADR-0034 — a stat line is not a score). The
// rows behind each door carry final scores and are gated in
// api/boxlines/rows.js, which is handed the page's `?d=` as its cutoff. This
// component holds no date logic; it passes `asOf` through.
//
// "Box Lines" is the internal name for this drilldown and never renders: the
// card is titled "Game lines", and each door says the house "See all ›".

export function GameLinesCard({ personId, playerSurname, group, asOf }) {
  const rows = cardFacetsFor(group)
  // ONE request for every situation door's label, whatever the count, plus one
  // per door whose line is a career under a game type (careerSplits.js). A
  // group with no doors asks nothing.
  const key = rows.map((r) => r.key).join(',')
  const { data } = useAsync(
    () => (personId && key ? fetchDoorLabels(personId, group, rows) : Promise.resolve(null)),
    // key IS rows, by value — the array would be a new identity every render.
    [personId, group, key],
  )
  if (!rows.length || !data) return null

  // A door with no games behind it does not exist: a hitter who never reached
  // October has no Postseason door, the way a MiLB player has no doors at all.
  const doors = rows
    .map((r) => ({ row: r, stat: data.get(r.key) }))
    .filter(({ stat }) => stat && Number(stat.gamesPlayed) > 0)
  if (!doors.length) return null

  return (
    <div className="gamelines">
      <SectionTitle title="Game lines" note="career" />
      <ul className="gamelines__rows">
        {doors.map(({ row, stat }) => (
          <li className="gamelines__row" key={row.key}>
            <BoxLinesDoor
              className="gamelines__door"
              label={`${row.label}: ${careerSplitLine(stat, group)}`}
              sheet={{
                personId,
                playerSurname,
                group,
                facet: row.facet,
                kicker: row.kicker,
                title: row.title(playerSurname),
                footNote: row.footNote ?? null,
                cutoff: asOf ?? null,
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
