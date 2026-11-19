import { useEffect, useMemo, useRef, useState } from 'react'
import { loadTradeSide, loadMinorLines } from '../../api/trade/side.js'
import { fetchLevelLines } from '../../api/trade/levelLines.js'
import { dealSummary, money, applyRetain, unsetSalary, wireSentence } from '../../lib/trade/deal.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { isMlbTeamId, teamAbbr, teamClubName, teamFullName, ALL_MLB_TEAM_IDS } from '../../lib/teams.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { Button } from '../../components/ui/control/Button.jsx'
import { Chips } from '../../components/ui/control/Chips.jsx'
import { InfoPopover } from '../../components/ui/InfoPopover.jsx'
import { headerThemeFor, barMarkTone, themeKeyFor } from '../../lib/colors/headerTheme.js'
import { EmptyState } from '../../components/ui/state/EmptyState.jsx'
import { TeamFilterStrip } from '../../components/team/TeamFilterStrip.jsx'
import { PlayerRow } from './PlayerRow.jsx'
import { DepthCard } from './DepthCard.jsx'
import { POS_GROUPS, SHOW, SORT, levelRank, rosterList } from './rosterList.js'
import { PCTS, RetainControl, Wire, Verdict, Effect, otherNotes, StripSide, payText } from './DealParts.jsx'
import '../../styles/trade/depth.css'
import '../../styles/trade/sheets.css'
import '../../styles/trade/columns.css'
import '../../styles/trade/motion.css'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import '../../styles/trade/page.css'

const DASH = '—'

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
              {/* Row one: each club's deal card (what it gets, what that does for it).
                  Row two: each club's roster, so the two rosters start level. */}
              <Side
                part="deal"
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
                part="deal"
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
              <Side
                part="roster"
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
                part="roster"
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
                part="deal"
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
              <Side
                part="roster"
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
            </>
          )}
        </div>

        {deal && (
          <Card frame="stamped" label="The deal" className="tradedesk__moves">
            <Wire text={wireSentence(
              { club: teamFullName(a), sends: sends(sideA.data), cashUsd: cashA * 1e6 },
              { club: teamFullName(b), sends: sends(sideB.data), cashUsd: cashB * 1e6 },
            )} />
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
function Side({ part = 'deal', teamId, state, incoming, incomingTeamId, incomingCash, partner, picked, onToggle, cash, onCash, after, effect = null, change, retainUI = null, farm = null, incomingFarm = null, requestFarm }) {
  const club = teamClubName(teamId)
  const data = state.data
  const theme = useMemo(() => headerThemeFor(teamId, themeKeyFor(teamId, 'home', 'main')), [teamId])
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
  // The roster card sits in its own row under the deal cards, so both clubs'
  // rosters start at the same height, whatever each deal card holds.
  if (part === 'roster') {
    return (
      <Card frame="stamped" className="tradedesk__side tradedesk__rostercard">
        {/* The club's main bar, the one the Identity Lab tunes and the lineup page
            wears: its bar colour, accent edge and ink, the mono mark bleeding the
            bar's full height, the full club name centred. Default navy when the
            club has no tuned bar. */}
        <h2
          className={`tradedesk__clubbar${barMarkTone(theme?.onBar) === 'dark' ? ' tradedesk__clubbar--darkmark' : ''}`}
          style={theme ? { '--clubbar-fill': theme.bar, '--clubbar-accent': theme.accent, '--clubbar-ink': theme.onBar } : undefined}
        >
          <TeamLogo teamId={teamId} variant="mono" crop="bar" className="tradedesk__clubbarmark" />
          <span>{teamFullName(teamId)}</span>
        </h2>
      {state.loading && !data && <p className="hint" role="status">Reading the {club} roster…</p>}
      {state.error && !data && (
        <EmptyState role="alert"><p>The {club} roster did not load.</p><Button skin="ink" onClick={state.reload}>Try again</Button></EmptyState>
      )}
        {data && (
          <div className="tradedesk__roster">
            <div className="tradedesk__rosterhead infopop-row">
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
        )}
      </Card>
    )
  }
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

        </>
      )}
    </Card>
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
