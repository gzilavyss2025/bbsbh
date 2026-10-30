import { useEffect, useState } from 'react'
import { fetchPostseasonByRound } from '../../../../api/player/postseasonRegister.js'
import { Ledger } from '../../../../components/player/Ledger.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { SectionHead } from '../../../../components/ui/frame/SectionHead.jsx'
import { StatTile } from '../../../../components/ui/frame/StatTile.jsx'
import { Stack } from '../../../../components/ui/layout/Stack.jsx'
import { roleWord } from '../../parts.jsx'
import { roundRows } from './overviewView.js'
import '../../../../styles/player-next/top/overview-extras.css'
// The row that opens (seasonmod__year, reg-round) is the Season card's; its sheet is imported here too.
import '../../../../styles/player-next/both/season.css'

// One row of compact tiles (Gary, 2026-10-30: the card took too much room). `head` replaces the
// section head's note, for the postseason switch.
function TileRow({ title, note, tiles, head }) {
  return (
    <Stack gap="snug">
      {(title || head) && (
        <div className="pnext-ext__head">
          {title ? <SectionHead look="rule" as="span" note={note}>{title}</SectionHead> : <span />}
          {head}
        </div>
      )}
      <div className="pnext-ext__tiles">
        {tiles.map((t) => <StatTile key={t.k} label={t.k} value={t.v} className="stattile--compact" />)}
      </div>
    </Stack>
  )
}

// One table, the season's postseason line. Tapping its "Postseason" cell opens one row per round
// under it, read on that first tap (Gary, 2026-10-30: no Total | By round switch; the Season card's
// year rows open the same way).
function Postseason({ block, playerId, season, cutoff }) {
  const ps = block.postseason
  const [open, setOpen] = useState(false)
  const [rounds, setRounds] = useState(undefined)
  useEffect(() => {
    if (!open || rounds !== undefined) return undefined
    let live = true
    fetchPostseasonByRound(playerId, block.group, { season, cutoff })
      .catch(() => null)
      .then((r) => live && setRounds(r))
    return () => { live = false }
  }, [open, rounds, playerId, block.group, season, cutoff])
  const rows = open && rounds ? roundRows(rounds, block.group, block.role) : []
  const keys = ps.tiles.map((t) => t.k)
  const label = (
    <button type="button" className="seasonmod__year" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
      Postseason
      <span className="seasonmod__chev" aria-hidden="true">{open ? '▾' : '▸'}</span>
    </button>
  )
  return (
    <Stack gap="snug">
      <Ledger
        label={ps.title}
        leftCols={1}
        head={['', 'G', ...keys]}
        hideNarrow={ps.tiles.flatMap((t, i) => (t.wide ? [i + 2] : []))}
        // The postseason line leads, and its rounds open under it (Gary, 2026-10-30), as the
        // Season card's year rows do.
        rows={[
          { key: 'post', cells: [label, ps.games, ...ps.tiles.map((t) => t.v)] },
          ...rows.map((r) => ({ key: r.gameType, className: 'reg-round', cells: [<span key="round" className="reg-round__name">{r.series}</span>, r.games, ...keys.map((k) => r.tiles.find((t) => t.k === k)?.v ?? '—')] })),
        ]}
      />
      {open && rounds === undefined && <p className="hint">Loading the rounds…</p>}
      {open && rounds === null && <p className="hint">No round split on file.</p>}
    </Stack>
  )
}

// The third top card (#2010), under the tiles: October (one table that opens by round), and an up-and-down
// player's other levels. The league-rank chips left it (Gary, 2026-10-30), so it shows only for a
// player with a postseason or another level this season, and is named for what it holds: the card's
// own name says "Postseason", so the group under it carries no second head.
export function OverviewExtras({ blocks, season, playerId, cutoff }) {
  const mine = blocks.filter((b) => b.postseason || b.otherLevels?.length)
  if (!mine.length) return null
  const ps = mine.find((b) => b.postseason)?.postseason
  return (
    <Card
      frame="stamped"
      label={ps ? `${season} Postseason` : `${season} other levels`}
      count={ps ? `${ps.games} G` : undefined}
      className="pnext__slot"
    >
      <Stack gap="base" className="pnext-ext">
        {mine.map((b) => (
          <Stack key={b.group} gap="snug">
            {blocks.length > 1 && <h3 className="pnext__rowlabel">{b.title}</h3>}
            <div className="pnext-ext__cols">
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
