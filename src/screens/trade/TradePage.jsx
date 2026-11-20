import { useEffect, useMemo, useState } from 'react'
import { loadTradeSide, loadMinorLines, valueTradeSide } from '../../api/trade/side.js'
import { dealSummary, applyRetain, wireSentence } from '../../lib/trade/deal.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { pathOf } from '../../lib/route/table.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { isMlbTeamId, teamAbbr, teamClubName, teamFullName, ALL_MLB_TEAM_IDS } from '../../lib/teams.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { Button } from '../../components/ui/control/Button.jsx'
import { Chips } from '../../components/ui/control/Chips.jsx'
import { TeamFilterStrip } from '../../components/team/TeamFilterStrip.jsx'
import { DepthCard } from './DepthCard.jsx'
import { LineupSheet } from './side/LineupSheet.jsx'
import { PCTS, RetainControl, Wire, Effect } from './DealParts.jsx'
import '../../styles/trade/depth.css'
import '../../styles/trade/sheets.css'
import '../../styles/trade/columns.css'
import '../../styles/trade/roster.css'
import '../../styles/trade/lineup.css'
import '../../styles/trade/stamp.css'
import '../../styles/trade/motion.css'
import { Side } from './side/Side.jsx'
import { IconButton } from '../../components/ui/control/IconButton.jsx'
import { Scoreboard } from './Scoreboard.jsx'
import { dealStory } from './dealStory.js'
import { TradeStory } from './story/TradeStory.jsx'
import { fetchCbPicks } from '../../api/trade/cbPicks.js'
import '../../styles/trade/page.css'


const idOf = (abbr) => ALL_MLB_TEAM_IDS.find((id) => teamAbbr({ id }) === abbr?.toUpperCase()) ?? null // caps-js-exempt: matches a URL key, renders nothing
// The club pickers read A to Z by full name, like every club strip.
const CLUBS_AZ = [...ALL_MLB_TEAM_IDS].sort((x, y) => teamFullName(x).localeCompare(teamFullName(y)))

// The deal lives in the address, so a link rebuilds it:
// /trade-simulator?team=MIL&with=BOS&p=1,2,3&ca=0&cb=2.5&dp=2027-A-33 (cash in $M; dp: draft picks).
function readLink() {
  const q = new URLSearchParams(window.location.search)
  return {
    a: idOf(q.get('team')),
    b: idOf(q.get('with')),
    picked: new Set((q.get('p') || '').split(',').filter(Boolean).map(Number)),
    cashA: Number(q.get('ca')) || 0,
    cashB: Number(q.get('cb')) || 0,
    dp: new Set((q.get('dp') || '').split(',').filter(Boolean)),
  }
}
function writeLink({ a, b, picked, cashA, cashB, dp }) {
  const q = new URLSearchParams()
  if (a) q.set('team', teamAbbr({ id: a }))
  if (b) q.set('with', teamAbbr({ id: b }))
  if (picked.size) q.set('p', [...picked].join(','))
  if (cashA) q.set('ca', String(cashA))
  if (cashB) q.set('cb', String(cashB))
  if (dp.size) q.set('dp', [...dp].join(','))
  const s = q.toString()
  window.history.replaceState(window.history.state, '', `${pathOf('trade')}${s ? `?${s}` : ''}`)
}

// One club's side in two steps: the roster draws as soon as it loads, and each
// player's value (valueTradeSide) fills in when the WAR history arrives.
// Until then the side reads as unvalued: no surplus, no estimated pay.
function useTradeSide(teamId) {
  const roster = useAsync(() => (teamId ? loadTradeSide(teamId) : Promise.resolve(null)), [teamId])
  const valued = useAsync(() => valueTradeSide(roster.data), [roster.data])
  return { ...roster, data: valued.data?.teamId === roster.data?.teamId && valued.data ? valued.data : roster.data }
}

// The trade card (/trade). Pick a partner, add players or cash from each side,
// and the card states what moves: payroll, WAR, years of control, 40-man spots.
// No grade on who wins. Open surface (ADR-0034): rosters and contracts only.
export function TradePage() {
  useDocumentTitle('Trade Simulator')
  const { favoriteTeamId } = useFavoriteTeam()
  const start = useMemo(() => readLink(), [])
  // No club is picked until the reader picks one (a shared link still names both).
  const [a, setA] = useState(start.a ?? null)
  const [b, setB] = useState(start.b && start.b !== start.a ? start.b : null)
  const [picked, setPicked] = useState(start.picked)
  const [cashA, setCashA] = useState(start.cashA)
  const [cashB, setCashB] = useState(start.cashB)
  // Competitive Balance picks in the deal, by key. A pick goes with the club
  // that holds it, so a club switch leaves the other club's keys inert.
  const [dp, setDp] = useState(start.dp)
  const cbPicks = useAsync(() => fetchCbPicks(), [])
  const ownPicks = (id) => (cbPicks.data?.picks ?? []).filter((pk) => pk.teamId === id)
  const sentPicks = (id) => ownPicks(id).filter((pk) => dp.has(pk.key))
  const togglePick = (key) => setDp((s) => {
    const n = new Set(s)
    n.has(key) ? n.delete(key) : n.add(key)
    return n
  })
  const pickProps = (id, other) => ({ draftPicks: ownPicks(id), dp, onTogglePick: togglePick, incomingPicks: other ? sentPicks(other) : [] })
  const [showDepth, setShowDepth] = useState(false)
  const [showLineups, setShowLineups] = useState(false)

  useEffect(() => writeLink({ a, b, picked, cashA, cashB, dp }), [a, b, picked, cashA, cashB, dp])

  const sideA = useTradeSide(a)
  const sideB = useTradeSide(b)
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
        { name: teamClubName(a), fortyCount: sideA.data.fortyCount, sends: sends(sideA.data), draftPicks: sentPicks(a), cashUsd: cashA * 1e6 },
        { name: teamClubName(b), fortyCount: sideB.data.fortyCount, sends: sends(sideB.data), draftPicks: sentPicks(b), cashUsd: cashB * 1e6 },
      )
    : null
  // The deal as the wire prints it, and as a wire story the news story is built on.
  const wireText = deal ? wireSentence(
    { club: teamFullName(a), sends: sends(sideA.data), draftPicks: sentPicks(a), cashUsd: cashA * 1e6 },
    { club: teamFullName(b), sends: sends(sideB.data), draftPicks: sentPicks(b), cashUsd: cashB * 1e6 },
  ) : ''
  const wireStory = deal ? dealStory({ a, b, sendsA: sends(sideA.data), sendsB: sends(sideB.data), picksA: sentPicks(a), picksB: sentPicks(b), cashA, cashB }) : null

  // A club is picked from a picker only while its side is empty, so a pick never drops anyone.
  const switchA = (id) => { setA(id); setPicked((s) => new Set([...s].filter((x) => picks(sideB.data).some((p) => p.id === x)))); setCashA(0) }
  const switchB = (id) => { setB(id); setPicked((s) => new Set([...s].filter((x) => picks(sideA.data).some((p) => p.id === x)))); setCashB(0) }
  const pickA = (id) => { if (id && id !== b) switchA(id) }
  const pickB = (id) => { if (id && id !== a) switchB(id) }
  // Nothing is in the deal yet: the deal cards wait, the rosters lead.
  const started = Boolean(picked.size || dp.size || cashA || cashB)
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
  // Start over: the partner, every player, pick and cash amount, and any
  // retained salary go. The button also clears your club, for a blank desk.
  const dirty = Boolean(a || b || picked.size || dp.size || cashA || cashB)
  const startOver = () => {
    setB(null)
    setPicked(new Set())
    setDp(new Set())
    setCashA(0)
    setCashB(0)
    setRetain({})
    setSidePct({ a: 0, b: 0 })
    setRetainOpen(false)
  }
  // X on your club: the partner (and what it sends) stays in its own column;
  // with no partner yet, the desk empties.
  const clearA = () => {
    if (!b) { startOver(); setA(null); return }
    setPicked((s) => new Set([...s].filter((x) => picks(sideB.data).some((p) => p.id === x))))
    setA(null); setCashA(0); setSidePct((x) => ({ ...x, a: 0 }))
  }
  // Each club bar's X: clears that side only.
  const xButton = (onClick) => <IconButton mark="sm" className="tradedesk__barx" onClick={onClick} label="Change club"><span className="tradedesk__pmglyph tradedesk__pmglyph--x" aria-hidden="true" /></IconButton>
  const changeA = xButton(clearA)
  const changeB = xButton(() => switchB(null))
  const swap = () => { setA(b); setB(a); setCashA(cashB); setCashB(cashA); setSidePct((x) => ({ a: x.b, b: x.a })) }

  return (
    <div className="screen tradedesk">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Trade Simulator</h1>
        {dirty && <Button size="control" skin="ghost" onClick={() => { startOver(); setA(null) }}>Start over</Button>}
      </header>

      <Stack gap="section">
        <div className="tradedesk__sides">
          {!a ? (
            <>
            <Card frame="stamped" label="Your club" className="tradedesk__side">
              <TeamFilterStrip
                chips
                showMlbPin={false}
                teams={CLUBS_AZ.filter((id) => id !== b).map((id) => ({ id, name: teamClubName(id) }))}
                selectedTeamId={null}
                centerTeamId={isMlbTeamId(favoriteTeamId) ? favoriteTeamId : undefined}
                onSelect={pickA}
                ariaLabel="Your club"
                className="tradedesk__partners"
              />
            </Card>
            {/* The partner keeps its own column while your club is unpicked. */}
            {b && ['deal', null, 'roster'].map((part) => (part
              ? <Side key={part} part={part} teamId={b} {...pickProps(b, null)} state={sideB} incoming={[]} incomingTeamId={null} incomingCash={0}
                  partner={null} picked={picked} onToggle={toggle} cash={cashB} onCash={setCashB} change={changeB}
                  farm={farmB.data} requestFarm={() => setWantFarm((w) => ({ ...w, b: true }))} />
              : <div key="gap" aria-hidden="true" />))}
            </>
          ) : b ? (
            <>
              <Side
                part="roster"
                bare={!started}
                teamId={a} {...pickProps(a, b)}
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
                effect={deal && <Effect club={teamClubName(a)} side="a" deal={deal} nextYear={sideA.data.nextYear} />}
                retainUI={retainUI}
                change={changeA}
                farm={farmA.data}
                incomingFarm={farmB.data}
                requestFarm={() => setWantFarm((w) => ({ ...w, a: true }))}
              />
              <Side
                part="roster"
                bare={!started}
                teamId={b} {...pickProps(b, a)}
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
                effect={deal && <Effect club={teamClubName(b)} side="b" deal={deal} nextYear={sideA.data.nextYear} />}
                retainUI={retainUI}
                change={changeB}
                farm={farmB.data}
                incomingFarm={farmA.data}
                requestFarm={() => setWantFarm((w) => ({ ...w, b: true }))}
              />
              {/* The rosters lead; what each club gets follows under its own roster,
                  and the grades ride in the tray at the foot of the screen. */}
              {started && (
              <>
              <Side
                part="deal"
                teamId={a} {...pickProps(a, b)}
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
                effect={deal && <Effect club={teamClubName(a)} side="a" deal={deal} nextYear={sideA.data.nextYear} />}
                retainUI={retainUI}
                change={changeA}
                farm={farmA.data}
                incomingFarm={farmB.data}
                requestFarm={() => setWantFarm((w) => ({ ...w, a: true }))}
              />
              <Side
                part="deal"
                teamId={b} {...pickProps(b, a)}
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
                effect={deal && <Effect club={teamClubName(b)} side="b" deal={deal} nextYear={sideA.data.nextYear} />}
                retainUI={retainUI}
                change={changeB}
                farm={farmB.data}
                incomingFarm={farmA.data}
                requestFarm={() => setWantFarm((w) => ({ ...w, b: true }))}
              />
              </>
              )}
            </>
          ) : (
            <>
              <Side
                part="deal"
                teamId={a} {...pickProps(a, b)}
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
                  teams={CLUBS_AZ.filter((id) => id !== a).map((id) => ({ id, name: teamClubName(id) }))}
                  selectedTeamId={b}
                  onSelect={pickB}
                  ariaLabel="Trade partner"
                  className="tradedesk__partners"
                />
              </Card>
              <Side
                part="roster"
                teamId={a} {...pickProps(a, b)}
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

        {deal && started && (
          <Card frame="stamped" label="The deal" className="tradedesk__moves">
            <Wire text={wireText}>
              {wireStory && (
                <TradeStory a={a} b={b} sendsA={sends(sideA.data)} sendsB={sends(sideB.data)} story={wireStory} deal={deal} nextYear={sideA.data.nextYear} fallback={wireText} />
              )}
            </Wire>
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
        {deal && started && (showDepth
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
      {deal && (
        // The deal at a glance (grades, the meter, who gets how many), pinned to
        // the foot of the screen while the reader picks players.
        <div className="tradedesk__tray">
          <Scoreboard deal={deal} a={a} b={b} sendsA={sends(sideA.data)} sendsB={sends(sideB.data)} cashA={cashA} cashB={cashB} picksA={sentPicks(a).length} picksB={sentPicks(b).length} valued={Boolean(sideA.data?.valued && sideB.data?.valued)} started={started}
            action={started && (
              // A phone's one-row tray shows the glyph alone; the word comes back from 740px.
              <Button size="control" skin="outline" className="tradeboard__lineups" aria-label="Lineups after the deal" onClick={() => setShowLineups(true)}>
                <svg className="tradeboard__lineupsglyph" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M2 3h2M2 8h2M2 13h2M6 3h8M6 8h8M6 13h8" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
                </svg>
                <span className="tradeboard__lineupsword">Lineups</span>
              </Button>
            )} />
        </div>
      )}
      {deal && showLineups && (
        <LineupSheet
          clubs={[
            { teamId: a, data: sideA.data, sends: sends(sideA.data) },
            { teamId: b, data: sideB.data, sends: sends(sideB.data) },
          ]}
          onClose={() => setShowLineups(false)}
        />
      )}
      <ReportFooter />
    </div>
  )
}
