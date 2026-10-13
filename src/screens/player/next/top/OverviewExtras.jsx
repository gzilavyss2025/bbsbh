import { Card } from '../../../../components/ui/frame/Card.jsx'
import { SectionHead } from '../../../../components/ui/frame/SectionHead.jsx'
import { StatTile } from '../../../../components/ui/frame/StatTile.jsx'
import { Grid } from '../../../../components/ui/layout/Grid.jsx'
import { Stack } from '../../../../components/ui/layout/Stack.jsx'
import { RankChips, roleWord } from '../../parts.jsx'
import { hasExtras } from '../heroData.js'

function TileRow({ title, note, tiles }) {
  return (
    <Stack gap="snug">
      <SectionHead look="rule" as="h4" note={note}>{title}</SectionHead>
      <Grid min="6rem">
        {tiles.map((t) => <StatTile key={t.k} label={t.k} value={t.v} />)}
      </Grid>
    </Stack>
  )
}

// The third top card (TbdWire "Overview extras"), under the tiles: league-rank chips, this
// October's row and an up-and-down player's other levels. They ride the overview blocks the
// tiles read. Hides when no block has any.
export function OverviewExtras({ blocks, year }) {
  const mine = blocks.filter(hasExtras)
  if (!mine.length) return null
  return (
    <Card frame="stamped" label="Overview extras" className="pnext__slot pnext__top">
      <Stack gap="base">
        {mine.map((b) => (
          <Stack key={b.group} gap="snug">
            {blocks.length > 1 && <h3 className="pnext__rowlabel">{b.title}</h3>}
            <RankChips ranks={b.ranks} />
            {b.postseason && <TileRow title={`${year} Postseason`} note={`${b.postseason.games} G`} tiles={b.postseason.tiles} />}
            {b.otherLevels?.map((lvl) => (
              <TileRow
                key={lvl.sportId}
                title={lvl.level}
                note={[b.group === 'pitching' && lvl.role ? roleWord(lvl.role) : null, 'this season'].filter(Boolean).join(' · ')}
                tiles={lvl.tiles}
              />
            ))}
          </Stack>
        ))}
      </Stack>
    </Card>
  )
}
