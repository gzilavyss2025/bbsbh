import { useEffect, useState } from 'react'
import '../../../../../styles/player-next/pitcher/pitchlog.css'
import { TeamLogo } from '../../../../../components/logo/TeamLogo.jsx'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { FactGrid } from '../../../../../components/ui/frame/FactGrid.jsx'
import { Cluster } from '../../../../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../../../../components/ui/layout/Stack.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { pitchMark } from '../../../../../lib/pitch/pitchTypes.js'
import { DASH, Fact } from '../../../parts.jsx'
import { LogTable } from '../../parts/LogTable.jsx'
import { keyOf, loadPitchlog, scopeRows, totalsOf } from './pitchlogView.js'

// The pitcher Game Log (#1851, board "GameLog"): his games this season, starts and relief outings,
// newest first, a totals row that follows the filter, and each game's pitch mix. Open surface
// (ADR-0034, ADR-0110): the score and decision show, except for a game on today's date
// (pitchlogView.js holds it).
const SHOWN = 5
const SCOPES = [
  ['all', 'All'],
  ['reg', 'Regular season'],
  ['post', 'Postseason'],
]
const games = (n) => `${n} ${n === 1 ? 'game' : 'games'}`
const HI = { k: (v) => v >= 7, er: (v) => v >= 4 }
// The family shape of each pitch (pitchTypes.js), on a 22-unit box.
const SHAPE = {
  circle: 'M11 2.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17Z',
  diamond: 'M11 1.5L20.5 11L11 20.5L1.5 11Z',
  square: 'M3.5 3.5H18.5V18.5H3.5Z',
  triangle: 'M11 2L20.5 19.5H1.5Z',
  hexagon: 'M6 2.5H16L20.5 11L16 19.5H6L1.5 11Z',
}

function Mark({ code }) {
  const m = pitchMark(code)
  return (
    <svg className="pitchlog__mark" viewBox="0 0 22 22" aria-hidden="true">
      <path d={SHAPE[m.shape]} fill={m.ring ? 'none' : m.color} stroke={m.ring ? m.color : undefined} />
    </svg>
  )
}

const stat = (key, label) => ({
  key,
  label,
  card: 'cell',
  cell: (r) => <span className={`mono${HI[key]?.(r[key]) ? ` pitchlog__hi pitchlog__hi--${key}` : ''}`}>{r[key]}</span>,
})

const COLUMNS = [
  {
    key: 'game',
    label: 'Game',
    card: 'head',
    cell: (r) => (
      <Cluster as="span" gap="tight" align="center">
        <span className="mono pitchlog__n">{r.n}</span>
        <b className="pitchlog__date">{r.date}</b>
        <span className="mono pitchlog__at">{r.home ? 'vs' : 'at'}</span>
        <TeamLogo teamId={r.oppId} name={r.opp} size={30} />
        <span className="sr-only">{r.opp}</span>
        {r.series && <span className="pitchlog__tag">{r.series}</span>}
        {r.relief && <span className="pitchlog__tag pitchlog__tag--relief">Relief</span>}
      </Cluster>
    ),
  },
  {
    key: 'result',
    label: 'Result · Dec',
    card: 'end',
    cell: (r) =>
      r.result ? (
        <Cluster as="span" gap="tight" align="center">
          <span className={`mono pitchlog__score pitchlog__score--${r.result}`}>
            {r.result} {r.runs}–{r.oppRuns}
          </span>
          {r.dec ? <span className={`mono pitchlog__dec pitchlog__dec--${r.dec}`}>{r.dec}</span> : <span className="mono">{DASH}</span>}
        </Cluster>
      ) : (
        <span className="mono">{DASH}</span>
      ),
  },
  stat('ip', 'IP'),
  stat('h', 'H'),
  stat('r', 'R'),
  stat('er', 'ER'),
  stat('bb', 'BB'),
  stat('k', 'K'),
  stat('hr', 'HR'),
  {
    key: 'pitches',
    label: 'Pitches',
    card: 'foot',
    className: 'pitchlog__pc',
    cell: (r) => (
      <span className="mono">
        {r.pitches ?? DASH}
        {r.pitches != null && r.strikes != null && <small> {r.strikes} strikes</small>}
      </span>
    ),
  },
  {
    key: 'mix',
    label: 'Pitch mix',
    card: 'foot',
    className: 'pitchlog__mixcell',
    cell: (r) =>
      r.mix ? (
        <span className="pitchlog__mix" role="img" aria-label={`Pitch mix: ${r.mix.map((m) => `${pitchMark(m.code).name} ${m.n}`).join(', ')}`}>
          {r.mix.map((m) => (
            <span key={m.code} className="mono pitchlog__seg" title={`${pitchMark(m.code).name} ${m.n} (${m.pct}%)`} style={{ flexGrow: m.n, background: pitchMark(m.code).color }}>
              {m.pct >= 13 ? m.pct : ''}
            </span>
          ))}
        </span>
      ) : (
        <span className="hint">No pitch mix on file</span>
      ),
  },
]

export default function PitchlogModule({ bio, asOf, season, onEmpty, onCount }) {
  const { data: view, loading, error } = useAsync(() => loadPitchlog(bio.id, season, asOf), [bio.id, season, asOf])
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
  if (!view) return <div className="pitchlog pitchlog--wait" aria-busy="true"><p className="hint">Loading the game log…</p></div>

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
  const codes = keyOf(shown)
  const counts = { all: all.length, reg: all.length - post, post }

  return (
    <Stack className="pitchlog">
      <Cluster align="center" className="pitchlog__top">
        {post > 0 && (
          <Cluster gap="tight" role="group" aria-label="Show games">
            {SCOPES.map(([id, label]) => (
              <Button key={id} size="control" pressed={id === scope} onClick={() => setScope(id)}>
                {label} <span className="mono">{counts[id]}</span>
              </Button>
            ))}
          </Cluster>
        )}
        <span className="mono pitchlog__scope">{season} · newest first</span>
      </Cluster>
      <FactGrid look="strip" as="div" className="pitchlog__totals">
        <Fact label="Games" value={t.games} mono />
        <Fact label="W–L" value={`${t.w}–${t.l}`} mono />
        <Fact label="ERA" value={t.era} mono />
        <Fact label="IP" value={t.ip} mono />
        <Fact label="K" value={t.k} mono />
        <Fact label="BB" value={t.bb} mono />
      </FactGrid>
      <LogTable columns={COLUMNS} rows={lines} caption={`Game log, ${season}`} />
      {rows.length > SHOWN && (
        <Button size="control" onClick={() => setMore(!more)} aria-expanded={more}>
          {more ? 'Show fewer' : `Show all ${games(rows.length)}`}
        </Button>
      )}
      {codes.length > 0 && (
        <Cluster as="ul" className="pitchlog__key">
          {codes.map((code) => (
            <li key={code}>
              <Mark code={code} />
              <span className="mono">{code}</span> {pitchMark(code).name}
            </li>
          ))}
        </Cluster>
      )}
      <p className="hint pitchlog__note">
        Bar: the share of each pitch type in the tracked pitches of the game, in the order of the key. Green underlined K: 7 or more. Clay
        underlined ER: 4 or more. Dec is his decision: W win, L loss, SV save, ND no decision in a start.
        {all.some((r) => !r.result) && ' A dash in Result: no final score on file. A game played today shows none until the next day, and so does a suspended game that resumes today (its row keeps the earlier date).'}
      </p>
    </Stack>
  )
}
