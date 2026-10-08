import '../../styles/postseason/primer-rail.css'
import { BATTING_CATEGORIES, SERIES_PITCHING_CATEGORIES } from '../../api/postseasonSeries.js'
import { leaderRows } from '../../lib/postseason/primer/leaderRows.js'
import { teamAbbr } from '../../lib/teams.js'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { Table } from '../ui/table/Table.jsx'

// SERIES LEADERS, LEDGER FORM — the primer's right column (ADR-0087,
// 2026-10-08 addendum). The team hub's leaders ledger (TeamLeadersLedger.jsx),
// fed by a series instead of a club: two blocks, Batting then Pitching, each a
// Table of Category, Leader, Stat. It reuses that ledger's `.tledg*` rules (in
// the core sheet), so the two read as one table; only the club tile is new.
//
// A category with three or fewer players lists all of them, high to low; with
// more it lists the leader only (lib/postseason/primer/leaderRows.js). A
// category with no entry draws no row, and a block with no rows draws nothing.
//
// Draw-only, on loadSeriesStats's box-score sums, which hold counted games
// only (api/postseasonSeries.js, spoiler-free in the manifest).
//
//   batting    loadSeriesStats's `batting`:  { [category key]: Entry[] }
//   pitching   loadSeriesStats's `pitching`, same shape
//   games      counted games, for the head's note; omit for no note
//
// An Entry is { id, name, teamId, display, value }.
function blockRows(stats, categories) {
  return categories.flatMap((category) =>
    leaderRows(stats?.[category.key]).map((entry, i) => ({ category, entry, first: i === 0 })),
  )
}

export function SeriesLeadersLedger({ batting, pitching, games = 0 }) {
  const blocks = [
    { key: 'batting', label: 'Batting', rows: blockRows(batting, BATTING_CATEGORIES) },
    { key: 'pitching', label: 'Pitching', rows: blockRows(pitching, SERIES_PITCHING_CATEGORIES) },
  ].filter((block) => block.rows.length > 0)
  if (blocks.length === 0) return null

  return (
    <section className="tledg">
      <SectionHead look="label" note={games ? `${games} played` : undefined}>
        Series leaders
      </SectionHead>
      <div className="tledg__blocks">
        {blocks.map((block) => (
          <Card key={block.key} body="flush" className="tledg__block">
            <h4 className="tledg__block-title">{block.label}</h4>
            <Table frame="bare" density="row" className="tledg__rows">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Leader</th>
                  <th>Stat</th>
                </tr>
              </thead>
              <tbody>
                {block.rows.map(({ category, entry, first }) => (
                  <tr key={`${category.key}-${entry.id}`}>
                    {/* Later rows of one category hold the code for a screen
                        reader only, so a column of codes is not a column of
                        repeats. */}
                    <td className="tledg__cat">{first ? category.short : <span className="sr-only">{category.short}</span>}</td>
                    <td className="tledg__leader">
                      <span className="tledg__who">
                        <PlayerLink id={entry.id} className="tledg__name">
                          {entry.name}
                        </PlayerLink>
                        <TeamLogo teamId={entry.teamId} name="" size={20} className="pbrail__club" />
                        <span className="sr-only">{teamAbbr({ id: entry.teamId })}</span>
                      </span>
                    </td>
                    <td className="tledg__val">{entry.display}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ))}
      </div>
    </section>
  )
}
