import { useEffect, useMemo, useRef, useState } from 'react'
import { loadTradeSide, loadMinorLines } from '../../api/trade/side.js'
import { fetchLevelLines } from '../../api/trade/levelLines.js'
import { percentileFromCuts, LEVEL_OF_SPORT } from '../../lib/trade/levelPct.js'
import { dealSummary, money, sortPlayers, applyRetain, lineIsSmall, unsetSalary } from '../../lib/trade/deal.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { isMlbTeamId, teamAbbr, teamClubName, ALL_MLB_TEAM_IDS } from '../../lib/teams.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { Button } from '../../components/ui/control/Button.jsx'
import { Chips } from '../../components/ui/control/Chips.jsx'
import { InfoPopover } from '../../components/ui/InfoPopover.jsx'
import { EmptyState } from '../../components/ui/state/EmptyState.jsx'
import { TeamFilterStrip } from '../../components/team/TeamFilterStrip.jsx'
import { PlayerRow } from './PlayerRow.jsx'
import { DepthCard } from './DepthCard.jsx'
import '../../styles/trade/depth.css'
import '../../styles/trade/sheets.css'
import '../../styles/trade/motion.css'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import '../../styles/trade/page.css'

const DASH = '—'

// Roster position filter. statsapi's 40-man calls every pitcher 'P'.
const POS_GROUPS = [
  { value: 'all', label: 'All' },
  { value: 'P', label: 'Pitchers' },
  { value: 'C', label: 'Catchers' },
  { value: 'IF', label: 'Infield' },
  { value: 'OF', label: 'Outfield' },
]
// Prospect lists write pitchers as RHP/LHP; the roster writes P.
const GROUP_OF = { P: 'P', SP: 'P', RP: 'P', RHP: 'P', LHP: 'P', TWP: 'P', C: 'C', '1B': 'IF', '2B': 'IF', '3B': 'IF', SS: 'IF', IF: 'IF', DH: 'IF', LF: 'OF', CF: 'OF', RF: 'OF', OF: 'OF' }
const inGroup = (p, g) => g === 'all' || GROUP_OF[p.pos] === g

// Which players the roster list holds: the 40-man, the club's ranked
// prospects (on the 40-man or not), or the whole organization.
const SHOW = [
  { value: 'forty', label: '40-man' },
  { value: 'prospects', label: 'Prospects' },
  { value: 'all', label: 'Everyone' },
]
// Sort keys; 'line' reads OPS for hitters and ERA for pitchers.
const SORT = [
  { value: 'name', label: 'Name' },
  { value: 'war', label: 'WAR' },
  { value: 'line', label: 'OPS / ERA' },
  { value: 'level', label: 'OPS / ERA vs level' },
  { value: 'pay', label: 'Salary' },
  { value: 'control', label: 'Control' },
  { value: 'age', label: 'Age' },
  { value: 'prospect', label: 'Prospect rank' },
]
const isPitcher = (p) => GROUP_OF[p.pos] === 'P'
// Accent- and case-blind, so "pena" finds Peña.
const fold = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() // caps-js-exempt: compares names, renders nothing
// A player's percentile within his own level (Q3, option C): a big-league
// line against MLB, else his line at his highest minor-league level. Below the
// level floor (40 PA, 30 outs) there is no percentile.
function levelRank(p, farm, cuts) {
  if (!cuts) return null
  const mlb = p.line && (p.line.pa != null ? Number(p.line.pa) >= 40 : parseFloat(p.line.ip) >= 10)
  const pitcher = isPitcher(p)
  if (mlb) {
    const v = Number(pitcher ? p.line.era : p.line.ops)
    const pct = percentileFromCuts(v, cuts.levels?.[1]?.[pitcher ? 'era' : 'ops'], !pitcher)
    return pct == null ? null : { pct, level: 'MLB' }
  }
  const r = farm?.get(p.id)?.ranked
  if (!r || (r.isPitcher ? Number(r.outs) < 30 : Number(r.pa) < 40)) return null
  const pct = percentileFromCuts(Number(r.isPitcher ? r.era : r.ops), cuts.levels?.[r.sport]?.[r.isPitcher ? 'era' : 'ops'], !r.isPitcher)
  return pct == null ? null : { pct, level: LEVEL_OF_SPORT[r.sport] }
}

function rosterList(data, { show, group, sort, query = '', farm = null, minimum = false, cuts = null }) {
  const prospect = (p) => p.orgRank != null || p.topRank != null
  let list = show === 'forty' ? data.forty
    : show === 'prospects' ? [...data.forty.filter(prospect), ...data.minors]
    : [...data.forty, ...data.minors, ...data.others]
  const q = fold(query.trim())
  list = list.filter((p) => inGroup(p, group) && (!q || fold(p.name).includes(q)))
  if (sort === 'line') {
    // Hitters by OPS, then pitchers by ERA, so neither number is compared with
    // the other. Within each, big-league lines come before minor-league ones:
    // a .900 OPS in Double-A is not a .900 OPS in the majors.
    const milb = (p) => (!p.line && farm?.get(p.id) ? { ...p, line: farm.get(p.id) } : null)
    // With the minimum on, a big-league line under 50 PA / 20 IP sorts after
    // the minor-league lines, as a small sample (still shown).
    const small = (p) => minimum && lineIsSmall(p.line)
    const tiers = (rows, key) => [
      ...sortPlayers(rows.filter((p) => p.line && !small(p)), key),
      ...sortPlayers(rows.map(milb).filter(Boolean), key),
      ...sortPlayers(rows.filter(small), key),
      ...rows.filter((p) => !p.line && !farm?.get(p.id)),
    ].map((p) => list.find((x) => x.id === p.id))
    return [...tiers(list.filter((p) => !isPitcher(p)), 'ops'), ...tiers(list.filter(isPitcher), 'era')]
  }
  if (sort === 'level') {
    // One list, hitters and pitchers together: each ranked only against his own level.
    const ranked = list.map((p) => ({ p, r: levelRank(p, farm, cuts) }))
    return [...ranked.filter((x) => x.r).sort((a, b) => b.r.pct - a.r.pct), ...ranked.filter((x) => !x.r)].map((x) => x.p)
  }
  return sort === 'name' ? list : sortPlayers(list, sort)
}
const idOf = (abbr) => ALL_MLB_TEAM_IDS.find((id) => teamAbbr({ id }) === abbr?.toUpperCase()) ?? null // caps-js-exempt: matches a URL key, renders nothing

// The deal lives in the address, so a link rebuilds it:
// /trade?team=MIL&with=BOS&p=1,2,3&ca=0&cb=2.5 (cash in $M).
function readLink() {
  const q = new URLSearchParams(window.location.search)
  return {
    a: idOf(q.get('team')),
    b: idOf(q.get('with')),
    picked: new Set((q.get('p') || '').split(',').filter(Boolean).map(Number)),
    cashA: Number(q.get('ca')) || 0,
    cashB: Number(q.get('cb')) || 0,
  }
}
function writeLink({ a, b, picked, cashA, cashB }) {
  const q = new URLSearchParams()
  if (a) q.set('team', teamAbbr({ id: a }))
  if (b) q.set('with', teamAbbr({ id: b }))
  if (picked.size) q.set('p', [...picked].join(','))
  if (cashA) q.set('ca', String(cashA))
  if (cashB) q.set('cb', String(cashB))
  const s = q.toString()
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${s ? `?${s}` : ''}`)
}

// The trade card (/trade). Pick a partner, add players or cash from each side,
// and the card states what moves: payroll, WAR, years of control, 40-man spots.
// No grade on who wins. Open surface (ADR-0034): rosters and contracts only.
export function TradePage() {
  useDocumentTitle('Trade Card')
  const { favoriteTeamId } = useFavoriteTeam()
  const start = useMemo(() => readLink(), [])
  const [a, setA] = useState(start.a ?? (isMlbTeamId(favoriteTeamId) ? favoriteTeamId : 158))
  const [b, setB] = useState(start.b && start.b !== start.a ? start.b : null)
  const [picked, setPicked] = useState(start.picked)
  const [cashA, setCashA] = useState(start.cashA)
  const [cashB, setCashB] = useState(start.cashB)
  const [choosingA, setChoosingA] = useState(false)
  const [choosingB, setChoosingB] = useState(false)
  const [showDepth, setShowDepth] = useState(false)
  // A club change that would drop players waits here until the reader confirms it.
  const [pending, setPending] = useState(null)

  useEffect(() => writeLink({ a, b, picked, cashA, cashB }), [a, b, picked, cashA, cashB])

  const sideA = useAsync(() => loadTradeSide(a), [a])
  const sideB = useAsync(() => (b ? loadTradeSide(b) : Promise.resolve(null)), [b])
  // Each club's minor-league lines load the first time its roster reaches past
  // the 40-man; the page holds them so the other column can read them too.
  const [wantFarm, setWantFarm] = useState({ a: false, b: false })
  const farmA = useAsync(() => (wantFarm.a ? loadMinorLines(a) : Promise.resolve(null)), [wantFarm.a, a])
  const farmB = useAsync(() => (wantFarm.b && b ? loadMinorLines(b) : Promise.resolve(null)), [wantFarm.b, b])

  const toggle = (id) => setPicked((s) => {
    const n = new Set(s)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })
  // Salary the sender keeps (Q4): a share per player, dollars per player, or one share for a whole side.
  const [retainMode, setRetainMode] = useState('pct')
  const [retain, setRetain] = useState({})
  const [retainOpen, setRetainOpen] = useState(false)
  const [sidePct, setSidePct] = useState({ a: 0, b: 0 })
  const setPlayerRetain = (id, v) => setRetain((r) => ({ ...r, [id]: v }))
  const picks = (side) => (side ? [...side.forty, ...side.minors, ...side.others].filter((p) => picked.has(p.id)) : [])
  const retainFor = (key) => (retainMode === 'side'
    ? { sidePct: sidePct[key] }
    : { retain: Object.fromEntries(Object.entries(retain).map(([id, v]) => [id, retainMode === 'pct' ? { pct: v.pct ?? 0 } : { usd: (v.usd ?? 0) * 1e6 }])) })
  const sends = (side) => (side ? applyRetain(picks(side), retainFor(side === sideA.data ? 'a' : 'b')) : [])
  const retainUI = retainMode === 'side' ? null : (p) => (
    <RetainControl mode={retainMode} p={p} value={retain[p.id]} onChange={(v) => setPlayerRetain(p.id, v)} />
  )
  const deal = sideA.data && sideB.data
    ? dealSummary(
        { name: teamClubName(a), fortyCount: sideA.data.fortyCount, sends: sends(sideA.data), cashUsd: cashA * 1e6 },
        { name: teamClubName(b), fortyCount: sideB.data.fortyCount, sends: sends(sideB.data), cashUsd: cashB * 1e6 },
      )
    : null

  // Tapping the club already picked just closes the strip.
  const named = (side) => picks(side).map((p) => p.name)
  const switchA = (id) => { setA(id); setPicked((s) => new Set([...s].filter((x) => picks(sideB.data).some((p) => p.id === x)))); setCashA(0); if (id === b) setB(null); setChoosingA(false); setPending(null) }
  const switchB = (id) => { setB(id); setPicked((s) => new Set([...s].filter((x) => picks(sideA.data).some((p) => p.id === x)))); setCashB(0); setChoosingB(false); setPending(null) }
  // Tapping the club already picked just closes the strip. A switch that would
  // drop players asks first; one that drops nobody happens at once.
  const pickA = (id) => {
    if (!id || id === a) { setChoosingA(false); return }
    const drops = named(sideA.data)
    if (drops.length) setPending({ side: 'a', id, drops })
    else switchA(id)
  }
  const pickB = (id) => {
    if (!id || id === a) return
    if (id === b) { setChoosingB(false); return }
    const drops = b ? named(sideB.data) : []
    if (drops.length) setPending({ side: 'b', id, drops })
    else switchB(id)
  }
  const confirm = pending && (
    <p className="tradedesk__confirm" role="alert">
      Switching to the {teamClubName(pending.id)} drops {pending.drops.join(', ')}.{' '}
      <Button size="control" skin="ink" onClick={() => (pending.side === 'a' ? switchA(pending.id) : switchB(pending.id))}>Switch</Button>{' '}
      <Button size="control" skin="ghost" onClick={() => setPending(null)}>Keep the deal</Button>
    </p>
  )
  // The pinned strip repeats the columns' figures, so it hides while they are on screen.
  const movesRef = useRef(null)
  const hasDeal = Boolean(sideA.data && sideB.data)
  const [movesInView, setMovesInView] = useState(false)
  useEffect(() => {
    const el = movesRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const io = new IntersectionObserver(([e]) => setMovesInView(e.isIntersecting), { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [hasDeal])
  // The phone's share sheet where there is one; otherwise copy the link.
  const [shared, setShared] = useState('')
  const share = async () => {
    const url = window.location.href
    const title = `${teamClubName(a)} – ${b ? teamClubName(b) : ''} trade`
    try {
      if (navigator.share) { await navigator.share({ title, url }); return }
      await navigator.clipboard.writeText(url)
      setShared('Link copied')
    } catch {
      setShared('')
    }
  }
  const changeA = choosingA
    ? (
      <>
        <TeamFilterStrip chips showMlbPin={false} selectedTeamId={a} centerTeamId={a} onSelect={pickA} ariaLabel="Your club" />
        <Button size="control" skin="ghost" onClick={() => { setChoosingA(false); setPending(null) }}>Cancel</Button>
        {pending?.side === 'a' && confirm}
      </>
    )
    : <Button size="control" skin="ghost" onClick={() => setChoosingA(true)}>Change club</Button>
  const changeB = choosingB
    ? (
      <>
        <TeamFilterStrip chips showMlbPin={false} selectedTeamId={b} centerTeamId={b}
          teams={ALL_MLB_TEAM_IDS.filter((id) => id !== a).map((id) => ({ id, name: teamClubName(id) }))}
          onSelect={pickB} ariaLabel="Trade partner" />
        <Button size="control" skin="ghost" onClick={() => { setChoosingB(false); setPending(null) }}>Cancel</Button>
        {pending?.side === 'b' && confirm}
      </>
    )
    : <Button size="control" skin="ghost" onClick={() => setChoosingB(true)}>Change partner</Button>
  const swap = () => { setA(b); setB(a); setCashA(cashB); setCashB(cashA); setSidePct((x) => ({ a: x.b, b: x.a })) }

  return (
    <div className="screen tradedesk">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Trade Card</h1>
      </header>

      <Stack gap="section">
        {deal && <Verdict deal={deal} a={a} b={b} sendsA={sends(sideA.data)} sendsB={sends(sideB.data)} cashA={cashA} cashB={cashB} />}

        <div className="tradedesk__sides" ref={movesRef}>
          {b ? (
            <>
              {/* Each column is one club: what it gets, what that does for it, then its own roster. */}
              <Side
                teamId={a}
                state={sideA}
                incoming={sends(sideB.data)}
                incomingTeamId={b}
                incomingCash={cashB}
                partner={teamClubName(b)}
                picked={picked}
                onToggle={toggle}
                cash={cashA}
                onCash={setCashA}
                after={deal?.fortyAfter.a}
                effect={deal && <Effect club={teamClubName(a)} pay={deal.payroll.a} unset={deal.unpriced.a} war={deal.war.a} inYrs={deal.control.aIn} outYrs={deal.control.aOut} nextYear={sideA.data.nextYear} warSeason={sideA.data.warSeason} />}
                retainUI={retainUI}
                change={changeA}
                farm={farmA.data}
                incomingFarm={farmB.data}
                requestFarm={() => setWantFarm((w) => ({ ...w, a: true }))}
              />
              <Side
                teamId={b}
                state={sideB}
                incoming={sends(sideA.data)}
                incomingTeamId={a}
                incomingCash={cashA}
                partner={teamClubName(a)}
                picked={picked}
                onToggle={toggle}
                cash={cashB}
                onCash={setCashB}
                after={deal?.fortyAfter.b}
                effect={deal && <Effect club={teamClubName(b)} pay={deal.payroll.b} unset={deal.unpriced.b} war={deal.war.b} inYrs={deal.control.aOut} outYrs={deal.control.aIn} nextYear={sideA.data.nextYear} warSeason={sideA.data.warSeason} />}
                retainUI={retainUI}
                change={changeB}
                farm={farmB.data}
                incomingFarm={farmA.data}
                requestFarm={() => setWantFarm((w) => ({ ...w, b: true }))}
              />
            </>
          ) : (
            <>
              <Side
                teamId={a}
                state={sideA}
                incoming={[]}
                incomingTeamId={null}
                incomingCash={0}
                partner={null}
                picked={picked}
                onToggle={toggle}
                cash={cashA}
                onCash={setCashA}
                change={changeA}
                farm={farmA.data}
                requestFarm={() => setWantFarm((w) => ({ ...w, a: true }))}
              />
              <Card frame="stamped" label="Trade partner" className="tradedesk__side">
                <TeamFilterStrip
                  chips
                  showMlbPin={false}
                  teams={ALL_MLB_TEAM_IDS.filter((id) => id !== a).map((id) => ({ id, name: teamClubName(id) }))}
                  selectedTeamId={b}
                  onSelect={pickB}
                  ariaLabel="Trade partner"
                />
              </Card>
            </>
          )}
        </div>

        {deal && (
          <Card frame="stamped" label="The deal" className="tradedesk__moves">
            {otherNotes(deal.notes).length > 0 && (
              <ul className="tradedesk__notes" aria-live="polite">
                {otherNotes(deal.notes).map((n) => <li key={n}>{n}</li>)}
              </ul>
            )}
            {retainOpen ? (
              <div className="tradedesk__retainbar">
                <Chips label="Retained salary" layout="wrap" value={retainMode} onChange={setRetainMode}
                  options={[{ value: 'pct', label: 'Retain % per player' }, { value: 'usd', label: 'Retain $ per player' }, { value: 'side', label: 'Retain % per side' }]} />
                {retainMode === 'side' && [['a', a], ['b', b]].map(([key, id]) => (
                  <Chips key={key} label={`${teamClubName(id)} keep`} layout="wrap" value={sidePct[key]} onChange={(v) => setSidePct((x) => ({ ...x, [key]: v }))}
                    options={PCTS.map((v) => ({ value: v, label: `${teamClubName(id)} keep ${v * 100}%` }))} />
                ))}
              </div>
            ) : (
              <Button size="control" skin="ghost" className="tradedesk__retainlink" onClick={() => setRetainOpen(true)}>Retain salary…</Button>
            )}
            <div className="tradedesk__actions">
              <Button skin="ink" onClick={share}>{shared || 'Share this deal'}</Button>
              <Button onClick={swap}>Swap sides</Button>
            </div>
          </Card>
        )}
        {deal && (showDepth
          ? (
            <DepthCard
              clubs={[
                { teamId: a, data: sideA.data, sends: sends(sideA.data) },
                { teamId: b, data: sideB.data, sends: sends(sideB.data) },
              ]}
              onClose={() => setShowDepth(false)}
            />
          )
          : <Button className="tradedesk__showdepth" onClick={() => setShowDepth(true)}>Show organization depth</Button>
        )}
      </Stack>
      {deal && !movesInView && (
        // The deal's three numbers, pinned so every add shows what it changed.
        <div className="tradedesk__strip" aria-live="polite">
          <StripSide name={teamAbbr({ id: a })} pay={payText(deal.payroll.a, deal.unpriced.a)} war={deal.war.a} forty={deal.fortyAfter.a} />
          <StripSide name={teamAbbr({ id: b })} pay={payText(deal.payroll.b, deal.unpriced.b)} war={deal.war.b} forty={deal.fortyAfter.b} />
          <Button size="control" skin="outline" className="tradedesk__stripshare" onClick={share}>{shared || 'Share'}</Button>
        </div>
      )}
      <ReportFooter />
    </div>
  )
}

// One club's column, the Trade Machine's shape: the club, what it gets from
// the other club (and what that does for it), then its own roster right
// there, where a tap sends a player across. No modal: the roster is the page.
function Side({ teamId, state, incoming, incomingTeamId, incomingCash, partner, picked, onToggle, cash, onCash, after, effect = null, change, retainUI = null, farm = null, incomingFarm = null, requestFarm }) {
  const club = teamClubName(teamId)
  const data = state.data
  const [group, setGroup] = useState('all')
  const [addingCash, setAddingCash] = useState(false)
  const [show, setShow] = useState('forty')
  const [sort, setSort] = useState('name')
  const [minimum, setMinimum] = useState(true)
  const [query, setQuery] = useState('')
  const pickShow = (v) => { setShow(v); if (v !== 'forty') requestFarm(); if (v === 'prospects' && sort === 'name') setSort('prospect') }
  const byLevel = sort === 'level'
  const cuts = useAsync(() => (byLevel ? fetchLevelLines() : Promise.resolve(null)), [byLevel])
  // A player the reader adds stamps into the column that gets him. The ones a
  // shared link or a reload brought are already there and do not replay it
  // (docs/motion.md). The set is taken once, the first render the deal is in;
  // adjusting state during render is React's documented pattern for this.
  const [arrived, setArrived] = useState(null)
  if (data && arrived === null) setArrived(new Set(incoming.map((p) => p.id)))
  return (
    <Card frame="stamped" label={club} className="tradedesk__side">
      {/* The club line: its mark, its 40-man count now and after the deal, and the switch. */}
      <div className="tradedesk__club">
        <TeamLogo teamId={teamId} size={40} />
        <p className="tradedesk__count">
          <span className="tradedesk__k">40-man</span>
          <span className="tradedesk__countfig">
            {data ? `${data.fortyCount}/40` : DASH}
            {data && after != null && after !== data.fortyCount && (
              <span className={after > 40 ? 'tradedesk__after tradedesk__after--over' : 'tradedesk__after'}> → {after}/40</span>
            )}
          </span>
        </p>
        {change}
      </div>

      {state.loading && !data && <p className="hint" role="status">Reading the {club} roster…</p>}
      {state.error && !data && (
        <EmptyState role="alert"><p>The {club} roster did not load.</p><Button skin="ink" onClick={state.reload}>Try again</Button></EmptyState>
      )}

      {data && (
        <>
          {partner && (
            <div className="tradedesk__sends">
              {/* What this club gets: the other club's players and cash, at a glance. */}
              <p className="tradedesk__sendshead">
                <span className="t-label t-label--bold">Gets from the {partner}</span>
                <span className="tradedesk__sendssum">{sendsSummary(incoming, incomingCash, data.nextYear)}</span>
              </p>
              {incoming.length === 0 && !incomingCash ? <p className="tradedesk__none">Nothing yet. Tap a player on the {partner} roster.</p> : (
                <ul className="tradedesk__list">
                  {incoming.map((p) => (
                    <PlayerRow compact key={p.id} p={p} teamId={incomingTeamId} picked onToggle={onToggle} nextYear={data.nextYear} warSeason={data.warSeason} farm={incomingFarm?.get(p.id)} enter={arrived != null && !arrived.has(p.id)}>
                      {retainUI && (p.payUsd != null || p.retainedUsd) ? retainUI(p) : null}
                    </PlayerRow>
                  ))}
                </ul>
              )}
            </div>
          )}

          {effect}

          {/* The club's own roster, in the column: tap Add to send a player across. */}
          <div className="tradedesk__roster">
            <div className="tradedesk__rosterhead infopop-row">
              <h3 className="t-label t-label--bold">{club} roster</h3>
              <InfoPopover label="How to read the numbers" className="infopop--paper infopop--down">
                A ~ marks a year estimated from service time. WAR is from last season.
              </InfoPopover>
              {cash || addingCash ? (
                <label className="tradedesk__cash">
                  <span className="t-label">{club} cash in {data.nextYear} ($M)</span>
                  <input type="number" min="0" step="0.5" inputMode="decimal" value={cash || ''} placeholder="0" autoFocus={addingCash && !cash}
                    onChange={(e) => onCash(Math.max(0, Number(e.target.value) || 0))}
                    onBlur={() => { if (!cash) setAddingCash(false) }} />
                </label>
              ) : (
                <Button size="control" skin="ghost" className="tradedesk__cash" onClick={() => setAddingCash(true)}>+ {club} cash</Button>
              )}
            </div>
            <div className="tradedesk__controls">
              <Chips label={`${club} list`} options={SHOW} value={show} onChange={pickShow} layout="wrap" />
              <Chips label={`${club} positions`} options={POS_GROUPS} value={group} onChange={setGroup} layout="wrap" />
              <input type="search" className="tradedesk__search" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder={`Find a ${club} player`} aria-label={`Find a ${club} player`} />
              <label className="tradedesk__sort">
                <span className="t-label">Sort</span>
                <select value={sort} onChange={(e) => { setSort(e.target.value); if (e.target.value === 'level') requestFarm() }}>
                  {SORT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              {sort === 'line' && (
                <Chips label="Big-league lines" layout="wrap" value={minimum ? 'min' : 'any'} onChange={(v) => setMinimum(v === 'min')}
                  options={[{ value: 'min', label: '50 PA / 20 IP to count' }, { value: 'any', label: 'Any sample' }]} />
              )}
            </div>
            <ul className="tradedesk__list tradedesk__rosterlist">
              {rosterList(data, { show, group, sort, query, farm, minimum, cuts: cuts.data }).map((p) => (
                <PlayerRow key={p.id} p={p} teamId={teamId} picked={picked.has(p.id)} onToggle={onToggle} nextYear={data.nextYear} warSeason={data.warSeason}
                  farm={farm?.get(p.id)} rank={sort === 'level' ? levelRank(p, farm, cuts.data) : null} goingTo={picked.has(p.id) ? partner : null} />
              ))}
            </ul>
          </div>
        </>
      )}
    </Card>
  )
}

const PCTS = [0, 0.25, 0.5]

// The per-player retain control under a player the reader is sending.
function RetainControl({ mode, p, value, onChange }) {
  if (mode === 'pct') {
    return (
      <Chips label={`Share of ${p.name}'s salary kept`} layout="wrap" value={value?.pct ?? 0} onChange={(v) => onChange({ pct: v })}
        options={PCTS.map((v) => ({ value: v, label: `Keep ${v * 100}%` }))} />
    )
  }
  return (
    <label className="tradedesk__cash">
      <span className="t-label">Keep a year ($M)</span>
      <input type="number" min="0" step="0.5" inputMode="decimal" value={value?.usd || ''} placeholder="0"
        onChange={(e) => onChange({ usd: Math.max(0, Number(e.target.value) || 0) })} />
    </label>
  )
}

// "1 player · $28.7M in 2027 · + $2M cash", or "Nobody yet".
function sendsSummary(sends, cash, nextYear) {
  if (!sends.length && !cash) return 'Nobody yet'
  const pay = sends.reduce((t, p) => t + (p.payUsd ?? 0), 0)
  const unset = sends.filter(unsetSalary).length
  return [
    sends.length ? `${sends.length} ${sends.length === 1 ? 'player' : 'players'}` : null,
    pay ? `${money(pay)} in ${nextYear}${unset ? ` + ${unset} TBD` : ''}` : unset ? `${unset} TBD` : null,
    cash ? `+ ${money(cash * 1e6)} cash` : null,
  ].filter(Boolean).join(' · ')
}

// The one banner on top, Trade Machine style, but a fact rather than a ruling:
// what has to happen before this deal can go through. Green when nothing does.
function Verdict({ deal, a, b, sendsA, sendsB, cashA, cashB }) {
  if ((!sendsA.length && !cashA) || (!sendsB.length && !cashB)) {
    return <p className="tradedesk__verdict tradedesk__verdict--wait" role="status">Add a player or cash from each club to see the deal.</p>
  }
  const blocks = []
  if (deal.fortyAfter.a > 40) blocks.push(`The ${teamClubName(a)} must clear ${deal.fortyAfter.a - 40} 40-man ${deal.fortyAfter.a - 40 === 1 ? 'spot' : 'spots'}`)
  if (deal.fortyAfter.b > 40) blocks.push(`The ${teamClubName(b)} must clear ${deal.fortyAfter.b - 40} 40-man ${deal.fortyAfter.b - 40 === 1 ? 'spot' : 'spots'}`)
  for (const p of [...sendsA, ...sendsB]) {
    if ((p.serviceYears ?? 0) >= 10) blocks.push(`${p.name} may be able to block it (10-and-5 rights)`)
  }
  if (!blocks.length) {
    return <p className="tradedesk__verdict tradedesk__verdict--go" role="status">This trade fits: both 40-man rosters have room</p>
  }
  return (
    <div className="tradedesk__verdict tradedesk__verdict--stop" role="status">
      <p>Before this trade can happen</p>
      <ul>{blocks.map((t) => <li key={t}>{t}</li>)}</ul>
    </div>
  )
}

// What the deal does for one club, under its haul: WAR, money and control,
// then the same thing said in a sentence (the Trade Machine's "you have
// increased this team's projected wins by 3").
function Effect({ club, pay, unset, war, inYrs, outYrs, nextYear, warSeason }) {
  const warText = Math.abs(war) < 0.05 ? 'no change in WAR' : `${war > 0 ? 'add' : 'lose'} ${Math.abs(war).toFixed(1)} WAR`
  const payText2 = Math.abs(pay) < 1 ? 'no change in payroll' : `${pay > 0 ? 'take on' : 'shed'} ${money(Math.abs(pay))}`
  return (
    <div className="tradedesk__effect">
      <p className="tradedesk__effectfigs">
        <span><span className="tradedesk__k">{warSeason ?? 'Last season'} WAR</span> <span className={`tradedesk__fig tradedesk__fig--${tone(war) || 'flat'}`}>{signedNum(war)}</span></span>
        <span><span className="tradedesk__k">{nextYear} payroll</span> <span className="tradedesk__fig">{signedMoney(pay)}</span>{unset ? (
          <span className="tradedesk__fignote infopop-row">
            {tbd(unset)}{' '}
            <InfoPopover label="What TBD means" className="infopop--paper">
              TBD is a big-league salary not set yet (arbitration, option or pre-arb). The payroll figure leaves it out.
            </InfoPopover>
          </span>
        ) : null}</span>
        <span><span className="tradedesk__k">Control</span> <span className="tradedesk__fig">+{inYrs} / −{outYrs}</span></span>
      </p>
      <p className="tradedesk__sentence">The {club} {warText} and {payText2} for {nextYear}{unset ? `, plus ${unset} salary not set yet` : ''}.</p>
    </div>
  )
}

// The notes the banner has not already said.
const otherNotes = (notes) => notes.filter((n) => !/no set salary|must clear|10\+ years/.test(n))

function StripSide({ name, pay, war, forty }) {
  return (
    <p className="tradedesk__stripside">
      <span className="t-label t-label--bold">{name}</span>
      <span><span className="tradedesk__k">Pay</span> {pay}</span>
      <span><span className="tradedesk__k">WAR</span> {signedNum(war)}</span>
      <span className={forty > 40 ? 'tradedesk__over' : ''}><span className="tradedesk__k">40-man</span> {forty}</span>
    </p>
  )
}


const tone = (v) => (v > 0.05 ? 'up' : v < -0.05 ? 'down' : '')
const tbd = (n) => (n ? `+ ${n} TBD` : null)

// "+$28.7M · 1 salary not set": the figure, and how many players in the deal it leaves out.
const payText = (v, unset) => `${signedMoney(v)}${unset ? ` + ${unset} TBD` : ''}`
const signedMoney = (v) => (v === 0 ? '$0' : `${v < 0 ? '−' : '+'}${money(v)}`)
const signedNum = (v) => (v === 0 ? '0.0' : `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(1)}`)
