import { useEffect, useState } from 'react'
import { fetchPostseasonByRound } from '../../../../api/player/postseasonRegister.js'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { SectionHead } from '../../../../components/ui/frame/SectionHead.jsx'
import { StatTile } from '../../../../components/ui/frame/StatTile.jsx'
import { Cluster } from '../../../../components/ui/layout/Cluster.jsx'
import { Grid } from '../../../../components/ui/layout/Grid.jsx'
import { Stack } from '../../../../components/ui/layout/Stack.jsx'
import { roleWord } from '../../parts.jsx'
import { hasExtras } from '../heroData.js'
import { chipsView, countTag, nextLit, roundRows } from './overviewView.js'
import '../../../../styles/player-next/top/overview-extras.css'

function TileRow({ title, note, tiles }) {
  return (
    <Stack gap="snug">
      <SectionHead look="rule" as="span" note={note}>{title}</SectionHead>
      <Grid min="7rem">
        {tiles.map((t) => <StatTile key={t.k} label={t.k} value={t.v} />)}
      </Grid>
    </Stack>
  )
}

// Rank chips as buttons: a chip with a hero tile lights it; one without (R, 2B) says so.
function Ranks({ block, lit, onLight }) {
  const [bare, setBare] = useState(null)
  const tap = (key, tile) => {
    setBare(tile ? null : key)
    onLight(nextLit(lit, block.group, tile))
  }
  return (
    <Stack gap="snug">
      <SectionHead look="rule" as="span" note="top 10">League rank</SectionHead>
      {chipsView(block).map((r) => (
        <Cluster key={r.league} className="pnext-ext__chips">
          {r.items.map((it) => {
            const key = `${r.league}:${it.label}`
            const on = it.tile ? lit?.group === block.group && lit.tile === it.tile : bare === key
            return (
              <button key={key} type="button" className="pnext-pick" aria-pressed={on} onClick={() => tap(key, it.tile)}>
                <strong className="pnext-ext__ord">{it.text}</strong>
                {` ${r.league} · ${it.label}${r.club ? ` · with ${r.club}` : ''}`}
              </button>
            )
          })}
        </Cluster>
      ))}
      {bare && <p className="hint" role="status">No hero tile shows this stat, so none lights.</p>}
    </Stack>
  )
}

// The Total row, or one row per round. The rounds load only when the switch asks, and the Total
// row stays up (dimmed) meanwhile, so the group holds its height.
function Postseason({ block, playerId, season, cutoff }) {
  const ps = block.postseason
  const [scope, setScope] = useState('total')
  const [rounds, setRounds] = useState(undefined)
  useEffect(() => {
    if (scope !== 'rounds' || rounds !== undefined) return undefined
    let live = true
    fetchPostseasonByRound(playerId, block.group, { season, cutoff })
      .catch(() => null)
      .then((r) => live && setRounds(r))
    return () => { live = false }
  }, [scope, rounds, playerId, block.group, season, cutoff])
  const rows = scope === 'rounds' && rounds ? roundRows(rounds, block.group, block.role) : null
  return (
    <Stack gap="snug">
      <Cluster className="pnext-ext__switch" role="group" aria-label="Postseason scope">
        {[['total', 'Total'], ['rounds', 'By round']].map(([key, label]) => (
          <button key={key} type="button" className="pnext-pick" aria-pressed={scope === key} onClick={() => setScope(key)}>{label}</button>
        ))}
      </Cluster>
      {rows ? rows.map((r) => <TileRow key={r.gameType} title={r.series} note={`${r.games} G`} tiles={r.tiles} />) : (
        <div className="pnext-ext__total" aria-busy={scope === 'rounds' && rounds === undefined}>
          <TileRow title={ps.title} note={`${ps.games} G`} tiles={ps.tiles} />
        </div>
      )}
      {scope === 'rounds' && rounds === null && <p className="hint">No round split on file.</p>}
    </Stack>
  )
}

// The third top card (#2010), under the tiles: this season's league-rank chips (they light a hero
// tile), October (Total | By round) and an up-and-down player's other levels. They ride the
// overview blocks the tiles read. Each group hides when empty; so does the card.
export function OverviewExtras({ blocks, lit, onLight, season, playerId, cutoff }) {
  const mine = blocks.filter(hasExtras)
  if (!mine.length) return null
  return (
    <Card frame="stamped" label={`${season} extras`} count={countTag(mine)} className="pnext__slot">
      <Stack gap="base" className="pnext-ext">
        {mine.map((b) => (
          <Stack key={b.group} gap="snug">
            {blocks.length > 1 && <h3 className="pnext__rowlabel">{b.title}</h3>}
            <div className="pnext-ext__cols">
              {b.ranks?.length > 0 && <Ranks block={b} lit={lit} onLight={onLight} />}
              {b.postseason && <Postseason block={b} playerId={playerId} season={season} cutoff={cutoff} />}
              {b.otherLevels?.length > 0 && (
                <Stack gap="snug">
                  <SectionHead look="rule" as="span">{`Other levels · ${season}`}</SectionHead>
                  {b.otherLevels.map((lvl) => (
                    <TileRow
                      key={lvl.sportId}
                      title={lvl.level}
                      note={b.group === 'pitching' && lvl.role ? roleWord(lvl.role) : undefined}
                      tiles={lvl.tiles}
                    />
                  ))}
                </Stack>
              )}
            </div>
          </Stack>
        ))}
      </Stack>
    </Card>
  )
}
