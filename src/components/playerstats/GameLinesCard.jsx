import { BoxLinesDoor } from '../boxlines/BoxLinesDoor.jsx'
import { SectionTitle } from '../ui/SectionTitle.jsx'
import { cardFacetsFor, SECTIONS } from '../../api/boxlines/cardFacets.js'
import { chipLine, doorLine, fetchDoorLabels } from '../../api/boxlines/careerSplits.js'
import { useAsync } from '../../hooks/useAsync.js'

// GAME LINES — the player page's ledger of doors (ADR-0069, issue #997). Each
// row is a career line under one FACET — at home, at night, in July, on a
// Sunday, off the bench — and opens the game-by-game rows that add up to it.
// The card exists so each facet issue is one entry in a registry rather than a
// card and a data path of its own. Twenty-odd of them are lit: Home and Road
// (#1004, #1005), Day and Night (#1000), a pitcher's Started and In relief
// (#1003's pitcher half), the Postseason (#1006), the eight months (#999), the
// seven weekdays (#1001) and a hitter's Pinch hitting (#1002).
//
// THE DOORS ARE A REGISTRY, and it lives in api/boxlines/cardFacets.js — pure
// data, so the suite can check every entry against the same facetPlan the
// sheet uses. Add a door there, not here. This file only draws them.
//
// IT DRAWS THEM UNDER FOUR HEADINGS, and it takes the headings and their order
// from SECTIONS rather than from the registry's own order, so a door added in
// the wrong place files itself correctly instead of quietly reordering the
// card. The headings arrived with the month and weekday doors: seven doors
// needed none, twenty do. A heading with no door under it does not render, so
// a pitcher's card has no "How he got in" until he has both a start and a
// relief outing, and a MiLB player still has no card at all.
//
// TWO SHAPES OF DOOR. A ledger row carries the whole career line; a chip
// carries a short one and sits in a row with its siblings. Only the weekdays
// are chips, because only they are a comparison — see BoxLinesDoor.
//
// AND TWO KINDS OF FIGURE. Most doors print a five-figure career line; a
// hitter's Started and Came in print a game count alone, because the source
// that knows how often he was on the card is a FIELDING career and it carries
// no batting average. `doorLine` picks, so this file does not have to.
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
  // October has no Postseason door, a March call-up no March door, and a MiLB
  // player no doors at all.
  const doors = rows
    .map((r) => ({ row: r, stat: data.get(r.key) }))
    .filter(({ stat }) => stat && Number(stat.gamesPlayed) > 0)
  if (!doors.length) return null

  const sheetFor = (row) => ({
    personId,
    playerSurname,
    group,
    facet: row.facet,
    kicker: row.kicker,
    title: row.title(playerSurname),
    footNote: row.footNote ?? null,
    cutoff: asOf ?? null,
  })

  return (
    <div className="gamelines">
      <SectionTitle title="Game lines" note="career" />
      {SECTIONS.map((section) => {
        const mine = doors.filter(({ row }) => row.section === section.key)
        if (!mine.length) return null
        const ledger = mine.filter(({ row }) => !row.chip)
        const chips = mine.filter(({ row }) => row.chip)
        return (
          <div className="gamelines__section" key={section.key}>
            <h4 className="gamelines__heading">{section.title}</h4>
            {ledger.length > 0 && (
              <ul className="gamelines__rows">
                {ledger.map(({ row, stat }) => (
                  <li className="gamelines__row" key={row.key}>
                    <BoxLinesDoor
                      className="gamelines__door"
                      label={`${row.label}: ${doorLine(row, stat, group)}`}
                      sheet={sheetFor(row)}
                    />
                  </li>
                ))}
              </ul>
            )}
            {chips.length > 0 && (
              <ul className="gamelines__chips">
                {chips.map(({ row, stat }) => (
                  <li key={row.key}>
                    <BoxLinesDoor
                      className="gamelines__chip"
                      // The full line, for the sheet's headline and the
                      // button's accessible name; the chip shows the short one.
                      label={`${row.label}: ${doorLine(row, stat, group)}`}
                      chip={{ name: row.short, line: chipLine(stat, group) }}
                      sheet={sheetFor(row)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
