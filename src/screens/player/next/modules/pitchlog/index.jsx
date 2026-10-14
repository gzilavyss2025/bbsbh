import { useEffect, useState } from 'react'
import '../../../../../styles/player-next/pitcher/pitchlog.css'
import { TeamLogo } from '../../../../../components/logo/TeamLogo.jsx'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { Door } from '../../../../../components/ui/control/Door.jsx'
import { FactGrid } from '../../../../../components/ui/frame/FactGrid.jsx'
import { Cluster } from '../../../../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../../../../components/ui/layout/Stack.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { splitDisplayName } from '../../../../../api/person/identity.js'
import { pitchMark } from '../../../../../lib/pitch/pitchTypes.js'
import { DASH, Fact } from '../../../parts.jsx'
import { LogTable } from '../../parts/LogTable.jsx'
import { earlierSeason, games, keyOf, linesOf, loadPitchlog, scopeRows, totalsOf } from './pitchlogView.js'
import { StartDetail } from './StartDetail.jsx'

// The pitcher Game Log (#1851, board "GameLog"): his games this season, starts and relief outings,
// newest first, a totals row that follows the filter, and each game's pitch mix. A row opens the
// game detail view (StartDetail.jsx). "Load earlier season" adds one season back per press; the
// filter and the totals span every loaded season. Open surface
// (ADR-0034, ADR-0110): the score and decision show, except for a game on today's date
// (pitchlogView.js holds it).
const SHOWN = 5
const SCOPES = [
  ['all', 'All'],
  ['reg', 'Regular season'],
  ['post', 'Postseason'],
]
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
        <Door className="pitchlog__open" data-pk={r.gamePk} aria-label={`Open game, ${r.date} ${r.home ? 'vs' : 'at'} ${r.opp}`}>
          {r.date}
        </Door>
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
        {r.pitches != null && r.strikes != null && <small> ({r.strikes} S/{r.pitches - r.strikes} B)</small>}
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
  const [earlier, setEarlier] = useState([]) // [{ season, rows }], newest first
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(null) // the gamePk in the detail view
  const empty = Boolean(error) || (!loading && !view) // a null load (no game, no log) ends the loader
  const blocks = view ? [{ season, rows: view.rows }, ...earlier] : []
  const all = blocks.flatMap((b) => b.rows)
  useEffect(() => {
    if (empty) onEmpty()
  }, [empty, onEmpty])
  useEffect(() => {
    onCount(all.length ? games(all.length) : undefined)
  }, [all.length, onCount])

  if (empty) return null
  if (!view) return <div className="pitchlog pitchlog--wait" aria-busy="true"><p className="hint">Loading the game log…</p></div>

  const rows = scopeRows(all, scope)
  const post = scopeRows(all, 'post').length
  const t = totalsOf(rows)
  const lines = linesOf(blocks, scope, more ? Infinity : SHOWN)
  const shown = lines.filter((l) => !l.divider)
  const codes = keyOf(shown)
  const counts = { all: all.length, reg: all.length - post, post }
  const next = earlierSeason(blocks.map((b) => b.season), bio.debut)
  const oldest = blocks.at(-1).season
  const span = oldest === season ? season : `${oldest}–${season}`
  const loadEarlier = () => {
    setBusy(true)
    setMore(true)
    loadPitchlog(bio.id, next, asOf)
      .catch(() => null)
      .then((v) => {
        setEarlier((e) => [...e, { season: next, rows: v?.rows ?? [] }])
        setBusy(false)
      })
  }
  const at = rows.findIndex((r) => r.gamePk === open)
  const close = () => {
    setOpen(null)
    document.querySelector(`.pitchlog__open[data-pk="${open}"]`)?.focus()
  }

  return (
    <Stack className="pitchlog" onClick={(e) => {
        const pk = e.target.closest?.('.pitchlog__open')?.dataset.pk
        if (pk) setOpen(Number(pk))
      }}>
      <Cluster align="center" className="pitchlog__top">
        <Cluster gap="tight" align="center">
          {next != null && (
            <Button size="control" onClick={loadEarlier} busy={busy}>
              {busy ? `Loading ${next}…` : 'Load earlier season'}
            </Button>
          )}
          {post > 0 && (
            <Cluster gap="tight" role="group" aria-label="Show games">
              {SCOPES.map(([id, label]) => (
                <Button key={id} size="control" pressed={id === scope} onClick={() => setScope(id)}>
                  {label} <span className="mono">{counts[id]}</span>
                </Button>
              ))}
            </Cluster>
          )}
        </Cluster>
        <span className="mono pitchlog__scope">{span} · newest first</span>
      </Cluster>
      <FactGrid look="strip" as="div" className="pitchlog__totals">
        <Fact label="Games" value={t.games} mono />
        <Fact label="W–L" value={`${t.w}–${t.l}`} mono />
        <Fact label="ERA" value={t.era} mono />
        <Fact label="IP" value={t.ip} mono />
        <Fact label="K" value={t.k} mono />
        <Fact label="BB" value={t.bb} mono />
      </FactGrid>
      <LogTable columns={COLUMNS} rows={lines} caption={`Game log, ${span}`} />
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
              <span className="mono">{pitchMark(code).name}</span>
            </li>
          ))}
        </Cluster>
      )}
      <p className="hint pitchlog__note">
        Bar: the share of each pitch type in the tracked pitches of the game, in the order of the key. Green underlined K: 7 or more. Clay
        underlined ER: 4 or more. Dec is his decision: W win, L loss, SV save, ND no decision in a start.
        {all.some((r) => !r.result) && ' A dash in Result: no final score on file. A game played today shows none until the next day, and so does a suspended game that resumes today (its row keeps the earlier date).'}
        {' '}Tap a game to open it.
      </p>
      {at >= 0 && (
        <StartDetail
          key={open}
          row={rows[at]}
          pitcherId={bio.id}
          last={splitDisplayName(bio.fullName).last}
          onEarlier={
            at < rows.length - 1
              ? () => {
                  setMore(true) // the row it opens may sit past the collapsed list
                  setOpen(rows[at + 1].gamePk)
                }
              : null
          }
          onLater={at > 0 ? () => setOpen(rows[at - 1].gamePk) : null}
          onClose={close}
        />
      )}
    </Stack>
  )
}
