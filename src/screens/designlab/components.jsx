import { useState } from 'react'
import { Entry, Group } from './Entry.jsx'

// The REAL components, imported and rendered — never a copy of their markup.
// Every prop below is invented: no feed, no gamePk, no score, no live game.
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { BreakableLocation } from '../../components/ui/BreakableLocation.jsx'
import { BuildStamp } from '../../components/ui/BuildStamp.jsx'
import { Door } from '../../components/ui/Door.jsx'
import { CopyBox, CopyIconButton } from '../../components/ui/CopyBox.jsx'
import { FlipCard } from '../../components/ui/FlipCard.jsx'
import { InfoPopover } from '../../components/ui/InfoPopover.jsx'
import { Loader } from '../../components/ui/Loader.jsx'
import { MasonryColumns } from '../../components/ui/MasonryColumns.jsx'
import { SectionMasthead } from '../../components/ui/SectionMasthead.jsx'
import { SectionTitle } from '../../components/ui/SectionTitle.jsx'

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
        title="src/components/ui — 12 shared components"
        lede="The whole shared tier, 472 lines. Against 32 card blocks and 10 pill blocks, this is the ratio #1112 exists to state."
      >
        <Entry title="Loader" path={`${UI_PATH}/Loader.jsx`} note="The shared cold-load loader — a mini linescore whose cell cycles. size=&quot;inline&quot; here.">
          <Loader size="inline" />
        </Entry>
        <Entry title="AsyncStatus" path={`${UI_PATH}/AsyncGate.jsx`} note="The loading/error/empty states every fetching screen shares. Shown in its error state.">
          <AsyncStatus loading={false} error={new Error('Nothing posted yet')} data={null} noun="lineup" />
        </Entry>
        <Entry title="SectionTitle" path={`${UI_PATH}/SectionTitle.jsx`} note="A section heading with an optional note and a right-hand action.">
          <SectionTitle title="Team leaders" note="Regular season" action={<Door onClick={() => {}}>See all</Door>} />
        </Entry>
        <Entry title="SectionMasthead" path={`${UI_PATH}/SectionMasthead.jsx`} note="The club-dressed band. No logo passed here, so it draws its undressed state.">
          <SectionMasthead title="Milwaukee" />
        </Entry>
        <Entry title="Door" path={`${UI_PATH}/Door.jsx`} note="The app&#39;s one door — &quot;there is more behind this&quot;. Inline is the text link and writes its own chevron; block is the row that closes a list, and carries none.">
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
