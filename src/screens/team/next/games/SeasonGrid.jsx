import { Fragment, useMemo, useState } from 'react'
import { TeamLogo } from '../../../../components/logo/TeamLogo.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { Chips } from '../../../../components/ui/control/Chips.jsx'
import { Pill } from '../../../../components/ui/control/Pill.jsx'
import { Cluster } from '../../../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../../../components/ui/layout/Stack.jsx'
import { useNav, useRouteLink } from '../../../../lib/nav.js'
import { teamStampInPath } from '../../../../lib/route.js'
import { GRID_DAYS, buildSeasonGrid, filterOptions, matchesFilter } from './seasonGrid.js'

// THE SEASON GRID (the Games band): the whole schedule as one calendar, a week to a row, seven days across,
// from a phone to the 960px wide column. A game is a link: a decided one opens its box score,
// one still to play opens the lineup. Solid is a win, hollow a loss, dashed is to play, gold is the
// page's own day. The gold band is the postseason, and it exists only when the club has played in
// October (a club with none just ends). The model is `seasonGrid.js`.
//
// This card is also the ONLY door to /team/{id}/stamp-in (ADR-0042): the Schedule card carried it
// before, and one entry point is the design.
//
// Open surface (ADR-0034): every result here was cut at `?d=` by the loader, and nothing is sealed.
export function SeasonGrid({ teamId, asOf, sportId, schedule, allStarGame, refDate, count, style }) {
  const link = useRouteLink()
  const navigate = useNav()
  const [filter, setFilter] = useState('all')
  const grid = useMemo(() => buildSeasonGrid(schedule, allStarGame, refDate), [schedule, allStarGame, refDate])
  if (!grid) return null

  return (
    <Card frame="stamped" label="Games" count={count} stampIn className="sgrid" style={style}>
      <Cluster gap="snug" align="center" className="sgrid__bar">
        <Chips
          label="Filter games"
          options={filterOptions(grid)}
          value={filter}
          onChange={setFilter}
          className="sgrid__chips"
        />
        {/* The one door to Stamp In (ADR-0042): a season of results opens only from here. */}
        <Pill
          role="control"
          fill="ink"
          className="sgrid__stamp"
          onClick={() => navigate(teamStampInPath(teamId, { d: asOf, s: sportId }))}
        >
          Stamp In
        </Pill>
      </Cluster>

      <Cluster gap="base" rowGap="tight" align="center" as="ul" className="sgrid__legend" aria-label="Key">
        <li className="sgrid__key">
          <span className="sgrid__swatch sgrid__swatch--w" aria-hidden="true" />
          Win
        </li>
        <li className="sgrid__key">
          <span className="sgrid__swatch sgrid__swatch--l" aria-hidden="true" />
          Loss
        </li>
        <li className="sgrid__key">
          <span className="sgrid__swatch sgrid__swatch--next" aria-hidden="true" />
          Today
        </li>
        <li className="sgrid__key">
          <span className="sgrid__swatch sgrid__swatch--todo" aria-hidden="true" />
          To play
        </li>
        <li className="sgrid__key">@ away</li>
        {grid.doubleHeaders > 0 && (
          <li className="sgrid__key">
            <span className="sgrid__swatch sgrid__swatch--split" aria-hidden="true" />
            Doubleheader, game 1 on top
          </li>
        )}
      </Cluster>

      <div className="sgrid__sheet">
        <div className="sgrid__days" aria-hidden="true">
          <span />
          {GRID_DAYS.map((d) => (
            <span key={d} className="sgrid__day">
              {d}
            </span>
          ))}
        </div>
        <Stack gap="tight" className="sgrid__weeks">
          {grid.weeks.map((w) => (
            <Fragment key={w.key}>
              {w.postLead && <div className="sgrid__band">Postseason</div>}
              <div className={`sgrid__week${w.post ? ' sgrid__week--post' : ''}`}>
                <span className="sgrid__mon">{w.label}</span>
                {w.days.map((day) => (
                  <div key={day.date} className="sgrid__cell">
                    {day.games.map((g) => (
                      <a
                        key={g.key}
                        className={`sgrid__game sgrid__game--${g.state}${g.post ? ' sgrid__game--post' : ''}${matchesFilter(g, filter) ? '' : ' sgrid__game--dim'}`}
                        aria-label={g.label}
                        {...link(g.path)}
                      >
                        {g.logo ? (
                          <span className="sgrid__opp">
                            {!g.isHome && <span className="sgrid__at">@</span>}
                            <TeamLogo teamId={g.opponentId} name={g.opponentName} size={22} variant="mono" className="sgrid__logo" />
                          </span>
                        ) : (
                          <span className="sgrid__mark">{g.mark}</span>
                        )}
                        {g.score && <span className="sgrid__score">{g.score}</span>}
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            </Fragment>
          ))}
        </Stack>
      </div>
    </Card>
  )
}
