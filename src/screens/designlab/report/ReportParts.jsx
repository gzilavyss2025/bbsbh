import { useState } from 'react'
import { StatTile } from '../../../components/ui/frame/StatTile.jsx'
import { StatCell, StatStrip } from '../../../components/ui/frame/StatStrip.jsx'
import { LeaderList, LeaderRow } from '../../../components/ui/frame/LeaderList.jsx'
import { ResultCard } from '../../../components/ui/frame/ResultCard.jsx'
import { Meter } from '../../../components/ui/frame/Meter.jsx'
import { Key } from '../../../components/ui/frame/Key.jsx'
import { CornerBadge } from '../../../components/ui/frame/CornerBadge.jsx'
import { Pill } from '../../../components/ui/control/Pill.jsx'
import { Button } from '../../../components/ui/control/Button.jsx'
import { Chips } from '../../../components/ui/control/Chips.jsx'
import { Segmented } from '../../../components/ui/control/Segmented.jsx'
import { Stepper } from '../../../components/ui/control/Stepper.jsx'
import { Switch } from '../../../components/ui/control/Switch.jsx'
import { TeamLogo } from '../../../components/logo/TeamLogo.jsx'
import { Stack } from '../../../components/ui/layout/Stack.jsx'
import { Cluster } from '../../../components/ui/layout/Cluster.jsx'
import { Grid } from '../../../components/ui/layout/Grid.jsx'

// THE REPORT PARTS (ADR-0112): the cards, pills, buttons, meter and key the report
// pages share. Each is the REAL part on invented data, in the order they were
// reviewed: stat band and strip, leader list, result card, corner badge, rank and
// mark pills, chips, row button, stepper, switch, meter and key.
//
// The clubs and every figure are invented. None is a score of a current game.
const DIVISIONS = [
  { value: 'all', label: 'All', count: 30 },
  { value: 'ale', label: 'AL East', count: 5 },
  { value: 'alc', label: 'AL Central', count: 5 },
  { value: 'nlc', label: 'NL Central', count: 5 },
  { value: 'nlw', label: 'NL West', count: 5 },
]
const BOARD = [
  { id: 133, name: 'Athletics', sub: 'AL West', figure: '$298M', state: 'lead' },
  { id: 147, name: 'Yankees', sub: 'AL East', figure: '$281M' },
  { id: 158, name: 'Brewers', sub: 'NL Central', figure: '$263M', state: 'mine' },
  { id: 111, name: 'Red Sox', sub: 'AL East', figure: '$247M' },
]
const mark = (id, name) => <TeamLogo teamId={id} name={name} size={32} />

export function ReportParts() {
  const [division, setDivision] = useState('all')
  const [picked, setPicked] = useState(['2024'])
  const [on, setOn] = useState(true)
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(2025)
  const [side, setSide] = useState('bat')
  return (
    <Stack gap="loose" style={{ width: '100%', minWidth: 0 }}>
      <StatStrip>
        <StatCell label="Clubs sampled" value="30" note="Regular season" />
        <StatCell label="Largest gate" value="48,231" note="Lead" lead />
        <StatCell label="Avg time of game" value="2:41" />
        <StatCell label="Doubleheaders" value="11" />
      </StatStrip>
      <Cluster gap="base">
        <StatTile look="band" label="League payroll" value="$5.2B" caption="30 clubs" />
        <StatTile look="band" lead label="Top club" value="$298M" caption="Athletics" />
        <StatTile tone="soft" className="stattile--compact" label="AVG" value=".312" />
        <StatTile tone="soft" className="stattile--compact" label="OBP" value=".388" />
      </Cluster>

      <LeaderList label="Payroll leaders" count="30 clubs">
        {BOARD.map((r, i) => (
          <LeaderRow key={r.id} rank={i + 1} mark={mark(r.id, r.name)} name={r.name} sub={r.sub} figure={r.figure} unit="payroll" state={r.state} />
        ))}
      </LeaderList>

      <ResultCard
        label="Sample final: Dodgers 5, Yankees 3"
        away={{ mark: mark(147, 'Yankees'), score: 3, tint: 'var(--accent-primary)' }}
        home={{ mark: mark(119, 'Dodgers'), score: 5, winner: true }}
        status="Final"
        note="Game 6"
        bars={[
          { tag: 'WP', name: 'Sample Pitcher', line: '7.0 IP · 9 K' },
          { tag: 'MVP', name: 'Sample Player', line: '2-for-4 · HR · 3 RBI' },
        ]}
        footer={
          <>
            <span>Sample data · Oct 28 · Sample Park</span>
            <Button size="control">Box score</Button>
          </>
        }
      />

      <Cluster gap="base" align="center">
        <CornerBadge host={mark(158, 'Brewers')}>SS</CornerBadge>
        <CornerBadge corner="action" host={mark(133, 'Athletics')}>
          ⤢
        </CornerBadge>
        <Pill figure mark fill="marker">1</Pill>
        <Pill figure mark>12</Pill>
        <Pill figure mark fill="ink">7</Pill>
        <Pill mark fill="ink">x</Pill>
        <Pill mark ink="--accent-positive">y</Pill>
        <Pill mark>CF</Pill>
        <Pill fill="ink">AAA</Pill>
        <Pill ink="--accent-positive">W5</Pill>
        <Pill ink="--accent-negative">L3</Pill>
      </Cluster>

      <Chips label="Division" options={DIVISIONS} value={division} onChange={setDivision} />
      <Chips
        label="Year"
        layout="wrap"
        multiple
        options={['2022', '2023', '2024', '2025'].map((y) => ({ value: y, label: y }))}
        value={picked}
        onChange={setPicked}
      />
      <Segmented
        label="Side"
        value={side}
        onChange={setSide}
        fill
        options={[
          { value: 'bat', label: 'Batting' },
          { value: 'pit', label: 'Pitching' },
          { value: 'fld', label: 'Fielding' },
        ]}
      />
      <Grid min="16rem">
        <Button block hint="Level, age, ETA" icon="›" aria-expanded={open} onClick={() => setOpen(!open)}>
          More filters
        </Button>
        <Button block skin="danger" hint="Clears this device only" icon="›">
          Erase my data
        </Button>
        <Switch label="Show headshots" hint="Turn off to save data" checked={on} onChange={setOn} />
        <Stepper
          label={String(year)}
          prevLabel="Previous year"
          nextLabel="Next year"
          onPrev={() => setYear(year - 1)}
          onNext={() => setYear(year + 1)}
          nextDisabled={year >= 2025}
        />
      </Grid>

      <Meter
        parts={[
          { code: 'Fresh', share: 5, tone: 'good' },
          { code: 'Ltd', share: 2, tone: 'caution' },
          { code: 'Out', share: 1, tone: 'bad' },
        ]}
      />
      <Meter
        parts={[
          { code: 'FB', share: 52, figure: '52%', tone: 'good' },
          { code: 'SL', share: 28, figure: '28%', tone: 'caution' },
          { code: 'OTH', share: 20, figure: '20%', ring: true },
        ]}
      />
      <Key
        items={[
          { label: 'Fresh', tone: 'good' },
          { label: 'Limited', tone: 'caution' },
          { label: 'Down', tone: 'bad' },
        ]}
      />
      <Key
        items={[
          { label: 'Clinched a postseason berth', mark: <Pill mark fill="ink">x</Pill> },
          { label: 'Eliminated', mark: <Pill mark ink="--accent-negative">e</Pill> },
        ]}
      />
    </Stack>
  )
}
