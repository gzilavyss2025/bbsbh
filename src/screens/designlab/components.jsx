import { useState } from 'react'
import { Entry, Group } from './Entry.jsx'

// The REAL components, imported and rendered — never a copy of their markup.
// Every prop below is invented: no feed, no gamePk, no score, no live game.
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { BreakableLocation } from '../../components/ui/BreakableLocation.jsx'
import { BuildStamp } from '../../components/ui/BuildStamp.jsx'
import { Door } from '../../components/ui/control/Door.jsx'
import { CopyBox, CopyIconButton } from '../../components/ui/CopyBox.jsx'
import { FlipCard } from '../../components/ui/FlipCard.jsx'
import { InfoPopover } from '../../components/ui/InfoPopover.jsx'
import { Loader } from '../../components/ui/Loader.jsx'
import { MasonryColumns } from '../../components/ui/MasonryColumns.jsx'
import { SectionMasthead } from '../../components/ui/SectionMasthead.jsx'
import { SectionHead } from '../../components/ui/frame/SectionHead.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { headerThemeClass, headerThemeFor, headerThemeStyle } from '../../lib/headerTheme.js'

import { DebutPill } from '../../components/badges/DebutPill.jsx'
import { InjuredMark } from '../../components/badges/InjuredMark.jsx'
import { MilestonePill } from '../../components/badges/MilestonePill.jsx'
import { ProspectPill } from '../../components/badges/ProspectPill.jsx'
import { ProspectTrendPill } from '../../components/badges/ProspectTrendPill.jsx'
import { RookiePill } from '../../components/badges/RookiePill.jsx'
import { TierPill } from '../../components/badges/TierPill.jsx'
import { UmpireTierGlyph } from '../../components/badges/UmpireTierGlyph.jsx'
import { VsLevelSlider } from '../../components/badges/VsLevelSlider.jsx'

import { BackBtn } from '../../components/chrome/BackBtn.jsx'
import { DirectoryHeading } from '../../components/chrome/DirectoryHeading.jsx'
import { HubTabBar } from '../../components/chrome/HubTabBar.jsx'

const UI_PATH = 'src/components/ui'

// The band on the grounds it really lands on (#1113): no club at all, then a
// club root that sets the three --bar-* properties, the way a themed page does.
// The Brewers are the dark bar; the Orioles are the loudest light one.
function Themed({ teamId, className = '', children }) {
  const theme = teamId ? headerThemeFor(teamId, 'main') : null
  return (
    <div className={`${className} ${headerThemeClass(theme)}`.trim()} style={headerThemeStyle(theme)}>
      {children}
    </div>
  )
}

// The card in composition (#1113): the three the spec names, then the frame
// and body pairs they leave out. A sheet with a club band head over a flush
// table, a ledger with a label head over a padded body, and a tile that is the
// tap target. Every class is the Card's own or a real table's; nothing here is
// drawn for the lab.
function CardDemo() {
  return (
    <div className="dlab__candidates">
      <Themed teamId={158}>
        <Card
          body="flush"
          head={
            <SectionHead look="band" club as="span" note="season">
              Sheet, band head, flush
            </SectionHead>
          }
        >
          <table className="bs__grid">
            <thead>
              <tr>
                <th className="bs__nameCol">Pos</th>
                <th>G</th>
                <th>GS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="bs__nameCol">LF</td>
                <td>112</td>
                <td>108</td>
              </tr>
              <tr>
                <td className="bs__nameCol">CF</td>
                <td>31</td>
                <td>24</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </Themed>
      <Card
        frame="ledger"
        head={
          <SectionHead look="label" as="span" note="org rank">
            Ledger, label head, padded
          </SectionHead>
        }
      >
        <span className="dlab__filler">{sample}</span>
      </Card>
      <Card as="button" frame="ledger" accent="--accent-primary" onClick={() => {}}>
        <span className="dlab__filler">Interactive tile: hover it, tab to it</span>
      </Card>
      <Card>
        <span className="dlab__filler">Sheet, no head, padded</span>
      </Card>
      <Card frame="ledger" body="flush">
        <span className="dlab__filler">Ledger, no head, flush</span>
      </Card>
    </div>
  )
}

const sample = 'Bottom 9th, two out'

function SectionHeadDemo() {
  return (
    <>
      <SectionHead look="label" as="span" note="regular season" action={<Door onClick={() => {}}>See all</Door>}>
        Team leaders
      </SectionHead>
      <SectionHead look="rule" as="span" note="percentile rank">
        Statcast
      </SectionHead>
      <SectionHead look="band" as="span" note="no club">
        Bullpen health
      </SectionHead>
      <Themed teamId={158}>
        <SectionHead look="band" as="span" action={<InfoPopover label="What is this?">A demo.</InfoPopover>}>
          Batting order
        </SectionHead>
      </Themed>
      <Card
        body="flush"
        head={
          <SectionHead look="band" club as="span" note="entering Sep 25">
            Club head, no club
          </SectionHead>
        }
      />
      {[158, 110].map((id) => (
        <Themed key={id} teamId={id}>
          <Card
            body="flush"
            head={
              <SectionHead look="band" club as="span" note="entering Sep 25" action={<Door onClick={() => {}}>Full season</Door>}>
                Club head, themed
              </SectionHead>
            }
          />
        </Themed>
      ))}
    </>
  )
}
const BADGE_PATH = 'src/components/badges'
const CHROME_PATH = 'src/components/chrome'

function FlipDemo() {
  const [flipped, setFlipped] = useState(false)
  return (
    <button type="button" className="dlab__plain" onClick={() => setFlipped((f) => !f)}>
      <FlipCard
        flipped={flipped}
        renderFront={() => <div className="gamecard"><span className="dlab__filler">Front — tap</span></div>}
        renderBack={() => <div className="gamecard"><span className="dlab__filler">Back</span></div>}
      />
    </button>
  )
}

function SliderDemo() {
  const [value, setValue] = useState(1)
  return <VsLevelSlider value={value} onChange={setValue} ariaLabel="Level" />
}

export function ComponentHalf() {
  return (
    <>
      <Group
        title="src/components/ui — 14 shared components"
        lede="The whole shared tier. Button and Door share control/, and Button has its own band above. Against 32 card blocks and 10 pill blocks, this is the ratio #1112 exists to state."
      >
        <Entry title="Loader" path={`${UI_PATH}/Loader.jsx`} note="The shared cold-load loader — a mini linescore whose cell cycles. size=&quot;inline&quot; here.">
          <Loader size="inline" />
        </Entry>
        <Entry title="AsyncStatus" path={`${UI_PATH}/AsyncGate.jsx`} note="The loading/error/empty states every fetching screen shares. Shown in its error state.">
          <AsyncStatus loading={false} error={new Error('Nothing posted yet')} data={null} noun="lineup" />
        </Entry>
        <Entry
          title="SectionHead"
          path={`${UI_PATH}/frame/SectionHead.jsx`}
          note="The one head (#1113), three looks. The label: graphite caps on a hairline. The rule: the label, then a pencil rule to the note (the player page's sub-heads). The band: the house navy and kraft with no club, the club's own bar under a themed root. With club, a band that is a plain label until a club colour arrives: the team hub's card heads and the player page's section bars."
        >
          <SectionHeadDemo />
        </Entry>
        <Entry
          title="Card"
          path={`${UI_PATH}/frame/Card.jsx`}
          wide
          note="The one card (#1113). Two frames: the sheet (md radius, the card shadow) and the ledger (sm radius, no shadow). A head is a SectionHead or nothing; the body is padded or flush. As a link or a button, the whole card is the tap target and its accent tints the hover. Card owns no margin: the space between cards is the parent's."
        >
          <CardDemo />
        </Entry>
        <Entry title="SectionMasthead" path={`${UI_PATH}/SectionMasthead.jsx`} note="A thin wrapper over the SectionHead band, kept for its sixteen call sites. No logo passed here, so it draws its undressed state.">
          <SectionMasthead title="Milwaukee" />
        </Entry>
        <Entry title="Door" path={`${UI_PATH}/control/Door.jsx`} note="The app&#39;s one door — &quot;there is more behind this&quot;. Inline is the text link and writes its own chevron; block is the row that closes a list, and carries none.">
          <Door onClick={() => {}}>Game lines</Door>
          <Door layout="block" onClick={() => {}}>Show 12 more former teammates</Door>
        </Entry>
        <Entry title="InfoPopover" path={`${UI_PATH}/InfoPopover.jsx`} note="The tap-to-explain control. There are no native title tooltips in this app — they are invisible on touch.">
          <InfoPopover label="What is this?">A run expectancy figure, from the 24 base-out states.</InfoPopover>
        </Entry>
        <Entry title="CopyBox / CopyIconButton" path={`${UI_PATH}/CopyBox.jsx`}>
          <CopyBox text="gamePk 776543" label="Game id" />
          <CopyIconButton text="gamePk 776543" label="Copy game id" />
        </Entry>
        <Entry title="FlipCard" path={`${UI_PATH}/FlipCard.jsx`} note="The 3D container behind the slate's result card. Tap it. Its .flipcard class is one declaration: perspective.">
          <FlipDemo />
        </Entry>
        <Entry title="BreakableLocation" path={`${UI_PATH}/BreakableLocation.jsx`} note="Wraps a long place name at a sensible point instead of overflowing.">
          <BreakableLocation text="Sahlen Field, Buffalo, New York" />
        </Entry>
        <Entry title="MasonryColumns" path={`${UI_PATH}/MasonryColumns.jsx`}>
          {/* The component keys what children() returns (#1127), so this call
              does not have to — which is the point of the fix. */}
          <MasonryColumns items={[1, 2, 3, 4]} columnWidth={90} gap={8}>
            {(n) => <div className="playercard"><span className="dlab__filler">Card {n}</span></div>}
          </MasonryColumns>
        </Entry>
        <Entry title="BuildStamp" path={`${UI_PATH}/BuildStamp.jsx`} note="The footer's build marker.">
          <BuildStamp />
        </Entry>
        <Entry
          title="ModalPortal"
          path={`${UI_PATH}/ModalPortal.jsx`}
          note="Not rendered here. It portals its children OUTSIDE #root, which is exactly why the caps invariant needs a separate exemption for the focus rail's sheet. A catalog entry that opened a modal over the catalog would hide the catalog."
        />
      </Group>

      <Group
        title="src/components/badges — 11 components, nine of them a pill"
        lede="UmpireTierPill.jsx is a four-line re-export of TierPill.jsx, so eleven files are ten components."
      >
        <Entry title="MilestonePill" path={`${BADGE_PATH}/MilestonePill.jsx`} verdict="Canonical pill" tone="canon">
          <MilestonePill text="3,000th hit" />
        </Entry>
        <Entry title="RookiePill" path={`${BADGE_PATH}/RookiePill.jsx`} verdict="Merge — tone" tone="merge">
          <RookiePill active />
        </Entry>
        <Entry title="ProspectPill" path={`${BADGE_PATH}/ProspectPill.jsx`} verdict="Merge — tone" tone="merge">
          <ProspectPill rank={12} orgRank={2} orgTeamName="Milwaukee" />
        </Entry>
        <Entry title="DebutPill" path={`${BADGE_PATH}/DebutPill.jsx`} verdict="Leave" tone="leave" note="Carries the shell only — it holds an icon, not type.">
          <DebutPill debuted="2026-04-11" />
        </Entry>
        <Entry title="TierPill" path={`${BADGE_PATH}/TierPill.jsx`} verdict="Merge — outline" tone="merge" note="All four tiers. UmpireTierPill.jsx re-exports this file unchanged.">
          <TierPill tier="elite" />
          <TierPill tier="good" />
          <TierPill tier="average" />
          <TierPill tier="below" />
        </Entry>
        <Entry title="InjuredMark" path={`${BADGE_PATH}/InjuredMark.jsx`}>
          <InjuredMark hurt={{ description: '10-day injured list' }} />
        </Entry>
        <Entry title="UmpireTierGlyph" path={`${BADGE_PATH}/UmpireTierGlyph.jsx`}>
          <UmpireTierGlyph tier="good" rank={18} total={89} />
        </Entry>
        <Entry title="ProspectTrendPill" path={`${BADGE_PATH}/ProspectTrendPill.jsx`} note="Renders nothing for an unqualified row — shown qualified here.">
          <ProspectTrendPill
            entry={{ group: 'hitting', percentile: 78, qualified: true, sampleSize: 240, movement: { direction: 'up', amount: 6 } }}
            level="AA"
          />
        </Entry>
        <Entry title="VsLevelSlider" path={`${BADGE_PATH}/VsLevelSlider.jsx`}>
          <SliderDemo />
        </Entry>
        <Entry
          title="RadarPill"
          path={`${BADGE_PATH}/RadarPill.jsx`}
          note="Not rendered. It reads a precomputed Fever Radar entry (a board, a playerId and a movement), and inventing one would put a made-up board on the page. Its .radarpill class owns no base rule — it is a namespace, like the card namespaces."
        />
      </Group>

      <Group
        title="src/components/chrome — the reusable controls"
        lede="The rest of chrome/ is the site frame — header, footer, menu, search — which is page furniture rather than a component anyone composes with."
      >
        <Entry title="BackBtn" path={`${CHROME_PATH}/BackBtn.jsx`}>
          <BackBtn onClick={() => {}} />
        </Entry>
        <Entry title="DirectoryHeading" path={`${CHROME_PATH}/DirectoryHeading.jsx`} note="The A–Z rail's letter heading.">
          <DirectoryHeading group="M" />
        </Entry>
        <Entry
          title="HubTabBar"
          path={`${CHROME_PATH}/HubTabBar.jsx`}
          wide
          note="The team and player hubs share this strip so the two cannot drift. Issues #1105 and #1108 turn it into a sticky jump bar — it is built once, there, and consumed here."
        >
          <HubTabBar
            tabs={[
              { key: 'overview', label: 'Overview' },
              { key: 'roster', label: 'Roster' },
              { key: 'schedule', label: 'Schedule' },
              { key: 'stats', label: 'Stats' },
            ]}
            active="overview"
            ariaLabel="Design lab sample tabs"
            pathFor={() => '/design-lab'}
          />
        </Entry>
      </Group>
    </>
  )
}
