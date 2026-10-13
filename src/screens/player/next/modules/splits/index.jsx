import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { SectionHead } from '../../../../../components/ui/frame/SectionHead.jsx'
import { Stack } from '../../../../../components/ui/layout/Stack.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { splitDisplayName } from '../../../../../api/person.js'
import { Flag, Head, Row } from './LineRows.jsx'
import { GameLines } from './GameLines.jsx'
import { VsTeam } from './VsTeam.jsx'
import { loadCareer, loadGameLines, loadSplits, loadVsTeam } from './splitsData.js'
import { gameLinesView, handTable, scopeText, seasonChoices, sitTable } from './splitsView.js'
import '../../../../../styles/player-next/both/splits.css'
import './parts.css'

const SCOPES = [['R', 'Regular'], ['P', 'Postseason'], ['A', 'All']]

// The Splits module (#1886; boards Splits and PitcherSplits): a season and scope bar over four
// parts — by handedness, situational, splits vs team, game lines. The first two follow the bar;
// the last two are the career. A pitcher opens on a menu of the four and shows the ones picked.
export default function SplitsModule({ bio, role, asOf, season, onEmpty, onCount }) {
  const group = role === 'pitching' ? 'pitching' : 'hitting'
  const pitching = group === 'pitching'
  const surname = splitDisplayName(bio.fullName).last
  const choices = seasonChoices(season, Number(String(bio.debut ?? '').slice(0, 4)) || null)
  const [picked, setPicked] = useState(null)
  const [wanted, setWanted] = useState('R')
  const [sitAll, setSitAll] = useState(false)
  const [focus, setFocus] = useState('')
  const [ready, setReady] = useState(false)
  const key = picked ?? String(season)
  // October is not cut by a date and the career holds it: a dated page asks for neither.
  const postOk = !asOf || (key !== 'career' && Number(key) < Number(season))
  const scope = postOk ? wanted : 'R'

  // The season he never played has no splits: until he picks, open the career instead.
  const splits = useAsync(async () => {
    let rows = await loadSplits(bio.id, group, key, scope)
    let shown = key
    if (!rows.length && picked === null && scope === 'R') {
      rows = await loadSplits(bio.id, group, 'career', 'R')
      shown = 'career'
    }
    setReady(true)
    return { rows, key: shown }
  }, [bio.id, group, key, scope, picked])
  const vs = useAsync(() => loadVsTeam(bio.id, group), [bio.id, group])
  const lines = useAsync(() => loadGameLines(bio.id, group), [bio.id, group])
  const career = useAsync(() => loadCareer(bio.id, group), [bio.id, group])

  const shown = splits.data?.key ?? key
  const text = scopeText(shown, scope)
  const tables = useMemo(() => {
    if (!splits.data) return null
    const hand = handTable(splits.data.rows, group, text.base)
    return { hand, sit: sitTable(splits.data.rows, group, text.base, hand?.baseSide, scope === 'P' ? 1 : 4) }
  }, [splits.data, group, text.base, scope])
  const glView = useMemo(
    () => (lines.data && career.data ? gameLinesView(lines.data, career.data, group) : null),
    [lines.data, career.data, group],
  )

  // Nothing at all: no splits even for the career, no vs-team shard, no game lines.
  const none = !splits.loading && (Boolean(splits.error) || Boolean(tables && !tables.hand && !tables.sit))
  const settled = !vs.loading && !lines.loading && !career.loading
  const empty = none && scope === 'R' && shown === 'career' && settled && !vs.data && !glView
  useEffect(() => {
    if (empty) onEmpty()
  }, [empty, onEmpty])
  const pa = tables?.hand?.base.count
  useEffect(() => {
    if (!tables) return
    onCount(pa ? `${pa} ${pitching ? 'BF' : 'PA'}` : undefined)
  }, [pa, pitching, tables, onCount])

  if (empty) return null
  if (!ready && !splits.error) return <div className="splitsmod splitsmod--wait" aria-busy="true" />

  const show = (id) => !pitching || focus === id || focus === 'all'
  const hand = tables?.hand
  const sit = tables?.sit
  const sitOps = (code) => sit?.groups.flatMap((g) => g.rows).find((r) => r.key === code)?.ops ?? '—'
  const menu = [
    ['h', 'By handedness', hand && `${hand.rows[0].label} ${hand.rows[0].ops} · ${hand.rows[1].label} ${hand.rows[1].ops}`, 'OPS against'],
    ['s', 'Situational', sit && `Empty ${sitOps('r0')} · RISP ${sitOps('risp')}`, 'OPS against'],
    vs.data && ['v', 'Splits vs team', 'Every club, career', 'Career ERA'],
    glView && ['g', 'Game lines', `Home ${glView.sections[0]?.items[0]?.era ?? '—'} · Road ${glView.sections[0]?.items[1]?.era ?? '—'}`, 'Career ERA'],
    ['all', 'All four', 'Scroll through everything', 'Every section open'],
  ].filter(Boolean)
  const empties = <p className="splitsmod__none">{`No ${scope === 'P' ? 'postseason ' : ''}splits for ${shown === 'career' ? 'his career' : shown}.`}</p>

  return (
    <Stack gap="loose" className="splitsmod">
      <div className="splitsmod__bar" role="group" aria-label="Filter the season parts">
        <label className="splitsmod__field">
          <span className="splitsmod__lbl">Season</span>
          <select className="splitsmod__select" value={shown} onChange={(e) => setPicked(e.target.value)}>
            {choices.map((c) => <option key={c} value={c}>{c === 'career' ? 'Career' : c}</option>)}
          </select>
        </label>
        <div className="splitsmod__field" role="group" aria-label="Scope">
          <span className="splitsmod__lbl">Scope</span>
          <div className="splitsmod__segs">
            {SCOPES.map(([id, label]) => (
              <Button key={id} size="control" skin="outline" pressed={scope === id} disabled={id !== 'R' && !postOk} onClick={() => { setPicked(shown); setWanted(id) }}>
                {label}
              </Button>
            ))}
          </div>
        </div>
        <span className="splitsmod__sum">
          <span className="splitsmod__pa">{pa ?? '—'}</span> {pitching ? 'BF' : 'PA'}
          <Button size="control" skin="outline" onClick={() => { setPicked(null); setWanted('R'); setSitAll(false) }}>Reset</Button>
        </span>
      </div>
      <ul className="splitsmod__legend" aria-label="How to read the bars">
        <li className="splitsmod__lgh">{pitching ? 'Bars show OPS against, then ERA. Shorter is better' : 'Bars show OPS'}</li>
        <li><span className="splitsmod__sw is-line" aria-hidden="true" />{pitching ? 'Line: the first row' : 'Line: OPS of the first row'}</li>
        <li><span className="splitsmod__sw is-pos" aria-hidden="true" />{pitching ? 'Better than it' : 'Above it'}</li>
        <li><span className="splitsmod__sw is-neg" aria-hidden="true" />{pitching ? 'Worse than it' : 'Below it'}</li>
        <li><span className="splitsmod__sw is-thin" aria-hidden="true" />{pitching ? 'Thin: under 100 BF or 20 IP' : 'Thin: under 100 PA'}</li>
        <li><Flag />Best in its group</li>
        <li><Flag weak />Weakest in its group</li>
      </ul>

      {pitching && (
        <div className={`splitsmod__menu${focus ? ' is-rail' : ''}`} role="group" aria-label="Splits sections">
          {menu.map(([id, title, preview, hint]) => (
            <button key={id} type="button" className="splitsmod__mc" aria-pressed={focus === id} onClick={() => setFocus(focus === id ? '' : id)}>
              <span className="splitsmod__mt">{title}</span>
              <span className="splitsmod__mx">
                <span className="splitsmod__mp">{preview}</span>
                <span className="splitsmod__mh">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="splitsmod__cards" aria-busy={splits.loading}>
        {show('h') && (
          <section className="splitsmod__part" aria-label="By handedness">
            <SectionHead look="rule" note={text.tag}>By handedness</SectionHead>
            {hand ? (
              <>
                <Head layout="slash" title="Split" group={group} vs={text.base} />
                <Row base line={hand.base} layout="slash" />
                {hand.rows.map((l) => <Row key={l.key} line={l} layout="slash" />)}
              </>
            ) : splits.loading ? <p className="hint">Loading…</p> : empties}
          </section>
        )}
        {show('s') && (
          <section className="splitsmod__part" aria-label="Situational">
            <SectionHead look="rule" note={text.tag}>Situational</SectionHead>
            {sit ? (
              <>
                <Head layout="slash" title="Split" group={group} vs={text.base} />
                {sit.base && <Row base line={sit.base} layout="slash" />}
                {sit.groups.filter((g) => sitAll || g.family === 'base').map((g) => (
                  <div key={g.family}>
                    <p className="splitsmod__fam">{g.title}</p>
                    {g.rows.map((l) => <Row key={l.key} line={l} layout="slash" />)}
                  </div>
                ))}
                {sit.groups.length > 1 && (
                  <Button size="control" skin="outline" className="splitsmod__more" aria-expanded={sitAll} onClick={() => setSitAll(!sitAll)}>
                    {sitAll ? 'Show less' : 'Show more'}
                  </Button>
                )}
              </>
            ) : splits.loading ? <p className="hint">Loading…</p> : empties}
          </section>
        )}
        {show('v') && vs.data && <VsTeam vs={vs.data} group={group} career={career.data} season={season} asOf={asOf} bio={bio} surname={surname} />}
        {show('g') && glView && <GameLines view={glView} labels={lines.data.labels} group={group} asOf={asOf} bio={bio} surname={surname} />}
      </div>
    </Stack>
  )
}
