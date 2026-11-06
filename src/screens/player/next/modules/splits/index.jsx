import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { MenuRail } from '../../../../../components/ui/control/MenuRail.jsx'
import { SectionHead } from '../../../../../components/ui/frame/SectionHead.jsx'
import { Stack } from '../../../../../components/ui/layout/Stack.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { splitDisplayName } from '../../../../../api/person.js'
import { viewKey } from '../../../../../lib/motion/inViewOnce.js'
import { Flag, Head, Part, Row } from './LineRows.jsx'
import { GameLines } from './GameLines.jsx'
import { VsTeam } from './VsTeam.jsx'
import { loadCareer, loadGameLines, loadSplits, loadVsTeam, loadVsTeamSeason } from './splitsData.js'
import { gameLinesView, handTable, scopeText, seasonChoices, sitTable, splitsMenu } from './splitsView.js'
import '../../../../../styles/player-next/both/splits.css'
import './parts.css'

const SCOPES = [['R', 'Regular'], ['P', 'Postseason'], ['A', 'All']]

// The Splits module (#1886; boards Splits and PitcherSplits): a season and scope bar over four
// parts — by handedness, situational, splits vs team, game lines. The first two follow the bar;
// Splits vs team and Game lines follow it too; a career pick's vs team stays the nightly regular season. Both roles open on a menu of the four, on By handedness, and show the ones picked.
export default function SplitsModule({ bio, role, asOf, season, onEmpty, onCount }) {
  const group = role === 'pitching' ? 'pitching' : 'hitting'
  const pitching = group === 'pitching'
  const surname = splitDisplayName(bio.fullName).last
  const once = viewKey(bio.id, `splits-${group}`)
  const choices = seasonChoices(season, Number(String(bio.debut ?? '').slice(0, 4)) || null)
  const [picked, setPicked] = useState(null)
  const [wanted, setWanted] = useState('R')
  const [sitAll, setSitAll] = useState(false)
  const [focus, setFocus] = useState(null)
  const [ready, setReady] = useState(false)
  const key = picked ?? String(season)
  // October is not cut by a date and the career holds it: a dated page asks for neither.
  const postOk = !asOf || (key !== 'career' && Number(key) < Number(season))
  const scope = postOk ? wanted : 'R'

  // Everything the bar governs, in one load so the parts never disagree: the hand and situational
  // rows, the Game lines doors and the season's vs team, fetched side by side (no waterfall). The
  // season he never played has no splits: until he picks, open the career instead.
  const splits = useAsync(async () => {
    const run = (k) =>
      Promise.all([
        loadSplits(bio.id, group, k, scope),
        loadGameLines(bio.id, group, k, scope),
        k === 'career' ? null : loadVsTeamSeason(bio.id, group, k, scope, asOf),
      ])
    let [rows, lines, vsSeason] = await run(key)
    let shown = key
    if (!rows.length && picked === null && scope === 'R') {
      ;[rows, lines, vsSeason] = await run('career')
      shown = 'career'
    }
    setReady(true)
    return { id: bio.id, group, rows, key: shown, scope, lines, vsSeason }
  }, [bio.id, group, key, scope, picked, asOf])
  // While a new pick loads, the last pick stays up (labelled as itself), so no part unmounts or
  // flashes another pick's figures.
  const [last, setLast] = useState(null)
  if (splits.data && splits.data !== last) setLast(splits.data)
  const data = splits.data ?? (last?.id === bio.id && last?.group === group ? last : null)
  const vs = useAsync(() => loadVsTeam(bio.id, group), [bio.id, group])
  const career = useAsync(() => loadCareer(bio.id, group), [bio.id, group])

  const shown = data?.key ?? key
  const shownScope = data?.scope ?? scope
  const text = scopeText(shown, shownScope)
  const tables = useMemo(() => {
    if (!data) return null
    const hand = handTable(data.rows, group, text.base)
    return { hand, sit: sitTable(data.rows, group, text.base, hand?.baseSide, shownScope === 'P' ? 1 : 4) }
  }, [data, group, text.base, shownScope])
  const lines = data?.lines ?? null
  // A season's vs team, from its game log; the career keeps the nightly shard (regular season).
  const vsView = useMemo(() => {
    if (!vs.data || !data) return null
    if (data.key === 'career') {
      return { vs: vs.data, base: career.data, tag: shownScope === 'R' ? 'Career' : 'Career, regular season', only: null }
    }
    const byOpp = data.vsSeason
    if (!byOpp || !lines?.base) return null
    return {
      vs: { ...vs.data, byOpp, teams: vs.data.teams.map((t) => ({ ...t, has: Boolean(byOpp[String(t.id)]) })) },
      base: lines.base,
      tag: text.base,
      only: lines.only,
    }
  }, [vs.data, career.data, data, lines, shownScope, text.base])
  const glView = useMemo(
    () => (lines?.base ? gameLinesView(lines, lines.base, group, text.base) : null),
    [lines, group, text.base],
  )

  // Nothing at all: no splits even for the career, no vs-team shard, no game lines.
  const none = !splits.loading && (Boolean(splits.error) || Boolean(tables && !tables.hand && !tables.sit))
  const settled = !vs.loading && !career.loading
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

  const hand = tables?.hand
  const sit = tables?.sit
  const menu = splitsMenu({ hand, sit, vs: Boolean(vs.data), glView, group }).map(({ key, title, preview, hint }) => ({
    key,
    title,
    figures: (
      <>
        <span className="splitsmod__mp">{preview}</span>
        <span className="splitsmod__mh">{hint}</span>
      </>
    ),
  }))
  const empties = <p className="splitsmod__none">{`No ${scope === 'P' ? 'postseason ' : ''}splits for ${shown === 'career' ? 'his career' : shown}.`}</p>

  // The parts. A batter sees all of them; a pitcher sees the ones he picks, in the MenuRail panel.
  const cards = (pick) => (
    <div className="splitsmod__cards" aria-busy={splits.loading}>
      {(pick === 'h' || pick === 'all') && (
        <Part once={`${once}:h`} label="By handedness">
          <SectionHead look="rule" note={text.tag}>By handedness</SectionHead>
          {hand ? (
            <>
              <Head layout="slash" title="Split" group={group} vs={text.base} />
              <Row base line={hand.base} layout="slash" />
              {hand.rows.map((l, i) => <Row key={l.key} i={i + 1} line={l} layout="slash" />)}
            </>
          ) : splits.loading ? <p className="hint">Loading…</p> : empties}
        </Part>
      )}
      {(pick === 's' || pick === 'all') && (
        <Part once={`${once}:s`} label="Situational">
          <SectionHead look="rule" note={text.tag}>Situational</SectionHead>
          {sit ? (
            <>
              <Head layout="slash" title="Split" group={group} vs={text.base} />
              {sit.base && <Row base line={sit.base} layout="slash" />}
              {sit.groups.filter((g) => sitAll || g.family === 'base').map((g) => (
                <div key={g.family}>
                  <p className="splitsmod__fam">{g.title}</p>
                  {g.rows.map((l, i) => <Row key={l.key} i={i + 1} line={l} layout="slash" />)}
                </div>
              ))}
              {sit.groups.length > 1 && (
                <Button size="control" skin="outline" className="splitsmod__more" aria-expanded={sitAll} onClick={() => setSitAll(!sitAll)}>
                  {sitAll ? 'Show less' : 'Show more'}
                </Button>
              )}
            </>
          ) : splits.loading ? <p className="hint">Loading…</p> : empties}
        </Part>
      )}
      {(pick === 'v' || pick === 'all') && vsView && <VsTeam vs={vsView.vs} group={group} career={vsView.base} tag={vsView.tag} only={vsView.only} season={season} asOf={asOf} bio={bio} surname={surname} />}
      {(pick === 'g' || pick === 'all') && glView && <GameLines view={glView} tag={text.base} only={lines.only} labels={lines.labels} group={group} asOf={asOf} bio={bio} surname={surname} />}
    </div>
  )

  return (
    <Stack gap="loose" className="splitsmod">
      {/* One line (Gary, 2026-10-30): the season picker and the scope, their captions for the screen
          reader only; the card's corner tag already counts the PA, and Reset shows once a pick moves. */}
      <div className="splitsmod__bar" role="group" aria-label="Filter the season parts">
        <label className="splitsmod__field">
          <span className="sr-only">Season</span>
          <select className="splitsmod__select" value={shown} onChange={(e) => setPicked(e.target.value)}>
            {choices.map((c) => <option key={c} value={c}>{c === 'career' ? 'Career' : c}</option>)}
          </select>
        </label>
        <div className="splitsmod__segs" role="group" aria-label="Scope">
          {SCOPES.map(([id, label]) => (
            <button key={id} type="button" className="pnext-pick" aria-pressed={scope === id} disabled={id !== 'R' && !postOk} onClick={() => { setPicked(shown); setWanted(id) }}>
              {label}
            </button>
          ))}
        </div>
        {(picked != null || wanted !== 'R' || sitAll || focus != null) && (
          <button type="button" className="splitsmod__reset" onClick={() => { setPicked(null); setWanted('R'); setSitAll(false); setFocus(null) }}>Reset</button>
        )}
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

      {pitching ? (
        <MenuRail label="Splits sections" items={menu} picked={focus} onPick={setFocus} panel={cards} />
      ) : (
        cards('all')
      )}
    </Stack>
  )
}
