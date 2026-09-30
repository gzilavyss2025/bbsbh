import '../../styles/31d-prospect-card.css'
import { fetchProspectRankHistory, prospectRankView } from '../../api/player/prospectRankHistory.js'
import { useAsync } from '../../hooks/useAsync.js'
import { Card } from '../ui/frame/Card.jsx'

// PROSPECT RANKINGS -- the years a man sat on a top-prospect list, and where
// (issue #1111). A trajectory rather than a fact: "18, 8, 15, 16, 31, 54, then
// the majors" is a story, "was a top prospect" is not.
//
// Sits beside Path to the Majors and wears the same paper shell, because the
// two are one dossier: the level card says where he played, this one says how
// the scouts saw him while he did. On a debuted player's History tab it follows
// that card; on the Overview of a player who has not debuted it follows it
// there (screens/player/PlayerHistoryTab.jsx, screens/PlayerPage.jsx).
//
// The card loads its own frozen file (#1111), so a screen that never mounts it
// (a debuted player's Overview, a pre-debut player's History tab) never fetches.
// It renders nothing until the file arrives. WHAT the rows say, which source
// each year came from, where the debut falls and how the gap after the last
// pulled season reads all live in api/player/prospectRankHistory.js, where they are pure and tested.
// It names no source and no year: a label, a credit and the years covered all
// arrive in the data, so dropping a source from the file changes nothing here.
//
// Renders NOTHING for a player with no ranked year. That is most players -- 982
// have any -- and a player page must be complete without this card.
export function ProspectRankHistoryCard({ playerId, debutYear, currentRank }) {
  const { data: history } = useAsync(() => fetchProspectRankHistory(), [])
  const view = prospectRankView({
    history,
    playerId,
    debutYear,
    currentRank,
    currentSeason: new Date().getFullYear(),
  })
  if (!view) return null

  return (
    <Card frame="ledger" body="flush" className="levelprog prankhist">
      <header className="levelprog__head">
        <h3 className="levelprog__title">Prospect rankings</h3>
      </header>
      <ol className="prankhist__list" aria-label="Prospect ranking by year">
        {view.entries.map((entry) => (
          <Row key={entry.kind === 'rank' ? entry.season : entry.kind} entry={entry} />
        ))}
      </ol>
      {/* The foot is prose, so it reads in the case it was written in. What the
          history covers, then who to thank for it. */}
      <div className="prankhist__foot">
        <p className="prankhist__note">{view.note}</p>
        {view.credits.map((line) => (
          <p key={line} className="prankhist__credit">
            {line}
          </p>
        ))}
      </div>
    </Card>
  )
}

// One line of the trajectory. A rank shows the year, the source that ranked him
// and the rank; a bare number, never "#18". "of 50" says how deep that year's
// list ran, so a top-50 year is not read as a top-100 one.
function Row({ entry }) {
  if (entry.kind === 'debut') {
    return (
      <li className="prankhist__row prankhist__row--mark">
        <span className="prankhist__year">{entry.season}</span>
        <span className="prankhist__label">Debuted</span>
      </li>
    )
  }
  if (entry.kind === 'today') {
    return (
      <li className="prankhist__row prankhist__row--today">
        <span className="prankhist__year">Today</span>
        <span className="prankhist__src">Current list</span>
        <span className="prankhist__rank">{entry.rank}</span>
      </li>
    )
  }
  return (
    <li className="prankhist__row">
      <span className="prankhist__year">{entry.season}</span>
      <span className="prankhist__src">{entry.sourceLabel}</span>
      <span className="prankhist__rank">
        {entry.rank}
        {entry.of ? <span className="prankhist__of"> of {entry.of}</span> : null}
      </span>
    </li>
  )
}
