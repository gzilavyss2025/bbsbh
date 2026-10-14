import { useEffect, useState } from 'react'
import '../../../../../styles/player-next/batter/batlog.css'
import { TeamLogo } from '../../../../../components/logo/TeamLogo.jsx'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { FactGrid } from '../../../../../components/ui/frame/FactGrid.jsx'
import { Cluster } from '../../../../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../../../../components/ui/layout/Stack.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { DASH, Fact } from '../../../parts.jsx'
import { LogTable } from '../../parts/LogTable.jsx'
import { COLUMNS, loadBatlog, scopeRows, totalsOf } from './batlogView.js'

// The batter Game Log (#1890, board "BatterGameLog"): his games this season, newest first, a totals
// strip that follows the filter, and each game's pitches seen split into whiffs, fouls and the
// rest. Same look as the pitcher log (../pitchlog). Open surface (ADR-0034): the score shows,
// except for a game on today's date (batlogView.js holds it).
const SHOWN = 8
const SCOPES = [
  ['all', 'All'],
  ['reg', 'Regular season'],
  ['post', 'Postseason'],
]
const games = (n) => `${n} ${n === 1 ? 'game' : 'games'}`
// Bold-equivalent marks: 3+ hits, a homer, 3+ RBI (green); 3+ strikeouts (clay).
const HI = { h: (v) => v >= 3, hr: (v) => v >= 1, rbi: (v) => v >= 3 }
const LO = { k: (v) => v >= 3 }
// A column's class: 2B, 3B, SB and AVG are hidden in the card look (the board drops them there).
const CLASS = { d2: 'batlog__wide', d3: 'batlog__wide', sb: 'batlog__wide', avg: 'batlog__wide', game: 'batlog__game', seen: 'batlog__seen', bar: 'batlog__barcell' }
const SEGS = [
  ['whiffs', 'Whiffs'],
  ['fouls', 'Fouls'],
  ['other', 'Other pitches'],
]

const CELLS = {
  game: (r) => (
    <Cluster as="span" gap="tight" align="center">
      <span className="mono batlog__n">{r.n}</span>
      <b className="batlog__date">{r.date}</b>
      <span className="mono batlog__at">{r.home ? 'vs' : 'at'}</span>
      <TeamLogo teamId={r.oppId} name={r.opp} size={30} />
      <span className="sr-only">{r.opp}</span>
      {r.series && <span className="batlog__tag">{r.series}</span>}
    </Cluster>
  ),
  result: (r) => (
    <Cluster as="span" gap="tight" align="center">
      {r.result ? (
        <span className={`mono batlog__score batlog__score--${r.result}`}>
          {r.result} {r.runs}–{r.oppRuns}
        </span>
      ) : (
        <span className="mono">{DASH}</span>
      )}
      <span className="mono batlog__pos">{r.pos}</span>
    </Cluster>
  ),
  seen: (r) => (
    <span className="mono">
      {r.seen ?? DASH}
      {r.seen != null && <small> pitches seen</small>}
    </span>
  ),
  bar: (r) =>
    r.other == null ? (
      <span className="hint">No whiff or foul counts on file</span>
    ) : (
      <span className="batlog__bar" role="img" aria-label={SEGS.map(([k, name]) => `${name} ${r[k]}`).join(', ')}>
        {SEGS.map(([k]) =>
          r[k] > 0 ? (
            <span key={k} className={`mono batlog__seg batlog__seg--${k}`} style={{ flexGrow: r[k] }}>
              {r[k]}
            </span>
          ) : null,
        )}
      </span>
    ),
}

const TABLE_COLUMNS = COLUMNS.map((c) => ({
  ...c,
  className: CLASS[c.key],
  cell:
    CELLS[c.key] ??
    ((r) => <span className={`mono${HI[c.key]?.(r[c.key]) ? ' batlog__hi' : LO[c.key]?.(r[c.key]) ? ' batlog__lo' : ''}`}>{r[c.key]}</span>),
}))

export default function BatlogModule({ bio, asOf, season, onEmpty, onCount }) {
  const { data: view, loading, error } = useAsync(() => loadBatlog(bio.id, season, asOf), [bio.id, season, asOf])
  const [scope, setScope] = useState('all')
  const [more, setMore] = useState(false)
  const empty = Boolean(error) || (!loading && !view) // a null load (no game, no log) ends the loader
  useEffect(() => {
    if (empty) onEmpty()
  }, [empty, onEmpty])
  useEffect(() => {
    onCount(view ? games(view.rows.length) : undefined)
  }, [view, onCount])

  if (empty) return null
  if (!view) return <div className="batlog batlog--wait" aria-busy="true"><p className="hint">Loading the game log…</p></div>

  const all = view.rows
  const rows = scopeRows(all, scope)
  const post = scopeRows(all, 'post').length
  const t = totalsOf(rows)
  const shown = more ? rows : rows.slice(0, SHOWN)
  // In the All view, a heading over each group, with its count.
  const groups = scope === 'all' && post > 0
  const lines = shown.flatMap((r, i) =>
    groups && (i === 0 || r.post !== shown[i - 1].post)
      ? [{ key: `div-${r.gamePk}`, divider: r.post ? 'Postseason' : 'Regular season', note: games(r.post ? post : all.length - post) }, { ...r, key: r.gamePk }]
      : [{ ...r, key: r.gamePk }],
  )
  const counts = { all: all.length, reg: all.length - post, post }

  return (
    <Stack className="batlog">
      <Cluster align="center" className="batlog__top">
        {post > 0 && (
          <Cluster gap="tight" role="group" aria-label="Show games">
            {SCOPES.map(([id, label]) => (
              <Button key={id} size="control" pressed={id === scope} onClick={() => (setScope(id), setMore(false))}>
                {label} <span className="mono">{counts[id]}</span>
              </Button>
            ))}
          </Cluster>
        )}
        <span className="mono batlog__scope">{season} · newest first</span>
      </Cluster>
      <FactGrid look="strip" as="div" className="batlog__totals">
        <Fact label="Games" value={t.games} mono />
        <Fact label="AVG" value={t.avg} mono />
        <Fact label="OBP" value={t.obp} mono />
        <Fact label="SLG" value={t.slg} mono />
        <Fact label="HR" value={t.hr} mono />
        <Fact label="RBI" value={t.rbi} mono />
      </FactGrid>
      <LogTable columns={TABLE_COLUMNS} rows={lines} caption={`Game log, ${season}`} />
      {rows.length > SHOWN && (
        <Button size="control" onClick={() => setMore(!more)} aria-expanded={more}>
          {more ? 'Show fewer' : `Show all ${games(rows.length)}`}
        </Button>
      )}
      <Cluster as="ul" className="batlog__key">
        {SEGS.map(([k, name]) => (
          <li key={k}>
            <span className={`batlog__sw batlog__seg--${k}`} aria-hidden="true" />
            {name}
          </li>
        ))}
      </Cluster>
      <p className="hint batlog__note">
        Bar: every pitch he saw that game, in the order above. Whiffs are swings and misses. Fouls include foul bunts and foul tips. Other is
        balls, called strikes and balls in play. Green underlined: 3 or more hits, a home run, or 3 or more RBI. Clay underlined: 3 or more
        strikeouts. AVG is the hits per at-bat of that day. Pos is where he played; PH pinch hitter, PR pinch runner.
        {all.some((r) => !r.result) && ' A dash in Result: no final score on file. A game played today shows none until the next day, and so does a suspended game that resumes today (its row keeps the earlier date).'}
      </p>
    </Stack>
  )
}
