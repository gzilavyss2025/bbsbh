import { selectGameInfo, selectOfficials } from '../../../api/select.js'
import { headerThemeClass, headerThemeStyle } from '../../../lib/headerTheme.js'
import { Stack } from '../../../components/ui/layout/Stack.jsx'
import { LineupDock } from './LineupDock.jsx'
import { LineupFacts } from './LineupFacts.jsx'
import { LineupHero } from './LineupHero.jsx'
import { LineupJumpBar } from './LineupJumpBar.jsx'
import { BullpenCard } from './cards/BullpenCard.jsx'
import { FieldCard } from './cards/FieldCard.jsx'
import { OrderCard } from './cards/OrderCard.jsx'
import { SeriesCard } from './cards/SeriesCard.jsx'
import { StarterCard } from './cards/StarterCard.jsx'
import { TeammatesCard } from './cards/TeammatesCard.jsx'
import { useLineupData } from './useLineupData.js'
import { lineupIdentity } from './lineupIdentity.js'
import { useLineupSeries } from './useLineupSeries.js'
import '../../../styles/lineup-next/page.css'
import '../../../styles/lineup-next/starter.css'
import '../../../styles/lineup-next/order.css'
import '../../../styles/lineup-next/field.css'
import '../../../styles/lineup-next/series.css'

// The new lineup page (docs/lineup-redesign.md), at `?look=new` on lineup1 and lineup2.
// It takes the props TeamInfo takes, plus the game chrome the live page leaves to GameView
// (tabs, keep-awake), so GameView swaps one page for the other. An open page like the
// live one: nothing here is a score. The slices S2 to S6 add the cards under the facts.
export function LineupNextPage({
  feed, side, game, tabs, onSection, isLive, keepAwake, onSetKeepAwake, officialDate, onSketch,
  manager, uniform, uniformFigure, treatment, oppTreatment, broadcast, scorebookWeather, scorebookWeatherLoading,
  oppPitcherLine, vsTeam, prospectsData, rookiesData, formerTeammatesData, careerMatchupsData, workloadData, callouts,
  onNext, nextLabel, onCatchUp = null, onReload, loading, lastUpdated,
}) {
  const id = lineupIdentity(feed, side, treatment, oppTreatment)
  const info = selectGameInfo(feed)
  const officials = selectOfficials(feed)
  const series = useLineupSeries(feed, officialDate)
  const data = {
    gamePk: feed?.gamePk,
    ...useLineupData({ feed, side, vsTeam, careerMatchupsData, workloadData, formerTeammatesData, oppPitcherLine }),
    prospectsData,
    rookiesData,
    callouts,
  }
  return (
    <div className={`lnext ${headerThemeClass(id.theme)}`.trim()} style={headerThemeStyle(id.theme, id.masthead.scale)}>
      <Stack gap="section" className="lnext__page">
        <LineupHero id={id} side={side} treatment={treatment} info={info} series={series} gamePk={game.gamePk} feed={feed} onSketch={onSketch}>
        <LineupFacts
          feed={feed}
          side={side}
          info={info}
          officials={officials}
          season={id.season}
          manager={manager}
          uniform={uniform}
          uniformFigure={uniformFigure}
          broadcast={broadcast}
          weather={scorebookWeather}
          weatherLoading={scorebookWeatherLoading}
        />
        </LineupHero>
        <LineupJumpBar tabs={tabs} onSection={onSection} />
        <StarterCard data={data} theme={id.oppTheme} masthead={id.oppMasthead} />
        <OrderCard data={data} masthead={id.masthead} />
        <FieldCard data={data} theme={id.oppTheme} masthead={id.oppMasthead} />
        <SeriesCard data={data} />
        <BullpenCard data={data} workloadData={workloadData} />
        <TeammatesCard data={data} side={side} />
        <LineupDock
          onReload={onReload}
          loading={loading}
          lastUpdated={lastUpdated}
          isLive={isLive}
          keepAwake={keepAwake}
          onSetKeepAwake={onSetKeepAwake}
          onCatchUp={onCatchUp}
          onNext={onNext}
          nextLabel={nextLabel}
        />
      </Stack>
    </div>
  )
}
