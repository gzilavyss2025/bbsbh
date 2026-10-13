import '../../../styles/designlab/stamped.css'
import { useState } from 'react'
import { Card } from '../../../components/ui/frame/Card.jsx'
import { FactGrid } from '../../../components/ui/frame/FactGrid.jsx'
import { StatTile } from '../../../components/ui/frame/StatTile.jsx'
import { Button } from '../../../components/ui/control/Button.jsx'
import { Cluster } from '../../../components/ui/layout/Cluster.jsx'
import { Grid } from '../../../components/ui/layout/Grid.jsx'
import { Stack } from '../../../components/ui/layout/Stack.jsx'

// THE PLAYER PAGE'S SHARED PARTS (#1882; docs/player-redesign.md, section 3):
// the stamped card with its name tab and count tag, the stat tile in its three
// fills, the fact strip, and the stamp-in. Each is the REAL part, on invented
// data. No live page uses them yet.
//
// The player, the club and every figure are invented. None is a score.
const FACTS = [
  ['Bats / Throws', 'L / R'],
  ['Age', '27'],
  ['Ht / Wt', '6′ 1″ 195'],
  ['Born', 'Fall River, MA'],
  ['MLB debut', '04/11/22'],
  ['Draft', '2019 · Rd 2 #48'],
]

const TILES = [
  { label: 'AVG · 2026', value: '.284', caption: 'Lead tile', tone: 'ink' },
  { label: 'HR', value: '18', caption: 'Tint tile', tone: 'tint' },
  { label: 'RBI', value: '77', caption: 'Plain tile' },
  { label: 'SO', value: '132', caption: '611 PA' },
  { label: 'WAR', value: '4.1', caption: 'Invented' },
]

const FIRSTS = [
  ['MLB debut', '4/11/22'],
  ['First hit', '4/12/22'],
  ['First home run', '4/20/22'],
  ['First stolen base', '5/2/22'],
]

export function StampedParts() {
  // Replay remounts the parts, so the stamp-in runs again from zero.
  const [run, setRun] = useState(0)
  return (
    <Stack gap="section" className="stamplab" key={run}>
      <Cluster align="center">
        <Button size="control" onClick={() => setRun((n) => n + 1)}>Replay the stamp-in</Button>
      </Cluster>

      <Card frame="stamped" body="flush" stampIn>
        <Stack gap="tight" className="stamplab__who">
          <p className="stamplab__kicker">Batter · #7</p>
          <h4 className="stamplab__name">Ray Tolliver</h4>
          <p className="stamplab__club">Harbor City Gulls · 2B</p>
        </Stack>
        <FactGrid look="strip">
          {FACTS.map(([label, value]) => (
            <div className="fact" key={label}>
              <dt className="fact__label">{label}</dt>
              <dd className="fact__value">{value}</dd>
            </div>
          ))}
        </FactGrid>
      </Card>

      <Grid min="9rem" gap="loose">
        {TILES.map((t, i) => (
          <StatTile
            key={t.label}
            label={t.label}
            value={t.value}
            caption={t.caption}
            tone={t.tone}
            stampIn
            style={{ '--stamp-delay': `${60 + i * 40}ms` }}
          />
        ))}
      </Grid>

      <Card frame="stamped" body="flush" label="Firsts" count={`${FIRSTS.length} firsts`} labelAs="h4" stampIn className="stamplab__named">
        <ul className="stamplab__rows">
          {FIRSTS.map(([label, date]) => (
            <li key={label} className="stamplab__row">
              <span className="stamplab__rowlabel">{label}</span>
              <span className="stamplab__rowdate">{date}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card frame="stamped" label="Name tab only" labelAs="h4" stampIn className="stamplab__named">
        <p className="stamplab__copy">
          A stamped card with a padded body. The name tab is the card&rsquo;s heading, so a screen reader names the
          card by it.
        </p>
      </Card>
    </Stack>
  )
}
